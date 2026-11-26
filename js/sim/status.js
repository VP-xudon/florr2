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
//     numeric: false,               // 可选：带数值的效果置 true，UI 会显示 value
//     stack: 'add',                 // 可选：可叠加（数值求和）；缺省见下方"叠层规则"
//     maxValue: 1                   // 可选：聚合值的上限（减疗 100%）
//   });
//
// —— 实体上的存储（【分层】）——
//   ent.status = [{ id, dur, value, src, born }]
//   每一次施加都是【独立的一层】，各层自己计时、并行存在：
//     · 可叠加（def.stack === 'add'）：任意时刻的数值 = 所有未过期层的【总和】。
//       例：305/s 持续 3s，第 2s 又叠 135/s 持续 5s
//           -> 0~2s 305、2~3s 440、3~7s 135、7s 后消失。
//     · 不可叠加（缺省）：任意时刻的数值 = 所有未过期层里的【最大值】，
//       时长同样各层并行（谁先到期谁消失，剩下的继续按自己的剩余时间生效）。
//       Web 这种固定数值的效果，同值层只刷新时长（等价于并行计时取最大），
//       不会每次场地 tick 都塞一层。
//     · 同一来源（opt.src，如同一只蜘蛛）：可叠加效果只刷新该来源那一层的时长，
//       数值不累加 —— 防止同一只蜘蛛反复咬把毒叠到无限。
//   · dur <= 0 表示永久
//   · 数组顺序 = 首次获得顺序（UI 就按这个顺序排）
//
// —— 聚合读取 ——
//   StatusFX.list(ent) 返回【每个 id 一条】的聚合记录 [{ id, value, dur, count }]，
//   UI 只摆一条条带；StatusFX.get(ent, id) 返回单个 id 的聚合记录。
//
// —— 速度 / 减疗 ——
//   移动速度统一走 StatusFX.speedMul(ent)（默认 1）；
//   治疗乘数统一走 StatusFX.healMul(ent)（默认 1），不要在各处硬乘系数。

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

  // 获得/刷新一个效果。opt = { dur, value, src }
  // 返回值 = 本次写入的那一层（调用方偶尔需要读 value）。
  // ent.immuneStatus = { web: true, ... } 时直接忽略（物种自带的免疫，见 data.js MOB_TRAITS）。
  add(ent, id, opt) {
    if (ent && ent.immuneStatus && ent.immuneStatus[id]) return null;
    const arr = this._arr(ent);
    if (!arr) return null;
    const o = opt || {};
    const dur = (o.dur == null) ? 0 : Math.max(0, o.dur);
    const value = (o.value == null ? null : o.value);
    const src = (o.src == null ? null : o.src);
    const def = this.defs[id];
    const addMode = !!(def && def.stack === 'add');

    for (const e of arr) {
      if (e.id !== id) continue;
      if (addMode) {
        // 可叠加：只有【同一个来源】才合并（刷新时长、数值替换），其它来源各占一层。
        if (src != null && e.src === src) {
          e.dur = Math.max(e.dur, dur);
          if (value != null) e.value = value;
          return e;
        }
        continue;
      }
      // 不可叠加：数值相同的层合并成一层（并行计时取最大值 <=> 刷新到最长剩余时长）。
      // 数值不同则各留一层，聚合时取最大。
      if (e.value === value) {
        e.dur = Math.max(e.dur, dur);
        return e;
      }
    }

    const rec = { id, dur, value, src, born: Date.now() };
    arr.push(rec);
    return rec;
  },

  // 移除某个效果的【全部层】
  remove(ent, id) {
    const arr = ent && ent.status;
    if (!arr) return false;
    let hit = false;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].id === id) { arr.splice(i, 1); hit = true; }
    }
    return hit;
  },

  has(ent, id) {
    const arr = ent && ent.status;
    if (!arr) return false;
    for (const e of arr) if (e.id === id) return true;
    return false;
  },

  // 单个效果的聚合记录（null = 没有该效果）。
  get(ent, id) {
    const arr = ent && ent.status;
    if (!arr) return null;
    const def = this.defs[id];
    const addMode = !!(def && def.stack === 'add');
    let value = null, dur = 0, n = 0;
    for (const e of arr) {
      if (e.id !== id) continue;
      n++;
      if (addMode) value = (value || 0) + (e.value || 0);
      else if (e.value != null) value = (value == null) ? e.value : Math.max(value, e.value);
      dur = Math.max(dur, e.dur || 0);
    }
    if (!n) return null;
    if (value != null && def && def.maxValue != null) value = Math.min(def.maxValue, value);
    return { id, value, dur, count: n };
  },

  // 按【首次获得顺序】聚合列出（UI 直接用）：每个 id 一条。
  list(ent) {
    const arr = ent && ent.status;
    if (!arr || !arr.length) return EMPTY_STATUS;
    const out = [];
    const byId = new Map();
    for (const e of arr) {
      let g = byId.get(e.id);
      if (!g) {
        g = { id: e.id, value: null, dur: 0, count: 0 };
        byId.set(e.id, g);
        out.push(g);
      }
      const def = this.defs[e.id];
      if (def && def.stack === 'add') g.value = (g.value || 0) + (e.value || 0);
      else if (e.value != null) g.value = (g.value == null) ? e.value : Math.max(g.value, e.value);
      g.dur = Math.max(g.dur, e.dur || 0);
      g.count++;
    }
    for (const g of out) {
      const def = this.defs[g.id];
      if (def && def.maxValue != null && g.value != null) g.value = Math.min(def.maxValue, g.value);
    }
    return out;
  },

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

  // 显示文本（状态条带上的数字）—— 唯一来源：UI 只负责摆 DOM 与量宽度。
  // 返回 '' = 这个效果没有数值（只显示图标）。
  textOf(rec) {
    if (!rec) return '';
    const def = this.defs[rec.id];
    if (!def) return '';
    if (def.text) return def.text(rec) || '';
    if (def.numeric && rec.value != null) {
      return (typeof fmtNum === 'function') ? fmtNum(rec.value) : String(rec.value);
    }
    return '';
  },

  // 【减疗】乘数：所有带 healDown 的层把百分比【相加】后从 1 里扣。
  // 统一入口 —— 任何回血来源（Leaf 持续 / Rose 一次性 / 以后的新来源）都必须经过它，
  // 这样"减疗"天生对全部治疗生效，不需要每个治疗点各自判断 debuff。
  healMul(ent) {
    const arr = ent && ent.status;
    if (!arr || !arr.length) return 1;
    let down = 0;
    for (const e of arr) {
      const d = this.defs[e.id];
      if (d && d.healDown) down += (e.value || 0);
    }
    return Math.max(0, Math.min(1, 1 - down));
  },

  // 移动速度乘数：每个带 speedMul 的效果只乘一次（不可叠加 = 取最大的那一档），
  // 不同效果之间相乘（蛛网 0.3 × 以后别的减速）。
  speedMul(ent) {
    const arr = ent && ent.status;
    if (!arr || !arr.length) return 1;
    let k = 1;
    const seen = new Set();
    for (const e of arr) {
      const d = this.defs[e.id];
      if (!d || d.speedMul == null || seen.has(e.id)) continue;
      seen.add(e.id);
      k *= d.speedMul;
    }
    return k;
  }
};

