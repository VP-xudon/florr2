// 常驻测试客户端（开发用）：join 后保持连接并缓慢移动，用来验证“其它玩家可见”。
'use strict';
const URL = process.argv[2] || 'ws://localhost:8090/ws';
const NAME = process.argv[3] || 'Bot';
const ws = new WebSocket(URL);
let t = 0;
ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name: NAME, maxHp: 1000, hp: 1000 }));
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.t === 'joined') console.log('bot joined', msg.id, msg.name);
};
setInterval(() => {
  if (ws.readyState !== 1) return;
  t += 0.05;
  ws.send(JSON.stringify({ t: 'input', input: { dx: Math.cos(t), dy: Math.sin(t), mode: 'normal', viewR: 900 } }));
}, 50);
setTimeout(() => { try { ws.close(); } catch (e) {} process.exit(0); }, 45000);
