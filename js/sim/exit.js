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

// 受控实体表：内部数组被闭包封死，外面拿不到 —— 因此无法绕过退场动画直接删元素。
// 对外只暴露"只读遍历 + add + sweep"：
//   · add(e)            加入一个实体
//   · sweep(dt)         推进退场动画，播完的才移除（唯一的移除路径）
//   · length / get / at / forEach / map / filter / some / find / slice / [Symbol.iterator]
// 刻意【不提供】push / splice / pop / shift / clear / length setter ——
// 那几个就是"绕过退场动画"的入口，不给未来的代码编写者留这条路。
function createExitList() {
  const a = [];
  return {
    add(e) { a.push(e); return e; },
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
    // 唯一的移除路径：走 ExitFX.sweep（先播退场动画，再回收）
    sweep(dt) { return ExitFX.sweep(a, dt); },
  };
}
