// render/spider-gait.js — 蜘蛛八条腿的【矢量步态】（纯表现，不改判定）
// 'use strict';
//
// 为什么不能"在贴图上再叠一层腿"：蜘蛛素材的 8 条腿本身就是 8 条独立 stroke 曲线，
// 直接叠加会变成 16 条腿。也不能用"预渲染帧"—— 那是像素图，帧数有限、
// 高稀有度还要为巨大画布申请显存。所以这里走【矢量级】：
//   ① 取原始 SVG 文本，解析出 8 条腿的曲线参数（M55 55q x1 y1 x2 y2）与 viewBox；
//   ② 每一帧【实时】按步态相位对每条腿做"旋转 + 膝盖弯曲"，直接用 canvas 画贝塞尔曲线；
//      相位是连续量（由走过的距离驱动）—— 理论上无限帧，任何缩放下都是矢量的锐边。
//   ③ 身体用"去掉腿"的同一份素材（bodyUrl），腿画在身体之下。
// 坐标换算：SVG(viewBox) → 固定裁剪框（SpriteStore._cropRatio，与本体贴图同一条管线）
//          → artCanvas 局部坐标（与 drawMob 的绘制矩形完全一致），所以腿和身体严丝合缝。
const SpiderGait = {
  SRC: 'assets/mobs/21.svg',
  AMP: 0.26,         // 单腿最大摆角（rad ≈ 15°）
  STRIDE: 52,        // 走多远走完一个步态周期（px）：0.5×（摆得更慢）
  STROKE: 4.167,     // 素材里腿的描边宽（SVG 单位）

  _text: null,       // 原始 SVG 文本
  _loading: false,
  _legs: null,       // 8 条腿的曲线参数
  _vb: null,         // viewBox [x, y, w, h]
  _bodyUrl: undefined,

  ready() { return !!(this._legs && this._vb); },

  // 懒加载（失败静默放弃，调用方回落到普通贴图）
  ensure() {
    if (this.ready()) return true;
    if (!this._loading) {
      this._loading = true;
      fetch(this.SRC + '?v=' + (typeof ASSET_VER !== 'undefined' ? ASSET_VER : 1))
        .then((r) => (r.ok ? r.text() : null))
        .then((t) => {
          if (!t) return;
          this._legs = this._parseLegs(t);
          const vb = /viewBox="([^"]*)"/.exec(t);
          if (!this._legs || !this._legs.length || !vb) return;
          this._vb = vb[1].split(/[\s,]+/).map(Number);
          this._text = t;
        })
        .catch(() => { /* 本地直接打开等场景：退回静态贴图 */ });
    }
    return false;
  },

  // 八条腿都是 "M55 55q x1 y1 x2 y2"（相对控制点），把后面两组坐标捞出来。
  // 注意：负数经常【不带分隔符】直接连着写（如 q-19.382-10.027-27.735-9.025），
  // 之前的正则要求部分位置必须有逗号/空格 -> 恰好漏掉一半的腿（"有一半的腿不见了"）。
  _parseLegs(txt) {
    const out = [];
    const re = /M55 55q\s*(-?[\d.]+)\s*[ ,]?\s*(-?[\d.]+)\s*[ ,]?\s*(-?[\d.]+)\s*[ ,]?\s*(-?[\d.]+)/g;
    let m;
    while ((m = re.exec(txt))) {
      out.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])]);
    }
    return out;
  },

  // 无腿"身体检材"的 data URL（碰撞轮廓用：腿不计入碰撞箱）
  bodyUrl() {
    if (this._bodyUrl !== undefined) return this._bodyUrl;
    if (!this._text || !this._legs) return null;
    let txt = this._text;
    for (const leg of this._legs) {
      txt = txt.replace('M55 55q' + leg.join(' '), '')
        .replace(/M55 55q-?[\d.]+[ ,]-?[\d.]+[ ,]?-?[\d.]+[ ,]-?[\d.]+/, '');
    }
    // 上面两步兜底：逐条精确替换失败时按正则整体删一次
    txt = txt.replace(/<path fill="none" stroke="#333"[^>]*d="M55 55q[^"]*"\s*\/>/g, '');
    this._bodyUrl = 'data:image/svg+xml,' + encodeURIComponent(txt);
    return this._bodyUrl;
  },

  // SVG 坐标 → artCanvas 局部坐标（size×size）
  _map(vx, vy, size) {
    const r = (typeof SpriteStore !== 'undefined' && SpriteStore._cropRatio) ? SpriteStore._cropRatio() : null;
    if (!r || !this._vb) return null;
    const u = (vx - this._vb[0]) / this._vb[2];
    const v = (vy - this._vb[1]) / this._vb[3];
    const half = (1 - r) / 2;
    return [(u - half) / r * size, (v - half) / r * size];
  },

  // 当前步态下 8 条腿的贝塞尔曲线（artCanvas 局部坐标）：
  //   返回 { lw, legs: [[x0,y0, cx,cy, ex,ey] × 8] }；gait = 走过的像素（连续量）。
  // 摆动 = 整条腿绕锚点旋转（脚的落点前后扫）；弯曲 = 膝盖（控制点）随相位收放。
  legs(size, gait) {
    if (!this.ready()) return null;
    const phase = gait / this.STRIDE;
    const legs = [];
    for (let i = 0; i < this._legs.length; i++) {
      const [x1, y1, x2, y2] = this._legs[i];
      // 左右交替（四足步态）：相邻腿相位差 π；再按组错开一点，避免 4 对完全同步
      const ph = phase * TAU + (i % 2 ? Math.PI : 0) + Math.floor(i / 2) * 0.35;
      const a = Math.sin(ph) * this.AMP;
      const bend = 1 + 0.22 * Math.sin(ph + 1.2);
      const c = Math.cos(a), s = Math.sin(a);
      const p0 = this._map(55, 55, size);                                   // 锚点（身体中心）
      const p1 = this._map(55 + x1 * bend * c - y1 * bend * s,
                           55 + x1 * bend * s + y1 * bend * c, size);       // 膝盖
      const p2 = this._map(55 + x2 * c - y2 * s,
                           55 + x2 * s + y2 * c, size);                     // 脚
      if (!p0 || !p1 || !p2) return null;
      legs.push([p0[0], p0[1], p1[0], p1[1], p2[0], p2[1]]);
    }
    // 描边宽：SVG 单位 → 局部（宽度的换算与坐标相同）
    const base = this._map(55, 55, size);
    const w0 = base ? this._map(55 + this.STROKE, 55, size) : null;
    const lw = (w0 && base) ? Math.max(1, w0[0] - base[0]) : size * 0.04;
    return { lw, legs };
  },
};
