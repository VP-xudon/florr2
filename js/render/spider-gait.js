// render/spider-gait.js — 蜘蛛八条腿的步态动画 + 无腿"身体检材"（纯表现，不改判定）
// 'use strict';
//
// 为什么不能"在贴图上再叠一层腿"：蜘蛛素材的 8 条腿本身就是 8 条独立 stroke 曲线，
// 直接叠加会变成 16 条腿。所以这里走"换帧"：
//   ① 取原始 SVG 文本，把每条腿的曲线端点绕身体中心 (55,55) 旋转一个相位角；
//   ② 按步态相位生成 FRAMES 张 SVG，分别栅格化成【同一尺寸】的帧画布；
//   ③ 绘制时按"走过的距离"取对应帧 —— 走动时腿在摆、站着时腿不动。
// 所有帧都在【同一个固定基准尺寸】下构建（BASE），绘制时由调用方缩放到实际直径：
// 每个稀有度的 drawSize 差距极大（Eternal 是 Common 的上百倍），
// 若按 drawSize 各建一套 12 帧画布，高稀有度会申请巨型画布（几百 MB）直接失败 ——
// 表现就是"高等级蜘蛛腿不动"（帧画布创建失败，永远回落到静态贴图）。
const SpiderGait = {
  SRC: 'assets/mobs/21.svg',
  FRAMES: 12,        // 步态一圈 12 帧
  AMP: 0.24,         // 单腿最大摆角（rad ≈ 14°）：腿长 ≈ 30 单位，端点约摆 7 个单位
  STRIDE: 26,        // 走多远换一帧（px）：越小摆得越快
  BASE: 192,         // 帧画布基准边长（px）：一次构建，全部稀有度共用

  _text: null,       // 原始 SVG 文本
  _loading: false,
  _frames: null,     // [canvas | null]（FRAMES 张，BASE 尺寸）
  _legs: null,       // 解析出来的 8 条腿的曲线参数
  _bodyUrl: undefined,

  ready() { return !!this._frames; },

  // 懒加载 + 预热全部帧（失败就静默放弃，调用方回落到普通贴图）
  ensure() {
    if (this.ready()) return true;
    if (!this._loading) {
      this._loading = true;
      fetch(this.SRC + '?v=' + (typeof ASSET_VER !== 'undefined' ? ASSET_VER : 1))
        .then((r) => (r.ok ? r.text() : null))
        .then((t) => {
          if (!t) return;
          this._legs = this._parseLegs(t);
          if (!this._legs || !this._legs.length) return;
          this._text = t;
          this._build();
        })
        .catch(() => { /* 忽略：没有网络/本地直接打开时退回静态贴图 */ });
    }
    return false;
  },

  // 八条腿都是 "M55 55q x1 y1 x2 y2"（相对控制点），把后面两组坐标捞出来
  _parseLegs(txt) {
    const out = [];
    const re = /M55 55q\s*(-?[\d.]+)[ ,](-?[\d.]+)[ ,]?\s*(-?[\d.]+)[ ,](-?[\d.]+)/g;
    let m;
    while ((m = re.exec(txt))) {
      out.push({
        raw: m[0],
        p: [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])]
      });
    }
    return out;
  },

  // 生成第 f 帧的 SVG 文本：每条腿绕 (55,55) 旋转一个相位角
  _frameText(f) {
    let txt = this._text;
    const n = this._legs.length;
    const t = (f / this.FRAMES) * TAU;
    for (let i = 0; i < n; i++) {
      const leg = this._legs[i];
      // 左右交替（四足步态）：相邻腿相位差 π，视觉上就是"对角腿一起动"
      const a = Math.sin(t + (i % 2 ? Math.PI : 0) + Math.floor(i / 2) * 0.35) * this.AMP;
      const c = Math.cos(a), s = Math.sin(a);
      const [x1, y1, x2, y2] = leg.p;
      const nx1 = x1 * c - y1 * s, ny1 = x1 * s + y1 * c;
      const nx2 = x2 * c - y2 * s, ny2 = x2 * s + y2 * c;
      const rep = 'M55 55q' + nx1.toFixed(3) + ' ' + ny1.toFixed(3) + ' '
        + nx2.toFixed(3) + ' ' + ny2.toFixed(3);
      txt = txt.replace(leg.raw, rep);
    }
    return txt;
  },

  // 一次性构建 FRAMES 帧（BASE 尺寸；与 SpriteStore 的固定裁剪框同源，保证观感一致）
  _build() {
    if (this._frames) return this._frames;
    const SS = 2;
    const px = this.BASE * SS;
    const list = new Array(this.FRAMES).fill(null);
    this._frames = list;                        // 占位：避免重复请求
    const crop = (typeof SpriteStore !== 'undefined' && SpriteStore._cropRect)
      ? SpriteStore._cropRect(px) : null;
    for (let f = 0; f < this.FRAMES; f++) {
      const img = new Image();
      img.onload = () => {
        try {
          const raw = document.createElement('canvas');
          raw.width = raw.height = px;
          raw.getContext('2d').drawImage(img, 0, 0, px, px);
          const out = document.createElement('canvas');
          out.width = out.height = this.BASE;
          const o = out.getContext('2d');
          o.imageSmoothingQuality = 'high';
          if (crop) o.drawImage(raw, crop[0], crop[1], crop[2], crop[3], 0, 0, this.BASE, this.BASE);
          else o.drawImage(raw, 0, 0, this.BASE, this.BASE);
          list[f] = out;
        } catch (e) { /* 单帧失败：保持 null，绘制侧回落 */ }
      };
      img.src = 'data:image/svg+xml,' + encodeURIComponent(this._frameText(f));
    }
    return list;
  },

  // 当前该画哪一帧（gait = 走过的像素）
  frameCanvas(gait) {
    if (!this._frames) return null;
    const f = Math.floor(gait / this.STRIDE) % this.FRAMES;
    return this._frames[(f + this.FRAMES) % this.FRAMES] || null;
  },

  // 无腿"身体检材"的 data URL（碰撞轮廓用：腿不计入碰撞箱）。
  // 与步态帧共用同一次 fetch；文本没就绪时返回 null（调用方下一帧再试）。
  bodyUrl() {
    if (this._bodyUrl !== undefined) return this._bodyUrl;
    if (!this._text || !this._legs) return null;
    let txt = this._text;
    for (const leg of this._legs) txt = txt.replace(leg.raw, '');
    this._bodyUrl = 'data:image/svg+xml,' + encodeURIComponent(txt);
    return this._bodyUrl;
  },
};
