// net/client.js — Net 传输接口 + LocalNet 进程内实现
// 远端实现（WebSocketNet）只需实现同一组方法，客户端代码无需改动。
'use strict';

class Net {
  constructor() {
    this._msgCbs = [];        // 下行消息监听
    this._connected = false;
  }
  onMessage(cb) { this._msgCbs.push(cb); }
  // 由具体实现调用：把一条服务端消息投递给所有监听者
  _deliver(msg) { for (const cb of this._msgCbs) cb(msg); }

  // ---- 以下由子类实现 ----
  // opts: { url?, map?, playerTemplate? }；本地实现用后两项完成世界初始化
  connect(opts) { this._connected = true; }

  // 单向消息：不保证回执。所有内容是纯数据（可 JSON 序列化）。
  send(msg) { throw new Error('Net.send 未实现'); }

  // 推进网络：本地实现顺带推进内嵌服务端；远端实现为空操作。
  step(dt) { throw new Error('Net.step 未实现'); }

  // 请求/应答：远端实现必须异步（返回 Promise）。
  // 客户端不得再通过 net.server 之类的引用直接读写权威对象。
  request(kind, payload) { return Promise.reject(new Error('Net.request 未实现')); }

  // 同步直取：只有"与权威同进程"的实现能提供，用于重生这类必须同帧拿到结果的路径。
  // 返回 undefined 表示本实现不支持，调用方必须回退到 request()。
  requestSync(kind, payload) { return undefined; }

  close() { this._connected = false; }
}

// ---------------- 进程内本地实现 ----------------
// 特点：服务端与客户端在同页、同步执行，因此"网络延迟"为 0；
// 但依旧严格走上行/下行两条路，边界与真服务器一致。
class LocalNet extends Net {
  constructor() {
    super();
    // 权威世界归服务端所有：外部只能通过消息 / request 访问，不再直接持有引用
    this._server = new LocalServer();
  }

  connect(opts) {
    super.connect(opts);
    if (opts && opts.map) this._server.attach(opts.map, opts.playerTemplate);
    this._server.start();
  }

  // 上行：输入意图（每帧调用，内容为纯数据，可 JSON 序列化）
  // 装备变化也走这条路（消息类型 'loadout'）：客户端从不直接改服务端的 slots
  send(msg) {
    if (!this._connected) return;
    if (msg && msg.t === 'input') this._server.applyInput(msg.input);
    else if (msg && msg.t === 'loadout') this._server.syncLoadout(msg.slots, msg.hold);
    else if (msg && msg.t === 'chat') this._server.sendChat(msg.channel, msg.text);
    else if (msg && msg.t === 'respawn') this._server.requestRespawn();

  }

  // 便捷封装：输入意图（等价于 send({ t:'input', input })）
  sendInput(input) { this.send({ t: 'input', input }); }

  request(kind, payload) {
    try { return Promise.resolve(this._server.handleRequest(kind, payload)); }
    catch (e) { return Promise.reject(e); }
  }

  // 与权威同进程，可以同步拿结果（重生点等）
  requestSync(kind, payload) { return this._server.handleRequest(kind, payload); }

  // 调试 / 自测专用：读取权威世界内部状态。业务代码请走 request / 快照。
  get debugServer() { return this._server; }

  // 由客户端主循环驱动：本地实现零延迟，因此每帧都推进并投递一份快照
  // （生物移动仍是帧率级，手感与现在完全一致；战斗在服务端内部按 25Hz 固定步长结算）。
  // 若换成低频真服务器，客户端侧的插值缓冲会自动生效（见 Game._applySnap）。
  step(dt) {
    if (!this._connected) return;
    this._server.step(dt);
    this._deliver({ t: 'snap', snap: this._server.snapshot(dt) });
    // 服务端在 step 中产生的事件（聊天/系统私信）此时才投递，保证顺序在快照之后
    for (const ev of this._server.drainEvents()) this._deliver({ t: 'evt', ev });
  }
}

// ---------------- 远端实现骨架 ----------------
// 有 Node 服务端时把下面这份打开即可（连接失败自动回退 LocalNet）。
// 协议：上行 { t, ... }；下行 { t:'snap'|'evt', ... }；请求应答 { t:'ack', id, ok, value, error }。
class WebSocketNet extends Net {
  constructor(url) {
    super();
    this.url = url;
    this._ws = null;
    this._pending = new Map();
    this._nextId = 1;
    this._fallback = null;
  }

  connect(opts) {
    super.connect(opts);
    return new Promise((resolve) => {
      let settled = false;
      const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { done(false); return; }
      const timer = setTimeout(() => { try { ws.close(); } catch (e) {} done(false); }, 3000);
      ws.onopen = () => {
        clearTimeout(timer);
        this._ws = ws;
        done(true);
      };
      ws.onerror = () => { clearTimeout(timer); done(false); };
      ws.onclose = () => {
        this._connected = false;
        for (const [, p] of this._pending) p.reject(new Error('连接已关闭'));
        this._pending.clear();
      };
      ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch (err) { return; }
        if (msg && msg.t === 'ack') {
          const p = this._pending.get(msg.id);
          if (!p) return;
          this._pending.delete(msg.id);
          if (msg.ok) p.resolve(msg.value); else p.reject(new Error(msg.error || 'request failed'));
          return;
        }
        this._deliver(msg);
      };
    }).then((ok) => {
      if (!ok) {
        // 连不上就用本地世界兜底，保证单机始终可玩
        this._fallback = new LocalNet();
        return this._fallback.connect(opts).then(() => false);
      }
      return true;
    });
  }

  send(msg) {
    if (this._fallback) return this._fallback.send(msg);
    if (this._ws && this._ws.readyState === 1) this._ws.send(JSON.stringify(msg));
  }

  sendInput(input) { this.send({ t: 'input', input }); }

  request(kind, payload) {
    if (this._fallback) return this._fallback.request(kind, payload);
    const id = this._nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error('request timeout: ' + kind));
      }, 5000);
      this._pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); }
      });
      this.send({ t: 'req', id, kind, payload });
    });
  }

  requestSync() { return undefined; }   // 远端必然异步

  step(dt) { if (this._fallback) this._fallback.step(dt); }   // 远端：什么都不做

  close() {
    if (this._fallback) this._fallback.close();
    if (this._ws) { try { this._ws.close(); } catch (e) {} }
    super.close();
  }
}
