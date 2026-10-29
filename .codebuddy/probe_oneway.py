#!/usr/bin/env python3
"""临时探针：单个 tick 内花瓣/生物血量变化，确认伤害是否双向。用完删除。"""
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

  const out = { petalCount: ps.petals.length, alive: ps.petals.filter(b => !b.dead).length, steps: [] };
  const type = MOB_TYPES.find(t => t && t.slug === 'ladybug');
  const b0 = ps.petals.find(b => !b.dead && !b.stationary);
  if (!b0) return out;
  const m = new Mob(type, b0.x, b0.y, 1, 'common');
  m.netId = 2e9 + 91; m._ensureShape();
  if (!m.shape) { out.err = 'no shape'; return out; }
  m.hp = m.maxHp = 1e6;
  srv.ents.push(m);

  const st0 = petalStatsFor(b0.card.type, b0.card.rarity);
  out.petalStat = { slug: b0.card.type.slug, hp: b0.hp, maxHp: b0.maxHp, armor: b0.armor,
                    dmg: st0.dmg, weight: b0.weight };
  out.mobStat = { hp: m.hp, dmg: m.dmg, armor: m.armor, weight: m.weight, r: m.r };

  srv._awake = [m];
  for (let i = 0; i < 6; i++) {
    const b = ps.petals.find(x => !x.dead && !x.stationary);
    if (b) { m.x = b.x; m.y = b.y; }        // 钉在花瓣身上，保证必然重叠
    const hpB = b ? b.hp : null, hpM = m.hp, deadB = b ? b.dead : null;
    srv._combatTick();
    const b2 = ps.petals.find(x => x.slotIndex === (b ? b.slotIndex : -1) && x.sub === (b ? (b.sub||0) : 0));
    out.steps.push({
      i, before: { petalHp: hpB, mobHp: hpM, dead: deadB },
      after: { petalHp: b2 ? b2.hp : null, mobHp: m.hp, dead: b2 ? b2.dead : null },
      alivePetals: ps.petals.filter(x => !x.dead).length
    });
    // 死了就补一片，便于连续观察
    for (const x of ps.petals) if (x.dead) { x.dead = false; x.hp = x.maxHp; }
  }
  srv.ents = srv.ents.filter(e => e !== m);
  return out;
})()
"""


def main():
    browser = st.find_browser(None)
    port = st.free_port()
    httpd = st.serve(ROOT, 8099)
    profile = tempfile.mkdtemp(prefix="florr2-probe-ow-")
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
