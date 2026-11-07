# -*- coding: utf-8 -*-
"""尾针渲染对比（最新代码）：当前实现 vs 原图 11.svg，做像素级对齐检查。"""
import base64
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
INLINE = r"""
(async () => {
  await new Promise(r => setTimeout(r, 3000));
  const out = {};
  try {
    out.scripts = Array.from(document.scripts).map(s => s.src.split('/').pop())
      .filter(x => /constants|mob\.js|mob-shape/.test(x));
    out.hasSightR = typeof MOB_SIGHT_R;
    out.win11e = (() => {
      const a = SpriteStore.images['mob11_empty'], b = SpriteStore.images['mob11'];
      return { empty: a ? [a.naturalWidth, a.naturalHeight] : null,
               full: b ? [b.naturalWidth, b.naturalHeight] : null };
    })();
    const cv = document.createElement('canvas');
    cv.width = 560; cv.height = 300;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#1ea761'; ctx.fillRect(0, 0, 560, 300);

    const t = MOB_TYPES.find(m => m && m.slug === 'hornet');
    // 左：当前实现
    const m1 = new Mob(t, 140, 150, 1, 'common');
    m1.age = 10; m1.facing = 0; m1._drawScale = 1; m1._drawAlpha = 1;
    m1._ensureShape();
    m1.draw(ctx);
    // 右：原图（mob11 自带尾针），同 drawSize 同 artRot
    drawMob(ctx, 'mob11', m1.drawSize, 420, 150, m1.facing + m1.artRot, 1, 1, false);

    out.drawSize = m1.drawSize;
    out.offPx = +(m1.drawSize * HORNET_TAIL_OFF_K).toFixed(2);
    out.winEmpty = (() => {  // 两个素材的窗口宽度（应该相等，这是本次修复的核心）
      const a = SpriteStore.images['mob11_empty'], b = SpriteStore.images['mob11'];
      return { empty: a ? [a.naturalWidth, a.naturalHeight] : null,
               full: b ? [b.naturalWidth, b.naturalHeight] : null };
    })();
    // 像素对比：两张图都在自己的半幅里，量"尾针黑色像素的最左端相对身体中心的距离"
    const d = ctx.getImageData(0, 0, 560, 300).data;
    const probe = (cx) => {
      let minX = 1e9;
      for (let y = 60; y < 240; y++) {
        for (let x = cx - 120; x < cx + 120; x++) {
          const i = (y * 560 + x) * 4;
          if (d[i] < 80 && d[i + 1] < 80 && d[i + 2] < 80) minX = Math.min(minX, x);
        }
      }
      return minX;
    };
    const leftMost1 = probe(140), leftMost2 = probe(420);
    out.tailOffsetCurrent = +(140 - leftMost1).toFixed(1);   // 当前实现：中心到尾针尖
    out.tailOffsetOriginal = +(420 - leftMost2).toFixed(1);  // 原图：中心到尾针尖
    out.match = Math.abs(out.tailOffsetCurrent - out.tailOffsetOriginal) < 4;
    ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
    ctx.fillText('current', 90, 285);
    ctx.fillText('original', 370, 285);
    out.png = cv.toDataURL('image/png');
  } catch (e) { out.err = String(e && (e.stack || e)); }
  window.__diagResult = JSON.stringify(out);
})();
"""

port = st.free_port()
with tempfile.TemporaryDirectory(prefix='florr2-cmp2-', ignore_cleanup_errors=True) as profile:
    proc = subprocess.Popen([
        EDGE, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
        '--no-default-browser-check', '--disable-extensions', '--mute-audio',
        '--hide-scrollbars', '--remote-allow-origins=*',
        f'--remote-debugging-port={port}', f'--user-data-dir={profile}', 'about:blank',
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        targets = st.wait_cdp(port)
        page = next((t for t in (targets or []) if t.get('type') == 'page'), None)
        ws = st.WebSocket(page['webSocketDebuggerUrl'])
        cdp = st.CDP(ws)
        cdp.call('Page.enable')
        cdp.call('Runtime.enable')
        cdp.call('Page.navigate', {'url': 'http://127.0.0.1:8080/'})
        end = time.time() + 40
        while time.time() < end:
            try:
                ok = cdp.eval("!!window.__game && typeof SpriteStore !== 'undefined'"
                              " && SpriteStore.ready('mob11_empty') && SpriteStore.ready('mob11')")
            except Exception:
                ok = False
            if ok:
                break
            time.sleep(0.5)
        time.sleep(2)
        cdp.call('Runtime.evaluate', {
            'expression': "(function(){const s=document.createElement('script');s.textContent="
                          + json.dumps(INLINE) + ";document.body.appendChild(s);})()"
        })
        val = ''
        end = time.time() + 25
        while time.time() < end:
            try:
                val = cdp.eval("window.__diagResult || ''")
            except Exception:
                val = ''
            if val:
                break
            time.sleep(0.3)
        if val:
            o = json.loads(val)
            b64 = o.pop('png', '')
            if b64 and ',' in b64:
                open(os.path.join(ROOT, '_tmp_cmp2.png'), 'wb').write(base64.b64decode(b64.split(',', 1)[1]))
            io.open('_tmp_cmp2.json', 'w', encoding='utf-8').write(json.dumps(o, ensure_ascii=False))
        else:
            io.open('_tmp_cmp2.json', 'w', encoding='utf-8').write('{"err":"timeout"}')
        ws.close()
    finally:
        proc.terminate()
print('done')
