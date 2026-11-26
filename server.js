// server.js — florr2 联机服务端（零依赖）
//
// 用法：
//   node server.js            # 默认 http://localhost:8080/
//   node server.js 9000       # 指定端口
//   node server.js --port 9000 --host 0.0.0.0
//
// 它同时做两件事：
//   ① 静态文件服务：与 python -m http.server 完全一样地托管本目录（浏览器直接打开根路径即可）；
//   ② 权威模拟 + WebSocket：把 js/net/server.js 的 LocalServer 放进 Node 里跑，
//      每个连接 = 一个会话（一个玩家），共享同一张地图 / 同一批生物 / 同一份聊天。
//
// 仍然保留纯静态模式：用 python -m http.server 打开时连不上 WebSocket，
// 客户端会自动回退到进程内 LocalNet（单机模拟，行为与以前一致）。
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = __dirname;
const SNAP_DT = 0.04;          // 25Hz 快照（与 sim/constants.js 的 SNAP_HZ 同频）
const STEP_DT = 1 / 60;        // 权威模拟步长
const TICK_MS = 16;
const MAX_PLAYERS = 32;

// ---------------- 命令行 ----------------
function parseArgs(argv) {
  let port = 8080;
  let host = '0.0.0.0';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' || a === '-p') port = parseInt(argv[++i], 10);
    else if (a === '--host') host = argv[++i];
    else if (/^\d+$/.test(a)) port = parseInt(a, 10);
  }
  return { port: Number.isFinite(port) ? port : 8080, host: host || '0.0.0.0' };
}

// ---------------- 静态文件 ----------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.tmj': 'application/json; charset=utf-8',
  '.tsj': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.crb': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

function serveStatic(req, res) {
  let p;
  try {
    p = decodeURIComponent(String(req.url || '/').split('?')[0].split('#')[0]);
  } catch (e) {
    res.writeHead(400); res.end('Bad Request'); return;
  }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^([/\\])+/, ''));
  // 目录穿越防护：解析后的路径必须仍在项目根目录里
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

// ---------------- 沙箱：把浏览器模拟模块装进 Node ----------------
const noop = () => {};

