// sim/exit.js — 实体生命周期引擎（无 DOM，可在 Node 加载）
//
// 契约：
//   spawn → tick → despawn → finished，回收只发生在 EntitySet.tick / tickList 里。
//   渲染必须走 EntityFX.draw(ctx, ent, paint)：入场/退场/渐隐由引擎统一施加，
//   业务代码不得手写 spawnFade/spawnPop/deathFade/ExitFX.alpha/scale。
//   绕过引擎直接 splice/pop/filter/length= 删元素 = 实体凭空消失，全项目禁止。
//
// 曲线（引擎内部私有，不再向外暴露）：
//   · 出场：spawnFade（alpha 渐显，0.1s）+ spawnPop（Q 弹缩放，easeOutBack）
//   · 退场：deathFade（放大 ×1.5 + 渐隐，0.1s）—— 与生物死亡同一套
//   · 红闪：ENTITY_HURT_T=0.3s，最大不透明度 0.55
// 种类注册表 registerKind(kind, {enter, enterT, exit, exitT}) 可按类型覆盖时长。

'use strict';

// clamp / TAU 来自 util.js（全局），与原 exit.js 一致，不在此重复声明。
// FADE_T / DEATH_SCALE / spawnFade / spawnPop / deathFade 来自 sim/constants.js
//（全局函数/常量，可在此直接引用）。
// ENTITY_HURT_T / ENTITY_HURT_A 是本模块专用，constants.js 里没有，须在此定义。
const ENTITY_HURT_T = 0.3;   // 红闪统一时长（秒）
const ENTITY_HURT_A = 0.55;  // 红闪统一最大不透明度

// ---------- 曲线（内部私有，复用 sim/constants.js 的全局常量与函数）----------
function hurtAlphaOf(t01) { return ENTITY_HURT_A * clamp(t01, 0, 1); }

// ---------- 种类注册表 ----------
// 曲线参数只在这里改；新增实体类型只需 registerKind 一处，不再各文件各写一套。
const KINDS = {
  mob:        { enter: 'pop',    enterT: 0.10, exit: 'growFade', exitT: FADE_T },
  web:        { enter: 'spring', enterT: 0.18, exit: 'growFade', exitT: FADE_T },
  drop:       { enter: 'pop',    enterT: 0.10, exit: 'fade',     exitT: 0.50 },
  petal:      { enter: 'pop',    enterT: 0.10, exit: 'growFade', exitT: FADE_T },
  projectile: { enter: 'pop',    enterT: 0.10, exit: 'growFade', exitT: FADE_T },
  summon:     { enter: 'pop',    enterT: 0.10, exit: 'growFade', exitT: FADE_T },
  fx:         { enter: 'pop',    enterT: 0.10, exit: 'fade',     exitT: FADE_T },
};
function registerKind(kind, def) { KINDS[kind] = { ...KINDS.mob, ...def }; }
function kindOf(kind) { return KINDS[kind] || KINDS.mob; }

