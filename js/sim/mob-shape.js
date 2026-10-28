// sim/mob-shape.js — 生物视觉尺寸与 SVG 轮廓碰撞数学（无 DOM）
'use strict';

const PLAYER_VISUAL_D = 13.2 * 1.2 * 2;
const MOB_DIAM_BASE = 1.9 * 0.65;                          // common ≈ 1.235
const _MOB_OLD_STEP = Math.pow(4.5 / 1.9, 1 / 4);          // 旧表步进（仅用于校准点换算）
const MOB_DIAM_STEP = Math.pow(
  (1.9 * Math.pow(_MOB_OLD_STEP, 6)) / MOB_DIAM_BASE, 1 / 5);   // ≈ 1.4118
const MOB_DIAM = (function () {
  const o = {};
  const order = ['common', 'unusual', 'rare', 'epic', 'legendary', 'mythic', 'ultra', 'super', 'eternal', 'unique'];
  for (let i = 0; i < order.length; i++) o[order[i]] = MOB_DIAM_BASE * Math.pow(MOB_DIAM_STEP, i);
  return o;
})();
// 注：生物体型【只用稀有度表】，不再有"按生物种类偏移几档"的特例。
// 各生物的相对大小由 SpriteStore 的固定比例裁剪决定（所有贴图共用同一个裁剪框，
// 以瓢虫的实际图案范围为基准标定）—— 素材画多大就显示多大。
//
// 个别生物需要整体比同稀有度的瓢虫更大/更小：用【等比倍数】而不是"偏移几档"。
//   bee = 1.395：使蜜蜂 common 正好等于原本 unusual 的大小（所有稀有度同比例放大）
// 体型倍率已迁到数据表（data.js 的 MOB_TRAITS.sizeScale），Mob 构造时读 type.sizeScale。
// 本文件只负责"给定尺寸后如何算轮廓"，不再持有物种名单。

// 贴图朝向补偿：部分生物 SVG 的「头」不指向 +x（瓢虫的头在图内指向左上 -135°）。
// 绘制与碰撞统一在 facing 上加这个偏角，使头始终朝向实际移动方向。
const MOB_ART_ROT = {
  '3': Math.PI * 3 / 4,       // 瓢虫：头中心在图内朝 -135°，补偿 +135°
  '4': Math.PI * 3 / 4,       // 蜜蜂：尾针在右下角(76.8,76.8)，头同样朝左上，补偿相同
  // 蜈蚣（含头节 12_h / 身体节 12_b，两张同朝向）：
  // 侧面那两个黑点是【脚】，分列左右两侧 -> 前方垂直于它们的连线，也就是贴图的"上方"。
  // 旋转 +90° 把贴图的上方(0,-1) 转到 +x，使前方与 facing 对齐。
  // 若实际是【倒着走】（头朝后），把这里改成 -Math.PI / 2 即可，只改这一个数。
  // 蜈蚣贴图（12_h 头 / 12_b 身）的图形朝【左上 45°】（= -135°），与瓢虫一致，
  // 所以补偿 +135° 把"前方"转到 +x。
  '12': Math.PI * 3 / 4,
  '12_h': Math.PI * 3 / 4,
  '12_b': Math.PI * 3 / 4,
};
// 瓢虫描边圈独立图层（assets/entities/3_ring.svg，main.js 预加载）：
// 渲染专用的生物素材统一放在 assets/entities/，assets/mobs/ 只存原始贴图。
// 绘制顺序 = 本体(无圈) -> 随机圆点 -> 描边圈，圆点永远压在圈的下面。
// RING_RECT = 圈在 base 贴图（3.svg）坐标系里的比例矩形（tools/_split_ring.py 算出）。
const LADYBUG_RING_KEY = 'mob3ring';
const LADYBUG_RING_RECT = [-0.0582, -0.0590, 1.1172, 1.1181];
// 生物 SVG 的实际图案只占 viewBox 的一部分（外圈是 clipPath 留白）。
// 旧实现按 91.667/110 估算这个比例，但真实图案比 clipPath 更小，所以视觉总比碰撞箱小一圈。
// 现在改为运行时按 alpha 通道实测包围盒并裁剪（见 SpriteStore.artCanvas），这里只留注释说明。
const MOB_ART_RATIO = 91.667 / 110;

// 全实体【共用】的血条尺寸（花朵 / 昆虫同一份数据，绝不允许两套公式）。
// 长度 = 基准公式 ×1.3；高度不变。
const HPBAR_W = Math.max(30, Math.min(
  PLAYER_VISUAL_D * MOB_DIAM_BASE / 2 * 1.7,
  PLAYER_VISUAL_D * MOB_DIAM_BASE / 2 * 1.9)) * 1.9 * 0.6 * 1.3;
const HPBAR_H = 6.6 * 0.8;

// —— 生物碰撞箱：取自 SVG 实绘图形的轮廓多边形（marching squares 提取）——
// 网格直接取自渲染像素，因此凹形（瓢虫头凹槽）也能表达；多边形顶点表与地图碰撞同形态，
// 消费方做「圆 vs 多边形」求交（思路同 map.js 的 circleContact）。

