// sim/exit.js — 实体生命周期引擎（无 DOM，可在 Node 加载）
//
// 契约：创建 EntityFX.spawn → 每帧 tickEntity / 表内 tickList → 离场 EntityFX.despawn
//       → 退场播完由 EntityFX.done 判定，回收只发生在受控实体表里。
// 渲染必须走 EntityFX.draw(ctx, ent, paint)：入场/退场/渐隐由引擎统一施加；
// 业务代码不得手写曲线，也不得 splice/pop/filter/length= 删实体（= 实体凭空消失）。
'use strict';

// ---------- 曲线参数（引擎私有，外部只读结果）----------
const ENTITY_HURT_T = 0.3;         // 红闪统一时长（秒）
const ENTITY_HURT_A = 0.55;        // 红闪统一最大不透明度
const ENTITY_ENTER_T = 0.1;        // 默认入场时长（秒）
const ENTITY_EXIT_T = 0.1;         // 默认退场时长（秒）
const ENTITY_DEATH_SCALE = 1.5;    // 退场放大倍率

function hurtAlphaOf(t01, maxA) {
  return (maxA == null ? ENTITY_HURT_A : maxA) * clamp(t01, 0, 1);
}
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
// 新增实体类型只在这里加一行；曲线参数不再散落到各文件。
const KINDS = {
  mob:        { enter: 'pop',    enterT: 0.10, exit: 'growFade',   exitT: ENTITY_EXIT_T },
  web:        { enter: 'spring', enterT: 0.18, exit: 'growFade',   exitT: ENTITY_EXIT_T },
  drop:       { enter: 'pop',    enterT: 0.10, exit: 'fadeShrink', exitT: 0.50 },
  petal:      { enter: 'pop',    enterT: 0.10, exit: 'growFade',   exitT: ENTITY_EXIT_T },
  projectile: { enter: 'pop',    enterT: 0.10, exit: 'growFade',   exitT: ENTITY_EXIT_T },
};
function kindOf(kind) { return KINDS[kind] || KINDS.mob; }
function exitDurOf(ent) {
  return ent.exitDur || kindOf(ent._kind).exitT || ENTITY_EXIT_T;
}

