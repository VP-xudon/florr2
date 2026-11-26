// net/client.js — Net 传输接口 + LocalNet（进程内单机）+ WebSocketNet（真联机）
//
// 连接过程分两步，和“准备页”一一对应：
//   connect() —— 只建立传输（WebSocket 握手）。失败时回退 LocalNet（静态托管模式）。
//   join()    —— 真正的入服：Live 服走 {t:'join'} 握手并等 {t:'joined'}；
//                本地回退则此时才创建内嵌 LocalServer（玩家实体在 Ready 之后才生成）。
'use strict';

class Net {
  constructor() {
    this._msgCbs = [];        // 下行消息监听
    this._connected = false;
    this.playerId = null;     // 服务端分配的会话 id（本地实现为 0）
    this.playerName = null;
    this.isLocal = false;
  }
  onMessage(cb) { this._msgCbs.push(cb); }
  // 由具体实现调用：把一条服务端消息投递给所有监听者
  _deliver(msg) { for (const cb of this._msgCbs) cb(msg); }

  // ---- 以下由子类实现 ----
  // opts: { url?, map?, playerTemplate?, name? }
  connect(opts) { this._connected = true; return Promise.resolve({ ok: true, local: false }); }
  join(opts) { return Promise.resolve({ ok: true, id: 0, name: (opts && opts.name) || null }); }

  // 单向消息：不保证回执。所有内容是纯数据（可 JSON 序列化）。
  send(msg) { throw new Error('Net.send 未实现'); }

  // 推进网络：本地实现顺带推进内嵌服务端；远端实现为空操作。
  step(dt) { throw new Error('Net.step 未实现'); }

  // 请求/应答：远端实现必须异步（返回 Promise）。
  // 客户端不得再通过 net.server 之类的引用直接读写权威对象。
  request(kind, payload) { return Promise.reject(new Error('Net.request 未实现')); }

  // 同步直取：只有“与权威同进程”的实现能提供，用于重生这类必须同帧拿到结果的路径。
  // 返回 undefined 表示本实现不支持，调用方必须回退到 request()。
  requestSync(kind, payload) { return undefined; }

  close() { this._connected = false; }
}

// ---------------- 进程内本地实现（python -m http.server 的静态测试模式） ----------------
// 特点：服务端与客户端在同页、同步执行，因此“网络延迟”为 0；
// 但依旧严格走上行/下行两条路，边界与真服务器一致。
class LocalNet extends Net {
  constructor() {
    super();
    this._server = new LocalServer();
    this._opts = null;
    this.isLocal = true;
  }

  connect(opts) {
    super.connect(opts);
    // 只记下参数：世界要等 Ready（join）之后才创建，Loading 阶段不跑任何模拟。
    this._opts = opts || null;
    return Promise.resolve({ ok: true, local: true });
  }

  join(opts) {
    const o = opts || this._opts || {};
    if (o.map) this._server.attach(o.map, o.playerTemplate);
    this._snapAcc = 0;
    this._simClock = 0;
    this._lastSnapClock = 0;
    this._server.start();
    this.playerId = 0;
    this.playerName = (o.playerTemplate && o.playerTemplate.name) || null;
    return Promise.resolve({ ok: true, local: true, id: 0, name: this.playerName });
  }

  // 上行：输入意图（每帧调用，内容为纯数据，可 JSON 序列化）
  // 装备变化也走这条路（消息类型 'loadout'）：客户端从不直接改服务端的 slots
  send(msg) {
    if (!this._server || !this._server.map) return;
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

  // 调试专用：读取权威世界内部状态。业务代码请走 request / 快照。
  get debugServer() { return this._server; }

  // 由客户端主循环驱动：本地实现零延迟，每步推进服务端。
  // 快照按 SNAP_HZ 下发而不是每个模拟步都发：一帧最多补 3 步，
  // 逐步发全量快照会造成大量对象分配。客户端用插值缓冲（_snapDt / px->tx blend）补齐间隔。
  step(dt) {
    if (!this._connected || !this._server.map) return;
    this._server.step(dt);
    this._snapAcc = (this._snapAcc || 0) + dt;
    this._simClock = (this._simClock || 0) + dt;
    if (this._snapAcc + 1e-9 >= SNAP_DT) {
      // span = 与上一份快照的真实间隔（含累加器余量），供客户端插值使用
      const span = this._simClock - (this._lastSnapClock || 0);
      this._lastSnapClock = this._simClock;
      this._snapAcc -= SNAP_DT;   // 保留余量（可为负），长期平均频率等于 SNAP_HZ
      this._deliver({ t: 'snap', snap: this._server.snapshot(span) });
    }
    // 服务端在 step 中产生的事件（聊天/伤害飘字/击杀）每步都投递，不受快照节流影响
    const evs = this._server.drainEvents();
    for (let i = 0; i < evs.length; i++) this._deliver({ t: 'evt', ev: evs[i] });
  }
}

// ---------------- 远端实现（node server.js） ----------------
// 协议：上行 { t:'join'|'input'|'loadout'|'chat'|'respawn'|'req', ... }
//       下行 { t:'joined'|'snap'|'evt'|'ack', ... }（evt 可批量：{ t:'evt', evs:[...] }）
// 连不上（python -m http.server / 纯静态托管）时自动回退 LocalNet。
class WebSocketNet extends Net {
  constructor(url) {
    super();
    this.url = url;
    this._ws = null;
    this._pending = new Map();
    this._nextId = 1;
    this._fallback = null;
    this._opts = null;
    this._joinWaiters = null;
    this._connectWaiters = null;
  }

