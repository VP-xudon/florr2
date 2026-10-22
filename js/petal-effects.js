// petal-effects.js — 花瓣特殊效果引擎（检测与效果自由组合的自定义框架）
// 'use strict';
//
// 设计目标：把"花瓣的特殊行为"从 _syncPetals / 战斗结算里彻底剥离。
// 任何花瓣只要在这里注册同名效果（key === card.type.slug，如 'rose'），引擎就会在它
// 【reload 完成、弹出至轨道后】每帧运行 detect；命中即激活 start/update，
// 检测（detect）与效果（update）完全解耦，可自由组合出新花瓣。
//
// —— 注册格式 ——
//   PetalFX.register(key, {
//     detect(ctx)          -> bool   每帧检测（未激活时调用）；返回 true 触发
//     start(ctx)                     触发时初始化（状态挂在 ctx.petal.fx.state）
//     update(ctx, dt)      -> bool   激活后每帧；返回 true = 效果结束（花瓣解管）
//     draw?(ctx2d, ctx)              可选：额外绘制（在花瓣本体之后调用）
//   });
//
// —— ctx API ——
//   ctx.player / ctx.petal / ctx.stats / ctx.dt
//   ctx.onOrbit()       花瓣是否已弹出至轨道（age ≥ ORBIT_T，出场 Q 弹完成）
//   ctx.heal(n)         给主角回血（自动 clamp 到 maxHp）
//   ctx.consumePetal()  消耗花瓣：转退场幽灵（放大渐隐）+ 该槽重新结算装填
//   激活期间引擎直接把 b.x/b.y 交给特效驱动（跳过轨道弹簧），战斗结算跳过
//   该花瓣（b.fxNoCombat），图层抬高到主角之上（玫瑰"飞到脸上吃"的观感）。

const PetalFX = {
  defs: {},
  ORBIT_T: 0.2,          // 弹出至轨道的判定阈值（出生 Q 弹 0.1s + 余量）
  _suppress: false,      // true = 静音表现层输出（服务端权威副本推进时置位）

  // 文字输出钩子：由 game.js 注入（内部转 spawnText）。
  // 特效层不直接持有 Game 实例，只通过这个单一出口弹字，保持「特效只描述意图」的分层。
  textSink: null,

  register(key, def) { this.defs[key] = def; },

  // 每帧对每片【在轨】花瓣推进：未激活 -> detect；已激活 -> update
  tick(body, player, dt) {
    if (!body || body.dead || body.fxDone) return;
    if (!body.fxActive) {
      // 查表键用 type.slug（'rose'/'basic' 等，稳定英文名）。
      // 注意不能用 type.key —— data.js 里 key 是 'p'+id（玫瑰是 'p5'），永远对不上注册名。
      const type = body.card && body.card.type;
      const key = type && (type.slug || type.key);
      const def = key ? this.defs[key] : null;
      if (!def || !def.detect) return;
      const c = this._ctx(body, player, dt);
      if (!def.detect(c)) return;
      body.fx = { key, state: {} };
      body.fxActive = true;
      body.fxNoCombat = true;       // 特效进行中不参与战斗结算
      if (def.start) def.start(c);
      return;
    }
    const def = this.defs[body.fx && body.fx.key];
    if (!def || !def.update) { body.fxActive = false; return; }
    const done = def.update(this._ctx(body, player, dt), dt);
    if (done) { body.fxActive = false; body.fxNoCombat = false; body.fxDone = true; }
  },

  _ctx(body, player, dt) {
    return {
      player,
      petal: body,
      stats: petalStatsFor(body.card.type, body.card.rarity),
      dt,
      onOrbit: () => body.age >= this.ORBIT_T,
      // 弹出"一点点"（约 1/3 弹道）：用于"加载即结算"类特效——不等飞满整圈固定位，
      // 花瓣往外弹一点就被拉回主角中心（观感更优美）。
      popped: () => body.age >= this.ORBIT_T * 0.34,
      // 回血：返回【实际回血量】（血量有缺口不足时小于 n；满血返回 0）。
      // 调用方应据此弹反馈，避免"想回 8 点但只回了 3 点却显示 8"。
      heal: (n) => {
        const before = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + (n || 0));
        return player.hp - before;
      },
      // 弹飘字：走 textSink（game.spawnText），样式与攻击反馈完全一致（DamageText）。
      // _suppress 为 true 时静音 —— 服务端权威副本也会跑特效逻辑（为了结算治疗量），
      // 但表现层只能由客户端出，否则同一帧会弹两次。
      floatText: (text, color, x, y) => {
        if (PetalFX._suppress) return;
        if (PetalFX.textSink) PetalFX.textSink(x, y, text, color);
      },
      consumePetal: () => this._consume(body, player),
    };
  },

  // 消耗：与 _destroyPetal/_syncPetals 同语义 —— 只打 dead 标记，由 _syncPetals
  // 的差分转成退场幽灵（原地放大渐隐），装填立即重新结算。
  _consume(body, player) {
    body.dead = true;
    const c = body.card;
    const dur = (c.type.reload != null) ? c.type.reload : Math.max(0, c.type.spd || 0);
    player.reload[body.slotIndex] = { card: c, age: 0, dur };
  },
};

// —— 内置特效 1：玫瑰（Rose）——
// 检测：reload 完成、已弹出至轨道，且主角血量不满（每帧检测，
//       因此"加载好之后的任何时候"血量不满都会立刻触发，而非只在出生瞬间）。
// 效果：1.5s smoothstep 从触发点飞向主角，结束时回 heal 血并消耗自己
//       （对应卡面冷却文本 "3.5s + 1.5s" 的后半段）。
PetalFX.register('rose', {
  detect(ctx) {
    // 加载即结算：不等回到满圈固定位，花瓣往外弹一点(orbit 1/3)就触发，
    // 随即被拉回主角中心回血（弃用"回固定位再吸入"的复杂做法）。
    return ctx.popped() && (ctx.stats.heal || 0) > 0 && ctx.player.hp < ctx.player.maxHp;
  },
  start(ctx) {
    ctx.petal.fx.state = { t: 0, fromX: ctx.petal.x, fromY: ctx.petal.y };
  },
  update(ctx, dt) {
    const s = ctx.petal.fx.state;
    s.t += dt;
    const t01 = clamp(s.t / 1.5, 0, 1);
    const e = t01 * t01 * (3 - 2 * t01);            // smoothstep：平滑起停
    ctx.petal.x = s.fromX + (ctx.player.x - s.fromX) * e;
    ctx.petal.y = s.fromY + (ctx.player.y - s.fromY) * e;
    if (t01 >= 1) {
      // 回血并弹出反馈：颜色用 Heal 专用粉（与卡面 Heal 属性行同色 #ff94c9），
      // 数值是【实际回血量】，位置在花朵本体上方 —— 与攻击飘字同款式，只是颜色和出发点不同。
      const got = ctx.heal(ctx.stats.heal);
      if (got > 0) {
        // 数字格式与攻击飘字保持一致（四舍五入到个位的原值），只换颜色与出发点
        ctx.floatText(String(Math.round(got)), HEAL_TEXT_COLOR,
          ctx.player.x, ctx.player.y - ctx.player.r - 6);
      }
      ctx.consumePetal();
      return true;
    }
    return false;
  },
});
