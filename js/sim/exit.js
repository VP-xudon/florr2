// sim/exit.js — 实体生命周期引擎（无 DOM，可在 Node 加载）
//
// 契约：
//   spawn → tick → despawn → finished，回收只发生在 EntitySet.tick / tickList 里。
//   渲染必须走 EntityFX.draw(ctx, ent, paint)：入场/退场/渐隐由引擎统一施加，
//   业务代码不得手写 spawnFade/spawnPop/deathFade/ExitFX.alpha/scale。
//   绕过引擎直接 splice/pop/filter/length= 删元素 = 实体凭空消失，全项目禁止。
//
// 曲线（引擎内部私有，不再向外暴露）：
//   · 出场：pop = alpha 渐显 + Q 弹缩放（easeOutBack）；spring = 三次缓出 + 过冲
//   · 退场：growFade = 放大 ×1.5 + 渐隐；fade = 只渐隐；fadeShrink = 渐隐 + 缩 15%
//   · 红闪：ENTITY_HURT_T=0.3s，最大不透明度 0.55
// 种类注册表 registerKind(kind, {enter, enterT, exit, exitT}) 可按类型覆盖时长。
// 业务代码只读 EntityFX.visual / draw，绝不再手算这些曲线。

'use strict';

// clamp 来自 util.js（全局）。
// 曲线参数与函数全部收在本模块，constants.js 不再导出 spawnFade/spawnPop/deathFade。
const ENTITY_HURT_T = 0.3;   // 红闪统一时长（秒）
const ENTITY_HURT_A = 0.55;  // 红闪统一最大不透明度
const ENTITY_ENTER_T = 0.1;  // 默认出场时长（秒）
const ENTITY_EXIT_T = 0.1;   // 默认退场时长（秒）
const ENTITY_DEATH_SCALE = 1.5;   // 退场放大倍率

