// sim/exit.js — 【实体退场的唯一通道】
// 'use strict';
//
// 为什么要有这个模块（背景）：
//   实体（生物 / 蛛网 / 场地型实体 / 未来的召唤物…）"消失"必须有统一的观感 ——
//   放大一点 + 渐隐（与生物死亡同一套曲线，见 constants.js 的 FADE_T / DEATH_SCALE）。
//   以前每个系统各写各的：蛛网直接 splice（凭空消失）、花瓣走"退场幽灵"、生物走 deathTimer，
//   同一个世界里于是有三种消失方式，随时还可能写出第四种（绕过动画直接删）。
//
// —— 规则（强绑定；以后加任何实体都必须照这个来）——
//   1) 想让一个实体离场 → 只能调 ExitFX.begin(ent) 打上退场标记；
//   2) 渲染层读 ExitFX.alpha(ent) / ExitFX.scale(ent) 画退场过程；
//   3) 真正把它从列表里摘掉 → 只能由 ExitFX.sweep(list, dt) 完成（退场播完才摘）；
//   4) 严禁 splice / pop / filter / length = 0 直接删实体 —— 那就是"实体凭空消失"，
//      没有退场动画，而且以后每多一种实体就多一种消失表现（观感立刻分裂）。
//
// 受控实体表 createExitList()：把内部数组封在闭包里，外面根本拿不到，
//   于是"绕过退场动画直接删元素"这件事在语法层面就不存在（想删只能 sweep）。
//
// 本模块无 DOM 依赖，可在 Node 中加载（与 sim/* 其它模块一致）。

const ExitFX = {
  // 进入退场：给实体打上退场标记（此后它只能被 ExitFX.sweep 回收）。
  // dur 省略时用通用时长 FADE_T；已经在退场的实体不会被重置（进度连续）。
  begin(ent, dur) {
    if (!ent) return null;
    if (ent.exiting) return ent;
    ent.exiting = true;
    ent.exitT = 0;
    ent.exitDur = (dur > 0) ? dur : FADE_T;
    ent.exitAlpha = 1;
    ent.exitScale = 1;
    return ent;
  },

  // 推进退场动画：返回 true 表示退场已播完（此时才可以被回收）。
  tick(ent, dt) {
    if (!ent || !ent.exiting) return false;
    ent.exitT = (ent.exitT || 0) + dt;
    // 兼容旧字段：生物的 deathTimer 就是退场计时（快照下发的也是它），保持同源。
    if (ent.deathTimer != null) ent.deathTimer = ent.exitT;
    const t = clamp(ent.exitT / (ent.exitDur || FADE_T), 0, 1);
    const d = deathFade(t);
    ent.exitAlpha = d.alpha;
    ent.exitScale = d.scale;
    return t >= 1;
  },

  // 渲染层读这两个值：未退场时恒为 1（不改变外观）。
  alpha(ent) {
    if (!ent || !ent.exiting) return 1;
    return (ent.exitAlpha == null) ? 1 : ent.exitAlpha;
  },
  scale(ent) {
    if (!ent || !ent.exiting) return 1;
    return (ent.exitScale == null) ? 1 : ent.exitScale;
  },

  // 退场进度 0..1（1 = 播完）
  progress(ent) {
    if (!ent || !ent.exiting) return 1;
    return clamp(ent.exitT / (ent.exitDur || FADE_T), 0, 1);
  },

  // 是否退场播完（可以回收了）
  done(ent) {
    if (!ent || !ent.exiting) return false;
    return (ent.exitT || 0) >= (ent.exitDur || FADE_T);
  },

  // 【唯一的回收点】：只摘"退场已播完"的实体。
  // 没在退场的实体（还在正常存活）一律不动 —— 不会出现"顺手把活着的也删了"。
  sweep(arr, dt) {
    if (!arr || !arr.length) return 0;
    let n = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      const e = arr[i];
      if (!e || !e.exiting) continue;
      if (ExitFX.tick(e, dt)) { arr.splice(i, 1); n++; }
    }
    return n;
  },
};

// ============================================================================
// EntityFX —— 【所有实体】共用的入场 / 退场 / 红闪引擎（唯一对外接口）
//
// 设计：外部（生物 / 花瓣 / 场地实体 / 弹幕 / 未来的召唤物）只允许调用这里的方法；
//   内部的 begin / sweep / tick 全部收进闭包，不再暴露给外面的模块。
//   · 入场  EntityFX.spawn(ent)        统一 age/hurtT/exiting 初值，渲染读 state()
//   · 红闪  EntityFX.hurt(ent)         统一 0.3s 时长与强度，渲染读 hurtAlpha()
//   · 退场  EntityFX.despawn(ent)      唯一离场入口：打标记 + 可选幽灵，绝不直接删
//   · 推进  EntityFX.tickEntity(ent,dt) / EntityFX.tickList(list,dt)（后者才允许回收）
//   · 表现  EntityFX.state(ent) / drawHurt(ctx, ent, x, y, r)
// 因此"绕开动画直接 splice/pop/filter"在架构上没有入口：list 由 createExitList 封死。
// ============================================================================
const ENTITY_HURT_T = 0.3;        // 红闪统一时长（秒）
const ENTITY_HURT_A = 0.55;       // 红闪统一最大不透明度

