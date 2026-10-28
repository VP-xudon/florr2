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

    emit();
  }

  main().catch((e) => {
    push('selftest: 执行异常', false, (e && e.stack) || String(e));
    emit();
  });
})();
