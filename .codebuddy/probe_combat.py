#!/usr/bin/env python3
"""临时探针：审计 生物/花瓣 的数值与"单向伤害"发生率。用完删除。"""
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
  const pc = g.player, ps = srv.player;

  // 1) 数值审计：每种可生成生物 × 每个稀有度
  const rows = [];
  const AUDIT = ['ladybug', 'bee', 'centipede'];
  for (const t of MOB_TYPES) {
    if (!t || AUDIT.indexOf(t.slug) < 0) continue;
    for (const rar of RARITY_ORDER) {
      const rs = t.rarityStats && t.rarityStats[rar];
      const m = new Mob(t, 0, 0, 1, rar);
      rows.push({
        slug: t.slug, rar,
        hasTable: !!rs, hpInTable: rs ? rs.hp : null, dmgInTable: rs ? (rs.dmg === undefined ? 'MISSING' : rs.dmg) : null,
        mobHp: m.hp, mobDmg: m.dmg, mobArmor: m.armor
      });
    }
  }

  // 2) 花瓣数值
  const pt = [];
  for (const t of PETAL_TYPES) {
    const s = petalStatsFor(t, 'common');
    pt.push({ slug: t.slug, hp: s.hp, dmg: s.dmg, solid: !!t.solid, armor: s.armor });
  }

  // 3) 单向伤害审计：把三种生物贴在环上，逐 tick 复刻战斗判定
  // 等花瓣装填完
  for (let i = 0; i < 900 && !ps.petals.some((b) => !b.dead); i++) g.stepFrames(1, 1 / 60, false);
  const targets = ['ladybug', 'bee', 'centipede'];
  const mobs = [];
  for (let k = 0; k < targets.length; k++) {
    const t = MOB_TYPES.find((x) => x && x.slug === targets[k]);
    if (!t) continue;
    const m = new Mob(t, ps.x, ps.y + 44, 1, 'common');
    m.netId = 2e9 + k; m._ensureShape();
    m.hp = m.maxHp = 1e9;             // 打不死，方便统计
    if (!m.shape) continue;
    srv.ents.push(m); mobs.push(m);
  }
  const oneWay = {};
  const bothWay = {};
  const stat = { ticks: 0, contactTicks: 0, oneWayTicks: 0, zeroDmgMobs: [] };
  const TICK = 1 / 25;
  for (let i = 0; i < 400; i++) {
    const b0 = ps.petals.find((b) => !b.dead && !b.stationary);
    if (b0) for (const m of mobs) { m.x = b0.x; m.y = b0.y; m.vx = 0; m.vy = 0; }
    ps.spin += PETAL_SPIN * TICK;
    ps._syncPetals(TICK, ps, mobs);
    srv._awake = mobs; srv._ents = srv.ents;
    srv._combatTick();
    stat.ticks++;
    for (const m of mobs) {
      for (const b of ps.petals) {
        if (b.dead || b.fxNoCombat) continue;
        if (!mobHitTest(m, b.x, b.y, PETAL_R)) continue;
        const stt = petalStatsFor(b.card.type, b.card.rarity);
        const toPetal = Math.max((m.dmg || 0) - (b.armor || 0), 0);
        const toMob = Math.max((stt.dmg || 0) - (m.armor || 0), 0);
        stat.contactTicks++;
        if (toMob > 0 && toPetal <= 0) {
          stat.oneWayTicks++;
          oneWay[m.type.slug] = (oneWay[m.type.slug] || 0) + 1;
        } else if (toMob > 0 && toPetal > 0) {
          bothWay[m.type.slug] = (bothWay[m.type.slug] || 0) + 1;
        }
        if (m.dmg <= 0 && stat.zeroDmgMobs.indexOf(m.type.slug) < 0) stat.zeroDmgMobs.push(m.type.slug);
      }
    }
    // 花瓣会被打碎：补满，保证持续接触
    for (const b of ps.petals) { if (b.dead) b.dead = false; b.hp = b.maxHp = 1e6; }
  }
  srv.ents = srv.ents.filter((m) => mobs.indexOf(m) < 0);
  stat.oneWayByMob = oneWay;
  stat.bothByMob = bothWay;
  return { rows, petals: pt, combat: stat };
})()
"""


def main():
    browser = st.find_browser(None)
    port = st.free_port()
    httpd = st.serve(ROOT, 8099)
    profile = tempfile.mkdtemp(prefix="florr2-probe-cb-")
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
        res = cdp.eval(JS)
        out = ROOT / ".codebuddy" / "combat_audit.json"
        out.write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
        print("saved", out)
        print(json.dumps(res.get("combat"), ensure_ascii=False))
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