// ---------- EntityFX：所有实体共用的入场/退场/红闪引擎（唯一对外接口）----------
const EntityFX = {
  // 入场：任何实体创建后调一次（列表由调用方 add，不在这里碰数组）
  spawn(ent, kind) {
    if (!ent) return null;
    ent.age = 0;
    ent.hurtT = 0;
    ent.exiting = false;
    ent.exitT = 0;
    ent.exitDur = kindOf(kind).exitT;
    ent.exitAlpha = 1;
    ent.exitScale = 1;
    ent.fx = null;              // visual() 懒算，每帧重算一次（幂等）
    ent._kind = kind || 'mob';
    return ent;
  },

  // 触发或延长红闪；较短的状态闪烁不会覆盖较长的受击闪烁。
  hurt(ent, dur) {
    if (!ent || ent.exiting) return;
    ent.hurtT = Math.max(ent.hurtT || 0, (dur > 0) ? dur : ENTITY_HURT_T);
  },
  // maxA：允许个别实体自定义红闪强度（花朵本体比花瓣淡），时长仍只有一份。
  hurtAlpha(ent, maxA) {
    if (!ent || !(ent.hurtT > 0)) return 0;
    return hurtAlphaOf(ent.hurtT / ENTITY_HURT_T, maxA);
  },
  // 主角本体不是可回收实体，但出场 Q 弹与实体共用同一条曲线（唯一来源）。
  pop(age) { return enterPop(clamp((age || 0) / ENTITY_ENTER_T, 0, 1)); },

  // 退场：唯一离场入口（幂等）。绝不当场删元素，等 done() 为真再回收。
  despawn(ent, opt) {
    if (!ent || ent.exiting) return ent;
    const o = opt || {};
    ent.exiting = true;
    ent.exitT = 0;
    ent.exitDur = (o.dur > 0) ? o.dur : kindOf(ent._kind).exitT;
    ent.exitAlpha = 1;
    ent.exitScale = 1;
    ent.fx = null;
    return ent;
  },

  // 单实体动画计时（不碰数组，可安全用于"挂在别处的实体"，如 Map 里的弹体）。
  // 返回 true = 退场已播完（可被回收），本身不回收。
  tickEntity(ent, dt) {
    if (!ent) return false;
    ent.age = (ent.age || 0) + dt;
    ent.hurtT = Math.max(0, (ent.hurtT || 0) - dt);
    ent.fx = null;              // 计时后 fx 失效，下一帧 visual() 重算
    if (!ent.exiting) return false;
    ent.exitT = (ent.exitT || 0) + dt;
    const d = exitVisual(kindOf(ent._kind), (ent.exitT || 0) / exitDurOf(ent));
    ent.exitAlpha = d.alpha;
    ent.exitScale = d.scale;
    return (ent.exitT || 0) >= exitDurOf(ent);
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

  done(ent) {
    if (!ent || !ent.exiting) return false;
    return (ent.exitT || 0) >= exitDurOf(ent);
  },

  // 计算并缓存 { alpha, scale, exiting, hurt }；fxAlpha 是业务透明度倍率。
  visual(ent) {
    if (!ent) return { alpha: 1, scale: 1, exiting: false, hurt: 0 };
    if (ent.fx != null) return ent.fx;
    const enter = enterVisual(kindOf(ent._kind), ent.age || 0);
    const exitA = ent.exiting ? (ent.exitAlpha == null ? 1 : ent.exitAlpha) : 1;
    const exitS = ent.exiting ? (ent.exitScale == null ? 1 : ent.exitScale) : 1;
    ent.fx = {
      alpha: exitA * enter.alpha * (ent.fxAlpha == null ? 1 : ent.fxAlpha),
      scale: exitS * enter.scale,
      exiting: !!ent.exiting,
      hurt: this.hurtAlpha(ent),
    };
    return ent.fx;
  },

  // ★ 强制统一绘制入口：所有实体画面只能通过这里画
  //   save → translate(x,y) → scale(fx.scale) → globalAlpha *= fx.alpha → paint → restore
  // 退场播完（alpha≈0）或缩放≈0 时不再调用 paint（等价于已消失，但由表统一回收）。
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

  // 统一的红闪绘制原语（圆形蒙层 / 多边形蒙层）。
  // 生物那种"带轮廓的红剪影"仍可在自己的 draw 里用 hurtAlpha() 当不透明度。
  drawHurt(ctx, ent, x, y, r, maxA) {
    const a = this.hurtAlpha(ent, maxA);
    if (!(a > 0) || !(r > 0)) return;
    ctx.save();
    ctx.globalAlpha *= a;      // 乘而不是赋值：调用方可能已经在入场/退场的 alpha 里
    ctx.fillStyle = '#ff4040';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  // 多边形实体的红闪（Wax 这类"碰撞箱严格等于外形"的实体）。
  drawHurtPoly(ctx, ent, x, y, poly, r, maxA) {
    const a = this.hurtAlpha(ent, maxA);
    if (!(a > 0) || !poly || poly.length < 3 || !(r > 0)) return;
    ctx.save();
    ctx.globalAlpha *= a;
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
  // 【红闪唯一入口】一律画【碰撞箱形状】：有碰撞多边形就填多边形（scale = 该形状的尺寸），
  // 碰撞箱本身就是圆的实体（花瓣 / 花朵本体）就填半径圆。
  // 调用方只传自己的碰撞数据，不再自己挑"圆 / 素材红剪影 / 专属半径"。
  drawHurtShape(ctx, ent, x, y, poly, scale, r, maxA) {
    if (poly && poly.length >= 3 && scale > 0) {
      this.drawHurtPoly(ctx, ent, x, y, poly, scale, maxA);
      return;
    }
    if (r > 0) this.drawHurt(ctx, ent, x, y, r, maxA);
  },
};

// ---------- 受控实体表（唯一容器）----------
// 内部数组被闭包封死，外面拿不到 —— 无法绕过退场直接删元素。
// 只暴露"只读遍历 + add/adopt + tick（唯一回收点）"，刻意不提供 push/pop/splice/clear。
// idGen：可选，add() 时给没有 netId 的实体分配全局单调 id（见 LocalServer.nextEntityId）。
function createEntitySet(kind, idGen) {
  const a = [];
  return {
    add(e) {
      if (!e) return null;
      if (idGen && e.netId == null) e.netId = idGen();
      a.push(e);
      return EntityFX.spawn(e, kind);
    },
    // 收养一个已经在退场中的实体（不要再 spawn，否则退场会被重置）
    adopt(e) {
      if (!e || e._inExitSet) return e;
      e._inExitSet = true;
      a.push(e);
      return e;
    },
    // 复活：实体在退场途中被"接回来"（多体卡子体重装填完成）。
    // 语义是【取消这次离场】而不是删除 —— 摘出表 + 重新入场，且必然重新 spawn，
    // 所以它不构成"绕过退场直接删元素"的口子。
    reclaim(e) {
      if (!e) return null;
      const i = a.indexOf(e);
      if (i >= 0) a.splice(i, 1);
      e._inExitSet = false;
      return EntityFX.spawn(e, kind);
    },
    get length() { return a.length; },
    get(i) { return a[i]; },
    forEach(fn, thisArg) { a.forEach(fn, thisArg); },
    find(fn) { return a.find(fn); },
    [Symbol.iterator]() { return a[Symbol.iterator](); },
    // 推进所有元素动画，退场播完的才移除（唯一的常规回收路径）。
    sweep(dt) { return EntityFX.tickList(a, dt); },
  };
}