// ---------- EntityFX：所有实体共用的入场/退场/红闪引擎（唯一对外接口）----------
const EntityFX = {
  // 入场：任何实体创建后调一次（列表由调用方自己 add，不在这里碰数组）
  spawn(ent, kind) {
    if (!ent) return null;
    const k = kindOf(kind);
    ent.age = 0;
    ent.hurtT = 0;
    ent.flash = 0;
    ent.exiting = false;
    ent.exitT = 0;
    ent.exitDur = k.exitT;
    ent.exitAlpha = 1;
    ent.exitScale = 1;
    ent.fx = null;          // 由 visual() 懒算，每帧重算一次（幂等）
    ent._kind = kind || 'mob';
    return ent;
  },

  // 红闪：全体实体同一个时长与强度，别再各处写 0.3 / 0.55
  hurt(ent, dur) {
    if (!ent || ent.exiting) return;
    ent.hurtT = (dur > 0) ? dur : ENTITY_HURT_T;
    ent.flash = Math.max(ent.flash || 0, ent.hurtT);
  },
  hurtAlpha(ent) {
    if (!ent || !(ent.hurtT > 0)) return 0;
    return hurtAlphaOf(ent.hurtT / ENTITY_HURT_T);
  },

  // 退场：唯一离场入口。opt = { dur, ghost(list, ent) }。绝不直接删元素。
  despawn(ent, opt) {
    if (!ent || ent.exiting) return ent;
    const o = opt || {};
    const k = kindOf(ent._kind);
    ent.exiting = true;
    ent.exitT = 0;
    ent.exitDur = (o.dur > 0) ? o.dur : k.exitT;
    ent.exitAlpha = 1;
    ent.exitScale = 1;
    ent.fx = null;          // 退场开始，fx 失效，下一帧 visual() 重算
    if (typeof o.ghost === 'function') o.ghost(ent);
    return ent;
  },

  // 单实体动画计时（不碰数组，可安全用于"附着在别处的实体"，如 Map 里的弹体）
  // 返回 true = 退场已播完（可被回收），但本身不回收。
  tickEntity(ent, dt) {
    if (!ent) return false;
    ent.age = (ent.age || 0) + dt;
    ent.hurtT = Math.max(0, (ent.hurtT || 0) - dt);
    ent.flash = Math.max(0, (ent.flash || 0) - dt);
    ent.fx = null;          // 计时后 fx 失效，下一帧 visual() 重算
    if (ent.exiting) {
      ent.exitT = (ent.exitT || 0) + dt;
      // 退场进度 -> 缩放/透明度（deathFade：放大×1.5 + 渐隐，与 mob.js 旧 ExitFX.tick 同一套）
      const t = clamp(ent.exitT / (ent.exitDur || FADE_T), 0, 1);
      const d = deathFade(t);
      ent.exitAlpha = d.alpha;
      ent.exitScale = d.scale;
      return (ent.exitT || 0) >= (ent.exitDur || FADE_T);
    }
    return false;
  },

  // 列表推进：入场/红闪/退场计时 + 【唯一】的回收（退场播完才移除）
  tickList(list, dt) {
    if (!list || !list.length) return 0;
    let removed = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (!e) continue;
      this.tickEntity(e, dt);
      if (e.exiting && (e.exitT || 0) >= (e.exitDur || FADE_T)) {
        list.splice(i, 1);
        removed++;
      }
    }
    return removed;
  },

  // 渲染层统一读：{ alpha, scale, exiting, hurt, flash }
  // alpha/scale 已经把 入场(spawn) × 退场(exit) 相乘好了，渲染方直接乘即可。
  state(ent) {
    if (!ent) return { alpha: 1, scale: 1, exiting: false, hurt: 0, flash: 0 };
    const spawnA = spawnFade(ent.age || 0);
    const spawnS = spawnPop(ent.age || 0);
    let exitA = 1, exitS = 1;
    if (ent.exiting) {
      exitA = ent.exitAlpha == null ? 1 : ent.exitAlpha;
      exitS = ent.exitScale == null ? 1 : ent.exitScale;
    }
    return {
      alpha: exitA * spawnA,
      scale: exitS * spawnS,
      exiting: !!ent.exiting,
      hurt: this.hurtAlpha(ent),
      flash: ent.flash || 0,
    };
  },
  isExiting(ent) { return !!(ent && ent.exiting); },
  done(ent) { return ent && ent.exiting && (ent.exitT || 0) >= (ent.exitDur || FADE_T); },
  progress(ent) {
    if (!ent || !ent.exiting) return 1;
    return clamp((ent.exitT || 0) / (ent.exitDur || FADE_T), 0, 1);
  },

  // 算出并缓存到 ent.fx（每帧一次，幂等）。渲染方优先读 ent.fx。
  visual(ent) {
    if (!ent) return null;
    if (ent.fx == null) ent.fx = this.state(ent);
    return ent.fx;
  },
  // 标记 fx 失效（tickEntity 已在内部置 null，这里供外部主动使失效）
  dirty(ent) { if (ent) ent.fx = null; },

  // ★ 强制统一绘制入口：所有实体画面只能通过这里画
  //   ctx.save(); translate(ent.x, ent.y); scale(fx.scale); globalAlpha *= fx.alpha; paint(); ctx.restore();
  // 退场播完（alpha≈0）或缩放≈0 时不再调用 paint（等价于已消失，但由 sweep 统一回收）。
  draw(ctx, ent, paint) {
    const fx = this.visual(ent);
    if (!(fx.alpha > 0.001) || !(fx.scale > 0.001)) return;
    ctx.save();
    ctx.translate(ent.x, ent.y);
    ctx.scale(fx.scale, fx.scale);
    ctx.globalAlpha *= fx.alpha;
    paint(ctx, ent, fx);
    ctx.restore();
  },

  // 统一的红闪绘制原语（圆形蒙层）。生物那种"带轮廓的红剪影"仍可在自己的 draw 里
  // 用 hurtAlpha() 当不透明度——数值与时长同样来自这里，不会各写一套。
  drawHurt(ctx, ent, x, y, r) {
    const a = this.hurtAlpha(ent);
    if (!(a > 0) || !(r > 0)) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ff4040';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  // 多边形实体的红闪（Wax 这类"碰撞箱严格等于外形"的实体）。
  drawHurtPoly(ctx, ent, x, y, poly, r) {
    const a = this.hurtAlpha(ent);
    if (!(a > 0) || !poly || poly.length < 3 || !(r > 0)) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ff4040';
    ctx.beginPath();
    for (let i = 0; i < poly.length; i++) {
      const vx = poly[i][0] * r, vy = poly[i][1] * r;
      if (i === 0) ctx.moveTo(x + vx, y + vy); else ctx.lineTo(x + vx, y + vy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
};

// ---------- ExitFX 兼容层（废弃，逐步迁移后删除）----------
// 所有旧调用点（ExitFX.begin/tick/done/alpha/scale/sweep）委托给 EntityFX，
// 这样重构可分步进行，不必一次性改完所有文件。
const ExitFX = {
  begin(ent, dur) { return EntityFX.despawn(ent, { dur }); },
  tick(ent, dt) { return EntityFX.tickEntity(ent, dt); },
  alpha(ent) {
    const s = EntityFX.state(ent);
    return ent && ent.exiting ? (ent.exitAlpha == null ? 1 : ent.exitAlpha) : s.alpha;
  },
  scale(ent) {
    const s = EntityFX.state(ent);
    return ent && ent.exiting ? (ent.exitScale == null ? 1 : ent.exitScale) : s.scale;
  },
  done(ent) { return EntityFX.done(ent); },
  progress(ent) { return EntityFX.progress(ent); },
  sweep(arr, dt) { return EntityFX.tickList(arr, dt); },
  // 独立实体（不在受控列表里）显式推进退场动画
  advanceExit(ent, dt) { return EntityFX.tickEntity(ent, dt); },
};

// ---------- 受控实体表（唯一容器）----------
// 内部数组被闭包封死，外面拿不到 —— 无法绕过退场动画直接删元素。
// 对外只暴露"只读遍历 + add + tick/sweep"，刻意不提供 push/pop/splice/clear/length=。
function createEntitySet(kind) {
  const a = [];
  return {
    add(e) { a.push(e); return EntityFX.spawn(e, kind); },
    get length() { return a.length; },
    get(i) { return a[i]; },
    at(i) { return a[i]; },
    forEach(fn, thisArg) { a.forEach(fn, thisArg); },
    map(fn) { return a.map(fn); },
    filter(fn) { return a.filter(fn); },
    some(fn) { return a.some(fn); },
    find(fn) { return a.find(fn); },
    slice() { return a.slice(); },
    [Symbol.iterator]() { return a[Symbol.iterator](); },
    // 推进所有元素动画，退场播完的才移除（唯一的移除路径）
    tick(dt) { return EntityFX.tickList(a, dt); },
    sweep(dt) { return EntityFX.tickList(a, dt); },
    // 按 y 排序（用于按高度绘制，避免遮挡错乱）
    sortedByY() { return a.slice().sort((x, y) => (x.y || 0) - (y.y || 0)); },
    toArray() { return a.slice(); },
  };
}
// 旧别名（废弃，Stage 1 迁移完后统一改为 createEntitySet）
const createExitList = createEntitySet;