function makeFakeCtx() {
  return new Proxy({}, {
    get(t, k) {
      if (k === 'canvas') return { width: 0, height: 0 };
      if (k === 'measureText') return () => ({ width: 0 });
      if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop });
      if (k === 'createPattern') return () => null;
      if (k in t) return t[k];
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function makeFakeCanvas() {
  return { width: 0, height: 0, style: {}, getContext: () => makeFakeCtx(), toDataURL: () => 'data:,' };
}

function buildSandbox() {
  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval, setImmediate,
    performance,
    Math, Date, JSON, Promise, Map, Set, WeakMap, WeakSet, Symbol, Reflect, Proxy,
    Object, Array, Number, String, Boolean, Error, TypeError, RangeError,
    Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
    Float32Array, Float64Array, ArrayBuffer, DataView,
    isFinite, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, escape, unescape,
    URL, URLSearchParams, TextEncoder, TextDecoder,
    DecompressionStream, Blob, Response, ReadableStream, AbortController,
    atob: (s) => Buffer.from(String(s), 'base64').toString('binary'),
    btoa: (s) => Buffer.from(String(s), 'binary').toString('base64'),
    structuredClone,
    queueMicrotask,
    requestAnimationFrame: (fn) => setTimeout(() => fn(performance.now()), 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.navigator = { userAgent: 'florr2-node-server' };
  sandbox.devicePixelRatio = 1;
  sandbox.location = { href: 'http://localhost/', search: '', protocol: 'http:', host: 'localhost' };
  sandbox.document = {
    baseURI: 'http://localhost/',
    cookie: '',
    readyState: 'complete',
    createElement: (tag) => (tag === 'canvas' ? makeFakeCanvas()
      : { style: {}, appendChild: noop, removeChild: noop, setAttribute: noop, classList: { add: noop, remove: noop } }),
    createElementNS: () => ({ style: {}, appendChild: noop, setAttribute: noop, querySelectorAll: () => [] }),
    getElementById: () => null,
    querySelector: () => null,
    body: { appendChild: noop, removeChild: noop },
    documentElement: { style: {} },
    addEventListener: noop,
    fonts: { load: () => Promise.resolve(), ready: Promise.resolve() },
    importNode: (x) => x,
  };
  class FakeImage {
    constructor() { this.naturalWidth = 0; this.naturalHeight = 0; this.width = 0; this.height = 0; this.complete = false; }
    set src(v) { this._src = v; }
    get src() { return this._src; }
    decode() { return Promise.resolve(); }
    addEventListener() {}
  }
  sandbox.Image = FakeImage;

  // fetch：http://localhost/xxx -> 项目目录里的文件（地图 / .crb / SVG 全走这一条）
  sandbox.fetch = function (input) {
    const raw = String(input && input.url ? input.url : input);
    const noQuery = raw.split('#')[0].split('?')[0];
    const rel = noQuery.replace(/^[a-z]+:\/\/[^/]+\//i, '').replace(/^\/+/, '');
    const file = path.join(ROOT, decodeURIComponent(rel));
    return fs.promises.readFile(file).then((buf) => ({
      ok: true,
      status: 200,
      url: raw,
      text: async () => buf.toString('utf8'),
      json: async () => JSON.parse(buf.toString('utf8')),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      headers: { get: () => null },
    })).catch(() => ({ ok: false, status: 404, url: raw, text: async () => '', json: async () => ({}) }));
  };
  return sandbox;
}

// 服务端不画图，只需要这些浏览器模块的接口存在、且“素材不可用”（走 .crb 预制碰撞箱）。
const STUB_SRC = `
var SpriteStore = {
  images: {}, sources: {},
  ready: function () { return false; },
  get: function () { return null; },
  getImage: function () { return null; },
  load: function () { return Promise.resolve(null); },
  loadAll: function () { return Promise.resolve(); },
  contour: function () { return null; },
  mobPivot: function () { return { x: 0, y: 0 }; },
  _cropRatio: function () { return null; },
  canvasFlip: function () { return null; },
  artCanvas: function () { return null; },
  prewarmMobs: function () { return Promise.resolve(); },
};
var CardRenderer = {
  FONT: 'Ubuntu',
  lightSubCount: function (type, rarity) {
    if (!type) return 1;
    var n = (type.entityCount && type.entityCount[rarity]) || type.subCount || 1;
    return n || 1;
  },
  entityFormationLayout: function () { return null; },
  multiLayout: function () { return null; },
  lightDRatio: function () { return 1; },
  entityArtSize: function () { return 24; },
  entityWindow: function () { return null; },
  artImage: function () { return null; },
  artCanvas: function () { return null; },
  redArtCanvas: function () { return null; },
  contentBox: function () { return null; },
  renderCardTo: function () {},
  prewarm: function () { return Promise.resolve(); },
  repaintAll: function () {},
};
var SpiderGait = {
  ensure: function () { return Promise.resolve(); },
  ready: function () { return false; },
  bodyUrl: function () { return null; },
  legs: function () { return null; },
  prewarm: function () { return Promise.resolve(); },
};
var AntArt = {
  prewarm: function () { return Promise.resolve(); },
  draw: function () {},
  of: function () { return null; },
  ready: function () { return false; },
  ensure: function () {},
  drawOver: function () {},
};
// assets.js 里的凸包（mob.js 的轮廓提取要用，服务端不加载 assets.js）
function convexHull(points) {
  const pts = points.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}
`;

// 按 index.html 的脚本顺序取模拟需要的模块（跳过纯客户端模块）。
// map.js 必须在 sim/constants.js 之前：constants 里的 MOB_WALK_LIMIT_R 读 GARDEN_TILE。
const WORLD_SCRIPTS = [
  'assets/registry.js',
  'js/util.js',
  'assets/i18n/en_US/en_US.js',
  'js/lang.js',
  'assets/mob-shapes.js',
  'js/data.js',
  'js/map.js',
  'js/sim/constants.js',
  'js/sim/exit.js',
  'js/sim/status.js',
  'js/sim/physics.js',
  'js/sim/crb.js',
  'js/ai.js',
  'js/petal-effects.js',
  'js/mob-fx.js',
  'js/sim/mob-shape.js',
  'js/sim/player.js',
  'js/sim/mob.js',
  'js/net/protocol.js',
  'js/net/server.js',
];

function loadWorld() {
  const sandbox = buildSandbox();
  const ctx = vm.createContext(sandbox);
  vm.runInContext(STUB_SRC, ctx, { filename: 'browser-stubs.js' });
  let src = '';
  for (const f of WORLD_SCRIPTS) {
    src += '\n// ===== ' + f + ' =====\n' + fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n';
  }
  vm.runInContext(src, ctx, { filename: 'florr2-world.js' });
  return { ctx, sandbox };
}

// ---------------- WebSocket（RFC 6455，手写，无依赖） ----------------
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsAccept(key) {
  return crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
}

function wsFrame(opcode, payload) {
  const len = payload.length;
  let head;
  if (len < 126) {
    head = Buffer.allocUnsafe(2);
    head[1] = len;
  } else if (len < 65536) {
    head = Buffer.allocUnsafe(4);
    head[1] = 126;
    head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.allocUnsafe(10);
    head[1] = 127;
    head.writeUInt32BE(0, 2);
    head.writeUInt32BE(len, 6);
  }
  head[0] = 0x80 | opcode;
  return Buffer.concat([head, payload]);
}

class WSConn {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.frag = null;
    this.fragOp = 0;
    this.closed = false;
    this.onmessage = null;
    this.onclose = null;
    socket.setNoDelay(true);
    socket.on('data', (d) => this._onData(d));
    socket.on('close', () => this._closed());
    socket.on('error', () => this._closed());
  }
  _closed() {
    if (this.closed) return;
    this.closed = true;
    if (this.onclose) this.onclose();
  }
  _onData(chunk) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) return;
        const hi = this.buf.readUInt32BE(2), lo = this.buf.readUInt32BE(6);
        if (hi > 0) { this.close(1009, 'too large'); return; }
        len = lo;
        off = 10;
      }
      if (len > 2 * 1024 * 1024) { this.close(1009, 'too large'); return; }
      let mask = null;
      if (masked) {
        if (this.buf.length < off + 4) return;
        mask = this.buf.subarray(off, off + 4);
        off += 4;
      }
      if (this.buf.length < off + len) return;
      let payload = Buffer.from(this.buf.subarray(off, off + len));
      this.buf = this.buf.subarray(off + len);
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];

      if (opcode === 0x8) { this.close(1000, ''); return; }
      if (opcode === 0x9) { this._sendRaw(0xA, payload); continue; }
      if (opcode === 0xA) continue;
      if (opcode === 0x0) {
        if (this.frag) this.frag = Buffer.concat([this.frag, payload]);
        if (fin && this.frag) {
          const whole = this.frag; this.frag = null;
          if (this.fragOp === 0x1) this._emit(whole.toString('utf8'));
        }
        continue;
      }
      if (opcode === 0x1 || opcode === 0x2) {
        if (!fin) { this.frag = payload; this.fragOp = opcode; continue; }
        if (opcode === 0x1) this._emit(payload.toString('utf8'));
      }
    }
  }
  _emit(text) {
    if (!this.onmessage) return;
    try { this.onmessage(text); } catch (e) { console.error('[ws] 消息处理失败：', e && e.stack || e); }
  }
  _sendRaw(opcode, payload) {
    if (this.closed || this.socket.destroyed) return;
    try { this.socket.write(wsFrame(opcode, payload)); } catch (e) { /* 对端已断开 */ }
  }
  send(obj) {
    this._sendRaw(0x1, Buffer.from(JSON.stringify(obj), 'utf8'));
  }
  close(code, reason) {
    if (this.closed) return;
    const payload = Buffer.allocUnsafe(2 + Buffer.byteLength(reason || ''));
    payload.writeUInt16BE(code || 1000, 0);
    if (reason) payload.write(reason, 2);
    this._sendRaw(0x8, payload);
    this.closed = true;
    if (this.onclose) this.onclose();
    try { this.socket.end(); } catch (e) { /* ignore */ }
  }
}

