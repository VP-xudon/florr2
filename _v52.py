# -*- coding: utf-8 -*-
"""b52 验证：Soldier Ant 朝向补偿、召唤物硬碰撞、接触伤害、玩家硬碰撞。"""
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, 'dev'))
spec = importlib.util.spec_from_file_location('st', os.path.join(ROOT, 'dev', 'selftest.py'))
st = importlib.util.module_from_spec(spec)
spec.loader.exec_module(st)
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 8099

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'],
                       cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2)

HOOK = "window.__errs=[];window.addEventListener('error',function(e){window.__errs.push(String(e.message));});"
INLINE = r"""
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const out = {};
  try {
    await sleep(4000);
    out.errs = window.__errs || [];
    const srv = window.__game.net.debugServer;
    const p = srv.player;

    // ① Soldier Ant 的 artRot（应 = 135°，头随朝向）
    const sa = MOB_TYPES.find(t => t && t.slug === 'soldier_ant');
    const ant = new Mob(sa, 0, 0, 1, 'common');
    ant.facing = -Math.PI / 2;          // 向上移动
    ant._ensureShape();
    out.antRot = +(ant.artRot || 0).toFixed(4);
    out.rotOk = Math.abs(ant.artRot - Math.PI * 3 / 4) < 1e-9;

    // ② 召唤物 vs 敌对生物：硬碰撞 + 接触伤害
    const egg = PETAL_TYPES.find(t => t && t.slug === 'ant_egg');
    const card = makePetal(egg.key, 'common');
    const body = { card, rarity: 'common', x: p.x + 200, y: p.y, slotIndex: 0, sub: 0, gen: 0,
                   age: 2, life: 0, vx: 0, vy: 0, dead: false, hp: 1, maxHp: 1 };
    const unit = srv._spawnSummon(body, card, egg.summon);
    // 敌对瓢虫压在召唤物中心（必然重叠）
    const lb = MOB_TYPES.find(t => t && t.slug === 'ladybug');
    const enemy = new Mob(lb, unit.x, unit.y, 1, 'common');
    enemy.netId = 1e9 + 21; enemy.faction = 'enemy'; enemy.hp = 100; enemy._ensureShape();
    srv._addEnt(enemy);
    srv._awake = srv.ents.slice();
    const d0 = Math.hypot(enemy.x - unit.x, enemy.y - unit.y);
    const ehp0 = enemy.hp;
    for (let i = 0; i < 8; i++) srv.step(1 / 25);
    const d1 = Math.hypot(enemy.x - unit.x, enemy.y - unit.y);
    out.enemyVsSummon = {
      distBefore: +d0.toFixed(1), distAfter: +d1.toFixed(1),
      separated: d1 > d0,
      enemyHp: +enemy.hp.toFixed(1),
      summonHp: +(unit.hp || 0).toFixed(1),
      bothDamaged: enemy.hp < ehp0 && unit.hp < unit.maxHp
    };

    // ③ 玩家 vs 召唤物：硬碰撞（玩家被推出，无伤害）
    const php0 = p.hp;
    p.x = unit.x; p.y = unit.y;        // 玩家压进召唤物
    for (let i = 0; i < 8; i++) srv.step(1 / 25);
    const pd = Math.hypot(p.x - unit.x, p.y - unit.y);
    out.playerVsSummon = {
      distAfter: +pd.toFixed(1), separated: pd > 0,
      playerHp: +(p.hp || 0).toFixed(1), noDamage: p.hp === php0
    };
  } catch (e) { out.err = String(e && (e.stack || e)); }
  window.__v = JSON.stringify(out);
})();
"""

port = st.free_port()
try:
    with tempfile.TemporaryDirectory(prefix='florr2-v52-', ignore_cleanup_errors=True) as profile:
        proc = subprocess.Popen([
            EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
            '--disable-extensions', '--mute-audio', '--remote-allow-origins=*',
            '--remote-debugging-port=%d' % port, '--user-data-dir=%s' % profile, 'about:blank',
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            targets = st.wait_cdp(port)
            page = next((t for t in (targets or []) if t.get('type') == 'page'), None)
            ws = st.WebSocket(page['webSocketDebuggerUrl'])
            cdp = st.CDP(ws)
            cdp.call('Page.enable')
            cdp.call('Runtime.enable')
            cdp.call('Page.addScriptToEvaluateOnNewDocument', {'source': HOOK})
            cdp.call('Page.navigate', {'url': 'http://127.0.0.1:%d/?t=%d' % (PORT, time.time())})
            time.sleep(8)
            cdp.call('Runtime.evaluate', {
                'expression': "(function(){const s=document.createElement('script');s.textContent="
                              + json.dumps(INLINE) + ";document.body.appendChild(s);})()"
            })
            val = ''
            end = time.time() + 35
            while time.time() < end:
                try:
                    val = cdp.eval("window.__v || ''")
                except Exception:
                    val = ''
                if val:
                    break
                time.sleep(0.3)
            io.open('_v52.json', 'w', encoding='utf-8').write(val or '{"err":"timeout"}')
            ws.close()
        finally:
            proc.terminate()
finally:
    srv.terminate()
print('done')