// ---------- 曲线（内部私有）----------
function hurtAlphaOf(t01) { return ENTITY_HURT_A * clamp(t01, 0, 1); }
// Q 弹：easeOutBack —— 从小弹出、过冲到 ~1.1 再落回 1
function enterPop(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
// 蛛网：三次缓出 + 一点点过冲，"啪地张开"
function enterSpring(t) {
  return (1 - Math.pow(1 - t, 3)) * (1 + 0.16 * Math.sin(Math.PI * t));
}
function enterVisual(kind, age) {
  const t = clamp((age || 0) / (kind.enterT || ENTITY_ENTER_T), 0, 1);
  if (kind.enter === 'spring') return { scale: enterSpring(t), alpha: t };
  if (kind.enter === 'none') return { scale: 1, alpha: 1 };
  return { scale: enterPop(t), alpha: t };
}
function exitVisual(kind, t01) {
  const t = clamp(t01, 0, 1);
  if (kind.exit === 'fade') return { scale: 1, alpha: 1 - t };
  if (kind.exit === 'fadeShrink') return { scale: 1 - 0.15 * t, alpha: 1 - t };
  return { scale: 1 + (ENTITY_DEATH_SCALE - 1) * t, alpha: 1 - t };
}

// ---------- 种类注册表 ----------
// 曲线参数只在这里改；新增实体类型只需 registerKind 一处，不再各文件各写一套。
const KINDS = {
  mob:        { enter: 'pop',    enterT: 0.10, exit: 'growFade',  exitT: ENTITY_EXIT_T },
  web:        { enter: 'spring', enterT: 0.18, exit: 'growFade',  exitT: ENTITY_EXIT_T },
  drop:       { enter: 'pop',    enterT: 0.10, exit: 'fadeShrink', exitT: 0.50 },
  petal:      { enter: 'pop',    enterT: 0.10, exit: 'growFade',  exitT: ENTITY_EXIT_T },
  projectile: { enter: 'pop',    enterT: 0.10, exit: 'growFade',  exitT: ENTITY_EXIT_T },
  summon:     { enter: 'pop',    enterT: 0.10, exit: 'growFade',  exitT: ENTITY_EXIT_T },
  fx:         { enter: 'pop',    enterT: 0.10, exit: 'fade',      exitT: ENTITY_EXIT_T },
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
    ent.fxAge = null;       // 附着型实体由渲染方每帧写入（见 state）
    ent._inExitSet = false;
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
  // 主角本体不是可回收实体，但出场 Q 弹与实体共用同一条曲线（唯一来源）。
  pop(age) { return enterPop(clamp((age || 0) / ENTITY_ENTER_T, 0, 1)); },

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
      // 退场进度 -> 缩放/透明度（曲线由 kind.exit 决定）
      const k = kindOf(ent._kind);
      const d = exitVisual(k, (ent.exitT || 0) / (ent.exitDur || k.exitT || ENTITY_EXIT_T));
      ent.exitAlpha = d.alpha;
      ent.exitScale = d.scale;
      return (ent.exitT || 0) >= (ent.exitDur || k.exitT || ENTITY_EXIT_T);
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
      if (this.done(e)) {
        list.splice(i, 1);
        e._inExitSet = false;
        removed++;
      }
    }
    return removed;
  },

  // 渲染层统一读：{ alpha, scale, exiting, hurt, flash }
  // alpha/scale 已经把 入场 × 退场 相乘好了，渲染方直接乘即可。
  // fxAge：附着型实体（Hornet 挂载尾针）的入场计时跟宿主走，由渲染方每帧写入。
  state(ent) {
    if (!ent) return { alpha: 1, scale: 1, exiting: false, hurt: 0, flash: 0 };
    const k = kindOf(ent._kind);
    const enter = enterVisual(k, ent.fxAge != null ? ent.fxAge : (ent.age || 0));
    let exitA = 1, exitS = 1;
    if (ent.exiting) {
      exitA = ent.exitAlpha == null ? 1 : ent.exitAlpha;
      exitS = ent.exitScale == null ? 1 : ent.exitScale;
    }
    return {
      alpha: exitA * enter.alpha * (ent.fxAlpha == null ? 1 : ent.fxAlpha),
      scale: exitS * enter.scale * (ent.fxScale == null ? 1 : ent.fxScale),
      exiting: !!ent.exiting,
      hurt: this.hurtAlpha(ent),
      flash: ent.flash || 0,
    };
  },
  isExiting(ent) { return !!(ent && ent.exiting); },
  done(ent) {
    if (!ent || !ent.exiting) return false;
    const k = kindOf(ent._kind);
    return (ent.exitT || 0) >= (ent.exitDur || k.exitT || ENTITY_EXIT_T);
  },
  progress(ent) {
    if (!ent || !ent.exiting) return 1;
    const k = kindOf(ent._kind);
    return clamp((ent.exitT || 0) / (ent.exitDur || k.exitT || ENTITY_EXIT_T), 0, 1);
  },

  // 算出并缓存到 ent.fx（每帧一次，幂等）。渲染方优先读 ent.fx。
  visual(ent) {
    if (!ent) return null;
    if (ent.fx == null) ent.fx = this.state(ent);
    return ent.fx;
  },
  // 标记 fx 失效（tickEntity 已在内部置 null，这里供外部主动使失效）
  dirty(ent) { if (ent) ent.fx = null; },

  // 独立实体（不在受控列表里，如 Map 里的弹体）显式推进退场动画。
  // 只推进退场计时，不推进 age/hurtT（那些由拥有者决定）。
  advanceExit(ent, dt) {
    if (!ent || !ent.exiting) return false;
    ent.exitT = (ent.exitT || 0) + dt;
    const k = kindOf(ent._kind);
    const d = exitVisual(k, (ent.exitT || 0) / (ent.exitDur || k.exitT || ENTITY_EXIT_T));
    ent.exitAlpha = d.alpha;
    ent.exitScale = d.scale;
    ent.fx = null;
    return (ent.exitT || 0) >= (ent.exitDur || k.exitT || ENTITY_EXIT_T);
  },

  // 复活（服务端把还活着的实体重新下发）：撤销退场标记并重新播入场。
  revive(ent, kind) {
    if (!ent) return null;
    return this.spawn(ent, kind || ent._kind);
  },

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

// ---------- 受控实体表（唯一容器）----------
// 内部数组被闭包封死，外面拿不到 —— 无法绕过退场动画直接删元素。
// 对外只暴露"只读遍历 + add + tick/sweep"，刻意不提供 push/pop/splice/clear/length=。
function createEntitySet(kind) {
  const a = [];
  return {
    add(e) { a.push(e); return EntityFX.spawn(e, kind); },
    // 收养一个已经在退场中的实体（不要把 spawn 再跑一遍，否则退场会被重置）
    adopt(e) {
      if (!e || e._inExitSet) return e;
      e._inExitSet = true;
      a.push(e);
      return e;
    },
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
