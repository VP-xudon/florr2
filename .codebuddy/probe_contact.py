#!/usr/bin/env python3
"""临时探针：新接触模型验收（离散结算 / 双向 / 耐久可见 / 实体分离）。用完删除。"""
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "dev"))
import selftest as st  # noqa: E402

JS = r"""
(() => {
  const g = window.__game;
  if (!g) return { err: 'no game' };
  g.stop();
  const srv = g.net && g.net.debugServer;
  const ps = srv.player;
  for (let i = 0; i < 900 && !ps.petals.some((b) => !b.dead); i++) g.stepFrames(1, 1 / 60, false);

  const type = MOB_TYPES.find(t => t && t.slug === 'ladybug');
  const b0 = ps.petals.find(b => !b.dead && !b.stationary);
  if (!b0) return { err: 'no petal' };
  const m = new Mob(type, b0.x, b0.y, 1, 'common');
  m.netId = 3e9 + 1; m._ensureShape();
  if (!m.shape) return { err: 'no shape' };
  srv.ents.push(m);

  const out = {
    petal: { slug: b0.card.type.slug, hp0: b0.hp, maxHp: b0.maxHp },
    mob: { hp0: m.hp, dmg: m.dmg, armor: m.armor, r: m.r },
    events: [], maxOverlapDepth: 0
  };
  let prevB = b0.hp, prevM = m.hp, petalDeaths = 0, contacts = 0;
  const hits = [];
  const origHit = srv._hitMob.bind(srv);
  srv._hitMob = function (mob, dmg) { hits.push(+dmg.toFixed(2)); return origHit(mob, dmg); };
  for (let i = 0; i < 60; i++) {
    // 每帧把生物拉回花瓣身上：模拟"生物赖在花瓣上"的最坏情况
    if (!b0.dead) { m.x = b0.x; m.y = b0.y; m.vx = 0; m.vy = 0; }
    const before = { b: b0.dead ? null : b0.hp, m: m.hp };
    srv._awake = [m];
    srv._combatTick();
    if (b0.dead && before.b != null) petalDeaths++;
    if (!b0.dead) {
      const hit = mobHitTest(m, b0.x, b0.y, PETAL_R);
      if (hit) out.maxOverlapDepth = Math.max(out.maxOverlapDepth, hit.depth);
    }
    const db = (before.b == null ? 0 : before.b - (b0.dead ? 0 : b0.hp));
    const dm = before.m - m.hp;
    if (db > 0.001 || dm > 0.001) {
      contacts++;
      out.events.push({ i, petal: +db.toFixed(2), mob: +dm.toFixed(2), petalDead: !!b0.dead,
                        overlap: hitDepth(m, b0) });
    }
    if (b0.dead) break;
  }
  function hitDepth(mob, body) {
    if (!body || body.dead) return null;
    const h = mobHitTest(mob, body.x, body.y, PETAL_R);
    return h ? +h.depth.toFixed(2) : 0;
  }
  srv._hitMob = origHit;
  out.hitCalls = hits;
  out.contacts = contacts;
  out.petalDeaths = petalDeaths;
  out.petalHpEnd = b0.dead ? 0 : +b0.hp.toFixed(2);
  out.mobHpEnd = +m.hp.toFixed(1);
  srv.ents = srv.ents.filter(e => e !== m);
  return out;
})()
"""


def main():
    browser = st.find_browser(None)
    port = st.free_port()
    httpd = st.serve(ROOT, 8099)
    profile = tempfile.mkdtemp(prefix="florr2-probe-ct-")
    proc = subprocess.Popen(
        [browser, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
         "--no-default-browser-check", "--disable-extensions", "--mute-audio",
         "--hide-scrollbars", "--window-size=900,560",
         "--disable-background-timer-throttling", "--remote-allow-origins=*",
         f"--remote-debugging-port={port}", f"--user-data-dir={profile}", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        targets = st.wait_cdp(port, timeout=30)
        page = next((t for t in (targets or []) if t.get("type") == "page"), None)
        if not page:
            print("无 page target")
            return 3
        ws = st.WebSocket(page["webSocketDebuggerUrl"])
        cdp = st.CDP(ws)
        cdp.call("Page.enable")
        cdp.call("Runtime.enable")
        cdp.call("Page.navigate", {"url": "http://127.0.0.1:8099/"})
        end = time.time() + 40
        ok = False
        while time.time() < end:
            try:
                ok = bool(cdp.eval("!!window.__game"))
            except Exception:
                ok = False
            if ok:
                break
            time.sleep(0.3)
        if not ok:
            print("页面未就绪")
            return 4
        time.sleep(1.5)
        print(json.dumps(cdp.eval(JS), ensure_ascii=False, indent=2))
        ws.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        httpd.shutdown()
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
