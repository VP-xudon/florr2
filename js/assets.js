// assets.js — SVG 贴图加载与离屏预渲染（含白色剪影用于受击闪烁）
'use strict';
// 固定裁剪框的标定基准：瓢虫（mob3）。
// 只有它按"实际图案范围"量一次，量出的比例被所有生物共用 —— 这样相对大小完全由素材
// 自身决定（不再每张图各自撑满），同时瓢虫的观感与旧版逐像素一致。
const ARTCROP_REF_KEY = 'mob3';

const SpriteStore = {
  _cropR: 0,     // 固定裁剪框比例（相对画布边长）；0 = 还没标定出来
  images: {},   // key -> Image | null   (null = 已尝试但失败)
  cache: {},    // key -> { size: canvas }
  white: {},    // key -> { size: canvas }  白色剪影
  artBox: {},   // 'key@size' -> [minX, minY, w, h] | null（实际图案的像素包围盒）
  artCache: {}, // 'key@size' -> canvas（裁剪并放大到 size×size 的图案）
  artWhiteCache: {},
  artRedCache: {},   // 'key@size' -> canvas（裁剪到图案包围盒的红色剪影，受击红闪用）
  artRectCache: {},   // key -> [x,y,w,h] 归一化（0..1）实际图案包围盒（在 SVG 原坐标系内）
  red: {},      // key -> { size: canvas }  红色剪影（受伤滤镜）
  alphaGridCache: {},   // 'key@N' -> Uint8Array(N*N) 实心度网格（精确外观碰撞用）
  contourCache: {},     // 'key@size' -> { pts, r } | null（碰撞轮廓多边形，归一化 [-0.5,0.5]）

  // 带超时的加载：任何情况下都 resolve，绝不永久 pending（防止加载界面卡死）

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

  // 实心度网格：把贴图按 N×N 光栅化，alpha>96 记 1。碰撞箱"完全依照外观"的数据源
  //（含凹形轮廓，凸包做不到）。网格坐标与 drawMob 的整图绘制一一对应。
  // 【只缓存成功结果】素材还没加载好时 canvas() 返回 null，若把 null 也缓存下来，
  // 之后每次都直接拿到 null —— 轮廓/碰撞箱将永远建不出来。因此失败不缓存，下次重试。
  alphaGrid(key, N) {
    const ck = key + '@' + N;
    const hit = this.alphaGridCache[ck];
    if (hit) return hit;
    const cv = this.canvas(key, N);
    if (!cv) return null;                    // 素材未就绪：不缓存，下一帧再试
    let g = null;
    try {
      // 与绘制同一个固定裁剪框 -> 轮廓坐标系 = drawSize 坐标系（碰撞箱与外观严格一致）
      let src = cv;
      const r = this._cropRect(N);
      if (r) {
        const tmp = document.createElement('canvas');
        tmp.width = N; tmp.height = N;
        const tc = tmp.getContext('2d');
        tc.imageSmoothingQuality = 'high';
        tc.drawImage(cv, r[0], r[1], r[2], r[3], 0, 0, N, N);
        src = tmp;
      }
      const d = src.getContext('2d').getImageData(0, 0, N, N).data;
      g = new Uint8Array(N * N);
      for (let i = 0; i < N * N; i++) g[i] = d[i * 4 + 3] > 96 ? 1 : 0;
    } catch (e) { g = null; }   // 画布被污染（file:// 等）：退回圆形碰撞
    if (g) this.alphaGridCache[ck] = g;
    return g;
  },

  // ---- 固定比例裁剪（替代原来的"每张图各量一次 bbox"自适应裁剪）----
  // 生物 SVG 的 viewBox 里有透明留白，直接按 viewBox 画会显得比碰撞箱小一圈；
  // 但"按各自实际图案撑满"会让不同生物的相对大小失真（同稀有度蜜蜂/瓢虫被拉成一样大）。
  // 现在所有生物共用【同一个固定裁剪框】：以瓢虫实际图案范围标定一次（ARTCROP_REF_KEY），
  // 于是相对大小完全由素材自身决定，而瓢虫的观感与旧版逐像素一致。
  _cropRatio() {
    if (this._cropR) return this._cropR;
    const REF = 160;
    const b = this.canvas(ARTCROP_REF_KEY, REF) ? this._artBox(ARTCROP_REF_KEY, REF) : null;
    if (b) this._cropR = Math.max(b[2], b[3]) / REF;   // 取长边，保持正方不变形
    return this._cropR || null;                        // 量不到就不缓存，等素材就绪再试
  },

  // 固定裁剪矩形（相对 size×size 画布，居中）
  _cropRect(size) {
    const r = this._cropRatio();
    if (!r) return null;                               // 量不到（未就绪/污染）-> 不裁剪
    const d = size * r, off = (size - d) / 2;
    return [off, off, d, d];
  },

  // 碰撞轮廓多边形：把实心度网格用 marching squares 描出【外边界】，抽样简化后
  // 归一化到 [-0.5, 0.5]（与整图绘制同坐标系），并给出外接半径供粗判。
  // 与"凸包"的区别：保留凹形（如瓢虫头部凹槽），所以碰撞箱就是看见的形状本身；
  // 数据形态与地图的碰撞多边形一致（顶点表 + 半径），消费方做圆 vs 多边形求交。
  // 每种 (key,size) 只算一次并缓存；顶点数经简化后通常几十个，逐帧检测很便宜。
  //
  // 两条数据源，优先像素（最忠实），像素不可用时用向量几何：
  //   ① 像素网格：从实绘像素的 alpha 提取，连抗锯齿边缘都算进去；
  //   ② 向量轮廓（assets/mob-shapes.js）：file:// 下画布会被标记为"污染"，
  //      getImageData 直接抛异常 —— 此时只能退到这份离线预计算的外形，
  //      否则所有生物的碰撞箱都会退化成外接圆（这就是"全是圆的"的根因）。
  contour(key, size) {
    const ck = key + '@' + size;
    const hit = this.contourCache[ck];
    if (hit) return hit;                 // 只认成功结果：失败不缓存，素材就绪后下次就能建出来
    let out = null;
    // 优先用【矢量几何】提取的精确轮廓（assets/mob-shapes.js，由
    // tools/gen_mob_shapes_vector.py 从 SVG 路径直接展平而来）——
    // 它比像素网格精确得多：像素网格受限于 CONTOUR_N 的分辨率，且"逐行左右极值"
    // 无法表达凹形，看起来就"很不对"。
    out = this.vectorContour(key, size);
    if (!out) {
      // 没有离线矢量数据时才退到像素轮廓（仍然与外观一致）
      const g = this.alphaGrid(key, CONTOUR_N);
      if (g) out = contourFromGrid(g, CONTOUR_N);
    }
    if (out) this.contourCache[ck] = out;
    return out;
  },

  // 贴图的【旋转轴心】= 主体图形的中心，单位 = size（-0.5~0.5，相对绘制框中心）。
  //
  // 为什么需要：drawMob 是 translate -> rotate -> drawImage(-size/2 ...) 画的，
  // 所以旋转轴恒为【裁剪框中心】。但有些贴图的主体并不在画布中央
  // （蜈蚣头 12_h 的绿色身体在 viewBox 归一化 (0.619,0.619)，触角把画布撑向另一侧），
  // 于是绕裁剪框中心旋转时，身体会绕着"错的轴"转 -> 大角度时脖子断开。
  //
  // 一视同仁的做法：轴心取 MOB_PIVOT（生成脚本按 SVG 主色算出的主体中心，viewBox 归一化）。
  // 主体本来居中的贴图（瓢虫/12_b）算出来自然≈(0,0)，不会有任何额外位移。
  //
  // 关键换算：pv = (pivotNorm - 0.5) / cropRatio
  //   （由 pv = (nx - off)/d - 0.5 化简而来，与 artCanvas 的裁剪换算严格等价）
  //
  // 【为什么不能等 cropRatio 就绪再算】：
  //   cropRatio 来自瓢虫贴图的像素实测，开局时还没就绪。曾经的写法在未就绪时
  //   直接 return {0,0}，而 vectorContour 的结果会被 contour() 缓存下来 ——
  //   于是碰撞轮廓永久停在 pv=0，画面却用真实 pv 平移，两者相差 0.119×size ≈ 5px：
  //   表现为"渲染的头比碰撞箱靠前，转弯时错位随朝向一起转"。
  //   现在未就绪时按 1.0（= 不裁剪的回退渲染路径，等价）计算且不缓存，永远不会算错。
  mobPivot(key) {
    const D = (typeof window !== 'undefined') ? window.MOB_PIVOT : null;
    const bare = String(key).replace(/^mob/, '');
    const pv = D && (D[key] || D[bare]);
    if (!pv || pv.length !== 2) return { x: 0, y: 0 };   // 非生物贴图：轴心 = 画布中心

    this._pivotCache = this._pivotCache || {};
    const hit = this._pivotCache[bare];
    if (hit) return hit;

    const ratio = this._cropRatio();
    if (!ratio) {
      // 比例未就绪：按"不裁剪"(1.0) 算，并且【不缓存】，等就绪后重算
      return { x: pv[0] - 0.5, y: pv[1] - 0.5 };
    }
    const out = { x: (pv[0] - 0.5) / ratio, y: (pv[1] - 0.5) / ratio };
    this._pivotCache[bare] = out;
    return out;
  },

  // 向量轮廓：用离线预计算的贴图外形（MOB_SHAPES，坐标 = viewBox 归一化 [0,1]），
  // 换算到与 artCanvas 完全相同的坐标系（有裁剪框就按裁剪框归一化，没有就是整图）。
  vectorContour(key, size) {
    const D = (typeof window !== 'undefined') ? window.MOB_SHAPES : null;
    // 离线外形表里的键是【裸 id】（如 '3' / '12_h'），而调用方传的是带前缀的 'mob3' / 'mob12_h'。
    // 之前只按 key 原样查，结果永远查不到 —— 像素轮廓一旦失败就没有任何兜底，
    // 碰撞箱直接为 null（表现为"打不到、也不参与伤害结算"）。
    const bare = String(key).replace(/^mob/, '');
    const shape = D && (D[key] || D[bare]);
    if (!shape || !shape.pts || shape.pts.length < 3) return null;
    const r = this._cropRect(size);          // 与 artCanvas 同一固定裁剪框
    // 再减去【旋转轴心】位移：drawMob 现在按主体中心旋转（贴图整体平移了 -pv），
    // 碰撞轮廓必须做同样的平移，否则画面居中了、判定还偏在旧位置。
    const pv = this.mobPivot(key);
    const pts = r
      ? shape.pts.map(([nx, ny]) => [(nx * size - r[0]) / r[2] - 0.5 - pv.x,
                                     (ny * size - r[1]) / r[3] - 0.5 - pv.y])
      : shape.pts.map(([nx, ny]) => [nx - 0.5 - pv.x, ny - 0.5 - pv.y]);
    let rad = 0;
    for (const [x, y] of pts) { const d = Math.hypot(x, y); if (d > rad) rad = d; }
    return { pts, r: rad || 0.5 };
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
    const b = this._cropRect(size * SS);          // 固定比例裁剪框（见 _cropRatio）
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
    const b = this._cropRect(size * SS);          // 与本体同一个固定裁剪框
    if (!b) { const fb = this.white[key][size] || base; this.artWhiteCache[ck] = fb; return fb; }
    const out = document.createElement('canvas');
    out.width = size; out.height = size;
    const o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.drawImage(base, b[0], b[1], b[2], b[3], 0, 0, size, size);
    this.artWhiteCache[ck] = out;
    return out;
  },

  // 裁剪到图案包围盒的红色剪影（受击红闪用），与 artWhiteCanvas 同一裁剪管线。
  // 关键：红闪必须和本体（artCanvas 裁剪版）同坐标系同尺寸，否则会偏小且偏移，
  // 表现为"红闪没盖住、只糊在中间一小块"。旧实现直接拿未裁剪的 redCanvas(key,512)
  // （全 viewBox 带留白）来画，自然对不上。
  artRedCanvas(key, size) {
    const ck = key + '@' + size;
    if (this.artRedCache[ck]) return this.artRedCache[ck];
    const SS = 2;
    this.canvas(key, size * SS);
    const base = this.white[key] ? this.white[key][size * SS] : null;
    if (!base) return null;
    const b = this._cropRect(size * SS);          // 与本体同一个固定裁剪框
    if (!b) { const fb = this.white[key] ? this.white[key][size] : null; this.artRedCache[ck] = fb; return fb; }
    const out = document.createElement('canvas');
    out.width = size; out.height = size;
    const o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.drawImage(base, b[0], b[1], b[2], b[3], 0, 0, size, size);
    o.globalCompositeOperation = 'source-in';
    o.fillStyle = '#ff4040';
    o.fillRect(0, 0, size, size);
    this.artRedCache[ck] = out;
    return out;
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

// 轮廓提取网格分辨率：越大越贴近外形，但每种贴图只算一次，96 已足够（成本 O(N²) 一次）。
const CONTOUR_N = 96;

// 从二值实心网格提取碰撞轮廓多边形。
// 方法：逐行求实心格的【左右极值】，上边界从左到右、下边界从右到左拼成一条简单多边形。
// 相比 marching squares 串环：
//   · 不可能失败 —— 不依赖环的连通性。真实贴图的抗锯齿边界存在大量对角"掐点"
//     （两个实心格只在对角相触），有向串环会在掐点处断掉，整条轮廓直接失效
//     （表现为碰撞多边形偏到一角甚至为 null，碰撞箱形同虚设）。
//   · 必然给出合法简单多边形，顶点数可控（行采样后约百个）。
//   · 实心区内部若有空洞会被填实 —— 碰撞箱本就该是实心的，不该让玩家掉进生物体内的洞。
//   · 对本项目的光滑外形（瓢虫等近似行凸）与原轮廓一致。
// 返回 { pts: [[x,y],...], r } —— pts 归一化到 [-0.5,0.5]，r 为外接半径（归一化）。
function contourFromGrid(g, N) {
  // 1) 每行的实心左右极值
  const rows = [];   // { j, l, r }
  for (let j = 0; j < N; j++) {
    const base = j * N;
    let l = -1, r = -1;
    for (let i = 0; i < N; i++) {
      if (g[base + i]) { if (l < 0) l = i; r = i; }
    }
    if (l >= 0) rows.push({ j, l, r });
  }
  if (rows.length < 2) return null;

  // 2) 行采样：网格 96 取约 48 行（误差亚像素级），同时保留首末行
  const stride = Math.max(1, Math.floor(rows.length / 48));
  const picked = [];
  for (let k = 0; k < rows.length; k += stride) picked.push(rows[k]);
  if (picked[picked.length - 1] !== rows[rows.length - 1]) picked.push(rows[rows.length - 1]);
  if (picked.length < 2) return null;

  // 3) 拼多边形：上边界（左极值，自上而下）+ 下边界（右极值，自下而上）
  const raw = [];
  for (let k = 0; k < picked.length; k++) raw.push([picked[k].l + 0.5, picked[k].j]);
  for (let k = picked.length - 1; k >= 0; k--) raw.push([picked[k].r + 0.5, picked[k].j]);
  if (raw.length < 3) return null;

  // 4) 抽样简化：相邻点曼哈顿距离 < 1.2 格就合并（视觉上无差别）
  const simple = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const p = raw[i], q = simple[simple.length - 1];
    if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) >= 1.2) simple.push(p);
  }
  if (simple.length < 3) return null;

  // 5) 归一化到 [-0.5, 0.5]（与整图绘制同坐标系）
  const norm = simple.map(([x, y]) => [x / N - 0.5, y / N - 0.5]);
  let r = 0;
  for (const [x, y] of norm) { const d = Math.hypot(x, y); if (d > r) r = d; }
  return { pts: norm, r: r || 0.5 };
}

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
