// util.js — 数学/随机/角度工具
'use strict';
const TAU = Math.PI * 2;

// 素材版本号：只要 assets/ 下的图片/SVG 内容变了（文件名不变），就把它 +1。
// 浏览器会按 URL 缓存这些素材，不加版本号时改动可能不生效（表现为"还在用旧素材"）。
const ASSET_VER = 5;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

// ---------------- 数值显示：欧美小游戏风格压缩记法 ----------------
// 只影响"显示"，底层数值永远保持精确原值。
//   < 1000  -> 原样（整数照原样；小数最多保留一位）
//   >= 1000 -> 一位小数（四舍五入）+ 单位：k / m / b / t
//   例：999 -> 999 ；1200 -> 1.2k ；8900 -> 8.9k ；56300 -> 56.3k
//       1.2e6 -> 1.2m ；3.2e9 -> 3.2b ；999999 -> 1.0m（进位自动换档）
const NUM_UNITS = [[1e12, 't'], [1e9, 'b'], [1e6, 'm'], [1e3, 'k']];
function fmtNum(n) {
  if (n == null || !isFinite(n)) return '0';
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v < 1000) {
    if (Number.isInteger(v)) return sign + String(v);
    return sign + String(Math.round(v * 10) / 10);
  }
  let idx = NUM_UNITS.length - 1;
  while (idx > 0 && v < NUM_UNITS[idx][0]) idx--;
  const one = (i) => (Math.round((v / NUM_UNITS[i][0]) * 10) / 10).toFixed(1);
  let str = one(idx);
  // 四舍五入后跨档（999.96k -> 1.0m）
  if (parseFloat(str) >= 1000 && idx > 0) { idx -= 1; str = one(idx); }
  return sign + str + NUM_UNITS[idx][1];
}

// ---------------- 卡槽数量 ----------------
// 调试模式(?mode=debug) 每行 10 个，否则 5 个；两行数量始终保持一致。
function slotCount() {
  return (typeof window !== 'undefined' && window.__debug) ? 10 : 5;
}
function emptySlots() { return new Array(slotCount()).fill(null); }

function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a = 1, b) { if (b === undefined) { b = a; a = 0; } return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function choice(arr) { return arr[(Math.random() * arr.length) | 0]; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

// 角度插值（按最短弧）
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * t;
}

// 指数平滑（帧率无关）
function damp(cur, target, rate, dt) {
  return lerp(cur, target, 1 - Math.exp(-rate * dt));
}

// 一维值噪声（平滑，用于地图不规则形态）
function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = Math.sin(i * 127.1) * 43758.5453;
  const b = Math.sin((i + 1) * 127.1) * 43758.5453;
  const ra = a - Math.floor(a), rb = b - Math.floor(b);
  return lerp(ra, rb, u);
}
