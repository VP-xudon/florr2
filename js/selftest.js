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

  // 受控实体表（sim/exit.js 的 createExitList）刻意【不提供】clear / length setter ——
  // 那是"绕过退场动画直接删实体"的入口。所以测试里要复位场上实体就换一张新表。
  function resetWebFields(p, saved) {
    if (!p) return;
    p.webFields = createExitList();
    if (saved) for (const x of saved) p.webFields.add(x);
  }

  // 自检期间世界照常推进（stepFrames 会真的跑战斗），玩家可能已经被生物咬死。
  // 需要"活着的玩家"的断言先复活 —— 否则会连环假失败（与被测逻辑无关）。
  function ensureAlive(game) {
    const p = game.player;
    if (!p || !p.dead) return false;
    game.respawn();
    game.stepFrames(2, 1 / 60, false);
    return true;
  }

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

    // 自检接管前游戏已经跑了几秒（素材加载），玩家可能已经被生物咬死。
    // 那时后面靠前的断言（击退守恒 / Leaf 回血…）会连环假失败 —— 统一从"活的玩家"开始。
    if (game.player && game.player.dead) {
      game.respawn();
      game.stepFrames(2, 1 / 60, false);
    }

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

    // ---- 动态卡面预热（异步）：渲染一张 Third Eye 卡，改朝向后再取样，
    //      验证"卡面真的会跟着本地朝向重画"（而不是画一次就定格）。
    const dynProbe = await (async () => {
      if (typeof CardRenderer === 'undefined' || !PETAL_TYPES) return null;
      const eye = PETAL_TYPES.find((x) => x && x.slug === 'third_eye');
      if (!eye) return null;
      // live: true = 模拟"装在主卡槽里"的卡（只有这种卡才跟随玩家朝向）；
      // 另一张不带 live = 背包/副槽里的同款卡，必须保持静止。
      const cv = CardRenderer.createCard({ rarity: 'common', svg: eye.svg, count: null, live: true });
      cv.style.cssText = 'position:absolute;left:-9999px;top:0;width:96px;height:96px';
      document.body.appendChild(cv);
      const cv2 = CardRenderer.createCard({ rarity: 'common', svg: eye.svg, count: null });
      cv2.style.cssText = 'position:absolute;left:-9999px;top:0;width:96px;height:96px';
      document.body.appendChild(cv2);
      const sampleOf = (canvas) => {
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        const d = ctx.getImageData(0, 0, W, H).data;
        let sx = 0, n = 0;
        for (let y = 0; y < H * 0.7; y++) {          // 只看上半部（避开白色名称文字）
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240 && d[i + 3] > 200) { sx += x; n++; }
          }
        }
        return n ? sx / n : null;
      };
      const pl = game.player, oldF = pl.facing;
      try {
        await new Promise((r) => setTimeout(r, 1200));       // 等素材与首帧
        pl.facing = 0;
        await new Promise((r) => setTimeout(r, 200));
        const right = sampleOf(cv), rightIdle = sampleOf(cv2);
        pl.facing = Math.PI;
        await new Promise((r) => setTimeout(r, 200));
        const left = sampleOf(cv), leftIdle = sampleOf(cv2);
        return { right, left, rightIdle, leftIdle };
      } finally {
        pl.facing = oldF;
        cv.remove();
        cv2.remove();
      }
    })();

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
      // 玩家可能已死（自检期间被生物咬死）：先复活，否则体伤分支根本不会触发
      ensureAlive(game);
      // 出生无敌会挡掉伤害，两端都要清（否则快照会把无敌又加回来）。
      // 受伤无敌帧也要清：周围生物可能刚好在这几帧咬了玩家一口，那样下面的人造接触会被
      // hurtInvuln 直接免伤，断言就变成"看运气"（这条曾经偶发 FAIL 就是这个原因）。
      p.invuln = 0; p.invulnSrc = {}; p.invulnTotal = 0; p.hurtInvuln = 0;
      srv.player.invuln = 0; srv.player.invulnSrc = {}; srv.player.invulnTotal = 0;
      srv.player.hurtInvuln = 0;
      // 高稀有度生物一击就有上千伤害，会把玩家直接打死（死亡分支不再发 hurt）。
      // 把两端血量抬高，保证测的是"击退"而不是"被秒"。
      p.maxHp = p.hp = 1e6;
      srv.player.maxHp = srv.player.hp = 1e6;
      // 必须挑一只有伤害的生物：dmg=0 的生物即使命中也不会走体伤分支。
      // 【多节生物（蜈蚣）不行】：它的体节位置每帧被链解算覆盖，钉在玩家身上的坐标
      // 下一帧就被拉回原链 —— 永远碰不到玩家（表现为"命中=0"的偶发失败）。
      const view = game.mobs.find((x) => !x.dead && x.dmg > 0 && x.segIdx == null);
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
      // 世界里还有【敌对生物在真实战斗】（蜘蛛看见就扑），它们的 hurt 事件会把 total
      // 覆盖掉、还会抢先吃掉受伤无敌帧 —— 测量期间只留测试生物，结束后原样还原。
      const savedEnts = srv.ents, savedAwake = srv._awake;
      const savedHp = sm.hp, savedMaxHp = sm.maxHp;
      try {
        srv.ents = [sm]; srv._awake = [sm];
        // 花瓣也在打它：血量不抬高的话，花瓣几个 tick 就把它打死（死亡分支不发 hurt）
        sm.hp = sm.maxHp = 1e6;
        for (let i = 0; i < 60 && total == null; i++) {
          sm.x = srv.player.x; sm.y = srv.player.y;
          sm.vx = 0; sm.vy = 0;
          game.update(1 / 60);
        }
      } finally {
        srv.ents = savedEnts; srv._awake = savedAwake;
        sm.hp = savedHp; sm.maxHp = savedMaxHp;
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
            ' hurtInvuln=' + (srv.player.hurtInvuln || 0).toFixed(2) +
            ' 玩家dead=' + (srv.player.dead ? 'Y' : 'N') + '）'
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
      // 复活点若落在减速瓦片上会一直不装填，这里等到出第一片花瓣为止（上限 10s）。
      // 世界里可能有敌对生物（蜘蛛会主动扑上来）把刚复活的玩家再咬死 —— 那样花瓣永远为 0，
      // 与被测逻辑无关。这一段给两端副本临时上无敌，结束后撤销。
      const canInv = (typeof InvulnFX !== 'undefined' && InvulnFX.add);
      if (canInv) { InvulnFX.add(p, 'selftest', 60); InvulnFX.add(srv.player, 'selftest', 60); }
      let waited = 0;
      let diag = '';
      try {
        while (p.petals.length === 0 && waited < 600) {
          if (p.dead) {
            game.respawn();
            if (canInv) InvulnFX.add(p, 'selftest', 60);
            // 中毒不进快照、也不被无敌帧挡（DoT 语义），会把刚复活的玩家反复咬死 —— 清掉
            if (typeof StatusFX !== 'undefined') {
              StatusFX.remove(p, 'poison');
              StatusFX.remove(srv.player, 'poison');
            }
          }
          game.stepFrames(10, 1 / 60, false);
          waited += 10;
        }
      } finally {
        if (canInv) { InvulnFX.remove(p, 'selftest'); InvulnFX.remove(srv.player, 'selftest'); }
        diag = ' slots=' + p.slots.length
          + ' reload=' + (p.reload[0] ? p.reload[0].age.toFixed(2) + '/' + p.reload[0].dur.toFixed(2) : '-')
          + ' hold=' + (p.reloadHold && p.reloadHold[0] ? 1 : 0)
          + ' dead=' + p.dead + ' poison=' + (typeof StatusFX !== 'undefined' ? StatusFX.has(p, 'poison') : '-');
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
          ' slowTile=' + !!p.slowTile + ' waited=' + waited + diag
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
      ensureAlive(game);            // 玩家死了就没法验证回血了
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

    check('engine: Orange 与 Missile 数据/能力', () => {
      const pick = (slug) => PETAL_TYPES.find((x) => x && x.slug === slug);
      const orange = pick('orange'), missile = pick('missile');
      if (!orange || !missile) return { ok: false, detail: 'Orange 或 Missile 未启用' };
      const layout = CardRenderer.multiLayout(orange.svg, 'common');
      const rotations = layout.map((part) => part.rot);
      const equalTurn = rotations.length === 3
        && rotations.every((angle, i) => i === 0 || Math.abs((angle - rotations[i - 1]) - TAU / 3) < 1e-9);
      const entityLayout = CardRenderer.entityFormationLayout(orange.svg, 'common');
      const sizeOk = Math.abs(layout[0].k - 0.936) < 1e-9
        && entityLayout.every((part) => part.k === 1);
      const missileStats = [
        ['unusual', 105, 6], ['rare', 315, 18], ['epic', 945, 54],
        ['legendary', 2835, 162], ['mythic', 8505, 486],
        ['ultra', 25515, 1458], ['super', 76545, 4374],
        ['eternal', 229635, 13122], ['unique', 229635, 13122]
      ];
      const statsOk = missileStats.every(([rarity, dmg, hp]) => {
        const stats = petalStatsFor(missile, rarity);
        return stats.dmg === dmg && stats.hp === hp;
      });
      const targetAngle = Math.PI / 36;
      const missileBody = { x: 0, y: 0, card: { type: missile } };
      const launch = PetalFX.defs.missile.detach({
        petal: missileBody, type: missile, player: { facing: 0 },
        mobs: [{ x: Math.cos(targetAngle) * 200, y: Math.sin(targetAngle) * 200, dead: false }]
      });
      const launchAngle = Math.atan2(launch.vy, launch.vx);
      const speedOk = Math.abs(Math.hypot(launch.vx, launch.vy) - 1.3 * PLAYER_BASE_SPEED) < 1e-9;
      const aimOk = Math.abs(launchAngle - targetAngle) < 1e-9
        && Math.abs(missileBody.flightRot - (targetAngle - MISSILE_TIP_ANGLE)) < 1e-9;
      const outsideBody = { x: 0, y: 0, card: { type: missile } };
      const outsideLaunch = PetalFX.defs.missile.detach({
        petal: outsideBody, type: missile, player: { facing: 0 },
        mobs: [{ x: Math.cos(Math.PI / 12) * 200, y: Math.sin(Math.PI / 12) * 200, dead: false }]
      });
      const noTrackOk = Math.abs(Math.atan2(outsideLaunch.vy, outsideLaunch.vx)) < 1e-9;
      const ok = orange.reload === 1.5 && equalTurn && sizeOk && statsOk && speedOk && aimOk && noTrackOk
        && missile.reload === 1.5 && missile.launchMode === 'reach'
        && missile.launchDelay === 0
        && missile.launch.speedK === 1.3 && missile.launch.life === 2;
      return {
        ok,
        detail: `Orange reload=${orange.reload} rotation=${rotations.join(',')} size=${sizeOk}; `
          + `Missile stats=${statsOk} aim=${aimOk} straight=${noTrackOk} speed=${speedOk}`
      };
    });

    check('engine: Hornet 属性/附庸导弹与隐藏掉落', () => {
      const hornet = MOB_TYPES.find((mob) => mob && mob.slug === 'hornet');
      const missile = PETAL_TYPES.find((petal) => petal && petal.slug === 'missile');
      const pairs = [
        ['common', 60, 50, 1, 1, 5, 10, 2],
        ['unusual', 225, 150, 2, 2, 25, 30, 3],
        ['rare', 810, 450, 7, 6, 125, 90, 4],
        ['epic', 3240, 1350, 22, 53, 625, 270, 5],
        ['legendary', 19440, 4050, 65, 486, 3125, 810, 6],
        ['mythic', 189540, 12150, 194, 6856, 15625, 2430, 7],
        ['ultra', 8748000, 36450, 583, 266727, 78125, 7290, 8],
        ['super', 262440000, 109350, 583, 16401473, 390625, 21870, 9],
        ['eternal', 1574640000, 328050, 583, 16401473, 1953125, 65610, 10],
        ['unique', 1574640000, 328050, 583, 16401473, 1953125, 65610, 10]
      ];
      if (!hornet || !missile) return { ok: false, detail: 'Hornet/Missile 缺失' };
      const valuesOk = pairs.every(([rarity, hp, dmg, armor, exp, mhp, mdmg, dur]) => {
        const stats = hornet.rarityStats[rarity];
        return stats.hp === hp && stats.dmg === dmg && stats.armor === armor && stats.exp === exp
          && stats.missileHp === mhp && stats.missileDmg === mdmg && stats.missileDur === dur;
      });
      const drops = mobDropRows(hornet.id, 'common');
      const visibleMissile = drops.some((row) => row.slug === 'missile');
      const magicHidden = DROP_HIDDEN_SLUGS.has('magic_missile');
      const magicianReplacement = MOB_DROP_MAGICIAN.hornet.missile === 'magic_missile';
      const spawned = parseSpawnMobs('hornet:1').some((entry) => entry.type.slug === 'hornet');
      return {
        ok: valuesOk && visibleMissile && magicHidden && magicianReplacement && spawned,
        detail: `values=${valuesOk} missileDrop=${visibleMissile} magicHidden=${magicHidden}`
          + ` replacement=${magicianReplacement} spawnable=${spawned}`
      };
    });

    check('ai: Hornet 发射/回转固定完成', () => {
      const hornetType = MOB_TYPES.find((mob) => mob && mob.slug === 'hornet');
      if (!hornetType) return 'Hornet 未启用（跳过）';
      const player = { x: 220, y: 0, vx: 0, vy: 0, dead: false };
      const mob = new Mob(hornetType, 0, 0, 1, 'common');
      mob._map = { lineBlocked: () => false };
      mob.threat = [{ ent: player, dmg: 1 }];
      mob.facing = 0;
      mob.hornet.missile.x = 0; mob.hornet.missile.y = 0;
      mob.ai.hornetMode = 'approach';
      const first = MobFX.stepMob(mob, 1 / 60, player);
      const immediateAim = mob.hornet.spinPhase === 'aim' && first.x === 0 && first.y === 0;
      const snapshotAngle = mob.hornet.launchAngle;
      player.x = 5000;
      let projectile = null;
      for (let i = 0; i < 200; i++) {
        MobFX.stepMob(mob, 1 / 60, player);
        if (mob.hornet.missile && mob.hornet.missile.flight) { projectile = mob.hornet.missile; break; }
      }
      const launched = !!projectile && Math.abs(Math.atan2(projectile.vy, projectile.vx) - snapshotAngle) < 1e-9;
      let returned = false;
      for (let i = 0; i < 200; i++) {
        MobFX.stepMob(mob, 1 / 60, player);
        if (!mob.hornet.spinPhase) { returned = true; break; }
      }
      return {
        ok: immediateAim && launched && returned,
        detail: `immediate=${immediateAim} straightLaunch=${launched} returnComplete=${returned}`
      };
    });

    // 6b) 装备型花瓣：Faster 加最大转速、Third Eye 加 reach，且同种只认最左一格
    check('engine: 装备加成（转速 / reach / 不可堆叠）', () => {
      const p = game && game.player;
      const pick = (slug) => (typeof PETAL_TYPES !== 'undefined' ? PETAL_TYPES : [])
        .find((x) => x && x.slug === slug);
      const faster = pick('faster'), eye = pick('third_eye');
      if (!p || !faster || !eye) return '缺少花瓣数据（跳过）';
      const saved = p.slots.slice();
      try {
        // 只放 3 格：1×faster(common +0.5) / 2×third_eye(legendary +40，第二件应作废)
        p.slots = [{ type: faster, rarity: 'common' },
                   { type: eye, rarity: 'legendary' },
                   { type: eye, rarity: 'eternal' }];
        p.recompute();
        const rotOk = Math.abs((p.rotMax - PETAL_SPIN) - 0.5) < 1e-6;
        const reachOk = Math.abs((p.reachBonus || 0) - 40) < 1e-6;
        const stackOk = p.slotActive[0] === true && p.slotActive[1] === true && p.slotActive[2] === false;
        return {
          ok: rotOk && reachOk && stackOk,
          detail: `rotMax=${p.rotMax.toFixed(2)}（+${(p.rotMax - PETAL_SPIN).toFixed(2)}）` +
            ` reach=+${p.reachBonus} 生效=${p.slotActive.map((v) => (v ? '1' : '0')).join('')}`
        };
      } finally {
        p.slots = saved;
        p.recompute();
      }
    });

    // 6b2) 所有花瓣使用旧版 Legendary 花瓣的固定击退质量
    check('sim: 花瓣击退质量固定为 Legendary', () => {
      if (typeof petalKnockbackWeight !== 'function' || typeof rarityWeight !== 'function') {
        return '缺少重量函数（跳过）';
      }
      const expected = rarityWeight('legendary') * 0.5 * Math.pow(0.1, 0.5);
      const same = RARITY_ORDER.every((r) => Math.abs(petalKnockbackWeight(r) - expected) < 1e-9);
      const ok = same;
      return {
        ok,
        detail: `所有花瓣=${petalKnockbackWeight('common').toFixed(3)}，`
          + `旧 Legendary=${expected.toFixed(3)}，生物 Legendary=${rarityWeight('legendary').toFixed(3)}`
      };
    });

    // 6b3) 素材接管：Third Eye 贴图里画死的眼珠必须被改写掉（否则渲染出两只眼）
    check('engine: 饰品素材去掉"死眼珠"', () => {
      if (typeof PetalFX === 'undefined' || !PetalFX.artVariant) return '引擎未就绪（跳过）';
      const pick = (slug) => (typeof PETAL_TYPES !== 'undefined' ? PETAL_TYPES : [])
        .find((x) => x && x.slug === slug);
      const eye = pick('third_eye');
      if (!eye) return '缺少 third_eye（跳过）';
      const src = '<svg><path fill="#eee" d="M0 0"/><path fill="#111" d="M1 1"/></svg>';
      const out = PetalFX.artVariant(eye.svg, src);
      const ok = !!out && out.indexOf('#eee') < 0 && out.indexOf('#111') >= 0;
      return { ok, detail: ok ? '浅色眼珠已改写为眼眶色' : ('未改写：' + String(out).slice(0, 60)) };
    });

    // 6b4) 可动部件真的会动：同一个 box 下，朝向不同 -> 眼珠落在不同位置
    //      （卡面"静态"的回归防线：卡面走的就是这个函数 + 本地朝向）
    check('engine: 卡面眼珠跟随朝向', () => {
      if (typeof PetalFX === 'undefined' || !PetalFX.artOverlay || !PetalFX.hasOverlay) {
        return '引擎未就绪（跳过）';
      }
      const pick = (slug) => (typeof PETAL_TYPES !== 'undefined' ? PETAL_TYPES : [])
        .find((x) => x && x.slug === slug);
      const eye = pick('third_eye'), basic = pick('basic');
      if (!eye) return '缺少 third_eye（跳过）';
      const overlayOk = PetalFX.hasOverlay(eye.svg) === true
        && (!basic || PetalFX.hasOverlay(basic.svg) === false);
      // 整张贴图当画布：box 覆盖完整素材坐标系（viewBox 0 0 110 110）
      const box = { x: 0, y: 0, w: 110, h: 110, ux: 0, uy: 0, uw: 110, uh: 110 };
      const cv = document.createElement('canvas');
      cv.width = cv.height = 110;
      const ctx = cv.getContext('2d');
      const centroid = (look) => {
        ctx.clearRect(0, 0, 110, 110);
        PetalFX.artOverlay(ctx, eye.svg, look, box);
        const d = ctx.getImageData(0, 0, 110, 110).data;
        let sx = 0, sy = 0, n = 0;
        for (let y = 0; y < 110; y++) {
          for (let x = 0; x < 110; x++) {
            const i = (y * 110 + x) * 4;
            // 眼珠是纯白
            if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240 && d[i + 3] > 200) { sx += x; sy += y; n++; }
          }
        }
        return n ? { x: sx / n, y: sy / n, n } : null;
      };
      const right = centroid(0), left = centroid(Math.PI);
      const dx = (right && left) ? (right.x - left.x) : 0;
      const moved = !!right && !!left && Math.abs(dx) > 3;
      // 本地朝向来源必须与玩家一致（卡面用的就是它）
      const lookOk = (typeof PetalFX.lookAngle === 'function')
        && (PetalFX.lookAngle() === null || Math.abs(PetalFX.lookAngle() - game.player.facing) < 1e-9);
      return {
        ok: overlayOk && moved && lookOk,
        detail: `可动=${overlayOk} 朝右x=${right ? right.x.toFixed(1) : '-'}`
          + ` 朝左x=${left ? left.x.toFixed(1) : '-'} Δ=${dx.toFixed(1)}px 本地朝向=${lookOk}`
      };
    });

    // 6b5) 真·动态卡面：改变本地朝向后，卡面像素必须跟着变（异步探针的结果）
    check('engine: 卡面按本地朝向实时重画', () => {
      if (!dynProbe) return '缺少 third_eye（跳过）';
      const { right, left, rightIdle, leftIdle } = dynProbe;
      const moved = right != null && left != null && Math.abs(right - left) > 1.5;
      // 未装备的同款卡必须【一动不动】（居中静态）
      const idleStill = rightIdle != null && leftIdle != null && Math.abs(rightIdle - leftIdle) < 0.5;
      return {
        ok: moved && idleStill,
        detail: `装备卡 x=${right == null ? '-' : right.toFixed(1)}→${left == null ? '-' : left.toFixed(1)}`
          + `（${moved ? '已重画' : '没重画'}）　未装备卡 `
          + `x=${rightIdle == null ? '-' : rightIdle.toFixed(1)}→${leftIdle == null ? '-' : leftIdle.toFixed(1)}`
          + `（${idleStill ? '静态' : '不该动'}）`
      };
    });

    // 6b6) Web：脱轨 -> 飞行 0.5s -> 原地成网；网给敌对生物挂"蛛网减速"（0.5x）
    check('engine: Web 成网 + 蛛网减速', () => {
      if (typeof StatusFX === 'undefined' || typeof PetalFX === 'undefined') return '引擎未就绪（跳过）';
      const web = (typeof PETAL_TYPES !== 'undefined' ? PETAL_TYPES : []).find((t) => t && t.slug === 'web');
      if (!web || !PetalFX.defOf(web)) return '缺少 web（跳过）';
      const p = game.player;
      const savedFields = p.webFields ? p.webFields.slice() : [];
      const mkBody = () => ({
        card: { type: web, rarity: 'rare' }, x: 40, y: 0, vx: 120, vy: 0,
        age: 1, hp: 45, maxHp: 45, life: 0
      });
      let flags = {};
      let info = '';
      try {
        resetWebFields(p, null);
        // ① 飞行到期 -> 生成独立场地实体（半径/时长按稀有度）
        const body = mkBody();
        const plan = PetalFX.detach(body, p);
        const flying = PetalFX.flightOf(body);
        PetalFX.onExpire(body, p);
        const f = p.webFields && p.webFields.get(0);
        // ② 飞行途中被打碎 -> 同样立刻成网（轨道上被打碎则不成网）
        const body2 = mkBody();
        body2.stationary = true;
        const popOk = PetalFX.onPop(body2, p);
        const body3 = mkBody();                 // 还在轨道上
        const popNo = PetalFX.onPop(body3, p);
        // ③ 状态效果：减速倍率取自注册项本身（改数值时不用同步改断言）且会过期
        const wantSlow = (StatusFX.defOf('web') || {}).speedMul;
        const probe = {};
        StatusFX.add(probe, 'web', { dur: 1 });
        const slow = StatusFX.speedMul(probe);
        const order = StatusFX.list(probe).map((e) => e.id).join(',');
        StatusFX.tick(probe, 1.2);
        flags = {
          plan: !!plan,
          fly: !!(flying && flying.life === 0.5),
          field: !!f && Math.abs(f.r - 70) < 1e-9 && Math.abs(f.dur - 10) < 1e-9,
          pop: popOk && p.webFields.length === 2,
          orbit: !popNo && p.webFields.length === 2,     // 轨道上打碎不再生成
          slow: typeof wantSlow === 'number' && Math.abs(slow - wantSlow) < 1e-9,
          order: order === 'web',
          clear: StatusFX.list(probe).length === 0
        };
        info = `飞行=${flying ? flying.life : '-'}s 网半径=${f ? f.r : '-'} 存活=${f ? f.dur : '-'}s`
          + ` 场地数=${p.webFields.length}`;
      } finally {
        resetWebFields(p, savedFields);
      }
      const bad = Object.keys(flags).filter((k) => !flags[k]);
      return {
        ok: bad.length === 0,
        detail: (bad.length ? '未通过: ' + bad.join(',') + '；' : '') + info
      };
    });

    // 6b7) 服务端场地判定：网范围内的生物必须真的拿到"蛛网减速"，且移动管线会读它
    check('sim: 蛛网减速作用于生物', () => {
      const srv = game.net && game.net.debugServer;
      if (!srv || !srv.player || typeof StatusFX === 'undefined') return '无本地服务端（跳过）';
      const p = srv.player;
      const list = srv._awake || srv.ents || [];
      // 挑一只【段首】生物：被刚性粘合的节会在 update 里提前 return（不读状态倍率），
      // 拿它测"移动管线读不读蛛网减速"会假失败。
      const m = list.find((e) => e && !e.dead && !e._chainLocked)
        || list.find((e) => e && !e.dead);
      if (!m) return '场上没有可用生物（跳过）';
      const savedFields = p.webFields.slice();
      const savedAwake = srv._awake;
      const savedStatus = m.status ? m.status.slice() : null;
      let inRange = false, outRange = false, mul = 1, applied = 1;
      try {
        resetWebFields(p, null);
        const w = p.spawnWeb(m.x, m.y, 120, 10, null);
        srv._awake = [m];
        StatusFX.remove(m, 'web');
        srv._fieldTick();
        inRange = StatusFX.has(m, 'web');
        mul = StatusFX.speedMul(m);
        // 移动管线是否真的读了它（拦一次 speedMul 调用即可）
        const orig = StatusFX.speedMul;
        StatusFX.speedMul = function (ent) {
          const v = orig.call(this, ent);
          if (ent === m) applied = v;
          return v;
        };
        try { m.update(1 / 60, p, srv.map); } finally { StatusFX.speedMul = orig; }
        // 走出范围后不应再被施加（刷新时长只有 STATUS_FIELD_REFRESH）
        StatusFX.remove(m, 'web');
        if (w) { w.x = m.x + 5000; w.y = m.y + 5000; }
        srv._fieldTick();
        outRange = !StatusFX.has(m, 'web');
      } finally {
        resetWebFields(p, savedFields);
        srv._awake = savedAwake;
        if (savedStatus) m.status = savedStatus; else StatusFX.remove(m, 'web');
      }
      // 期望值直接读注册项：调数值（如 0.5 -> 0.3）时断言自动跟随，不会误报
      const want = (StatusFX.defOf('web') || {}).speedMul;
      const ok = inRange && outRange && typeof want === 'number'
        && Math.abs(mul - want) < 1e-9 && Math.abs(applied - want) < 1e-9;
      return {
        ok,
        detail: `范围内=${inRange} 范围外=${outRange} 乘数=${mul}（应 ${want}） 实际读取=${applied}`
      };
    });

    // 6c) 转速与 reach 互不影响：装上 Faster 后，花瓣的实际轨道半径不能变
    check('engine: 转速不影响 reach 伸距', () => {
      const srv = game.net && game.net.debugServer;
      const p = srv && srv.player;
      const pick = (slug) => (typeof PETAL_TYPES !== 'undefined' ? PETAL_TYPES : [])
        .find((x) => x && x.slug === slug);
      const basic = pick('basic'), faster = pick('faster'), eye = pick('third_eye');
      if (!p || !basic || !faster || !eye) return '缺少花瓣数据（跳过）';
      const saved = {
        slots: p.slots.slice(), mode: p.mode, modeT: p.modeT, spin: p.spin,
        petals: p.petals, ghosts: p.petalGhosts, reload: p.reload.slice(),
        x: p.x, y: p.y, vx: p.vx, vy: p.vy, slow: p.slowTile
      };
      // 固定 reach 模式 + 装填完成，先跑 2s 让弹簧收敛，再【只统计最后 30 帧】的平均半径。
      // （统计全程会把起步阶段的"从中心弹出去"也算进来，噪声比要找的差异还大。）
      const measure = () => {
        p.mode = 'reach'; p.modeT = 1; p.slowTile = false;
        p.petals = []; p.petalGhosts = []; p.spin = 0;
        p.reload = p.slots.map((c) => (c ? { card: c, age: 99, dur: 1 } : null));
        for (let i = 0; i < 120; i++) {
          // 与 update() 同一节奏：先推进公转角，再同步花瓣（否则目标点不动，测的不是真实轨道）
          p.spin += (p.rotMax || PETAL_SPIN) * ROT_SCALE * (1 / 60);
          p._syncPetals(1 / 60, srv.map, []);
        }
        let sum = 0, n = 0;
        for (let i = 0; i < 30; i++) {
          p.spin += (p.rotMax || PETAL_SPIN) * ROT_SCALE * (1 / 60);
          p._syncPetals(1 / 60, srv.map, []);
          for (const b of p.petals) { sum += Math.hypot(b.x - p.x, b.y - p.y); n++; }
        }
        return n ? sum / n : 0;
      };
      let rNoFast = 0, rFast = 0;
      try {
        p.slots = [{ type: basic, rarity: 'common' }, { type: eye, rarity: 'legendary' }];
        p.recompute();
        rNoFast = measure();
        // 再加一件 eternal Faster：转速上去了，但 reach 伸距必须一模一样
        p.slots = [{ type: basic, rarity: 'common' }, { type: eye, rarity: 'legendary' },
                   { type: faster, rarity: 'eternal' }];
        p.recompute();
        rFast = measure();
      } finally {
        p.slots = saved.slots; p.mode = saved.mode; p.modeT = saved.modeT; p.spin = saved.spin;
        p.petals = saved.petals; p.petalGhosts = saved.ghosts; p.reload = saved.reload;
        p.x = saved.x; p.y = saved.y; p.vx = saved.vx; p.vy = saved.vy; p.slowTile = saved.slow;
        p.recompute();
      }
      const diff = Math.abs(rFast - rNoFast);
      return {
        ok: rNoFast > 50 && diff < 2,
        detail: `无Faster=${rNoFast.toFixed(1)}px 有Faster=${rFast.toFixed(1)}px 差=${diff.toFixed(1)}px`
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
      for (const [slug, key] of [['ladybug', 'wander'], ['bee', 'bee'], ['centipede', 'centipede'], ['spider', 'spider']]) {
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

    // 8b1) 蜘蛛：数值表 / 速度口径 / 仇恨半径 / 中毒链路
    check('sim: 蜘蛛（数值 + 速度 + 中毒）', () => {
      const t = (typeof MOB_TYPES !== 'undefined') ? MOB_TYPES.find((x) => x && x.slug === 'spider') : null;
      if (!t) return '缺少 spider（跳过）';
      const m = new Mob(t, 0, 0, 1, 'rare');
      const rs = (t.rarityStats && t.rarityStats.rare) || {};
      const dataOk = rs.hp === 810 && rs.dmg === 135 && rs.armor === 7
        && rs.poison === 360 && rs.poisonRate === 135 && rs.exp === 5;
      const speedOk = Math.abs(m.chaseSpeed - 1.10 * PLAYER_BASE_SPEED) < 1e-6
        && Math.abs(m.wanderSpeed - m.chaseSpeed * 0.9) < 1e-6;
      const sightOk = m.sightR === 500;
      // 中毒：按 rare 蜘蛛的速率给玩家挂毒，跑 1s 掉血应 ≈ 每秒伤害（135）
      const p = game.player;
      const saved = { hp: p.hp, dead: p.dead, hurtT: p.hurtT, killedBy: p.killedBy,
        status: p.status ? p.status.slice() : null,
        invuln: p.invuln, hurtInvuln: p.hurtInvuln, invulnSrc: p.invulnSrc };
      let dmg = 0;
      try {
        p.dead = false; p.hp = 1e6; p.killedBy = null;
        p.invuln = 0; p.hurtInvuln = 0; p.invulnSrc = {};   // 无敌不吃毒：测 DoT 必须先摘掉无敌
        StatusFX.remove(p, 'poison');
        StatusFX.add(p, 'poison', { dur: m.poison / m.poisonRate, value: m.poisonRate });
        for (let i = 0; i < 60; i++) p._tickPoison(1 / 60);
        dmg = 1e6 - p.hp;
      } finally {
        p.hp = saved.hp; p.dead = saved.dead; p.hurtT = saved.hurtT; p.killedBy = saved.killedBy;
        p.invuln = saved.invuln; p.hurtInvuln = saved.hurtInvuln; p.invulnSrc = saved.invulnSrc;
        if (saved.status) p.status = saved.status; else StatusFX.remove(p, 'poison');
      }
      const dotOk = Math.abs(dmg - m.poisonRate) < 1;
      const faceOk = (() => {                      // 中毒时脸部会换色 / 强制哭脸
        const before = p.status;
        StatusFX.add(p, 'poison', { dur: 1, value: 1 });
        const on = StatusFX.has(p, 'poison');
        StatusFX.remove(p, 'poison');
        const off = StatusFX.has(p, 'poison');
        p.status = before;
        return on && !off;
      })();
      return {
        ok: dataOk && speedOk && sightOk && dotOk && faceOk,
        detail: `rare hp=${rs.hp} dmg=${rs.dmg} armor=${rs.armor} poison=${rs.poison}/${rs.poisonRate}s`
          + ` 追击=${m.chaseSpeed.toFixed(1)} 游荡=${m.wanderSpeed.toFixed(1)} 视野=${m.sightR}`
          + ` 1s中毒掉血=${dmg.toFixed(1)} 状态=${faceOk ? 'ok' : 'bad'}`
      };
    });

    // 8b1b) 蜘蛛掉率表：Web 没有 Common 档（不可能掉 Common Web）；Faster 有；Third Eye Legendary 不掉
    check('data: 蜘蛛掉率表（Web 无 Common 档）', () => {
      if (typeof dropDistFor !== 'function') return '掉率查询未就绪（跳过）';
      const webC = dropDistFor('web', 'common') || [];
      const fasterC = dropDistFor('faster', 'common') || [];
      const webOk = webC.length > 0 && webC.every(([r]) => r !== 'common')
        && webC.some(([r, c]) => r === 'unusual' && Math.abs(c - 0.164) < 1e-9);
      const fasterOk = fasterC.some(([r]) => r === 'common')
        && fasterC.some(([r, c]) => r === 'unusual' && Math.abs(c - 0.164) < 1e-9);
      // 掷骰抽查：common 蜘蛛掉落的 Web 只能是 unusual（跑 400 次足以覆盖 16.4% 档）
      let badRoll = 0;
      for (let i = 0; i < 400; i++) {
        for (const d of rollMobDrops('spider', 'common', false)) {
          if (d.slug === 'web' && d.rarity === 'common') badRoll++;
        }
      }
      const eyeOk = !dropDistFor('third_eye', 'legendary') && !!dropDistFor('third_eye', 'mythic');
      const ok = webOk && fasterOk && eyeOk && badRoll === 0;
      return {
        ok,
        detail: `Web(common 档)=${JSON.stringify(webC)} Faster 有 common=${fasterOk}`
          + ` ThirdEye legendary 掉=${!!dropDistFor('third_eye', 'legendary')}`
          + ` 400 次掷骰出现 Common Web=${badRoll}`
      };
    });

    // 8b1c) 通用退场：实体离场【只能】走 ExitFX（放大 + 渐隐），不许凭空消失
    check('fix: 实体退场强绑定通用退场动效', () => {
      if (typeof ExitFX === 'undefined' || typeof createExitList !== 'function') return '退场通道未就绪（跳过）';
      const bad = [];
      // ① 通道本身：begin -> 渐隐放大 -> sweep 才回收
      const list = createExitList();
      const e = list.add({ x: 0, y: 0, r: 10, t: 0, dur: 0.05, pop: 1 });
      list.sweep(0.02);
      if (list.length !== 1) bad.push('未到期的实体被提前回收');
      ExitFX.begin(e, 0.05);
      if (!e.exiting) bad.push('begin 没有打上退场标记');
      const a0 = ExitFX.alpha(e);
      list.sweep(0.02);
      if (!(ExitFX.alpha(e) < a0)) bad.push('退场没有渐隐');
      if (!(ExitFX.scale(e) > 1)) bad.push('退场没有放大');
      if (list.length !== 1) bad.push('退场未播完就被回收');
      list.sweep(0.2);
      if (list.length !== 0) bad.push('退场播完仍未回收');
      // ② 受控实体表：外部拿不到原始数组（想直接删元素连语法都没有）
      if (typeof list.splice === 'function' || typeof list.push === 'function'
        || typeof list.pop === 'function' || typeof list.clear === 'function') {
        bad.push('受控实体表暴露了删除入口');
      }
      // ③ 蜘蛛自铺的网：到期进入退场，退场播完才被回收（不许凭空消失）
      const srv = game.net && game.net.debugServer;
      let webDetail = '';
      if (srv) {
        const MARK = 987654;
        const savedWebs = srv.mobWebs.slice();
        try {
          srv.mobWebs.add({ x: 1e6, y: 1e6, r: MARK, t: 0, dur: 0.05, pop: 1 });
          srv._fieldTick(0.06);
          const w = srv.mobWebs.find((x) => x && x.r === MARK);
          if (!w) bad.push('蜘蛛网到期后凭空消失（没进退场）');
          else if (!w.exiting) bad.push('蜘蛛网到期没有进入退场');
          srv._fieldTick(0.3);
          if (srv.mobWebs.find((x) => x && x.r === MARK)) bad.push('蜘蛛网退场播完仍未回收');
          webDetail = ' 到期->退场->回收 正常';
        } finally {
          srv.mobWebs = createExitList();
          for (const x of savedWebs) srv.mobWebs.add(x);
        }
      } else webDetail = ' （无本地服务端，跳过蛛网部分）';
      return { ok: bad.length === 0, detail: (bad.length ? '未通过: ' + bad.join(',') + '；' : '退场通道正常') + webDetail };
    });

    // 8b1d) 蜘蛛大招（Super / Eternal 专属）：定在原地自转 + 摆腿 + 转满 3 圈产出超大蛛网
    check('ai: Super 蜘蛛大招（定住自转 + 超大蛛网）', () => {
      const t = (typeof MOB_TYPES !== 'undefined') ? MOB_TYPES.find((x) => x && x.slug === 'spider') : null;
      if (!t) return '缺少 spider（跳过）';
      const uDef = MobFX.defs.spider && MobFX.defs.spider.ultimate;
      if (!uDef) return '蜘蛛没有大招定义（跳过）';
      const p = game.player;
      const bad = [];
      const DT = 1 / 25;
      // ① 稀有度门槛：只有 Super 及以上才有大招
      for (const r of ['common', 'rare', 'legendary', 'ultra']) {
        const mr = new Mob(t, p.x, p.y, 1, r);
        mr.ai.ultCd = 0;
        mr.update(DT, p, game.map);
        if (mr.ultActive) bad.push(r + ' 蜘蛛也有大招');
      }
      // ② Super 蜘蛛：起手 -> 定在原地自转（3 秒 2 圈）-> 腿摆动 -> 转满 3 圈产出请求
      const m = new Mob(t, p.x, p.y, 1, 'super');
      m.ai.ultCd = 0;
      const x0 = m.x, y0 = m.y;
      m.update(DT, p, game.map);
      if (!m.ultActive) bad.push('大招没有起手');
      let steps = 0, spin = 0, drift = 0, prev = m.facing;
      const gait0 = m.gait;
      while (m.ultActive && steps < 600) {
        // 此刻大招仍在进行：位置必须严格等于锚点（"定在原地"是字面意思）。
        // 最后一帧（大招刚结束、恢复正常 AI）不计入 —— 那帧允许它重新走位。
        if (m.ultHold) {
          const d = Math.hypot(m.x - m.ultHold.x, m.y - m.ultHold.y);
          if (d > drift) drift = d;
        }
        m.update(DT, p, game.map);
        spin += MobAI._util.angNorm(m.facing - prev);
        prev = m.facing;
        steps++;
      }
      const wantSpin = TAU * SPIDER_ULT_TURNS;                 // 3 圈
      if (m.ultActive) bad.push('大招没有结束');
      if (Math.abs(spin - wantSpin) > 0.4) bad.push('自转圈数不对 ' + (spin / TAU).toFixed(2) + ' 圈');
      if (drift > 1e-6) bad.push('大招期间没有定在原地（漂移 ' + drift.toFixed(2) + '）');
      if (!(m.gait > gait0)) bad.push('大招期间腿没有摆动');
      const req = m.ultFieldReq;
      if (!req || req.kind !== 'web' || Math.abs((req.mul || 0) - SPIDER_ULT_WEB_MUL) > 1e-9) bad.push('大招没有产出超大蛛网请求');
      // ③ 服务端消费请求 -> 半径 = 同等级蛛网 × 2
      const srv = game.net && game.net.debugServer;
      let webDetail = '';
      if (srv) {
        const webType = (typeof PETAL_TYPES !== 'undefined') ? PETAL_TYPES.find((x) => x && x.slug === 'web') : null;
        const wantR = Math.round(((webType && petalStatsFor(webType, 'super').radius) || 120) * SPIDER_ULT_WEB_MUL);
        const sp = new Mob(t, p.x + 5000, p.y + 5000, 1, 'super');
        sp.ultFieldReq = { kind: 'web', mul: SPIDER_ULT_WEB_MUL };
        const savedAwake = srv._awake;
        const savedWebs = srv.mobWebs.slice();
        try {
          srv._awake = [sp];
          srv._fieldTick(0.04);
          const w = srv.mobWebs.find((x) => x && x.r === wantR);
          if (!w) bad.push('服务端没有产出超大蛛网（半径应为 ' + wantR + '）');
          webDetail = ` 超大网半径=${w ? w.r : '-'}`;
        } finally {
          srv._awake = savedAwake;
          srv.mobWebs = createExitList();
          for (const x of savedWebs) srv.mobWebs.add(x);
        }
      } else webDetail = ' （无本地服务端，跳过产出部分）';
      // ④ 客户端镜像：快照带 ultActive -> 客户端视图同步 + 腿继续摆 + 结束时补超大网
      let mirrorDetail = '';
      if (srv) {
        const sp2 = new Mob(t, p.x + 320, p.y, 1, 'super');
        sp2.netId = 990077;
        sp2.ai.ultCd = 0;
        const savedEnts = srv.ents;
        const canInv = (typeof InvulnFX !== 'undefined' && InvulnFX.add);
        if (canInv) InvulnFX.add(p, 'selftest', 60);
        try {
          srv.ents = savedEnts.concat([sp2]);
          game.stepFrames(20, 1 / 25, false);
          const view = game.mobs.find((x) => x && x.netId === 990077);
          if (!view) bad.push('客户端没有生成该生物的视图');
          else if (!view.ultActive) bad.push('客户端没有收到大招状态（ultActive）');
          else {
            const g0 = view.gait;
            game.stepFrames(8, 1 / 25, false);
            if (!(view.gait > g0)) bad.push('客户端大招期间腿没有摆动');
            mirrorDetail = ` 镜像 ultActive=true 步态+${(view.gait - g0).toFixed(1)}`;
          }
        } finally {
          srv.ents = savedEnts;
          if (canInv && typeof InvulnFX !== 'undefined' && InvulnFX.remove) InvulnFX.remove(p, 'selftest');
        }
      }
      return {
        ok: bad.length === 0,
        detail: (bad.length ? '未通过: ' + bad.join(',') + '；' : '')
          + `自转=${(spin / TAU).toFixed(2)}圈 漂移=${drift.toFixed(3)} 步态=${(m.gait - gait0).toFixed(1)}` + webDetail + mirrorDetail
      };
    });

    // 8b1e) 生物悬浮框：和卡牌一样【有的属性就显示，没有就不显示】（蜘蛛必须有 Poison）
    check('ui: 生物悬浮框属性行按数据取舍（含 Poison）', () => {
      const cv = document.getElementById('uiOverlay');
      if (!cv || !UI._tipLayout) return '悬浮框未就绪（跳过）';
      const ctx = cv.getContext('2d');
      const t = (typeof MOB_TYPES !== 'undefined') ? MOB_TYPES.find((x) => x && x.slug === 'spider') : null;
      if (!t) return '缺少 spider（跳过）';
      const rs = (t.rarityStats && t.rarityStats.rare) || {};
      const L = UI._tipLayout(ctx, {
        mob: true, name: 'Spider', rarityName: 'Rare', rarityColor: '#fff', desc: '', xp: 5,
        hp: rs.hp, dmg: rs.dmg, armor: rs.armor, poison: rs.poison, poisonRate: rs.poisonRate, drops: []
      });
      const labels = L.rows.map((r) => String(r.label));
      const values = L.rows.map((r) => String(r.value));
      const poisonRow = labels.findIndex((l) => /poison|剧毒/i.test(l));
      const bad = [];
      if (poisonRow < 0) bad.push('蜘蛛悬浮框没有 Poison 行');
      else if (!new RegExp(String(rs.poison)).test(values[poisonRow]) || !new RegExp(String(rs.poisonRate)).test(values[poisonRow])) {
        bad.push('Poison 行的数值不对：' + values[poisonRow]);
      }
      // 没有的属性整行不画（只有血量的生物 -> 只剩 Health 一行）
      const L2 = UI._tipLayout(ctx, {
        mob: true, name: 'X', rarityName: 'Common', rarityColor: '#fff', desc: '', xp: 0,
        hp: 10, dmg: 0, armor: 0, poison: 0, poisonRate: 0, drops: []
      });
      if (L2.rows.length !== 1) bad.push('没有属性的生物仍画了多行：' + L2.rows.length);
      return {
        ok: bad.length === 0,
        detail: (bad.length ? bad.join(',') + '；' : '') + `行=${JSON.stringify(labels)} 值=${JSON.stringify(values)}`
      };
    });

    // 8b2) 蜈蚣断链继承仇恨 + 敌对生物"看见即追"
    check('sim: 断链继承仇恨 + 敌对看见即追', () => {
      const pick = (slug) => MOB_TYPES.find((t) => t && t.slug === slug);
      const ct = pick('centipede'), sp = pick('spider');
      if (!ct || !sp) return '缺少生物（跳过）';
      const srv = game.net && game.net.debugServer;
      // ① 断链：旧段首的仇恨表要能并进新段首。
      //    common 蜈蚣是 Passive（noteThreat 直接忽略），这条测的是"继承"而不是阵营，
      //    所以临时把两端 hostility 改成 hostile，结束还原。
      const head = new Mob(ct, 0, 0, 1, 'common');
      const tail = new Mob(ct, 0, 0, 1, 'common');
      const src = { name: 'Probe', x: 10, y: 0, dead: false };
      const savedHost = [head.hostility, tail.hostility];
      head.hostility = 'hostile'; tail.hostility = 'hostile';
      head.noteThreat(src, 50);
      const inherited = (() => {
        tail.threat.length = 0;
        tail.inheritThreat(head);                    // 断链那一刻做的事
        return tail.topThreat() === src;             // topThreat 返回的就是实体本身
      })();
      head.hostility = savedHost[0]; tail.hostility = savedHost[1];
      // ② 敌对（蜘蛛）只要看得见目标，不需要先挨打就该有追击目标。
      //    自测世界里的玩家可能已经死了，这里用一只"活的假玩家"做目标，与真实链路同构。
      const alive = { name: 'P', x: 0, y: 0, dead: false };
      const m = new Mob(sp, alive.x + 60, alive.y, 1, 'common');
      m._map = srv ? srv.map : { lineBlocked: () => false };
      m.threat.length = 0;
      m.update(1 / 60, alive, m._map);
      const aggro = m.topThreat() === alive;
      const diag = tail.threat.map((t2) => ('ent===src:' + (t2.ent === src) + ' dmg:' + t2.dmg)).join(';');
      return {
        ok: inherited && aggro && m.hostility === 'hostile',
        detail: `继承=${inherited}（tail.threat=${tail.threat.length} [${diag}]` +
          ` top=${String(tail.topThreat() === src)} hostility=${tail.hostility}）` +
          ` 看见即追=${aggro}（m.threat=${m.threat.length} 可见=${m.canSee(alive)}` +
          ` 阵营=${m.hostility}）`
      };
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
      const tickDmg = [];                 // 每个 tick 该生物实际受到的伤害（用来验证"只结算一次"）
      try {
        srv.ents = [m]; srv._awake = [m]; srv._events = [];
        const origHit = srv._hitMob;
        srv._hitMob = function (mob, dmg) { tickDmg[tickDmg.length - 1] += dmg; return origHit.call(srv, mob, dmg); };
        try {
          for (let i = 0; i < 3; i++) { tickDmg.push(0); srv._combatTick(); }
        } finally { srv._hitMob = origHit; }
        bAfter = b.hp; mAfter = m.hp;
      } finally {
        srv.ents = savedEnts; srv._awake = savedAwake; srv._events = savedEv;
        b.hp = savedHp; b.maxHp = savedMaxHp; b.dead = false; b.hurtT = 0;
        b.fxNoCombat = savedNoCmb;
      }
      const st = petalStatsFor(b.card.type, b.card.rarity);
      const toPetalPanel = Math.max((m.dmg || 0) - (b.armor || 0), 0);
      const toMobPanel = Math.max((st.dmg || 0) - (m.armor || 0), 0);
      // 伤害【每 tick 结算一次，一次就是完整面板值】（见 sim/constants.js）：
      // 花瓣没有单次受伤上限（伤害 ≥ 耐久就当 tick 碎），另有每 tick 的攻击磨损。
      const perTickPetal = toPetalPanel + (bMax0 || 0) * PETAL_ATTACK_DUR;
      const wantPetal = perTickPetal * 3;
      const okB = Math.abs((bHp0 - bAfter) - wantPetal) < 0.01;
      // 生物侧：三个 tick 都必须吃到完整面板伤害（没有冷却空窗），且不超过"花瓣 + 花朵本体"
      // 的合计（这颗测试生物离花朵很近，本体那一路可能额外补一份体伤）。
      const wantM = toMobPanel;
      const wantBody = Math.max((p.bodyDmg || 0) - (m.armor || 0), 0);
      const capM = wantM + wantBody + 1e-6;
      const okM = tickDmg.length === 3
        && tickDmg.every((d) => d >= wantM - 1e-6 && d <= capM);
      return {
        ok: bAfter < bHp0 && mAfter < mHp0 && okB && okM,
        detail: `花瓣 -${(bHp0 - bAfter).toFixed(2)}（应为 ${wantPetal.toFixed(2)}）`
          + ` 生物各tick -${tickDmg.map((x) => x.toFixed(2)).join('/')}`
          + `（每 tick 应为 ${wantM.toFixed(2)}）`
      };
    });

    // 8c2a) 花瓣承受的是【每 tick 完整面板伤害】：伤害 ≥ 耐久 -> 同一 tick 直接碎。
    //       守的是"贴着磨一会才碎"这个观感 bug（曾经有单次受伤上限 + 冷却门槛）。
    check('fix: 高伤生物一击打碎花瓣', () => {
      const srv = game.net && game.net.debugServer;
      const pl = srv && srv.player;
      if (!pl) return '无本地服务端（跳过）';
      const type = MOB_TYPES.find((t) => t && t.slug === 'ladybug');
      const b = (pl.petals || []).find((x) => !x.dead && !x.stationary);
      if (!type || !b) return '没有可用花瓣（跳过）';
      const m = new Mob(type, b.x, b.y, 1, 'rare');      // rare 瓢虫 dmg 90
      m.netId = 1e9 + 4;
      m._ensureShape();
      if (!m.shape) return '轮廓未就绪（跳过）';
      const saved = {
        ents: srv.ents, awake: srv._awake, ev: srv._events,
        hp: b.hp, maxHp: b.maxHp, dead: b.dead, hurtT: b.hurtT,
        noCmb: b.fxNoCombat, respawnT: b.respawnT,
        reload: pl.reload ? pl.reload[b.slotIndex] : undefined,
        pHp: pl.hp, pDead: pl.dead, pHurtInvuln: pl.hurtInvuln, pKilledBy: pl.killedBy
      };
      let died = false;
      try {
        b.hp = b.maxHp = 10;            // common basic 的真实耐久
        b.dead = false; b.respawnT = 0; b.fxNoCombat = false;
        pl.hp = pl.maxHp; pl.dead = false; pl.hurtInvuln = 0;   // 别让本体在这条断言里被打死
        srv.ents = [m]; srv._awake = [m]; srv._events = [];
        srv._combatTick();              // 只跑一个 tick
        died = !!b.dead;
      } finally {
        b.dead = saved.dead; b.hp = saved.hp; b.maxHp = saved.maxHp;
        b.hurtT = saved.hurtT; b.fxNoCombat = saved.noCmb; b.respawnT = saved.respawnT;
        if (pl.reload) pl.reload[b.slotIndex] = saved.reload;
        pl.hp = saved.pHp; pl.dead = saved.pDead;
        pl.hurtInvuln = saved.pHurtInvuln; pl.killedBy = saved.pKilledBy;
        srv.ents = saved.ents; srv._awake = saved.awake; srv._events = saved.ev;
      }
      return {
        ok: died,
        detail: `rare 瓢虫 dmg=${m.dmg} vs 花瓣 hp=10 -> ${died ? '一击碎' : '没碎'}`
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

    // 8d1) 蜈蚣：打尾节不记仇恨；打中段会沿链传冲量（整条被带动）
    check('ai: 蜈蚣尾节不记仇 + 击退沿链传递', () => {
      const srv = game.net && game.net.debugServer;
      const head = srv && srv.ents && srv.ents.find((m) => m.segIdx === 0 && !m.dead && !m._lead);
      if (!head || !head._next || head._next.dead) return '场上没有多节链（跳过）';
      const mid = head._next;
      let tail = head;
      while (tail._next && !tail._next.dead) tail = tail._next;
      if (tail === head) return '链太短（跳过）';
      // 被动型不记仇恨，测试期间临时改成中立（结束还原）
      const savedHost = [head, mid, tail].map((s) => s.hostility);
      const savedKb = [head, mid].map((s) => [s.kbX, s.kbY]);
      const savedPush = [mid.pushX, mid.pushY];
      const src = { name: 'Probe', x: head.x + 60, y: head.y };
      let tailThreat = -1, midThreat = -1, headGot = 0, pushed = 0;
      try {
        for (const s of [head, mid, tail]) { s.hostility = 'hostile'; s.threat.length = 0; }
        tail.noteThreat(src, 50);
        tailThreat = tail.threat.length;          // 尾节：应当 0
        mid.noteThreat(src, 50);
        midThreat = mid.threat.length;            // 中段：自己记 + 段首记
        head.kbX = head.kbY = 0;
        mid.pushX = mid.pushY = 0;
        applyKnockback(mid, 1, 0, 20);            // 打中段
        headGot = Math.abs(head.kbX);             // 段首应当分到一份冲量
        mid.update(1 / 60, srv.player, srv.map);  // 一节 update：冲量积分成本地偏移
        pushed = Math.hypot(mid.pushX || 0, mid.pushY || 0);
      } finally {
        [head, mid, tail].forEach((s, i) => { s.hostility = savedHost[i]; s.threat.length = 0; });
        head.kbX = savedKb[0][0]; head.kbY = savedKb[0][1];
        mid.kbX = savedKb[1][0]; mid.kbY = savedKb[1][1];
        mid.pushX = savedPush[0]; mid.pushY = savedPush[1];
      }
      const ok = tailThreat === 0 && midThreat > 0 && headGot > 1 && pushed > 0.01;
      return {
        ok,
        detail: `尾节仇恨=${tailThreat} 中段仇恨=${midThreat} 段首冲量=${headGot.toFixed(1)}`
          + ` 中段偏移=${pushed.toFixed(2)}px`
      };
    });

    // 8d1b) /kill-mob 的伤害是无穷大：再高血的 eternal 也必须一击必杀
    check('sim: kill-mob 对 eternal 一击必杀', () => {
      const srv = game.net && game.net.debugServer;
      if (!srv) return '无本地服务端（跳过）';
      const type = MOB_TYPES.find((t) => t && t.slug === 'ladybug');
      if (!type) return '缺少瓢虫数据（跳过）';
      const m = new Mob(type, game.player.x, game.player.y, 1, 'eternal');
      m.netId = 1e9 + 7;
      const before = m.hp;
      let killed = false;
      const n0 = srv.ents.length;
      try {
        srv.ents.push(m);
        killed = !!srv._hitMob(m, Infinity);
      } finally {
        srv.ents.length = n0;                 // 立刻移出世界，别污染后续断言
      }
      return {
        ok: killed && m.dead && m.hp === 0,
        detail: `eternal 血量=${before} -> 击杀=${killed}`
      };
    });

    // 8d2) 昆虫视野 360°：只有【墙】会挡视线（减速瓦片不再等于隐身）
    check('sim: 视野 360°（只认墙）', () => {
      const srv = game.net && game.net.debugServer;
      const proto = srv && srv.ents && srv.ents.find((e) => !e.dead && !e.obstacle);
      if (!proto) return '没有可用生物（跳过）';
      const m = Object.create(Object.getPrototypeOf(proto));
      Object.assign(m, { x: 0, y: 0, age: 0, _seeCache: null });
      const tgt = { x: 40, y: 0, dead: false };
      // 正前方 40px：目标站在减速瓦片里（slowAt=true）但中间没有墙
      m._map = { slowAt: () => true, lineBlocked: () => false };
      const seeOpen = m.canSee(tgt);
      const wallOpen = m.wallBlocked(tgt);
      // 同一位置但中间隔墙
      m._seeCache = null;
      m._map = { slowAt: () => false, lineBlocked: () => true };
      const seeWall = m.canSee(tgt);
      const wallWall = m.wallBlocked(tgt);
      return {
        ok: seeOpen === true && wallOpen === false && seeWall === false && wallWall === true,
        detail: `开阔=看${seeOpen}/墙${wallOpen}　隔墙=看${seeWall}/墙${wallWall}`
      };
    });

    // 8d3) 蜈蚣出生带随机弯曲：整条不能是一条直线（首尾朝向必须差出一个角）
    check('sim: 蜈蚣出生带弯曲', () => {
      const srv = game.net && game.net.debugServer;
      const type = (typeof MOB_TYPES !== 'undefined') ? MOB_TYPES.find((t) => t && t.slug === 'centipede') : null;
      if (!srv || !srv.ents || !type) return '跳过';
      const before = srv.ents.length;
      srv._spawnChain(type, 0, 0, 'common', null, 'normal');
      const added = srv.ents.slice(before);
      srv.ents.length = before;                       // 立刻移除测试链，别污染世界
      if (added.length < 3) return { ok: false, detail: '生成的节数=' + added.length };
      let d = added[added.length - 1].facing - added[0].facing;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      return {
        ok: Math.abs(d) > 0.2,
        detail: `节数=${added.length} 首尾朝向差=${d.toFixed(2)}rad`
      };
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

    // 8k2) Super/Eternal 生成公告：默认模板 / 专属台词 / 只有头节播
    check('chat: Boss 生成全服公告', () => {
      const srv = game.net && game.net.debugServer;
      if (!srv) return '跳过';
      const before = srv._events.length;
      srv._announceBossSpawn({ name: 'Ladybug', rarity: 'super', type: { name: 'Ladybug', slug: 'ladybug' } });
      srv._announceBossSpawn({ name: 'Bee', rarity: 'common', type: { name: 'Bee', slug: 'bee' } });   // 非 super -> 不播
      srv._announceBossSpawn({                                                   // 非头节 -> 不播
        name: 'Centipede', rarity: 'eternal', segIdx: 3, isHeadSeg: false,
        type: { name: 'Centipede', slug: 'centipede' }
      });
      const evs = srv._events.slice(before);
      srv._events.length = before;
      const want = I18N.t('Chat/Sys/Spawn/ladybug', '');
      const ok = evs.length === 1 && evs[0].kind === 'sys' && evs[0].channel === 'global'
        && evs[0].color === RARITIES.super.color && evs[0].text === want;
      return { ok, detail: evs.length ? evs[0].text : '无事件' };
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

    // 9b) 卡面文字：长名字自动缩字不溢出，且文字底边（基线）不变
    check('ui: 卡面长名字自动缩字', () => {
      if (typeof CardRenderer === 'undefined' || !CardRenderer.renderCardTo) return '卡牌渲染未就绪（跳过）';
      const cv = document.createElement('canvas');
      // paintCard 要求 canvas 已在 DOM 里（它按 clientWidth 同步后备缓冲），
      // 所以挂到屏幕外（仍在布局中，display:none 会得到 0 宽）。
      cv.style.position = 'absolute';
      cv.style.left = '-9999px';
      cv.style.top = '0';
      document.body.appendChild(cv);
      const PX = 96;
      const ink = (name) => {
        cv._card = cv._card || {};
        CardRenderer.renderCardTo(cv, { rarity: 'common', svg: null, px: PX });
        cv._card.name = name;
        CardRenderer.paintCard(cv);
        const ctx = cv.getContext('2d');
        const W = cv.width, H = cv.height;
        const d = ctx.getImageData(0, 0, W, H).data;
        let x0 = W, x1 = -1, y1 = -1;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            // 名称是卡面上唯一接近纯白的元素
            if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240 && d[i + 3] > 200) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y > y1) y1 = y;       // 底边 = 所有墨迹里最靠下的那一行
            }
          }
        }
        return { x0, x1, y1, W, H };
      };
      let short, long;
      try {
        short = ink('Basic');
        long = ink('WWWWWWWWWW');      // 10 个最宽字符：必然触发缩字
      } catch (e) {
        return '像素读取失败（跳过）：' + e.message;
      } finally {
        cv.remove();
      }
      const inside = (r) => r.x1 > 0 && r.x0 > r.W * 0.045 && r.x1 < r.W * 0.955;
      const baseOk = short.y1 > 0 && Math.abs(long.y1 - short.y1) <= 2;   // 底边不变
      return {
        ok: inside(long) && inside(short) && baseOk,
        detail: `Basic x=${short.x0}..${short.x1}/底 y=${short.y1}`
          + `　长名 x=${long.x0}..${long.x1}/底 y=${long.y1}（画布 ${short.W}）`
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
      // A/B 按钮必须严格贴屏幕右下角（16px + 安全区）：它们在 body 上独立成层
      const btns = document.getElementById('tBtns');
      const br = btns ? btns.getBoundingClientRect() : null;
      const anchorOk = !!br
        && Math.abs(br.right - (innerWidth - 16)) <= 2
        && Math.abs(br.bottom - (innerHeight - 16)) <= 2;
      // 移动端卡槽靠左下（桌面端仍居中）
      const qb = document.getElementById('quickbar');
      const qr = qb ? qb.getBoundingClientRect() : null;
      const qbOk = !qr || qr.width === 0 || qr.left <= 24;
      const ok = !!layer && s.width > 0 && sa.width > 0 && sb.width > 0 &&
        s.width >= 84 - 1 && s.width <= 160 + 1 &&                       // 自缩放区间
        sa.width === sb.width &&                                          // A/B 同尺寸
        s.width >= sa.width &&                                            // 摇杆不小于按钮
        anchorOk && qbOk;
      // 还原：删掉测试创建的元素与状态（A/B 现在挂在 body 上，要单独删）
      if (layer) layer.remove();
      if (btns) btns.remove();
      TouchCtl.on = false; TouchCtl.refs = null; TouchCtl._stick.id = -1;
      document.body.classList.remove('touch-ui');
      return {
        ok,
        detail: 'viewport=' + Math.round(small) + ' stick=' + Math.round(s.width) +
          ' A=' + Math.round(sa.width) + ' B=' + Math.round(sb.width) +
          ' 按钮贴角=' + anchorOk + ' 卡槽靠左=' + qbOk
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
      // 世界里还有敌对生物在真实战斗（蜘蛛会咬花瓣），等待期间可能又有别的花瓣碎了 ——
      // 所以这里轮询收敛（最多 1s）：两端"存活数一致且该槽仍在装填"即视为同步完成，
      // 而不是掐死 20 帧后硬比（那会被环境战斗的时序噪声打成假失败）。
      let cAlive = 0, sAlive = 0, cr = null, okReload = false;
      for (let i = 0; i < 60; i++) {
        game.stepFrames(1, 1 / 60, false);
        cAlive = pc.petals.filter((b) => !b.dead).length;
        sAlive = ps.petals.filter((b) => !b.dead).length;
        cr = pc.reload[slot];
        okReload = !cr || cr.age < (cr.dur || 0);
        if (cAlive === sAlive && okReload) break;
      }
      return {
        ok: cAlive === sAlive && okReload,
        detail: 'client=' + cAlive + ' server=' + sAlive +
          ' reload=' + (cr ? cr.age.toFixed(2) + '/' + (cr.dur || 0).toFixed(2) : '-')
      };
    });

    // ===== TEMP PERF PROBE（放在所有断言之后：它会改变世界状态）=====
    {
      const srv = game.net && game.net.debugServer;
      if (srv) {
        const N = 40;
        const t0 = performance.now();
        for (let i = 0; i < N; i++) srv.step(1 / 60);
        const baseSrv = (performance.now() - t0) / N;
        const awakeN = (srv._awake || []).length;
        const st = MOB_TYPES.find((x) => x && x.slug === 'spider');
        let withSrv = -1, rInfo = '';
        if (st) {
          const mm = new Mob(st, game.player.x + 300, game.player.y, 1, 'eternal');
          srv.ents.push(mm);
          const t1 = performance.now();
          for (let i = 0; i < N; i++) srv.step(1 / 60);
          withSrv = (performance.now() - t1) / N;
          rInfo = `r=${mm.r.toFixed(1)} visualD=${mm.visualD.toFixed(1)}`;
        }
        const t2 = performance.now();
        for (let i = 0; i < 10; i++) srv._fillEnts();
        const fill = (performance.now() - t2) / 10;
        const t3 = performance.now();
        for (let i = 0; i < 20; i++) game.update(1 / 60);
        const upd = (performance.now() - t3) / 20;
        const t4 = performance.now();
        for (let i = 0; i < 20; i++) game.render();
        const rnd = (performance.now() - t4) / 20;
        report.checks.push({
          name: 'PROBE', ok: true,
          detail: `服务端步=${baseSrv.toFixed(2)}ms(永恒蜘蛛后 ${withSrv.toFixed(2)}ms ${rInfo}) `
            + `awake=${awakeN} ents=${srv.ents.length} 快照填充=${fill.toFixed(2)}ms `
            + `客户端update=${upd.toFixed(2)}ms render=${rnd.toFixed(2)}ms 视图数=${game.mobs.length}`
        });
        const pr = srv._prof;
        if (pr && pr.n) {
          const parts = Object.keys(pr.t).map((k) => `${k}=${(pr.t[k] / pr.n).toFixed(2)}`).join(' ');
          report.checks.push({ name: 'PROBE2', ok: true, detail: `服务端分项(ms/步): ${parts} n=${pr.n}` });
          pr.t = {}; pr.n = 0;
        }
        // 召唤永恒蜘蛛后连跑 10 秒，逐帧计时（找"卡死"）
        {
          const st2 = MOB_TYPES.find((x) => x && x.slug === 'spider');
          if (st2) {
            const em = new Mob(st2, game.player.x + 200, game.player.y, 1, 'eternal');
            srv.ents.push(em);
            const times = [];
            const t5 = performance.now();
            for (let i = 0; i < 600; i++) {
              const a = performance.now();
              game.update(1 / 60);
              game.render();
              times.push(performance.now() - a);
            }
            const tot = (performance.now() - t5) / 600;
            times.sort((x, y) => x - y);
            report.checks.push({
              name: 'PROBE3', ok: true,
              detail: `永恒蜘蛛 10 秒: 平均=${tot.toFixed(2)}ms p50=${times[300].toFixed(2)} `
                + `p95=${times[570].toFixed(2)} max=${times[599].toFixed(2)} `
                + `服务端网=${srv.mobWebs.length} 客户端网=${(game.mobWebs && game.mobWebs.length) || 0} `
                + `awake=${(srv._awake || []).length} 玩家hp=${game.player.hp.toFixed(0)}`
            });
          }
        }
      }
    }
    // 蜘蛛碰撞箱 = 从【原 SVG 提取】的"身体"（忽略 8 条腿）
    {
      const st = MOB_TYPES.find((x) => x && x.slug === 'spider');
      let detail = '没有蜘蛛类型';
      let ok = false;
      if (st) {
        const sm = new Mob(st, 0, 0, 1, 'common');
        sm._ensureShape();
        const pts = (sm.shape && sm.shape.pts) || null;
        const k = sm.drawSize > 0 ? sm.r / sm.drawSize : 0;
        // 对照组：无腿身体素材（mob21_body）与含腿素材（mob21）的外接半径
        const bodyCt = SpriteStore.contour('mob21_body', sm.drawSize);
        const fullCt = SpriteStore.contour('mob21', sm.drawSize);
        const bodyR = bodyCt ? bodyCt.r : 0, fullR = fullCt ? fullCt.r : 0;
        if (bodyR > 0) {
          // 去腿素材已就绪：碰撞箱必须等于"身体"口径，且明显小于含腿轮廓
          ok = !!pts && Math.abs(k - bodyR) < 0.03 && (fullR <= 0 || k < fullR * 0.6);
          detail = `r/视觉直径=${k.toFixed(3)}（无腿身体=${bodyR.toFixed(3)} 含腿=${fullR.toFixed(3)}）`;
        } else {
          // 去腿素材还没就绪：绝不能把"含腿轮廓"提前定死（碰撞箱会大一圈）
          ok = !pts || k < 0.25;
          detail = pts
            ? `去腿素材未就绪却已缓存 r=${k.toFixed(3)}（应 <0.25）`
            : '去腿素材未就绪、尚未提取（等待素材，OK）';
        }
      }
      report.checks.push({ name: 'sim: 蜘蛛碰撞箱从 SVG 提取（忽略腿）', ok, detail });
    }
    // Antennae（触角）：视野扩大 -> 相机拉远（zoom < 1），且【平滑过渡】不是瞬变
    check('petal: 触角扩大视野且相机平滑缩放', () => {
      const p = game.player;
      const ant = (typeof PETAL_TYPES !== 'undefined')
        ? PETAL_TYPES.find((x) => x && x.slug === 'antennae') : null;
      if (!ant || typeof makePetal !== 'function') return '未启用 antennae（跳过）';
      const saved = p.slots[0];
      p.slots[0] = makePetal(ant.key, 'common');
      p.recompute();
      const bonus = p.sightBonus || 0;
      if (!(bonus > 0)) return { ok: false, detail: 'sightBonus 未生效（=0）' };
      // 数值链路：数据表 -> PetalFX.bonus -> Player.recompute
      const b = PetalFX.bonus(ant, 'common');
      if (!(b.sight > 0)) return { ok: false, detail: 'PetalFX.bonus 未给出 sight' };
      // 官方数值表：common 视野 +11.1% -> 相机缩放 1/1.111 ≈ 0.9
      const stAnt = petalStatsFor(ant, 'common');
      if (Math.abs(stAnt.sight - 0.111) > 1e-9) {
        return { ok: false, detail: `common sight=${stAnt.sight}（应 0.111）` };
      }
      const zCommon = 1 / (1 + stAnt.sight);
      if (Math.abs(zCommon - 0.9) > 0.002) {
        return { ok: false, detail: `common 相机缩放应 ≈0.9，实际 ${zCommon.toFixed(4)}` };
      }
      game.stepFrames(1, 1 / 60, false);
      const target = game.camZoomTarget, z0 = game.camZoom;
      if (!(target < 1)) return { ok: false, detail: `camZoomTarget=${target}（应 < 1）` };
      if (!(z0 > target)) {
        return { ok: false, detail: `第一帧就瞬变：z0=${z0.toFixed(4)} target=${target.toFixed(4)}（应平滑逼近）` };
      }
      game.stepFrames(180, 1 / 60, false);
      const z1 = game.camZoom;
      if (!(Math.abs(z1 - target) < 0.01)) {
        return { ok: false, detail: `未趋近目标：z=${z1.toFixed(4)} target=${target.toFixed(4)}` };
      }
      const viewRadius = Math.hypot(
        Math.abs(game.camera.x - p.x) + game.W / (2 * z1),
        Math.abs(game.camera.y - p.y) + game.H / (2 * z1)
      ) + 300;
      if (game._nearR < viewRadius) {
        p.slots[0] = saved; p.recompute();
        game.stepFrames(120, 1 / 60, false);
        return { ok: false, detail: `生物视图半径 ${game._nearR.toFixed(1)} 小于视口覆盖需求 ${viewRadius.toFixed(1)}` };
      }
      // 还原装备，避免影响后续断言
      p.slots[0] = saved; p.recompute();
      game.stepFrames(120, 1 / 60, false);
      return `视野 +${(bonus * 100).toFixed(0)}%  zoom ${z0.toFixed(3)} -> ${z1.toFixed(3)}（目标 ${target.toFixed(3)}）`;
    });
    // Peas：合并显示口径（官方模板特例）—— 显示 4 合 1，实体结算仍是单体值
    check('petal: Peas 合并显示（4 合 1）且实体仍按单体结算', () => {
      const peas = (typeof PETAL_TYPES !== 'undefined')
        ? PETAL_TYPES.find((x) => x && x.slug === 'peas') : null;
      if (!peas || typeof petalDisplayStats !== 'function') return '未启用 peas（跳过）';
      const st = petalStatsFor(peas, 'common');
      const ds = petalDisplayStats(peas, 'common');
      const cnt = CardRenderer.lightSubCount(peas, 'common');
      if (cnt !== 4) return { ok: false, detail: `实体数应为 4，实际 ${cnt}` };
      if (Math.abs(ds.dmg - st.dmg * 4) > 1e-9) {
        return { ok: false, detail: `显示伤害应=4×单体（${st.dmg * 4}），实际 ${ds.dmg}` };
      }
      if (Math.abs(ds.hp - st.hp * 4) > 1e-9) {
        return { ok: false, detail: `显示血量应=4×单体（${st.hp * 4}），实际 ${ds.hp}` };
      }
      return `common 单体 ${st.dmg}/${st.hp} -> 显示 ${ds.dmg}/${ds.hp}（${cnt} 个实体各 ${st.dmg}/${st.hp}）`;
    });
    // ===== END TEMP PERF PROBE =====

    emit();
  }

  main().catch((e) => {
    push('selftest: 执行异常', false, (e && e.stack) || String(e));
    emit();
  });
})();
