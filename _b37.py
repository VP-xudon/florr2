# -*- coding: utf-8 -*-
"""b37 集成验证：生物穿蜡 / 尾针挂点 / Hornet 1.4x / AI 回转。"""
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

HOOK = "window.__errs=[];window.addEventListener('error',function(e){window.__errs.push(String(e.message));});"
INLINE = r"""
(async () => {
  await new Promise(r => setTimeout(r, 3500));
  const out = {};
  try {
    out.errs = window.__errs || [];
    out.tail = MobFX.hornetTail; out.tipBack = MobFX.missileTipBack;
    out.hornetScale = (MOB_TRAITS.hornet || {}).sizeScale;
    const g = window.__game, srv = g.net.debugServer, p = srv.player;
    const wax = PETAL_TYPES.find(x => x && x.slug === 'wax');
    // 【真实生成路径】：装 Wax 卡 + 装填完成 -> _syncPetals 正常生成
    const card = makePetal(wax.key, 'rare');
    srv.player.slots[0] = card; srv.player.recompute();
    srv.player.reload[0] = { card, age: 999, dur: 0.01 };
    const bt = MOB_TYPES.find(x => x && x.slug === 'ladybug');
    const mob = new Mob(bt, 0, 0, 1, 'common');
    mob.netId = 990002; mob.age = 10; mob._ensureShape();
    let worst = -1e9, waxRef = null;
    for (let i = 0; i < 90; i++) {
      mob.x = 30; mob.y = 0; mob.vx = -300; mob.vy = 0;
      srv.step(1 / 25);
      waxRef = srv.player.petals.find(w => w && w.anchor) || waxRef;
      if (waxRef) worst = Math.max(worst, waxRef.cr - Math.abs(mob.x - waxRef.x));
    }
    out.maxPenetration = +worst.toFixed(1);
    out.hardBlocked = worst <= 2;
    const hornetT = MOB_TYPES.find(m => m && m.slug === 'hornet');
    const h = new Mob(hornetT, 0, 0, 1, 'common');
    h.age = 10;
    h.hornet = { mode: 'x', missile: null, projectiles: [], spinT: 0,
                 launchAngle: 0.7, baseFacing: 3.0, spinPhase: 'return',
                 cooldown: 0, reloadT: 0 };
    h.facing = 0.7 + Math.PI;
    for (let i = 0; i < 240; i++) {
      MobFX.stepMob(h, 1 / 60, { x: 100, y: 0, dead: false, vx: 0, vy: 0 });
    }
    out.returnFacing = +h.facing.toFixed(2);
    out.facePlayerOk = Math.abs(MobAI._util.angNorm(h.facing - 0.7)) < 0.05;
  } catch (e) { out.err = String(e && (e.stack || e)); }
  window.__v = JSON.stringify(out);
})();
"""

port = st.free_port()
with tempfile.TemporaryDirectory(prefix='florr2-b37-', ignore_cleanup_errors=True) as profile:
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
        cdp.call('Page.navigate', {'url': 'http://127.0.0.1:8080/?v=%d' % time.time()})
        time.sleep(6)
        cdp.call('Runtime.evaluate', {
            'expression': "(function(){const s=document.createElement('script');s.textContent="
                          + json.dumps(INLINE) + ";document.body.appendChild(s);})()"
        })
        val = ''
        end = time.time() + 25
        while time.time() < end:
            try:
                val = cdp.eval("window.__v || ''")
            except Exception:
                val = ''
            if val:
                break
            time.sleep(0.3)
        io.open('_b37.json', 'w', encoding='utf-8').write(val or '{"err":"timeout"}')
        ws.close()
    finally:
        proc.terminate()
print('done')