const EntityFX = (function () {
  // ---- 内部原语（不导出）----
  function beginExit(ent, dur) {
    if (!ent || ent.exiting) return ent;
    ExitFX.begin(ent, dur);       // 打标记：exiting / exitT / exitDur
    return ent;
  }
  function sweep(arr, dt) { return ExitFX.sweep(arr, dt); }   // 唯一的回收点

  return {
    // 入场：任何实体创建后调一次（列表由调用方自己 add，不在这里碰数组）
    spawn(ent) {
      if (!ent) return null;
      ent.age = 0;
      ent.hurtT = 0;
      ent.flash = 0;
      ent.exiting = false;
      ent.exitT = 0;
      return ent;
    },

    // 红闪：全体实体同一个时长与强度，别再各处写 0.3 / 0.4 / 0.55
    hurt(ent, dur) {
      if (!ent || ent.exiting) return;
      ent.hurtT = (dur > 0) ? dur : ENTITY_HURT_T;
      ent.flash = Math.max(ent.flash || 0, ent.hurtT);
    },
    hurtAlpha(ent) {
      if (!ent || !(ent.hurtT > 0)) return 0;
      return ENTITY_HURT_A * clamp(ent.hurtT / ENTITY_HURT_T, 0, 1);
    },

    // 退场：唯一入口。opt = { dur, ghost(list, ent) } —— 幽灵也由引擎统一生成。
    despawn(ent, opt) {
      if (!ent || ent.exiting) return ent;
      const o = opt || {};
      beginExit(ent, o.dur);
      if (typeof o.ghost === 'function') o.ghost(ent);
      return ent;
    },

    // 单实体动画计时（不碰数组，可安全用于"附着在别处的实体"）
    tickEntity(ent, dt) {
      if (!ent) return false;
      ent.age = (ent.age || 0) + dt;
      ent.hurtT = Math.max(0, (ent.hurtT || 0) - dt);
      ent.flash = Math.max(0, (ent.flash || 0) - dt);
      // 退场计时由 tickList 的 sweep 统一推进，避免同一帧被 tick 两次（动画快进一倍）
      if (ent.exiting) return ExitFX.done(ent);
      return false;
    },

    // 列表推进：入场/红闪计时 + 退场动画 + 【唯一】的回收
    tickList(list, dt) {
      if (!list || !list.length) return 0;
      for (let i = 0; i < list.length; i++) this.tickEntity(list[i], dt);
      return sweep(list, dt);
    },

    // 渲染层统一读：alpha / scale（入场/退场都不需要渲染方自己算）
    state(ent) {
      const exitA = ExitFX.alpha(ent), exitS = ExitFX.scale(ent);
      const spawnA = spawnFade((ent && ent.age) || 0);
      const spawnS = spawnPop((ent && ent.age) || 0);
      return { alpha: exitA * spawnA, scale: exitS * spawnS, exiting: !!(ent && ent.exiting) };
    },
    isExiting(ent) { return !!(ent && ent.exiting); },
    done(ent) { return ExitFX.done(ent); },
    // 独立实体（不在受控列表里，如按 id 存在 Map 中的弹体）显式推进退场动画
    advanceExit(ent, dt) {
      if (!ent || !ent.exiting) return false;
      return ExitFX.tick(ent, dt);
    },

    // 统一的红闪绘制原语（圆形蒙层）。生物那种"带轮廓的红剪影"仍可在自己的 draw 里
    // 用 hurtAlpha() 当不透明度 —— 数值与时长同样来自这里，不会各写一套。
    drawHurt(ctx, ent, x, y, r) {
      const a = this.hurtAlpha(ent);
      if (!(a > 0) || !(r > 0)) return;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ff4040';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.restore();
    },

    // 多边形实体的红闪（Wax 这类"碰撞箱严格等于外形"的实体）。
    // 与圆形版同一套时长/强度，只是覆盖区域换成真实外形 —— 圆圈盖在六边形上会溢出去。
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
})();

// 兼容别名：旧代码里的 ExitFX 仍指向内部实现，但【新代码一律用 EntityFX】。
// 内部实现不再作为引擎接口对外推荐（注释保留，防止绕过动画直接删元素）。
const EntityFXLegacy = ExitFX;

// 受控实体表：内部数组被闭包封死，外面拿不到 —— 因此无法绕过退场动画直接删元素。
// 对外只暴露"只读遍历 + add + sweep"：
//   · add(e)            加入一个实体（入场由 EntityFX.spawn 负责）
//   · sweep(dt)         推进所有动画，退场播完的才移除（唯一的移除路径）
// 刻意【不提供】push / splice / pop / shift / clear / length setter ——
// 那几个就是"绕过退场动画"的入口，不给未来的代码编写者留这条路。
function createExitList() {
  const a = [];
  return {
    add(e) { a.push(e); return EntityFX.spawn(e); },
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
    // 唯一的移除路径：EntityFX.tickList（内部 sweep 会先播完退场动画）
    sweep(dt) { return EntityFX.tickList(a, dt); },
  };
}
