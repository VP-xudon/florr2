// sim/status.js — 实体状态效果（纯模拟，无 DOM）
// 'use strict';
//
// 设计目标：任何实体（玩家 / 生物）都能携带一组"效果"，效果本身只描述
// 「我是什么、我改什么」，具体怎么显示交给 UI，怎么结算交给调用方。
//
// —— 注册格式 ——
//   StatusFX.register(id, {
//     nameKey: 'Status/Web/Name',   // i18n 名（UI 悬浮提示用）
//     shortKey: 'Status/Web/Short', // 图标里的 1 个字（缺省用 name 首字）
//     color: '#4D52E3',             // 图标底色
//     speedMul: 0.5,                // 可选：移动速度乘数（多个效果相乘）
//     numeric: false                // 可选：将来带数值的效果置 true，UI 会显示 value
//   });
//
// —— 实体上的存储 ——
//   ent.status = [{ id, dur, value, born }]   数组顺序 = 获得顺序（UI 就按这个顺序排）
//   · 同一 id 再获得：刷新时长/数值，位置不变（避免图标跳来跳去）
//   · dur <= 0 表示永久
//
// —— 速度 ——
//   移动速度统一走 StatusFX.speedMul(ent)（默认 1），不要在各处硬乘系数。

// 空数组常量：list() 在实体没有任何效果时返回它，避免每帧分配
const EMPTY_STATUS = [];

const StatusFX = {
  defs: {},

  register(id, def) {
    if (!id || !def) return null;
    this.defs[id] = def;
    return def;
  },

  defOf(id) { return this.defs[id] || null; },

  _arr(ent) {
    if (!ent) return null;
    if (!ent.status) ent.status = [];
    return ent.status;
  },

  // 获得/刷新一个效果。opt = { dur, value }
  // 返回值 = 该效果的记录（调用方偶尔需要读 value）。
  add(ent, id, opt) {
    const arr = this._arr(ent);
    if (!arr) return null;
    const o = opt || {};
    const dur = (o.dur == null) ? 0 : Math.max(0, o.dur);
    for (const e of arr) {
      if (e.id !== id) continue;
      e.dur = Math.max(e.dur, dur);              // 取更长的那个，不会被短效果截断
      if (o.value != null) e.value = o.value;
      return e;
    }
    const rec = { id, dur, value: (o.value == null ? null : o.value), born: Date.now() };
    arr.push(rec);
    return rec;
  },

  remove(ent, id) {
    const arr = ent && ent.status;
    if (!arr) return false;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].id === id) { arr.splice(i, 1); return true; }
    }
    return false;
  },

  has(ent, id) {
    const arr = ent && ent.status;
    if (!arr) return false;
    for (const e of arr) if (e.id === id) return true;
    return false;
  },

  get(ent, id) {
    const arr = ent && ent.status;
    if (!arr) return null;
    for (const e of arr) if (e.id === id) return e;
    return null;
  },

  // 按获得顺序列出（UI 直接用；不分配新数组）
  list(ent) { return (ent && ent.status) ? ent.status : EMPTY_STATUS; },

  // 时长推进（实体 update 里每帧调一次）
  tick(ent, dt) {
    const arr = ent && ent.status;
    if (!arr || !arr.length || !(dt > 0)) return false;
    let changed = false;
    for (let i = arr.length - 1; i >= 0; i--) {
      const e = arr[i];
      if (!(e.dur > 0)) continue;                // 永久效果
      e.dur -= dt;
      if (e.dur <= 0) { arr.splice(i, 1); changed = true; }
    }
    return changed;
  },

  // 移动速度乘数：所有带 speedMul 的效果相乘（蛛网 0.3 = 只剩三成速度）
  speedMul(ent) {
    const arr = ent && ent.status;
    if (!arr || !arr.length) return 1;
    let k = 1;
    for (const e of arr) {
      const d = this.defs[e.id];
      if (d && d.speedMul != null) k *= d.speedMul;
    }
    return k;
  }
};

// ---- 内置效果：蛛网减速 ----
// 具体数值（0.3x = 只剩三成速度）只在这里声明一次，结算侧统一读 StatusFX.speedMul。
StatusFX.register('web', {
  nameKey: 'Status/Web/Name',
  shortKey: 'Status/Web/Short',
  color: '#b9c6d4',
  speedMul: 0.3,
  numeric: false
});

// ---- 内置效果：中毒（Spider 的 Poison）----
// value = 每秒伤害（dps），dur = 这次中毒的总时长。
// 施加方（LocalServer）把「总量 / 每秒」算成 dur 传进来，扣血由 Player 的状态推进统一做：
//   伤害总量 = dps × dur，按帧均摊 —— 所以总量与速率都来自数据表，效果本身不含数值。
// dot: true 表示它是"持续伤害"，UI 的图标用紫色骷髅。
StatusFX.register('poison', {
  nameKey: 'Status/Poison/Name',
  shortKey: 'Status/Poison/Short',
  color: '#a05bd6',
  dot: true,
  numeric: false
});