// ---- 内置效果：蛛网减速（不可叠加）----
// 具体数值（0.3x = 只剩三成速度）只在这里声明一次，结算侧统一读 StatusFX.speedMul。
// 多个网叠在脚下：时长并行累计，数值取最大（这里只有一个固定档位）。
StatusFX.register('web', {
  nameKey: 'Status/Web/Name',
  shortKey: 'Status/Web/Short',
  color: '#b9c6d4',
  bandColor: '#dfe7f0',       // 条带底色：图标色的淡版
  glyph: '≈',                  // 图标里的符号（文字/emoji 不进条带，数字在右侧）
  speedMul: 0.3,
  numeric: true,
  // 显示：目前移速被减少的百分比（0.3x -> "-70%"）
  text: () => '-' + Math.round((1 - 0.3) * 100) + '%'
});

// ---- 内置效果：中毒（Spider 的 Poison）----
// value = 每秒伤害（dps），dur = 这一层的持续时长。
// 【可叠加】：不同来源的中毒各占一层、dps 求和（305 + 135 = 440/s），各层独立到期；
// 同一只蜘蛛（opt.src = 它的 netId）只刷新自己那一层的时长，防止无限叠毒。
// 扣血由 Player._tickPoison 每帧读聚合值均摊。
StatusFX.register('poison', {
  nameKey: 'Status/Poison/Name',
  shortKey: 'Status/Poison/Short',
  color: '#a05bd6',
  bandColor: '#e6d2f7',
  glyph: '☠',
  dot: true,
  numeric: true,
  stack: 'add',
  // value = 每秒伤害（聚合后的 dps）：条带直接显示"目前持续受到多少"（每秒），不是总量。
  text: (e) => (typeof fmtNum === 'function') ? fmtNum(Math.round(e.value || 0)) : String(Math.round(e.value || 0))
});

// ---- 内置效果：减疗（Dandelion）----
// value = 被减少的治疗比例（0..1）；每一层独立计时 30s，聚合时【相加】并封顶 100%。
// 图标 = unusual 淡黄底上的减号；条带略浅，右侧显示当前减免比例（-20% / -40% …）。
StatusFX.register('heal_down', {
  nameKey: 'Status/HealDown/Name',
  shortKey: 'Status/HealDown/Short',
  color: '#FFE65D',            // = RARITIES.unusual 淡黄
  bandColor: '#FFF4B8',
  glyph: '−',                   // 减号（U+2212）
  numeric: true,
  stack: 'add',
  maxValue: 1,
  healDown: true,
  text: (e) => '-' + Math.round((e.value || 0) * 100) + '%'
});
