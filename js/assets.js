// assets.js — SVG 贴图加载与离屏预渲染（含白色剪影用于受击闪烁）
'use strict';
const SpriteStore = {
  images: {},   // key -> Image | null   (null = 已尝试但失败)
  cache: {},    // key -> { size: canvas }
  white: {},    // key -> { size: canvas }  白色剪影
  artBox: {},   // 'key@size' -> [minX, minY, w, h] | null（实际图案的像素包围盒）
  artCache: {}, // 'key@size' -> canvas（裁剪并放大到 size×size 的图案）
  artWhiteCache: {},
  artRectCache: {},   // key -> [x,y,w,h] 归一化（0..1）实际图案包围盒（在 SVG 原坐标系内）
  red: {},      // key -> { size: canvas }  红色剪影（受伤滤镜）
  alphaGridCache: {},   // 'key@N' -> Uint8Array(N*N) 实心度网格（精确外观碰撞用）

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

  // 实心度网格：把贴图按 N×N 光栅化，alpha>96 记 1。碰撞箱"完全依照外观"的数据源
  //（含凹形轮廓，凸包做不到）。网格坐标与 drawMob 的整图绘制一一对应。
  alphaGrid(key, N) {
    const ck = key + '@' + N;
    if (this.alphaGridCache[ck] !== undefined) return this.alphaGridCache[ck];
    let g = null;
    const cv = this.canvas(key, N);
    if (cv) {
      try {
        const d = cv.getContext('2d').getImageData(0, 0, N, N).data;
        g = new Uint8Array(N * N);
        for (let i = 0; i < N * N; i++) g[i] = d[i * 4 + 3] > 96 ? 1 : 0;
      } catch (e) { g = null; }   // 画布被污染（file:// 等）：退回圆形碰撞
    }
    this.alphaGridCache[ck] = g;
    return g;
  },

  // 红色剪影（受伤 0.1s 红色滤镜）：与白色剪影同一管线，仅填充色不同
  redCanvas(key, size) {
    this.canvas(key, size);
    const wv = this.white[key] ? this.white[key][size] : null;
    if (!wv) return null;
    const ck = key + '@' + size;
    if (this.red[key] && this.red[key][size]) return this.red[key][size];
    const rc = document.createElement('canvas');
    rc.width = wv.width; rc.height = wv.height;
    const rx = rc.getContext('2d');
    rx.drawImage(wv, 0, 0);
    rx.globalCompositeOperation = 'source-in';
    rx.fillStyle = '#ff4040';
    rx.fillRect(0, 0, rc.width, rc.height);
    if (!this.red[key]) this.red[key] = {};
    this.red[key][size] = rc;
    return rc;
  },

  // 实际图案的像素包围盒（相对 size×size 画布）。生物 SVG 的 viewBox 里有大片留白
  // （clipPath 之外全是透明），直接按 viewBox 绘制会让图案明显比碰撞箱小一圈。
  // 这里扫一遍 alpha 通道量出真实范围，每种 (key,size) 只算一次。
  _artBox(key, size) {
    const ck = key + '@' + size;
    if (this.artBox[ck] !== undefined) return this.artBox[ck];
    const base = this.canvas(key, size);
    if (!base) { this.artBox[ck] = null; return null; }
    let box = null;
    try {
      const x = base.getContext('2d');
      const w = base.width, h = base.height;
      const d = x.getImageData(0, 0, w, h).data;
      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let py = 0; py < h; py++) {
        const row = py * w;
        for (let px = 0; px < w; px++) {
          if (d[(row + px) * 4 + 3] > 8) {
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          }
        }
      }
      if (maxX >= 0) box = [minX, minY, maxX - minX + 1, maxY - minY + 1];
    } catch (e) {
      box = null;   // file:// 等下画布被污染：量不到就退回不裁剪
    }
    this.artBox[ck] = box;
    return box;
  },

  // 把贴图裁剪到实际图案范围，再缩放至 size×size —— 图案正好撑满 size。
  // 关键：先按 2x 超采样渲染 SVG，再裁剪缩小回来 —— 旧实现按 size 渲染后裁剪
  // 放大，图案区域被放大 ~1.6 倍导致边缘发糊（看着不像矢量）。
  artCanvas(key, size) {
    const ck = key + '@' + size;
    if (this.artCache[ck]) return this.artCache[ck];
    const SS = 2;
    const base = this.canvas(key, size * SS);
    if (!base) return null;
    const b = this._artBox(key, size * SS);
    if (!b) { const fb = this.canvas(key, size); this.artCache[ck] = fb; return fb; }
    const out = document.createElement('canvas');
    out.width = size; out.height = size;
    const o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.drawImage(base, b[0], b[1], b[2], b[3], 0, 0, size, size);
    this.artCache[ck] = out;
    return out;
  },

  // 同上，但返回白色剪影版本（受击闪烁用）
  artWhiteCanvas(key, size) {
    const ck = key + '@' + size;
    if (this.artWhiteCache[ck]) return this.artWhiteCache[ck];
    const SS = 2;
    this.canvas(key, size * SS);
    const base = this.white[key] ? this.white[key][size * SS] : null;
    if (!base) return null;
    const b = this._artBox(key, size * SS);
    if (!b) { const fb = this.white[key][size] || base; this.artWhiteCache[ck] = fb; return fb; }
    const out = document.createElement('canvas');
    out.width = size; out.height = size;
    const o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.drawImage(base, b[0], b[1], b[2], b[3], 0, 0, size, size);
    this.artWhiteCache[ck] = out;
    return out;
  },

  // 实际图案在 SVG 原坐标系中的归一化包围盒（一次性测量，供 drawMob 直接矢量裁剪绘制）。
  // 用固定参考分辨率量一次即可——包围盒与分辨率无关。
  artRect(key) {
    if (this.artRectCache[key] !== undefined) return this.artRectCache[key];
    const REF = 160;
    const base = this.canvas(key, REF);
    const b = base ? this._artBox(key, REF) : null;
    const r = b ? [b[0] / REF, b[1] / REF, b[2] / REF, b[3] / REF] : null;
    this.artRectCache[key] = r;
    return r;
  },

  // 碰撞外形：从贴图的 alpha 通道提取【实际轮廓】做凸包，归一化到 [-0.5, 0.5]。
  // 这样生物的碰撞箱就是它 SVG 体现出来的几何外形（Ladybug 出来是个圆润的多边形），
  // 而不是一个和图稿未必吻合的圆。取不到（图片未加载/画布被污染）时返回 null，
  // 调用方应退回圆形碰撞箱。
  shape(key, size) {
    const base = this.artCanvas(key, size);
    if (!base) return null;                  // 不缓存失败：图片加载好后下次就能取到
    let poly = null;
    try {
      const w = base.width, h = base.height;
      const d = base.getContext('2d').getImageData(0, 0, w, h).data;
      const step = Math.max(1, Math.floor(Math.min(w, h) / 72));   // 采样密度提高，轮廓更贴合图稿
      const pts = [];
      for (let py = 0; py < h; py += step) {
        for (let px = 0; px < w; px += step) {
          if (d[(py * w + px) * 4 + 3] > 128) pts.push([px, py]);
        }
      }
      if (pts.length >= 3) {
        poly = convexHull(pts).map(([px, py]) => [px / w - 0.5, py / h - 0.5]);
      }
    } catch (e) { poly = null; }
    return (poly && poly.length >= 3) ? poly : null;
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

// 凸包（Andrew 单调链）。用于把粗采样出来的实心像素点收敛成一个凸多边形碰撞外形。
function convexHull(points) {
  const pts = points.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

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
