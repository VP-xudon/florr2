// assets.js — SVG 贴图加载与离屏预渲染（含白色剪影用于受击闪烁）
'use strict';
const SpriteStore = {
  images: {},   // key -> Image | null   (null = 已尝试但失败)
  cache: {},    // key -> { size: canvas }
  white: {},    // key -> { size: canvas }  白色剪影

  // 带超时的加载：任何情况下都 resolve，绝不永久 pending（防止加载界面卡死）
  load(key, src, timeout = 8000) {
    return new Promise((resolve) => {
      if (!src) { this.images[key] = null; resolve(null); return; }
      let settled = false;
      const done = (v) => {
        if (settled) return; settled = true;
        this.images[key] = v; resolve(v);
      };
      const img = new Image();
      img.onload = () => done(img);
      img.onerror = () => done(null);
      // 兜底：即使 onload/onerror 都不触发，也按时结束
      setTimeout(() => done(this.images[key] || null), timeout);
      img.src = src;
    });
  },

  getImage(key) { return this.images[key]; },
  // map.js / 其它地方可能用 get() 取图，做别名以防调用到不存在的方法
  get(key) { return this.images[key]; },
  ready(key) { const v = this.images[key]; return !!(v && v.complete); },

  // 返回以 size×size 渲染好的 canvas（首次构建并缓存）
  canvas(key, size) {
    const img = this.images[key];
    if (!img) return null;
    if (!this.cache[key]) this.cache[key] = {};
    if (this.cache[key][size]) return this.cache[key][size];

    const cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    const x = cv.getContext('2d');
    x.drawImage(img, 0, 0, size, size);
    this.cache[key][size] = cv;

    // 白色剪影：用 source-in 将已绘制像素填白
    const wv = document.createElement('canvas');
    wv.width = size; wv.height = size;
    const wx = wv.getContext('2d');
    wx.drawImage(img, 0, 0, size, size);
    wx.globalCompositeOperation = 'source-in';
    wx.fillStyle = '#ffffff';
    wx.fillRect(0, 0, size, size);
    if (!this.white[key]) this.white[key] = {};
    this.white[key][size] = wv;

    return cv;
  },

  whiteCanvas(key, size) {
    this.canvas(key, size);
    return this.white[key] ? this.white[key][size] : null;
  },

  // 按 Tiled 翻转标志（H=1, V=2, D=4）返回一个已翻转并缓存的画布。
  // 用于被翻转的边缘/叠加瓦片（例如把左边缘镜像成右边缘），保证边缘平滑过渡方向正确。
  canvasFlip(key, size, flags) {
    if (!flags) return this.canvas(key, size);
    const fk = key + '#' + flags;
    if (this.cache[fk] && this.cache[fk][size]) return this.cache[fk][size];
    const base = this.canvas(key, size);
    if (!base) return null;
    const out = flipCanvas(base, flags);
    if (!this.cache[fk]) this.cache[fk] = {};
    this.cache[fk][size] = out;
    return out;
  }
};

// Apply Tiled's orthogonal GID transform order: diagonal, horizontal, then vertical.
function flipCanvas(src, flags) {
  const s = src.width;
  const o = document.createElement('canvas');
  o.width = s; o.height = s;
  const c = o.getContext('2d');
  const transform = (x, y) => {
    if (flags & 4) [x, y] = [y, x];
    if (flags & 1) x = s - x;
    if (flags & 2) y = s - y;
    return [x, y];
  };
  const [x0, y0] = transform(0, 0);
  const [x1, y1] = transform(s, 0);
  const [x2, y2] = transform(0, s);
  c.setTransform((x1 - x0) / s, (y1 - y0) / s, (x2 - x0) / s, (y2 - y0) / s, x0, y0);
  c.drawImage(src, 0, 0);
  return o;
}
