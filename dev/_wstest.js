// 联机冒烟测试（开发用）：两个客户端 join，检查快照/事件/背包/聊天/玩家可见性
'use strict';
const URL = process.argv[2] || 'ws://localhost:8090/ws';

function client(name) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const state = { name, snaps: 0, evts: 0, joined: null, lastSnap: null, ack: null, ws };
    const timer = setTimeout(() => reject(new Error('timeout join ' + name)), 8000);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name, maxHp: 1000, hp: 1000 }));
    ws.onerror = (e) => { clearTimeout(timer); reject(new Error('ws error ' + (e && e.message))); };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.t === 'joined') {
        clearTimeout(timer);
        state.joined = msg;
        resolve(state);
      } else if (msg.t === 'snap') {
        state.snaps++;
        state.lastSnap = msg.snap;
        state.bytes = (state.bytes || 0) + e.data.length;
      } else if (msg.t === 'evt') {
        state.evts += msg.evs.length;
        (state.evLog || (state.evLog = [])).push(...msg.evs.slice(0, 5));
      } else if (msg.t === 'ack') {
        state.ack = msg;
      }
    };
  });
}

(async () => {
  const a = await client('Tester-A');
  console.log('A joined', JSON.stringify(a.joined));
  const b = await client('Tester-B');
  console.log('B joined', JSON.stringify(b.joined));

  // 输入 + 装备上行
  a.ws.send(JSON.stringify({ t: 'input', input: { dx: 1, dy: 0, mode: 'normal', viewR: 900 } }));
  b.ws.send(JSON.stringify({ t: 'input', input: { dx: -1, dy: 0, mode: 'reach', viewR: 900 } }));
  a.ws.send(JSON.stringify({ t: 'loadout', slots: [{ key: 'basic', rarity: 'common' }, null, null, null, null], hold: [] }));

  // 聊天
  a.ws.send(JSON.stringify({ t: 'chat', channel: 'local', text: 'hello multiplayer' }));

  // 背包请求
  a.ws.send(JSON.stringify({ t: 'req', id: 1, kind: 'inv', payload: { op: 'get' } }));
  a.ws.send(JSON.stringify({ t: 'req', id: 2, kind: 'player', payload: {} }));
  a.ws.send(JSON.stringify({ t: 'req', id: 3, kind: 'players', payload: {} }));

  await new Promise((r) => setTimeout(r, 2500));

  const s = a.lastSnap;
  console.log('A snaps', a.snaps, 'avg snapshot bytes', Math.round((a.bytes || 0) / Math.max(1, a.snaps)));
  console.log('A detach ack', JSON.stringify(a.ack));
  console.log('snap keys', s && Object.keys(s).join(','));
  console.log('ents near', s && s.ents.length, 'far', s && s.far && s.far.length, 'players', s && s.players && s.players.length);
  console.log('remote player sample', JSON.stringify(s && s.players && s.players[0]).slice(0, 260));
  console.log('own petals', s && s.petals.length, 'own player', JSON.stringify(s && s.player));
  console.log('B snaps', b.snaps, 'B players', b.lastSnap && b.lastSnap.players && b.lastSnap.players.length);
  console.log('A events', a.evts, 'B events', b.evts);
  console.log('A chat ev', JSON.stringify((a.evLog || []).filter((e) => e.kind === 'chat' || e.kind === 'sys').slice(0, 3)));
  a.ws.close(); b.ws.close();
  process.exit(0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