  connect(opts) {
    super.connect(opts);
    this._opts = opts || null;
    return new Promise((resolve) => {
      let settled = false;
      const done = (ok, local) => { if (!settled) { settled = true; resolve({ ok, local: !!local }); } };
      let ws;
      try { ws = new WebSocket(this.url); }
      catch (e) { this._fallbackToLocal(); done(true, true); return; }
      const timer = setTimeout(() => {
        try { ws.close(); } catch (e) { /* ignore */ }
        this._fallbackToLocal();
        done(true, true);
      }, 4000);
      ws.onopen = () => {
        clearTimeout(timer);
        this._ws = ws;
        done(true, false);
      };
      ws.onerror = () => {
        clearTimeout(timer);
        if (!this._ws) { this._fallbackToLocal(); done(true, true); }
      };
      ws.onclose = () => {
        clearTimeout(timer);
        const wasOpen = !!this._ws;
        this._ws = null;
        this._connected = false;
        if (!wasOpen) { this._fallbackToLocal(); done(true, true); }
        const waiters = this._joinWaiters || [];
        this._joinWaiters = null;
        for (const w of waiters) w({ ok: false });
        for (const [, p] of this._pending) p.reject(new Error('连接已关闭'));
        this._pending.clear();
      };
      ws.onmessage = (e) => this._onWsMessage(e);
    });
  }

  _onWsMessage(e) {
    let msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'joined') {
      this.playerId = msg.id;
      this.playerName = msg.name;
      this._connected = true;
      const waiters = this._joinWaiters || [];
      this._joinWaiters = null;
      for (const w of waiters) w({ ok: true, id: msg.id, name: msg.name, players: msg.players });
      return;
    }
    if (msg.t === 'ack') {
      const p = this._pending.get(msg.id);
      if (!p) return;
      this._pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.value); else p.reject(new Error(msg.error || 'request failed'));
      return;
    }
    if (msg.t === 'evt' && Array.isArray(msg.evs)) {
      for (const ev of msg.evs) this._deliver({ t: 'evt', ev });
      return;
    }
    this._deliver(msg);
  }

  _fallbackToLocal() {
    if (this._fallback) return;
    this._fallback = new LocalNet();
    this._fallback.onMessage((msg) => this._deliver(msg));
    this._fallback.connect(this._opts);
    this.isLocal = true;
    this._connected = true;
  }

  join(opts) {
    const o = opts || this._opts || {};
    if (this._fallback) return this._fallback.join(o);
    if (!this._ws || this._ws.readyState !== 1) {
      this._fallbackToLocal();
      return this._fallback.join(o);
    }
    const tpl = o.playerTemplate || {};
    return new Promise((resolve) => {
      const waiters = this._joinWaiters || (this._joinWaiters = []);
      let settled = false;
      const finish = (r) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (r && r.ok) resolve(r);
        else {
          // 服务端在握手阶段断开：退回本地模拟，保证静态托管仍能玩
          this._fallbackToLocal();
          resolve(this._fallback.join(o));
        }
      };
      waiters.push(finish);
      const timer = setTimeout(() => finish({ ok: false }), 4000);
      this._ws.send(JSON.stringify({
        t: 'join',
        name: tpl.name || null,
        maxHp: Number.isFinite(tpl.maxHp) ? tpl.maxHp : undefined,
        hp: Number.isFinite(tpl.hp) ? tpl.hp : undefined,
      }));
    });
  }

  send(msg) {
    if (this._fallback) return this._fallback.send(msg);
    if (!this._ws || this._ws.readyState !== 1) return;
    // 装备上行只带 key/rarity：完整卡对象里有整份 type（几百字节 × 槽位），
    // 每帧发一次会让上行带宽直接失控。服务端按 PETAL_TYPES 还原。
    if (msg && msg.t === 'loadout' && Array.isArray(msg.slots)) {
      msg = {
        t: 'loadout',
        hold: msg.hold,
        slots: msg.slots.map((c) => (c && c.type) ? { key: c.type.key, rarity: c.rarity } : null),
      };
    }
    this._ws.send(JSON.stringify(msg));
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

  requestSync(kind, payload) {
    return this._fallback ? this._fallback.requestSync(kind, payload) : undefined;
  }

  step(dt) { if (this._fallback) this._fallback.step(dt); }

  close() {
    if (this._fallback) this._fallback.close();
    if (this._ws) { try { this._ws.close(); } catch (e) { /* ignore */ } }
    this._ws = null;
    super.close();
  }
}