// 生物轮廓几何核心：本地坐标下求"最近点 + 是否在内"。
// 圆-多边形求交、花瓣吸附落点都复用这一份，避免两套几何算法各算各的。
function _mobLocalNearest(poly, D, lx, ly) {
  const pts = poly.pts;
  // 内外判定用射线法（与绕向无关，轮廓提取不保证绕向）
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const ax = pts[j][0] * D, ay = pts[j][1] * D;
    const bx = pts[i][0] * D, by = pts[i][1] * D;
    if ((ay > ly) !== (by > ly) && lx < (bx - ax) * (ly - ay) / (by - ay) + ax) inside = !inside;
  }
  // 逐边求最近点
  let bx = 0, by = 0, bd2 = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const ax = pts[j][0] * D, ay = pts[j][1] * D;
    const ex = pts[i][0] * D - ax, ey = pts[i][1] * D - ay;
    const len2 = ex * ex + ey * ey || 1e-9;
    let t = ((lx - ax) * ex + (ly - ay) * ey) / len2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const px = ax + t * ex, py = ay + t * ey;
    const ddx = lx - px, ddy = ly - py;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 < bd2) { bd2 = d2; bx = px; by = py; }
  }
  return { px: bx, py: by, dist: Math.sqrt(bd2), inside };
}

// 贴图旋转（facing + artRot），与 draw 完全一致
function _mobRot(m) {
  const rot = m.facing + (m.artRot || 0);
  return { c: Math.cos(rot), s: Math.sin(rot) };
}

// 圆 vs 生物轮廓多边形。命中返回 { nx, ny, depth }（世界空间法线，指向生物外），否则 null。
// 复杂度 = O(顶点数)，顶点已抽样简化（通常几十个），比逐格扫描更快。
function circleVsMobPoly(m, cx, cy, cr) {
  const poly = m.shape;
  if (!poly || !poly.pts || poly.pts.length < 3) return null;
  const D = m.collSize;
  // 世界 -> 生物本地（贴图随 facing + artRot 旋转，与绘制完全一致）
  const { c, s } = _mobRot(m);
  const dx = cx - m.x, dy = cy - m.y;
  const lx = dx * c + dy * s, ly = -dx * s + dy * c;
  // 粗判：本地外接圆
  const rr = D * poly.r + cr;
  if (lx * lx + ly * ly > rr * rr) return null;

  const q = _mobLocalNearest(poly, D, lx, ly);
  if (!q.inside && q.dist >= cr) return null;      // 完全在外且没碰到
  let nlx, nly;
  if (q.dist > 1e-6) {
    nlx = (lx - q.px) / q.dist; nly = (ly - q.py) / q.dist;
    if (q.inside) { nlx = -nlx; nly = -nly; }      // 圆心在内部：法线反向（指向出口）
  } else { nlx = 1; nly = 0; }
  const depth = q.inside ? cr + q.dist : cr - q.dist;
  if (depth <= 0) return null;
  // 本地法线 -> 世界
  return { nx: nlx * c - nly * s, ny: nlx * s + nly * c, depth };
}

// 轮廓上离 (x,y) 最近的点（世界坐标）+ 外法线 + 距离（在内为负）。
// 花瓣吸附的落点必须贴着【真实外形】——用外接圆会把花瓣拉到空气里（"飘"）。
function mobShapeNearest(m, x, y) {
  const poly = m.shape;
  if (!poly || !poly.pts || poly.pts.length < 3) return null;   // 纯矢量：无多边形不吸附（首帧可能为空）
  const D = m.collSize;
  const { c, s } = _mobRot(m);
  const dx = x - m.x, dy = y - m.y;
  const lx = dx * c + dy * s, ly = -dx * s + dy * c;
  const q = _mobLocalNearest(poly, D, lx, ly);
  let nlx, nly;
  if (q.dist > 1e-6) {
    nlx = (lx - q.px) / q.dist; nly = (ly - q.py) / q.dist;
    if (q.inside) { nlx = -nlx; nly = -nly; }
  } else { nlx = 1; nly = 0; }
  return {
    x: m.x + (q.px * c - q.py * s),
    y: m.y + (q.px * s + q.py * c),
    nx: nlx * c - nly * s,
    ny: nlx * s + nly * c,
    dist: q.inside ? -q.dist : q.dist,
    inside: q.inside
  };
}

// 统一的生物碰撞入口：优先用 SVG 轮廓多边形（严格按几何形状判定），
// 轮廓尚未提取（贴图刚加载 / 提取失败）时退回外接圆，避免"完全不碰撞"。
// 返回 { nx, ny, depth }：法线由生物表面指向圆心（世界空间）。
function mobHitTest(m, cx, cy, cr) {
  const poly = m.shape;
  // 纯矢量碰撞：只认外形多边形，不回退外接圆（避免膨胀圆导致碰撞箱过大 / 隔很远就打到人）
  if (!(poly && poly.pts && poly.pts.length >= 3)) return null;   // 无矢量外形则无碰撞
  return circleVsMobPoly(m, cx, cy, cr);
}

// 多节生物（蜈蚣每一节）的碰撞箱：【本节自己的贴图】的轮廓，而不是整个物种的贴图。
//   · 头节 artSvg = '12_h'（带触角的那张）→ MOB_SHAPES['12_h'] = 绿色身体（不含触角/腿）
//   · 身体节 artSvg = '12_b'                  → MOB_SHAPES['12_b'] = 绿色身体
//   · 12.svg 是【整条】蜈蚣的外形，只能用来画"物种图标"，套在一节上会又长又大，
//     所以取轮廓时一律按 artSvg（见 Mob._ensureShape），绝不回落到物种 id。
// 触角/腿脚/花纹在素材里是独立的 <path>，离线提取只取包围盒最大的那条主体路径
// （tools/gen_mob_shapes_vector.py 里有自检打印：主体 vs 全部部件的尺寸对比）。
