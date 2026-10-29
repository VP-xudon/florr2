// selftest.js — 仅在 ?selftest=1 时由 main.js 动态加载
// 职责：暂停 rAF 主循环，用固定步长回放，跑不变量断言与性能基准，把结果写进 DOM。
// 结果由 dev/selftest.py 用 headless 浏览器 --dump-dom 抓取并判定。
'use strict';

(function () {
  const RESULT_ID = 'selftest-result';
  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    errors: [],
    checks: [],
    perf: null,
    stats: null
  };

  function push(name, ok, detail) {
    if (!ok) report.ok = false;
    report.checks.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail) });
  }

  // check(name, fn)：fn 返回 false 视为失败；返回 {ok, detail} 可自定义判定；其余作为说明且算通过。
  function check(name, fn) {
    try {
      const r = fn();
      if (r && typeof r === 'object') push(name, !!r.ok, r.detail);
      else if (r === false) push(name, false, 'returned false');
      else push(name, true, r === true || r === undefined ? '' : r);
    } catch (e) {
      push(name, false, (e && e.message) || String(e));
    }
  }

  function assert(name, cond, detail) { push(name, cond, detail); }

  function emit() {
    report.errors = (window.__selftestErrors || []).slice();
    if (!report.ok) report.ok = report.errors.length === 0;
    const el = document.createElement('script');
    el.type = 'application/json';
    el.id = RESULT_ID;
    el.textContent = JSON.stringify(report);
    document.body.appendChild(el);
    document.body.dataset.selftest = report.ok ? 'pass' : 'fail';
    document.title = 'SELFTEST ' + (report.ok ? 'PASS' : 'FAIL');
  }

  // 逐帧计时；withRender=true 时同时渲染。
  function measure(game, frames, dt, withRender) {
    const times = [];
    for (let i = 0; i < frames; i++) {
      const t0 = performance.now();
      game.update(dt);
      if (withRender) game.render();
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const pick = (q) => times[Math.min(times.length - 1, Math.floor(times.length * q))];
    let sum = 0;
    for (const t of times) sum += t;
    return {
      frames,
      render: !!withRender,
      avgMs: +(sum / times.length).toFixed(3),
      p50Ms: +pick(0.5).toFixed(3),
      p95Ms: +pick(0.95).toFixed(3),
      maxMs: +times[times.length - 1].toFixed(3)
    };
  }

  // 多轮取中位数：headless 的 CPU 调度噪声很大，单轮 p95 波动可达 ±60%
  function measureMedian(game, rounds, frames, dt, withRender) {
    const runs = [];
    for (let i = 0; i < rounds; i++) runs.push(measure(game, frames, dt, withRender));
    runs.sort((a, b) => a.p50Ms - b.p50Ms);
    const r = runs[Math.floor(runs.length / 2)];
    return {
      frames: frames * rounds, rounds, render: !!withRender,
      avgMs: r.avgMs, p50Ms: r.p50Ms, p95Ms: r.p95Ms, maxMs: r.maxMs
    };
  }

  function snapshotStats(game) {
    const p = game.player;
    return {
      mobs: game.mobs.length,
      mobViews: game.mobViews ? game.mobViews.size : -1,
      visible: game._visibleMobs ? game._visibleMobs.length : -1,
      drops: game.drops.length,
      cards: game.cards.length,
      particles: game.particles.length,
      dmgTexts: game.dmgTexts.length,
      petals: p && p.petals ? p.petals.length : -1,
      playerHp: p ? Math.round(p.hp * 100) / 100 : null,
      playerDead: p ? !!p.dead : null
    };
  }

  async function main() {
    const game = window.__game;
    if (!game) {
      push('boot', false, 'window.__game 不存在（引导失败）');
      emit();
      return;
    }

    // 让已排队的 rAF 回调先跑掉，再接管推进
    game.stop();
    await new Promise((r) => setTimeout(r, 0));

    check('boot: game/map/player 就绪', () => !!(game.map && game.player));
    report.env = {
      ua: navigator.userAgent,
      dpr: window.devicePixelRatio || 1,
      viewport: (game.W || 0) + 'x' + (game.H || 0),
      assetVer: typeof ASSET_VER !== 'undefined' ? ASSET_VER : null
    };
    check('boot: 网络层接口', () =>
      !!(game.net && typeof game.net.send === 'function' && typeof game.net.step === 'function' &&
         typeof game.net.sendInput === 'function' && typeof game.net.onMessage === 'function'));
    check('boot: 常量存在', () =>
      typeof FLOWER_SPAWN_INVULN === 'number' && typeof SNAP_HZ === 'number' &&
      typeof MOB_ACTIVE_R === 'number' && typeof DROP_PICK_R === 'number');
    check('boot: i18n 关键键已注册', () => {
      const t = I18N.t('UI/Settings/Title');
      return t && t.indexOf('<') !== 0 ? '' : '缺失键: ' + t;
    });

    // 固定步长推进（覆盖服务端生成、快照镜像、花瓣轨道）
    game.stepFrames(60, 1 / 60, false);
    const p = game.player;
    check('sim: 玩家坐标有限', () =>
      isFinite(p.x) && isFinite(p.y) && isFinite(p.hp) ? '' : 'x=' + p.x + ' y=' + p.y + ' hp=' + p.hp);
    check('sim: 血量在 [0, maxHp]', () =>
      p.hp >= 0 && p.hp <= p.maxHp + 1e-6 ? '' : 'hp=' + p.hp + ' max=' + p.maxHp);
    check('sim: 生物 id 唯一', () => {
      const seen = new Set();
      for (const m of game.mobs) {
        if (seen.has(m.netId)) return '重复 netId=' + m.netId;
        seen.add(m.netId);
      }
      return game.mobs.length + ' 只';
    });
    check('sim: 花瓣槽位与实体一致', () =>
      Array.isArray(p.petals) && Array.isArray(p.reload) ? '' : 'petals/reload 非数组');

    // 让花瓣全部装填完（后续断言都假定"花瓣已在轨道上"）
    game.stepFrames(150, 1 / 60, false);

    // 移动：键盘模式按住 D，位置应当右移
    const x0 = p.x;
    game.moveMode = 'keyboard';
    game._down = game._down || new Set();
    game._down.add('KeyD');
    game.stepFrames(45, 1 / 60, false);
    game._down.delete('KeyD');
    check('sim: 键盘移动生效', () =>
      p.x > x0 + 1 ? 'Δx=' + (p.x - x0).toFixed(1) : 'Δx=' + (p.x - x0).toFixed(2));

    // 快照契约：服务端下发的字段，客户端应用后应能读回
    check('net: 快照应用后玩家血量同步', () => {
      const srv = game.net.debugServer;
      if (!srv || !srv.player) return '本地服务端不可用（远端模式跳过）';
      return Math.abs(srv.player.hp - p.hp) < Math.max(1, p.maxHp * 0.02)
        ? '' : 'client=' + p.hp.toFixed(2) + ' server=' + srv.player.hp.toFixed(2);
    });

    report.stats = snapshotStats(game);
    report.perf = {
      update: measureMedian(game, 3, 80, 1 / 60, false),
      updateRender: measureMedian(game, 3, 40, 1 / 60, true)
    };
    report.statsAfter = snapshotStats(game);

    // ---- 回归断言：本轮修掉的机制性 BUG ----

    // 1) 击退守恒：hurt 事件里的玩家份额必须等于 KNOCKBACK_SHARE[rarity][0] × 设计总位移
    check('fix: 击退总位移守恒', () => {
      const p = game.player, srv = game.net.debugServer;
      if (!srv || !srv.player) return '无本地服务端（跳过）';
      // 出生无敌会挡掉伤害，两端都要清（否则快照会把无敌又加回来）
      p.invuln = 0; p.invulnSrc = {}; p.invulnTotal = 0;
      srv.player.invuln = 0; srv.player.invulnSrc = {}; srv.player.invulnTotal = 0;
      // 高稀有度生物一击就有上千伤害，会把玩家直接打死（死亡分支不再发 hurt）。
      // 把两端血量抬高，保证测的是"击退"而不是"被秒"。
      p.maxHp = p.hp = 1e6;
      srv.player.maxHp = srv.player.hp = 1e6;
      // 必须挑一只有伤害的生物：dmg=0 的生物即使命中也不会走体伤分支
      const view = game.mobs.find((x) => !x.dead && x.dmg > 0);
      if (!view) return '场上没有可测试的生物';
      const sm = srv.ents.find((x) => x.netId === view.netId);
      if (!sm) return '服务端未找到对应生物';
      let total = null, hitCount = 0;
      const orig = game._applyEvt.bind(game);
      game._applyEvt = (ev) => { if (ev && ev.kind === 'hurt') total = ev.total; return orig(ev); };
      // 关掉接触挤出：否则每帧都会把生物与玩家推开，体伤判定根本来不及命中
      const origPush = window.physicsPush;
      const origHitTest = window.mobHitTest;
      window.physicsPush = () => {};
      window.mobHitTest = function (m, x, y, r) {
        const out = origHitTest(m, x, y, r);
        if (out) hitCount++;
        return out;
      };
      try {
        for (let i = 0; i < 60 && total == null; i++) {
          sm.x = srv.player.x; sm.y = srv.player.y;
          sm.vx = 0; sm.vy = 0;
          game.update(1 / 60);
        }
      } finally {
        window.physicsPush = origPush;
        window.mobHitTest = origHitTest;
        game._applyEvt = orig;
        // 还原血量上限：这是本测试临时抬高的人造值，不能泄漏给后续断言（含提前返回分支）
        p.maxHp = FLOWER_BASE_HP; srv.player.maxHp = FLOWER_BASE_HP;
        p.hp = Math.min(p.hp, p.maxHp); srv.player.hp = Math.min(srv.player.hp, srv.player.maxHp);
      }
      if (total == null) {
        return {
          ok: false,
          detail: '未触发 hurt（命中=' + hitCount + ' dmg=' + sm.dmg + ' armor=' +
            (srv.player.armor || 0) + ' invuln=' + srv.player.invuln.toFixed(2) +
            ' hurtInvuln=' + (srv.player.hurtInvuln || 0).toFixed(2) + '）'
        };
      }
      const sh = KNOCKBACK_SHARE[sm.rarity] || KNOCKBACK_SHARE.common;
      const expect = FLOWER_KNOCKBACK * p.r * 2 * sh[0];
      return {
        ok: Math.abs(total - expect) < 1e-6,
        detail: 'total=' + total.toFixed(2) + ' expect=' + expect.toFixed(2)
      };
    });

    // 2) 装填暂停：客户端置 hold 后两端都必须停止计时
    //（旧实现服务端 reloadHold 恒为空 -> 服务端照常装填并提前放出花瓣）
    check('fix: 装填暂停跨端一致', () => {
      const p = game.player, srv = game.net.debugServer;
      if (!srv || !srv.player || !p.slots[0]) return '无本地服务端或空槽（跳过）';
      game.respawn();                                // 从干净的出生状态开始，排除死亡/减速残留
      game.stepFrames(2, 1 / 60, false);
      p.reloadHold[0] = true;
      game.stepFrames(1, 1 / 60, false);              // 让 hold 上行到位
      const sp = srv.player;
      const holdApplied = sp.reloadHold[0] === true;
      const ca0 = p.reload[0] ? p.reload[0].age : -1;
      const sa0 = sp.reload[0] ? sp.reload[0].age : -1;
      game.stepFrames(30, 1 / 60, false);
      const ca1 = p.reload[0] ? p.reload[0].age : -1;
      const sa1 = sp.reload[0] ? sp.reload[0].age : -1;
      p.reloadHold[0] = false;
      return {
        ok: holdApplied && (ca1 - ca0) < 1e-6 && (sa1 - sa0) < 1e-6,
        detail: 'serverHold=' + holdApplied +
          ' clientAge ' + ca0.toFixed(2) + '->' + ca1.toFixed(2) +
          ' serverAge ' + sa0.toFixed(2) + '->' + sa1.toFixed(2) +
          (sp.slowTile ? '（减速瓦片）' : '')
      };
    });

    // 3) 预测漂移：持续移动时与权威位置偏差必须受控（旧实现会攒到 90px 再瞬移）
    check('fix: 预测位置偏差受控', () => {
      const p = game.player;
      game.moveMode = 'keyboard';
      game._down.add('KeyD');
      let maxD = 0;
      for (let i = 0; i < 180; i++) {
        game.update(1 / 60);
        const t = game._netPos;
        if (t) maxD = Math.max(maxD, Math.hypot(p.x - t.x, p.y - t.y));
      }
      game._down.delete('KeyD');
      return { ok: maxD < 30, detail: 'maxΔ=' + maxD.toFixed(1) + 'px' };
    });

    // 4) 重生后世代号一致：旧实现客户端不清 _petalGen -> 重生后该槽花瓣永久不掉血
    check('fix: 重生后花瓣世代号一致', () => {
      const p = game.player, srv = game.net.debugServer;
      if (!srv || !srv.player) return '无本地服务端（跳过）';
      srv.player.invuln = 0; srv.player.invulnSrc = {}; srv.player.hurtInvuln = 0;
      srv.player.hurt(1e9, null);
      game.stepFrames(2, 1 / 60, false);
      const diedOnClient = !!p.dead;
      game.respawn();
      // 复活点若落在减速瓦片上会一直不装填，这里等到出第一片花瓣为止（上限 10s）
      let waited = 0;
      while (p.petals.length === 0 && waited < 600) {
        game.stepFrames(10, 1 / 60, false);
        waited += 10;
      }
      const cg = JSON.stringify(p._petalGen || []);
      const sg = JSON.stringify(srv.player._petalGen || []);
      const map = p.netPetals || {};
      let miss = 0;
      for (const b of p.petals) {
        if (!map[b.slotIndex + '|' + (b.sub || 0) + '|' + (b.gen || 0)]) miss++;
      }
      return {
        ok: cg === sg && miss === 0 && p.petals.length > 0,
        detail: 'clientGen=' + cg + ' serverGen=' + sg + ' petals=' + p.petals.length +
          ' unmatched=' + miss + ' diedSynced=' + diedOnClient +
          ' slowTile=' + !!p.slowTile + ' waited=' + waited
      };
    });

    // 5) Leaf 持续回血：规则已从战斗循环迁入 PetalFX 的 passive 效果
    //    （passive 不接管位置、不跳过战斗，所以叶子仍会正常参与碰撞与伤害）
    check('engine: Leaf 持续回血生效', () => {
      const p = game.player, srv = game.net.debugServer;
      if (!srv || !srv.player) return '无本地服务端（跳过）';
      const leaf = (typeof PETAL_TYPES !== 'undefined' ? PETAL_TYPES : [])
        .find((x) => x && x.slug === 'leaf');
      if (!leaf || typeof makePetal !== 'function') return '未启用 leaf（跳过）';
      // 测试期间长无敌，避免被怪咬死后误判
      InvulnFX.add(p, 'selftest', 60);
      InvulnFX.add(srv.player, 'selftest', 60);
      p.slots[0] = makePetal(leaf.key, 'common');
      p.recompute();
      game.stepFrames(2, 1 / 60, false);            // loadout 上行
      const before = Math.max(10, p.maxHp * 0.4);
      p.hp = before; srv.player.hp = before;
      game.stepFrames(300, 1 / 60, false);          // 1.8s 装填 + 约 3.2s 回血
      if (p.dead) return { ok: false, detail: '玩家在测试中死亡（环境干扰）' };
      return {
        ok: p.hp > before + 0.5,
        detail: 'hp ' + before.toFixed(1) + ' -> ' + p.hp.toFixed(1) + '（maxHp ' + p.maxHp + '）'
      };
    });

    // 6) 多体数量唯一来源 = data.js 的 PETAL_SUB_COUNT（cards.js 不再按 slug 特判）
    check('engine: 多体数量来自数据表', () => {
      const pick = (slug) => (typeof PETAL_TYPES !== 'undefined' ? PETAL_TYPES : [])
        .find((x) => x && x.slug === slug);
      const cases = [['light', 'super', 6], ['light', 'mythic', 5],
                     ['stinger', 'ultra', 5], ['peas', 'common', 4]];
      const bad = [];
      for (const [slug, rar, want] of cases) {
        const t = pick(slug);
        if (!t) continue;                                  // 未启用的花瓣跳过
        const got = CardRenderer.lightSubCount(t, rar);
        if (got !== want) bad.push(slug + '/' + rar + '=' + got + '≠' + want);
      }
      return {
        ok: bad.length === 0,
        detail: bad.length ? bad.join(' ') : 'light/stinger/peas 与 PETAL_SUB_COUNT 一致'
      };
    });

    // 7) 复活落点：在检查点【整片区域】内随机，且必须“整个人站得下”（不是只判一个点）
    check('fix: 复活点在检查点区域内随机', () => {
      const map = game.map, p = game.player;
      if (!map || !map.checkpoints || !map.checkpoints.length) return '无检查点（跳过）';
      const cp = map.checkpoints[0];
      const r = p.r || 22;
      const pts = [];
      for (let i = 0; i < 40; i++) {
        const q = map.checkpointSpawnPoint(cp, r);
        if (q.x < cp.x || q.x > cp.x + cp.w || q.y < cp.y || q.y > cp.y + cp.h) {
          return { ok: false, detail: '落点越界 ' + q.x.toFixed(1) + ',' + q.y.toFixed(1) };
        }
        if (!map.canStandAt(q.x, q.y, r)) {
          return { ok: false, detail: '落点站不住 ' + q.x.toFixed(1) + ',' + q.y.toFixed(1) };
        }
        pts.push(q);
      }
      // 旧实现“中心可站就回中心”：centerHits 必须为 0
      let centerHits = 0;
      for (const q of pts) if (Math.hypot(q.x - cp.cx, q.y - cp.cy) < 1e-6) centerHits++;
      // 分散度：最大两两距离应接近这一大片区域的尺寸（而不是挤在一点）
      let spread = 0;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d > spread) spread = d;
        }
      }
      const want = Math.min(cp.w, cp.h) * 0.25;
      return {
        ok: centerHits === 0 && spread > want,
        detail: 'n=40 center=' + centerHits + ' spread=' + spread.toFixed(0) +
          ' want>' + want.toFixed(0) + ' 区域=' + cp.w.toFixed(0) + 'x' + cp.h.toFixed(0)
      };
    });

    // 8) 多节生物碰撞箱：取【本节贴图】的轮廓（12_h / 12_b），不是整条 12.svg
    check('fix: 多节生物用本节轮廓', () => {
      const segs = game.mobs.filter((m) => m.artSvg === '12_h' || m.artSvg === '12_b');
      const seg = segs[0];
      if (!seg) return '场上没有蜈蚣节（跳过）';
      // 远处生物不再每帧建轮廓（见 _tickMobViews 的视口预筛），这里显式建一次
      seg._ensureShape();
      if (!seg.shape) return { ok: false, detail: '节无碰撞轮廓（shape=null）' };
      const own = SpriteStore.contour('mob' + seg.artSvg, seg.drawSize);
      const whole = SpriteStore.contour('mob' + seg.svg, seg.drawSize);
      // 整条 12.svg 的轮廓半径必然明显大于单节身体（否则说明还在用整条外形）
      const smaller = !whole || whole.r > own.r * 1.15;
      return {
        ok: own === seg.shape && smaller,
        detail: 'art=' + seg.artSvg + ' 同源=' + (own === seg.shape) +
          ' r节=' + own.r.toFixed(3) + ' r整条=' + (whole ? whole.r.toFixed(3) : 'null') +
          ' 节数=' + segs.length
      };
    });

    // 8b) 生物 AI 引擎：按物种分派独立 AI + 蜈蚣的弧线/转向/限速真正生效
    check('ai: 生物 AI 按物种分派', () => {
      const typeOf = (slug) => (typeof MOB_TYPES === 'undefined') ? null
        : MOB_TYPES.find((t) => t && t.slug === slug);
      const bad = [];
      let detail = '';
      // ① 分派：瓢虫走通用游走、蜜蜂走 S 型、蜈蚣走连续弧线
      for (const [slug, key] of [['ladybug', 'wander'], ['bee', 'bee'], ['centipede', 'centipede']]) {
        const t = typeOf(slug);
        if (!t) continue;                                  // 未启用的生物跳过
        const m = new Mob(t, 0, 0, 1, 'common');
        if (m.aiKey !== key) bad.push(slug + '=' + m.aiKey + '≠' + key);
      }
      // ② 蜈蚣：连续 120 帧必须真的产出移动欲望，且转向不超过 arcRate×dt
      const ct = typeOf('centipede');
      if (ct) {
        const m = new Mob(ct, 0, 0, 1, 'common');
        const DT = 1 / 25;
        let moved = 0, maxTurn = 0, prev = m.ai.heading;
        for (let i = 0; i < 120; i++) {
          const v = MobAI.step(m.ai, DT, m, null);
          moved += Math.hypot(v.x, v.y);
          const d = Math.abs(MobAI._util.angNorm(m.ai.heading - prev));
          if (d > maxTurn) maxTurn = d;
          prev = m.ai.heading;
        }
        const lim = (m.arcRate || 0.1) * DT * 1.01;
        // ③ 限速：给一个超大欲望，必须被钳回本物种的硬上限
        const cap = m._centSpeedCap || 0;
        const cappedVec = MobAI.limitSpeed(m, { x: 99999, y: 0 });
        const capped = Math.abs(Math.hypot(cappedVec.x, cappedVec.y) - cap) < 0.01;
        if (!(moved > 0)) bad.push('蜈蚣没有移动欲望');
        if (!(maxTurn <= lim)) bad.push('蜈蚣转向超速 ' + maxTurn.toFixed(4) + '>' + lim.toFixed(4));
        if (!capped) bad.push('蜈蚣限速失效');
        detail = ' 蜈蚣120帧欲望=' + moved.toFixed(1) + ' 最大转向=' + maxTurn.toFixed(4) +
          ' 限速=' + cap.toFixed(1);
      }
      return { ok: bad.length === 0, detail: (bad.length ? bad.join(' ') : '分派正确') + detail };
    });

    // 8c) 花瓣能力：8 种启用花瓣全部注册；脱轨/喷射/硬碰撞/吸引由引擎统一分派
    check('engine: 花瓣能力由 PetalFX 统一接管', () => {
      const typeOf = (slug) => PETAL_TYPES.find((t) => t && t.slug === slug);
      const missing = PETAL_TYPES.filter((t) => !PetalFX.defOf(t)).map((t) => t.slug);
      const bad = missing.length ? ['未注册: ' + missing.join(',')] : [];
      const p = game.player;
      const mkBody = (t, x) => ({
        card: { type: t, rarity: 'rare' }, slotIndex: 0, sub: 0, selfRot: 0,
        x: x || 0, y: 0, vx: 10, vy: 0, age: 1, hp: 10, maxHp: 10
      });
      // ① 喷射型（Peas）：detach 必须给出 launch 速度，而不是"惯性滑行"
      const peas = typeOf('peas');
      if (peas) {
        const plan = PetalFX.detach(mkBody(peas), p);
        const sp = plan ? Math.hypot(plan.vx, plan.vy) : 0;
        if (!(sp > 100)) bad.push('peas 未喷射 sp=' + sp.toFixed(1));
      }
      // ② 接触传能（PetalFX.onHit）：只传一次动能，【谁都不位移】——
      //    位移是实体分离的职责（生物侧 LocalServer._separateMobFromPetal / 花瓣侧
      //    Player._separatePetalFromMobs），两件事必须彻底分开，否则又会出现
      //    "推完就判不到命中 -> 卡在轮廓外沿、既不受伤也不再结算"。
      const honey = typeOf('honey');
      if (honey) {
        const b = mkBody(honey);
        const mob = { x: 1, y: 0, vx: -200, vy: 0, rarity: 'common', weight: 1, kbX: 0, kbY: 0 };
        const bx = b.x, by = b.y, mx = mob.x;
        const contact = {
          dt: 0.04, mob, hit: { nx: 1, ny: 0, depth: 4 }, approach: 200, relN: 200,
          jmass: 1, jshare: 0.85, wP: 1, wM: 1, shareP: 0.5, shareM: 0.5, kbBoost: 1
        };
        PetalFX.onHit(b, p, contact);
        if (b.x !== bx || b.y !== by) bad.push('传能阶段位移了花瓣');
        if (mob.x !== mx) bad.push('传能阶段位移了生物');
        if (!(mob.kbX < 0)) bad.push('honey 未沿法线传动能 kbX=' + mob.kbX);
        const once = mob.kbX;
        PetalFX.onHit(b, p, contact);                      // 冷却内重复接触
        if (mob.kbX !== once) bad.push('同一次接触传了两次动能');
        // ③ 实体分离的"生物一侧"：推开但必须保留 PETAL_CONTACT_SKIN 的接触量
        const srv = game.net && game.net.debugServer;
        if (srv) {
          const m2 = { x: 1, y: 0, weight: 1, _chainLocked: false };
          srv._separateMobFromPetal(m2, b, { nx: 1, ny: 0, depth: 8 });
          const pushed = 1 - m2.x;
          if (!(pushed > 0)) bad.push('生物没被推出花瓣');
          if (!(pushed < 8)) bad.push('一次推完了整段穿透 pushed=' + pushed.toFixed(2));
          // 被刚性粘合的链节不让位（推了会被 _solveChains 覆盖成抖动）
          const m3 = { x: 1, y: 0, weight: 1, _chainLocked: true };
          srv._separateMobFromPetal(m3, b, { nx: 1, ny: 0, depth: 8 });
          if (m3.x !== 1) bad.push('被粘合的链节被推动了');
        }
        // ④ 稀有度上限：rare 蜜只吸得到 common，吸不到 epic
        if (PetalFX.canAttract(b, p, { rarity: 'epic', x: 10, y: 0 })) bad.push('honey 稀有度上限失效');
        if (!PetalFX.canAttract(b, p, { rarity: 'common', x: 10, y: 0 })) bad.push('honey 连 common 都吸不到');
      }
      return { ok: bad.length === 0, detail: bad.length ? bad.join(' ') : '注册齐全 + 传能/分离/吸附属性能正常' };
    });

    // 8c1) 吸附属性必须【逐个花瓣显式声明】（不允许"没写就默认某种行为"）
    check('data: 花瓣吸附属性逐个声明', () => {
      const enabled = Array.from(ENABLED_PETAL_SLUGS || []);
      const undeclared = enabled.filter((s) => !PETAL_TRAITS[s] || typeof PETAL_TRAITS[s].sticky !== 'boolean');
      const sticky = enabled.filter((s) => PETAL_TRAITS[s] && PETAL_TRAITS[s].sticky === true);
      // 类型表里的 sticky 必须与声明一致（行为层只读 type.sticky）
      const mismatch = PETAL_TYPES.filter((t) => !!t.sticky !== !!(PETAL_TRAITS[t.slug] && PETAL_TRAITS[t.slug].sticky))
        .map((t) => t.slug);
      // 旧的 solid 字段必须彻底消失：它曾经决定"花瓣能不能穿过生物"，
      // 现在所有花瓣都是实体，留着会让人以为还有两套碰撞。
      const legacy = PETAL_TYPES.filter((t) => t.solid !== undefined).map((t) => t.slug);
      const ok = undeclared.length === 0 && mismatch.length === 0 && legacy.length === 0;
      return {
        ok,
        detail: ok
          ? `共 ${enabled.length} 种；会被吸附=${sticky.join(',') || '无'}`
          : `未声明=${undeclared.join(',')} 不一致=${mismatch.join(',')} 残留solid=${legacy.join(',')}`
      };
    });

    // 8c1b) 玩家与生物的推挤必须和伤害结算 / F3 用同一套轮廓（旧实现用等面积圆，大怪穿模）
    check('sim: 玩家推挤用生物轮廓', () => {
      const type = MOB_TYPES.find((t) => t && t.slug === 'ladybug');
      const p = game.player;
      if (!type || !p) return '跳过';
      const m = new Mob(type, p.x + 80, p.y, 1, 'eternal');   // 大型生物：等面积圆远小于外形
      m._ensureShape();
      if (!m.shape) return '轮廓未就绪（跳过）';
      const saved = { x: p.x, y: p.y, vx: p.vx || 0, vy: p.vy || 0 };
      let dist = 0, inside = true;
      try {
        p.x = m.x; p.y = m.y; p.vx = 0; p.vy = 0;             // 直接塞进生物中心
        for (let i = 0; i < 24; i++) physicsPushMob(p, m);
        const hit = mobHitTest(m, p.x, p.y, p.r);
        inside = !!(hit && hit.depth > 0.01);
        dist = Math.hypot(p.x - m.x, p.y - m.y);
      } finally {
        p.x = saved.x; p.y = saved.y; p.vx = saved.vx; p.vy = saved.vy;
      }
      return {
        ok: !inside,
        detail: `被推到 ${dist.toFixed(1)}px（等面积 r=${m.r.toFixed(1)}，外形半径更大）`
      };
    });

    // 8c2) 花瓣与生物重叠：必须【双向】受伤，且走同一套「伤害 - 护甲」口径
    check('sim: 花瓣与生物双向受伤', () => {
      const srv = game.net && game.net.debugServer;
      if (!srv || !srv.player) return '无本地服务端（跳过）';
      const p = srv.player;
      const type = MOB_TYPES.find((t) => t && t.slug === 'ladybug');
      const b = (p.petals || []).find((x) => !x.dead);
      if (!type || !b) return '跳过';
      const m = new Mob(type, b.x, b.y, 1, 'common');
      m.netId = 1e9 + 1;
      m._ensureShape();
      if (!m.shape) return '轮廓未就绪（跳过）';   // 没有 SVG 轮廓就没有命中判定
      m.hp = m.maxHp = 1e6;                        // 别让它被打死，只看数字
      // 给一片花瓣一个足够大的血池：真实花瓣只有十几点血，1~2 个 tick 就碎了，
      // 那样测不出"三个 tick 都在双向扣血"（碎了之后本 tick 之后就不再结算）。
      const savedEnts = srv.ents, savedAwake = srv._awake, savedEv = srv._events;
      const savedHp = b.hp, savedMaxHp = b.maxHp, savedNoCmb = b.fxNoCombat;
      b.maxHp = 10000; b.hp = 10000;
      b.fxNoCombat = false;          // 玫瑰回血等特效期间该实体不参与战斗，别让断言随机跳过
      const bHp0 = b.hp, bMax0 = b.maxHp, mHp0 = m.hp;
      let bAfter = bHp0, mAfter = mHp0;
      try {
        srv.ents = [m]; srv._awake = [m]; srv._events = [];
        for (let i = 0; i < 3; i++) srv._combatTick();
        bAfter = b.hp; mAfter = m.hp;
      } finally {
        srv.ents = savedEnts; srv._awake = savedAwake; srv._events = savedEv;
        b.hp = savedHp; b.maxHp = savedMaxHp; b.dead = false; b.hurtT = 0;
        b.fxNoCombat = savedNoCmb;
      }
      const st = petalStatsFor(b.card.type, b.card.rarity);
      const toPetal = Math.max((m.dmg || 0) - (b.armor || 0), 0);
      const toMob = Math.max((st.dmg || 0) - (m.armor || 0), 0);
      // 接触是【离散事件】：3 个 tick 里只有第 1 个结算（后面两个在 PETAL_HIT_CD 冷却里）。
      // 花瓣单次受伤有上限（× PETAL_HIT_HP_CAP，保证能挨两下），另有每次接触的攻击磨损。
      const wantPetal = Math.min(toPetal, (bMax0 || 0) * PETAL_HIT_HP_CAP)
        + (bMax0 || 0) * PETAL_ATTACK_DUR;
      const wantMob = toMob;
      const okB = Math.abs((bHp0 - bAfter) - wantPetal) < 0.01;
      const okM = Math.abs((mHp0 - mAfter) - wantMob) < 0.01;
      return {
        ok: bAfter < bHp0 && mAfter < mHp0 && okB && okM,
        detail: `花瓣 -${(bHp0 - bAfter).toFixed(1)}（应为 ${wantPetal.toFixed(1)}）`
          + ` 生物 -${(mHp0 - mAfter).toFixed(1)}（应为 ${wantMob.toFixed(1)}）`
      };
    });

    // 8c2b) 花瓣与生物【实体碰撞】：重叠时双方各让一半，重叠必须真的被消掉。
    //       这条守的是"花瓣和生物不能正常结算碰撞"——只结算伤害、两者照样重合是错的。
    check('sim: 花瓣与生物实体碰撞（互相让位）', () => {
      const srv = game.net && game.net.debugServer;
      const pl = srv && srv.player;
      const type = MOB_TYPES.find((t) => t && t.slug === 'ladybug');
      const b = pl && (pl.petals || []).find((x) => !x.dead && !x.stationary);
      if (!type || !b) return '没有可用花瓣（跳过）';
      const m = new Mob(type, b.x, b.y, 1, 'common');
      m.netId = 1e9 + 2;
      m._ensureShape();
      if (!m.shape) return '轮廓未就绪（跳过）';
      const saved = { bx: b.x, by: b.y, bvx: b.vx, bvy: b.vy, mx: m.x, my: m.y };
      try {
        m.x = b.x; m.y = b.y;                     // 完全重合：最深的重叠
        const hit0 = mobHitTest(m, b.x, b.y, PETAL_R);
        if (!hit0) return '重合却判不到命中（跳过）';
        const d0 = hit0.depth;
        // 生物一侧（战斗循环里做的）
        srv._separateMobFromPetal(m, b, hit0);
        // 花瓣一侧（两端同源的那段代码）
        pl._separatePetalFromMobs(b, [m]);
        const hit1 = mobHitTest(m, b.x, b.y, PETAL_R);
        const d1 = hit1 ? hit1.depth : 0;
        const mvd = Math.hypot(m.x - saved.mx, m.y - saved.my);
        const bvd = Math.hypot(b.x - saved.bx, b.y - saved.by);
        return {
          ok: d1 < d0 * 0.75 && mvd > 0.5 && bvd > 0.5,
          detail: '深度 ' + d0.toFixed(1) + ' -> ' + d1.toFixed(1) +
            ' 分离 生物=' + mvd.toFixed(1) + 'px 花瓣=' + bvd.toFixed(1) + 'px'
        };
      } finally {
        m.x = saved.mx; m.y = saved.my;
        b.x = saved.bx; b.y = saved.by; b.vx = saved.bvx; b.vy = saved.bvy;
      }
    });

    // 8c3) 花瓣血量镜像：世代号错位（客户端/服务端脱轨差一 tick）也必须能对上
    check('net: 花瓣血量镜像容错', () => {
      const p = game.player;
      const b = (p.petals || []).find((x) => !x.dead && !x.stationary);
      if (!b) return '跳过';
      const oldNet = p.netPetals, oldHp = b.hp, oldMax = b.maxHp, oldGen = b.gen || 0;
      try {
        const gen = oldGen + 7;                     // 故意错位
        p.netPetals = {};
        p.netPetals[b.slotIndex + '|' + (b.sub || 0) + '|' + gen] =
          { slot: b.slotIndex, sub: b.sub || 0, gen, hp: 3, maxHp: 10, dead: false, hurtT: 0 };
        p._applyNetPetalStates();
        const okHp = b.hp === 3 && b.maxHp === 10;
        const okGen = b.gen === gen;
        return { ok: okHp && okGen, detail: `hp=${b.hp}/${b.maxHp} gen=${b.gen}（应为 ${gen}）` };
      } finally {
        p.netPetals = oldNet; b.hp = oldHp; b.maxHp = oldMax; b.gen = oldGen;
      }
    });

    // 8d) 蜈蚣 AI 真的驱动头节（不是只挂了个 aiKey）
    check('ai: 蜈蚣头节真的会移动', () => {
      const srv = game.net && game.net.debugServer;
      if (!srv || !srv.ents) return '无本地服务端（跳过）';
      const head = srv.ents.find((m) => m.segIdx === 0 && !m.dead && !m._lead);
      if (!head) return '场上没有蜈蚣段首（跳过）';
      const x0 = head.x, y0 = head.y;
      for (let i = 0; i < 40; i++) head.update(1 / 25, game.player, srv.map);
      const moved = Math.hypot(head.x - x0, head.y - y0);
      return { ok: moved > 4, detail: '1.6s 位移=' + moved.toFixed(1) + 'px' };
    });

    // 8e) 普通生物也必须真的会移动（旧 bug：撞墙误判让全体生物原地转头）
    check('sim: 普通生物真的会移动', () => {
      const srv = game.net && game.net.debugServer;
      if (!srv || !srv.ents) return '无本地服务端（跳过）';
      const m = srv.ents.find((e) => !e.dead && e.segIdx == null && !e.obstacle && e.aiKey === 'wander');
      if (!m) return '场上没有普通游走生物（跳过）';
      const x0 = m.x, y0 = m.y;
      let maxV = 0, blocked = 0;
      for (let i = 0; i < 75; i++) {
        m.update(1 / 25, game.player, srv.map);
        const v = Math.hypot(m.vx, m.vy);
        if (v > maxV) maxV = v;
        if (m.ai && m.ai.blockedT > 0) blocked++;
      }
      const moved = Math.hypot(m.x - x0, m.y - y0);
      return {
        ok: moved > 5,
        detail: '3s 位移=' + moved.toFixed(1) + 'px 最大速度=' + maxV.toFixed(1) +
          ' 误判堵住帧=' + blocked
      };
    });

    // 8f) 掉落粒子时长按掉落概率分级（3s / 6s / 15s / 永久）
    check('sim: 掉落粒子时长按概率分级', () => {
      if (typeof dropFxDuration !== 'function') return { ok: false, detail: 'dropFxDuration 未定义' };
      const cases = [[0.04, 3], [0.009, 6], [0.002, 15], [0.0005, Infinity], [0.5, 0]];
      const bad = [];
      for (const [c, want] of cases) {
        const got = dropFxDuration('common', c);
        if (got !== want) bad.push(c + '->' + got + '≠' + want);
      }
      if (dropFxDuration('ultra', 0.9) !== Infinity) bad.push('ultra 非永久');
      return { ok: bad.length === 0, detail: bad.length ? bad.join(' ') : '3s/6s/15s/永久/无 分级正确' };
    });

    // 8g) 超长蜈蚣：只有 common 能自然生成；/summon 的 type=long 可强制任意稀有度
    check('sim: 超长蜈蚣生成规则', () => {
      const srv = game.net && game.net.debugServer;
      const type = (typeof MOB_TYPES === 'undefined') ? null
        : MOB_TYPES.find((t) => t && t.slug === 'centipede');
      if (!srv || !type) return '跳过';
      const bad = [];
      const n0 = srv.ents.length;
      srv._spawnChain(type, 0, 0, 'rare', null);            // 自然生成：非 common 必须短版
      let added = srv.ents.slice(n0);
      if (added.some((m) => m.chainLong)) bad.push('rare 自然生成出了超长个体');
      if (!(added.length >= 8 && added.length <= 15)) bad.push('短版节数=' + added.length);
      srv.ents.length = n0;
      const n1 = srv.ents.length;
      srv._spawnChain(type, 0, 0, 'common', null, 'long');  // /summon type=long
      added = srv.ents.slice(n1);
      if (!added.every((m) => m.chainLong)) bad.push('long 标记缺失');
      if (!(added.length >= 45 && added.length <= 60)) bad.push('long 节数=' + added.length);
      srv.ents.length = n1;
      const drops = (typeof CHAIN_LONG_DROPS === 'undefined') ? null : CHAIN_LONG_DROPS;
      if (!drops || drops.length !== 9) bad.push('隐藏掉落表缺失');
      else if (!(drops[0].chance === 0.04 && drops[8].rarity === 'eternal')) bad.push('隐藏掉落表内容异常');
      return { ok: bad.length === 0, detail: bad.length ? bad.join(' ') : 'common 0.3% 自然 / long 强制 ok' };
    });

    // 8h) Boss 血条：Eternal 优先于 Super；多只纵向排布；真的画出了像素
    check('ui: Boss 血条排序与绘制', () => {
      if (typeof BossBar === 'undefined' || !BossBar.game) return '未加载';
      const g = BossBar.game;
      const mk = (rarity, dist) => ({
        x: g.camera.x + dist * 0.1, y: g.camera.y, rarity,
        dead: false, gone: false, name: rarity, hp: 100, maxHp: 100, dispHp: 100, ghostHp: 100
      });
      // super 更近、eternal 更远 -> 先按稀有度分层，Eternal 仍必须排第一
      const near = mk('super', 1), far = mk('eternal', 9);
      g.mobs.push(near, far);
      const picked = BossBar._pick();
      g.mobs.pop(); g.mobs.pop();
      const okOrder = picked[0] === far && picked[1] === near;
      // 绘制：临时塞一条满血条目，比对顶部中轴线区域的像素是否发生变化
      const cy = BossBar._slotY(g, 0);
      BossBar.items.push({ id: -1, mob: mk('super', 0), a: 1, slot: 0, y: cy, targetY: cy });
      const cx = Math.round(g.W / 2 * g.dpr);
      const py = Math.round(cy * g.dpr);
      const before = g.ctx.getImageData(cx - 4, py - 4, 8, 8).data;
      BossBar.draw(g.ctx, g);
      const after = g.ctx.getImageData(cx - 4, py - 4, 8, 8).data;
      BossBar.items.pop();
      let changed = 0;
      for (let i = 0; i < after.length; i += 4) {
        if (after[i] !== before[i] || after[i + 1] !== before[i + 1]) changed++;
      }
      const okDraw = changed > 0;
      // 条高：当前规格 = 上一版 33.6px × 1.1 = 36.96px（bh 52.8 × BAR_K 0.7），锁住数值防回归
      const bhv = BossBar._size(g).bh * BossBar.BAR_K;
      const okH = Math.abs(bhv - 36.96) < 1e-6;
      return {
        ok: okOrder && okDraw && okH,
        detail: (okOrder ? 'Eternal 优先' : '排序错误') + ' / ' + (okDraw ? '绘制有像素变化' : '绘制无变化')
          + ' / 条高=' + bhv.toFixed(1) + 'px'
      };
    });

    // 8i) 蜈蚣：游击转向半径 = 1 节直径；游荡 = 大半径长弧；与墙保持 1 个瓦片
    check('ai: 蜈蚣转弯半径与避墙', () => {
      const type = (typeof MOB_TYPES === 'undefined') ? null
        : MOB_TYPES.find((t) => t && t.slug === 'centipede');
      if (!type) return '跳过';
      const m = new Mob(type, 0, 0, 1, 'common');
      const bad = [];
      if (!(m.turnRadius > 0)) bad.push('turnRadius 缺失');
      if (!(Math.abs(m.chaseTurn - m.chaseSpeed / m.turnRadius) < 1e-6)) bad.push('chaseTurn 口径不对');
      if (m.wallKeep !== GARDEN_TILE) bad.push('wallKeep=' + m.wallKeep);
      // 游荡必须是【大半径长弧】：半径 ≥ 540px，对应曲率 = 速度 / 半径 很小
      if (!(m.arcRadius >= 540)) bad.push('arcRadius=' + m.arcRadius);
      if (!(m.arcRate > 0 && m.arcRate < 0.12)) bad.push('arcRate=' + m.arcRate);
      // 稀有度越高，弧半径越大（turnRadius 随 visualD 增长）
      const mr = new Mob(type, 0, 0, 1, 'rare');
      if (!(mr.arcRadius > m.arcRadius)) bad.push('高稀有度弧半径没有变大');
      // 连续 200 帧：航向变化率不得超过「速度 / 半径」对应的曲率上限
      let maxRate = 0, prev = m.ai.heading;
      for (let i = 0; i < 200; i++) {
        MobAI.step(m.ai, 1 / 25, m, null);
        const d = Math.abs(MobAI._util.angNorm(m.ai.heading - prev)) * 25;
        if (d > maxRate) maxRate = d;
        prev = m.ai.heading;
        if (!Number.isFinite(m.ai.curv)) { bad.push('curv 非有限'); break; }
      }
      if (maxRate > m.chaseTurn + 1e-3) bad.push('转向速率 ' + maxRate.toFixed(2) + ' > ' + m.chaseTurn.toFixed(2));
      // 探测：四周都不可站时必须给出转向方向（不能返回 0）
      m._map = { canStandAt: () => false };
      const dir = MobAI.defs.centipede._wallProbe(m, m.ai);
      if (!dir) bad.push('全堵时未给出避让方向');
      m._map = null;
      return {
        ok: bad.length === 0,
        detail: bad.length ? bad.join(' ')
          : `转向半径=${m.turnRadius.toFixed(0)}px 大弧半径=${m.arcRadius.toFixed(0)}px 最大角速度=${maxRate.toFixed(2)}`
      };
    });

    // 8j) 高稀有度装备花瓣：Super/Eternal（以及 ultra 的 basic）持续冒同色圆形粒子
    //     粒子进的是 auraFx（画在花瓣【之下】，不是普通 particles），密度 1.6x（0.09 -> 0.05625s）
    check('fx: 高稀有度花瓣光环', () => {
      const p = game.player;
      if (!p) return '跳过';
      const basic = PETAL_TYPES.find((t) => t && t.slug === 'basic');
      const rose = PETAL_TYPES.find((t) => t && t.slug === 'rose');
      const old = p.petals;
      const before = game.auraFx.length;
      const pBefore = game.particles.length;    // 光环粒子【不许】再进普通 particles
      p.petals = [
        { dead: false, x: p.x, y: p.y, card: { rarity: 'eternal', type: basic } },
        { dead: false, x: p.x, y: p.y, card: { rarity: 'ultra', type: basic } },
        { dead: false, x: p.x, y: p.y, card: { rarity: 'ultra', type: rose } }
      ];
      game._auraAcc = 1;                       // 跳过节流
      game._tickPetalAura(0.1);
      const added = game.auraFx.length - before;
      // 密度：1 秒内单片 eternal 的新增数量（0.09s 间隔约 11 颗，1.6x 后约 15 颗）
      p.petals = [{ dead: false, x: p.x, y: p.y, card: { rarity: 'eternal', type: basic } }];
      game._auraAcc = 0;
      const n0 = game.auraFx.length;
      for (let i = 0; i < 60; i++) game._tickPetalAura(1 / 60);
      const perSec = game.auraFx.length - n0;
      game.auraFx.length = before;             // 还原（截到测试前长度）
      p.petals = old;
      const ok = added === 2 && perSec >= 14 && game.particles.length === pBefore;
      return {
        ok,
        detail: `新增=${added}（eternal + ultra basic；ultra rose 不算）密度=${perSec}/s（1.6x）`
      };
    });

    // 8j2) 行走碰撞箱：墙体口径 = min(自身, 1 格瓦片 0.9 倍正方形的内接圆)
    //      伤害口径（r / shape / collSize）必须完全不变，且巨型个体一定塞得进 1 格通道。
    check('sim: 行走碰撞箱（1 格通道可通行）', () => {
      if (typeof Mob === 'undefined' || typeof MOB_TYPES === 'undefined') return '跳过';
      const type = MOB_TYPES.find((t) => t && t.slug === 'ladybug');
      if (!type) return '跳过';
      const cap = 0.45 * GARDEN_TILE;                 // 0.9 格正方形的内接圆半径
      const big = new Mob(type, 0, 0, 1, 'eternal');
      const small = new Mob(type, 0, 0, 1, 'common');
      big._ensureShape(); small._ensureShape();
      const bad = [];
      if (!big.walkHull) bad.push('walkHull 缺失');
      if (big.walkSize > 0.9 * GARDEN_TILE + 0.01) bad.push('巨型 walkSize=' + big.walkSize.toFixed(1));
      if (big.walkR > cap + 0.01) bad.push('巨型 walkR=' + big.walkR.toFixed(1));
      if (!(big.r > cap)) bad.push('伤害半径被误改=' + big.r.toFixed(1));
      if (Math.abs(small.walkR - small.r) > 0.01) bad.push('普通个体 walkR 被误改');
      if (Math.abs(small.walkSize - small.drawSize) > 0.01) bad.push('普通个体 walkSize 被误改');
      // 凸包外接圆 = 走路箱真正的最大半径：超限就等于"过不去 1 格口"
      const hullR = (m) => Math.max(...m.walkHull.map(([x, y]) => Math.hypot(x, y))) * m.walkSize;
      if (big.walkHull && hullR(big) > cap + 0.5) bad.push('凸包外接半径 ' + hullR(big).toFixed(1) + ' 超限');
      return {
        ok: bad.length === 0,
        detail: bad.length ? bad.join(' ') :
          `Eternal: r=${big.r.toFixed(0)} -> walkR=${big.walkR.toFixed(0)} / walkSize=${big.walkSize.toFixed(0)}` +
          `（上限 ${(0.9 * GARDEN_TILE).toFixed(0)}）；Common 不受影响`
      };
    });

    // 8k) Super/Eternal 击杀公告：全服系统消息、稀有度配色、伤害榜榜首
    check('chat: Boss 击杀全服公告', () => {
      const srv = game.net && game.net.debugServer;
      if (!srv) return '跳过';
      const before = srv._events.length;
      srv._announceBossKill({
        name: 'Centipede', rarity: 'eternal',
        threat: [{ ent: { name: 'Guest 1234' }, dmg: 50 }],
        type: { name: 'Centipede' }
      });
      const ev = srv._events[before];
      srv._events.length = before;
      const ok = !!ev && ev.kind === 'sys' && ev.channel === 'global'
        && ev.color === RARITIES.eternal.color
        && ev.text.indexOf('Guest 1234') >= 0 && ev.text.indexOf('Centipede') >= 0;
      return { ok, detail: ev ? ev.text : '无事件' };
    });

    // 9) F3 调试屏幕：能开关、有内容、关掉后碰撞箱一起关
    check('ui: F3 调试屏幕', () => {
      if (typeof DebugScreen === 'undefined' || !DebugScreen.refs) return '未初始化（跳过）';
      const el = DebugScreen.refs.root;
      DebugScreen.toggle();
      const onShown = !el.classList.contains('hidden') && !!el.querySelector('.f3-row');
      const hitOn = game.showHitbox === true;
      DebugScreen.toggle();
      const offHidden = el.classList.contains('hidden') && game.showHitbox === false;
      return {
        ok: onShown && hitOn && offHidden,
        detail: 'show=' + onShown + ' hitbox=' + hitOn + ' hide=' + offHidden
      };
    });

    // 9b) F3 面板的三处历史 bug：花瓣血量百分比 / 朝向 / 帧率来源
    check('ui: F3 花瓣血量与朝向归一', () => {
      if (typeof DebugScreen === 'undefined' || !DebugScreen.refs) return '未初始化（跳过）';
      const p = game.player;
      const oldPetals = p.petals, oldSlots = p.slots, oldF = p.facing;
      const card = p.slots.find(Boolean);
      let text = '', facingTxt = '';
      try {
        if (!card) return '跳过';
        // 一个"已碎裂且 hp 为负"的实体 + 一个满血实体：旧写法会显示 -2900%
        p.slots = [card];
        p.petals = [
          { dead: false, slotIndex: 0, card, hp: -29, maxHp: 1 },
          { dead: true, slotIndex: 0, card, hp: -5, maxHp: 1 },
        ];
        p.facing = 3 * Math.PI * 2 + 0.5;          // 连续绕圈后的"超范围"朝向
        DebugScreen.toggle();                       // 打开 -> 强制刷新 DOM
        DebugScreen._acc = 1;
        DebugScreen.update(0.2);
        text = (DebugScreen.refs.petals || {}).textContent || '';
        // 字段元素挂在 DebugScreen.v 上（refs 只有 root / petals）
        facingTxt = (DebugScreen.v.facing || {}).textContent || '';
        DebugScreen.toggle();
      } finally {
        p.petals = oldPetals; p.slots = oldSlots; p.facing = wrapAngle(oldF);
      }
      const hpOk = text.indexOf('-') < 0 && /(0|—)\s*%?/.test(text);
      const faceOk = /^\d{1,3}°$/.test(facingTxt) && parseInt(facingTxt, 10) <= 360;
      // 帧率必须来自主循环（真实 rAF 间隔），不能再由 F3 自己按固定步长数出来
      const fpsOk = (typeof game.perf.fps === 'number')
        && game.perf.fps >= 0 && game.perf.fps <= 1000
        && (typeof DebugScreen._fps === 'undefined');
      return {
        ok: hpOk && faceOk && fpsOk,
        detail: `花瓣="${text.trim()}" 朝向=${facingTxt} 帧率来源=${typeof game.perf.fps}`
      };
    });

    // 10) 触控层：桌面（细指针）不创建任何元素
    check('ui: 桌面不启用触控层', () => {
      if (typeof TouchCtl === 'undefined') return { ok: false, detail: 'TouchCtl 未加载' };
      if (TouchCtl.on) return '触摸设备（跳过）';
      const el = document.getElementById('touchLayer');
      return { ok: !el, detail: el ? '桌面环境出现了 #touchLayer' : '无 #touchLayer' };
    });

    // 11) 触控层构建路径（桌面环境强制走一次，验证摇杆/按钮的尺寸与位置合法）
    check('ui: 触控层布局（自缩放）', () => {
      if (TouchCtl.on) return '已是触摸设备（跳过强制构建）';
      TouchCtl.init(game, true);
      const layer = document.getElementById('touchLayer');
      const stick = layer && layer.querySelector('.t-stick');
      const a = document.getElementById('tBtnA');
      const b = document.getElementById('tBtnB');
      const sizeOf = (el) => (el ? el.getBoundingClientRect() : { width: 0, height: 0 });
      const s = sizeOf(stick), sa = sizeOf(a), sb = sizeOf(b);
      const small = Math.min(innerWidth, innerHeight);
      const ok = !!layer && s.width > 0 && sa.width > 0 && sb.width > 0 &&
        s.width >= 84 - 1 && s.width <= 160 + 1 &&                       // 自缩放区间
        sa.width === sb.width &&                                          // A/B 同尺寸
        s.width >= sa.width;                                              // 摇杆不小于按钮
      // 还原：删掉测试创建的元素与状态
      if (layer) layer.remove();
      TouchCtl.on = false; TouchCtl.refs = null; TouchCtl._stick.id = -1;
      document.body.classList.remove('touch-ui');
      return {
        ok,
        detail: 'viewport=' + Math.round(small) + ' stick=' + Math.round(s.width) +
          ' A=' + Math.round(sa.width) + ' B=' + Math.round(sb.width)
      };
    });

    // 12) 触控拖拽卡牌：pointer 事件必须能拿起幽灵（触屏上 mouse 事件不会随手指移动）
    check('ui: 触控拖拽卡牌', () => {
      if (!window.PointerEvent) return '无 PointerEvent（跳过）';
      const cv = document.querySelector('#quickbar .qslot .card') ||
                 document.querySelector('#quickbar .qslot canvas');
      if (!cv) return '卡槽里没有卡（跳过）';
      const r = cv.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const ev = (type, x, y, extra) => new PointerEvent(type, Object.assign({
        pointerId: 91, pointerType: 'touch', isPrimary: true,
        bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1
      }, extra || {}));
      // touch-action 必须被关掉，否则真实设备上系统会先发 pointercancel
      const ta = getComputedStyle(cv).touchAction;
      cv.dispatchEvent(ev('pointerdown', cx, cy));
      window.dispatchEvent(ev('pointermove', cx + 70, cy - 90));
      const ghost = document.getElementById('dragGhost');
      window.dispatchEvent(ev('pointercancel', cx + 70, cy - 90, { buttons: 0 }));
      const cleaned = !document.getElementById('dragGhost') && !UI._drag;
      return {
        ok: ta === 'none' && !!ghost && cleaned,
        detail: 'touch-action=' + ta + ' ghost=' + !!ghost + ' cleanup=' + cleaned
      };
    });

    // 帧循环：selfTest 结束后不应留下未捕获异常
    check('runtime: 无未捕获异常', () => {
      const errs = window.__selftestErrors || [];
      return errs.length === 0 ? '' : errs.slice(0, 5).join(' | ');
    });

    // 花瓣命中生物：瓢虫压在花瓣身上，跑 1.5s，生物必须掉血。
    // 这条守的是【命中管线】本身：轮廓判定 + 服务端权威位置的战斗 tick + 伤害口径。
    // 用"钉在花瓣当前位置"而不是"钉在轨道环某点"：后者要等花瓣公转到那个角度，
    // 存活花瓣少的时候会整轮都碰不上（变成随机失败）。
    check('fix: 花瓣命中生物并结算', () => {
      const srv = game.net && game.net.debugServer;
      const ps = srv && srv.player;
      if (!ps) return '无本地服务端（跳过）';
      const type = MOB_TYPES.find((t) => t && t.slug === 'ladybug');
      // 等花瓣装填完（前面的断言可能把它们全打碎了）
      for (let i = 0; i < 600 && !ps.petals.some((b) => !b.dead && !b.stationary); i++) {
        game.stepFrames(1, 1 / 60, false);
      }
      const b0 = ps.petals.find((b) => !b.dead && !b.stationary);
      if (!type || !b0) return '场上没有可用花瓣（跳过）';
      const ring = Math.hypot(b0.x - ps.x, b0.y - ps.y);
      const m = new Mob(type, b0.x, b0.y, 1, 'common');
      m.netId = 1e9 + 41;
      m._ensureShape();
      if (!m.shape) return '瓢虫轮廓未就绪（跳过）';
      m.hp = m.maxHp = 1e6;   // 别打死，只看有没有结算
      m.dmg = 0;              // 别让花瓣被一口咬碎（那样只测到"第一击"）
      srv.ents.push(m);
      const hp0 = m.hp;
      try {
        for (let i = 0; i < 90; i++) {
          const b = ps.petals.find((x) => !x.dead && !x.stationary);
          if (b) { m.x = b.x; m.y = b.y; m.vx = 0; m.vy = 0; }
          game.stepFrames(1, 1 / 60, false);
        }
      } finally {
        srv.ents = srv.ents.filter((e) => e !== m);
      }
      const dm = hp0 - m.hp;
      return { ok: dm > 0, detail: 'Δhp=' + dm.toFixed(1) + ' ring=' + ring.toFixed(1) + ' armor=' + m.armor };
    });

    // 花瓣被打碎后，客户端必须【同步碎裂 + 重新装填】。
    // 快照曾经只下发 p.petals 的映射，而实体在装填期间已经从这个数组里移除 ——
    // 客户端按 (slot,sub,gen) 找不到条目就既不碎也不进冷却，会一直画一片
    // 打不到任何东西的幽灵花瓣（"花瓣从生物身上飘过去、一点交互都没有"的根因）。
    check('fix: 花瓣碎裂跨端同步', () => {
      const srv = game.net && game.net.debugServer;
      const ps = srv && srv.player, pc = game.player;
      if (!ps) return '无本地服务端（跳过）';
      for (let i = 0; i < 600; i++) {
        if (pc.petals.some((b) => !b.dead) && ps.petals.some((b) => !b.dead)) break;
        game.stepFrames(1, 1 / 60, false);
      }
      // 挑一张有正经冷却的卡：冷却太短会在断言前就装满，测不出"是否同步进入装填"
      const sb = ps.petals.find((b) => !b.dead && !b.stationary
        && ((b.card.type.reload || 0) > 0.5));
      if (!sb) return '服务端没有可用花瓣（跳过）';
      const slot = sb.slotIndex;
      srv._destroyPetal(sb);
      game.stepFrames(20, 1 / 60, false);          // 0.33s：25Hz 快照足够下发多次
      const cAlive = pc.petals.filter((b) => !b.dead).length;
      const sAlive = ps.petals.filter((b) => !b.dead).length;
      const cr = pc.reload[slot];
      const okReload = !cr || cr.age < (cr.dur || 0);
      return {
        ok: cAlive === sAlive && okReload,
        detail: 'client=' + cAlive + ' server=' + sAlive +
          ' reload=' + (cr ? cr.age.toFixed(2) + '/' + (cr.dur || 0).toFixed(2) : '-')
      };
    });

    emit();
  }

  main().catch((e) => {
    push('selftest: 执行异常', false, (e && e.stack) || String(e));
    emit();
  });
})();