// ---------------- 启动 ----------------
async function main() {
  const { port, host } = parseArgs(process.argv.slice(2));
  console.log('[server] 加载世界模块…');
  const { ctx, sandbox } = loadWorld();
  const garden = await vm.runInContext('loadGardenData()', ctx);
  sandbox.__garden = garden;
  const map = vm.runInContext('createGardenMap(__garden)', ctx);
  await vm.runInContext('CRB.loadAll()', ctx);
  vm.runInContext('window.__srv = new LocalServer()', ctx);
  const srv = vm.runInContext('window.__srv', ctx);
  srv.attach(map, null);
  // 预生成世界：首次入服会同步铺满全图（1~2s+），放在启动阶段做，
  // 否则第一个玩家会卡在“Connecting”上，甚至被客户端 4s 握手超时误判成连不上。
  srv.addSession(0, { name: 'world-init' });
  srv.removeSession(0);
  console.log('[server] 世界就绪：' + (map.name || 'map') + '，' + (map.spawnZones || []).length + ' 个生成区');

  const server = http.createServer(serveStatic);

  // 每个 WebSocket 连接 = 一个会话（一个玩家）
  const clients = new Map();      // conn -> { id, session }
  let nextSessId = 1;

  // 上行装备只带 key/rarity：既接受完整卡（带 type 的本地对象），
  // 也接受客户端 WebSocketNet.send 已经瘦身过的 { key, rarity } ——
  // 只认 c.type 会把后者的所有槽位变成 null（服务端玩家没花瓣 -> 不结算伤害）。
  function slimSlots(slots) {
    if (!Array.isArray(slots)) return slots;
    return slots.map((c) => {
      if (!c) return null;
      const key = (c.type && c.type.key) || c.key;
      return key ? { key, rarity: c.rarity, lunge: c.lunge || 0 } : null;
    });
  }

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    if (clients.size >= MAX_PLAYERS) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + wsAccept(String(key)) + '\r\n' +
      '\r\n'
    );
    const conn = new WSConn(socket);
    const state = { id: null, session: null };
    clients.set(conn, state);

    conn.onclose = () => {
      clients.delete(conn);
      if (state.id != null) {
        srv.removeSession(state.id);
        console.log('[server] 玩家离开 #' + state.id + '（在线 ' + clients.size + '）');
      }
    };

    conn.onmessage = (text) => {
      let msg;
      try { msg = JSON.parse(text); } catch (e) { return; }
      if (!msg || typeof msg !== 'object') return;
      const t = msg.t;

      if (t === 'join') {
        if (state.id != null) return;      // 一个连接只加入一次
        const name = (msg.name && String(msg.name).slice(0, 24)) || null;
        const tpl = {
          name: name || ('Guest #' + (1000 + Math.floor(Math.random() * 9000))),
          maxHp: Number.isFinite(msg.maxHp) ? Math.min(msg.maxHp, 1e7) : undefined,
          hp: Number.isFinite(msg.hp) ? Math.min(msg.hp, 1e7) : undefined,
        };
        const sess = srv.addSession(nextSessId++, tpl);
        state.id = sess.id;
        state.session = sess;
        conn.send({
          t: 'joined',
          id: sess.id,
          name: sess.name,
          players: srv.players.map((p) => ({ id: p.sess ? p.sess.id : null, name: p.name })),
        });
        console.log('[server] 玩家加入 #' + sess.id + ' ' + sess.name + '（在线 ' + clients.size + '）');
        return;
      }

      if (state.id == null) return;
      const sid = state.id;
      switch (t) {
        case 'input':
          srv.applyInput(msg.input, sid);
          break;
        case 'loadout':
          srv.syncLoadout(slimSlots(msg.slots), msg.hold, sid);
          break;
        case 'chat':
          srv.sendChat(msg.channel, msg.text, sid);
          break;
        case 'respawn':
          srv.requestRespawn(sid);
          break;
        case 'req': {
          let ok = true, value = null, error = null;
          try { value = srv.handleRequest(msg.kind, msg.payload, sid); }
          catch (e) { ok = false; error = String((e && e.message) || e); }
          conn.send({ t: 'ack', id: msg.id, ok, value, error });
          break;
        }
        default:
          break;
      }
    };
  });

  // 权威模拟 60Hz + 快照 25Hz
  let last = performance.now();
  let acc = 0;
  let snapAcc = 0;
  let simClock = 0;
  setInterval(() => {
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.25);
    acc += dt;
    let steps = 0;
    while (acc + 1e-9 >= STEP_DT && steps < 3) {
      srv.step(STEP_DT);
      acc -= STEP_DT;
      simClock += STEP_DT;
      steps++;
    }
    if (steps === 3) acc = 0;   // 补步上限：多余时间丢弃（与客户端同一条规则）

    snapAcc += dt;
    if (snapAcc + 1e-9 >= SNAP_DT) {
      const span = snapAcc;
      snapAcc = 0;
      for (const [conn, st] of clients) {
        if (st.id == null || conn.closed) continue;
        try {
          const snap = srv.snapshot(span, st.id);
          compactSnapshot(snap, srv, st.id);
          conn.send({ t: 'snap', snap });
          const evs = srv.drainEvents(st.id);
          if (evs.length) conn.send({ t: 'evt', evs });
        } catch (e) {
          console.error('[server] 快照失败 #' + st.id + '：', e && e.stack || e);
        }
      }
    }
  }, TICK_MS);

  server.listen(port, host, () => {
    console.log('[server] 服务已启动： http://localhost:' + port + '/');
    console.log('[server] 联机 WebSocket： ws://localhost:' + port + '/ws');
    console.log('[server] 纯静态模式仍然可用： python -m http.server 8080');
  });
}

// 快照瘦身：近处生物发完整对象，远处只发 [id, typeId, rarity, level, x, y]。
// 客户端 _applySnap 对远处个体本来也只用这几个字段（小地图），
// 不压缩的话全图 2000+ 只 × 20 个键 = 每份快照 700KB+，25Hz 直接打爆带宽。
function compactSnapshot(snap, srv, sessId) {
  const sess = srv.session(sessId);
  const p = sess && sess.player;
  if (!p) return snap;
  const R = Math.max(1400, (sess.viewR || 2200) + 700);
  const R2 = R * R;
  const near = [];
  const far = [];
  for (const e of snap.ents) {
    const dx = e.x - p.x, dy = e.y - p.y;
    if (e.rarity === 'super' || e.rarity === 'eternal' || dx * dx + dy * dy <= R2) near.push(e);
    else far.push([e.id, e.typeId, e.rarity, e.level, Math.round(e.x), Math.round(e.y)]);
  }
  snap.ents = near;
  snap.far = far;
  return snap;
}

main().catch((e) => {
  console.error('[server] 启动失败：', e && e.stack || e);
  process.exit(1);
});
