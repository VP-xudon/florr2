// util.js — 数学/随机/角度工具
'use strict';
const TAU = Math.PI * 2;

// 素材版本号：只要 assets/ 下的图片/SVG 内容变了（文件名不变），就把它 +1。
// 浏览器会按 URL 缓存这些素材，不加版本号时改动可能不生效（表现为"还在用旧素材"）。
const ASSET_VER = 16;  // 16: 强制重新拉取多节生物贴图（12_h/12_b），清掉浏览器里可能缓存的旧 404

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

// ---------------- 用户设置（Cookie 持久化） ----------------
// 只存"重启后生效"的选项：语言、键盘移动、调试模式。
// 之所以用 Cookie 而不是 URL 参数：这些是用户偏好，不该每次开游戏都拼一遍查询串。
// 读取时机必须早于 lang.js（语言包要在 data.js 之前定下来），所以放在最靠前的 util.js。
window.Settings = (function () {
  const KEY = 'florr_settings';
  const DEFAULTS = {
    lang: 'en_US',        // 语言包代码（assets/i18n/<code>/<code>.js 的 <code>）
    keyboardMove: false,  // false = 鼠标移动（默认），true = 键盘移动
    debug: false          // 开发者模式（原 ?mode=debug）
  };
  function load() {
    let raw = '';
    try {
      const m = document.cookie.match(new RegExp('(?:^|; )' + KEY + '=([^;]*)'));
      raw = m ? decodeURIComponent(m[1]) : '';
    } catch (e) { raw = ''; }
    let obj = {};
    if (raw) { try { obj = JSON.parse(raw) || {}; } catch (e) { obj = {}; } }
    return Object.assign({}, DEFAULTS, obj);
  }
  let data = load();
  function persist() {
    try {
      document.cookie = KEY + '=' + encodeURIComponent(JSON.stringify(data)) +
        '; path=/; max-age=' + (60 * 60 * 24 * 365) + '; SameSite=Lax';
    } catch (e) { /* Cookie 不可用（file:// 等）：本次会话内仍然生效 */ }
  }
  return {
    DEFAULTS,
    get(k) { return data[k]; },
    set(k, v) { data[k] = v; persist(); },
    all() { return Object.assign({}, data); }
  };
})();

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

// 角度归一化到 (-PI, PI]。
// lerpAngle 只是 a + d*t，本身不会把 a 拉回区间：一直朝同一方向转（绕圈 / 鼠标绕人转）
// 时朝向会一路累加到几千度 —— F3 上的 "Facing" 就会显示出天文数字。
// 所有"朝向"字段写回时都要过这一道。
function wrapAngle(a) {
  if (!isFinite(a)) return 0;
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

// 指数平滑（帧率无关）
function damp(cur, target, rate, dt) {
  return lerp(cur, target, 1 - Math.exp(-rate * dt));
}
