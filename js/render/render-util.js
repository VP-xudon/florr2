// render/render-util.js — 通用绘制工具：颜色/圆角/精灵/血条基础
'use strict';

// 血条颜色：绿 -> 红【连续】hue 插值（替代旧的绿/黄/红三档跳变），满血绿、空血红。
function hpBarColor(ratio) {
  const r = clamp(ratio, 0, 1);
  return 'hsl(' + (110 * r).toFixed(1) + ', 82%, 52%)';
}
// 颜色插值：支持 #rgb/#rrggbb/hsl(...) 输入，按 t(0..1) 线性混合后返回 #rrggbb。
// 用途：无敌期间血条在「正常配色」与「金/白」之间平滑过渡（t 由 invulnA 驱动）。
function mixHex(a, b, t) {
  const pa = parseColor(a), pb = parseColor(b);
  const k = clamp(t, 0, 1);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * k));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
// 解析颜色为 [r,g,b]：支持 #rgb / #rrggbb / hsl(h, s%, l%)
function parseColor(s) {
  if (s[0] === '#') {
    const h = s.length === 4
      ? s[1] + s[1] + s[2] + s[2] + s[3] + s[3]
      : s.slice(1, 7);
    return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
  }
  const m = /hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/.exec(s);
  if (!m) return [255, 255, 255];
  const h = parseFloat(m[1]) / 360, sat = parseFloat(m[2]) / 100, l = parseFloat(m[3]) / 100;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = sat * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)].map((v) => Math.round(clamp(v, 0, 1) * 255));
}

// 圆角矩形路径（ cards.js 里那份在闭包内，这里给实体绘制单独放一份）
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 绘制生物贴图：用「裁剪到实际图案」的版本，使图案正好撑满 size（= 碰撞箱直径）。
// 普通 drawSprite 按 viewBox 绘制，生物 SVG 外圈有一大片透明留白，图案会明显小一圈。
function drawMob(ctx, key, size, x, y, rot, scale, alpha, white) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (scale && scale !== 1) ctx.scale(scale, scale);
  if (alpha != null) ctx.globalAlpha = alpha;
  // 旋转轴心 = 贴图主体图形的中心（见 SpriteStore.mobPivot）。
  // 把贴图整体反向平移 pv*size，使【主体中心】落在旋转原点上：
  // 于是绕 (x,y) 旋转时，转的是绿色身体，而不是"画布几何中心"。
  // 主体本来居中的贴图 pv≈(0,0)，等于没变。
  const pv = SpriteStore.mobPivot(key);
  const ox = -size / 2 - pv.x * size;
  const oy = -size / 2 - pv.y * size;
  if (white) {
    // 受击白闪：用裁剪到图案包围盒的白色剪影（与本体同一裁剪管线），
    // 否则未裁剪的全 viewBox 剪影会比本体小一圈且偏移，看着像"只有中间变白"。
    const cv = SpriteStore.artWhiteCanvas(key, size);
    if (!cv) { ctx.restore(); return; }
    ctx.drawImage(cv, ox, oy, size, size);
  } else {
    // 真矢量渲染：统一走「裁剪到实际图案包围盒」的 artCanvas，
    // 保证与下面的白闪/红闪（artWhiteCanvas / artRedCanvas）同裁剪、同坐标系，
    // 三者在 size×size 里完全对齐（否则红/白闪会偏小且偏移）。
    const cv = SpriteStore.artCanvas(key, size);
    if (!cv) { ctx.restore(); return; }
    ctx.drawImage(cv, ox, oy, size, size);
  }
  ctx.restore();
}

// 绘制已预渲染的贴图（支持旋转/缩放/透明）
function drawSprite(ctx, key, size, x, y, rot, scale, alpha) {
  const cv = SpriteStore.canvas(key, size);
  if (!cv) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (scale && scale !== 1) ctx.scale(scale, scale);
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.drawImage(cv, -size / 2, -size / 2, size, size);
  ctx.restore();
}
// 绘制"花瓣实体"画布（已去字母、已收紧画布），支持旋转/缩放/透明
function drawArt(ctx, cv, size, x, y, rot, scale, alpha) {
  if (!cv) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (scale && scale !== 1) ctx.scale(scale, scale);
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.drawImage(cv, -size / 2, -size / 2, size, size);
  ctx.restore();
}

// 绘制一片花瓣的图形。多体花瓣（Light）在实体里【不套用卡面的紧凑排布】：
// 它的每个光点各占一个轨道位（见 _syncPetals 的 b.lights），这里只负责画单个光点。
function drawPetalArt(ctx, cv, size, x, y, rot, scale, alpha) {
  drawArt(ctx, cv, size, x, y, rot, scale, alpha);
}

// 基于重量与动能的实体推挤（玩家↔生物、生物↔生物通用）。
