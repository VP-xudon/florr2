// main.js — 资源加载引导（非阻塞，绝不卡死加载界面）
'use strict';

const ASSET_LIST = [];
// 花瓣/生物素材带 ASSET_VER：内容换过但文件名没变，必须靠版本号强制浏览器重新拉取
for (const p of PETAL_TYPES) ASSET_LIST.push(['petal' + p.svg, 'assets/petals/' + p.svg + '.svg?v=' + ASSET_VER]);
// 生物贴图：assets/mobs/ 只存【原始素材】（官方 SVG 直接落地，不做任何拆分/裁剪）。
// 有专用渲染素材的生物（见下）：跳过 mobs/ 里的原始贴图，避免同一个 key 被重复加载覆盖。
const RENDER_ASSET_MOBS = new Set(['3']);
for (const m of MOB_TYPES) {
  if (RENDER_ASSET_MOBS.has(String(m.id))) continue;
  ASSET_LIST.push(['mob' + m.svg, 'assets/mobs/' + m.svg + '.svg?v=' + ASSET_VER]);
}
// 渲染专用生物素材统一放 assets/entities/（与原始贴图分离，避免再出现"拆分后原地覆盖"）：
//   瓢虫 = 本体(mobs/3.svg 已裁到图案、去掉了描边圈) + 描边圈独立图层，
//   绘制顺序：本体 -> 随机圆点 -> 描边圈（圆点永远压在圈的下面）。
//   RING_RECT 见 entities.js LADYBUG_RING_RECT。
ASSET_LIST.push(['mob3', 'assets/entities/3_body.svg?v=' + ASSET_VER]);
ASSET_LIST.push(['mob3ring', 'assets/entities/3_ring.svg?v=' + ASSET_VER]);

// 运行参数：仅保留开发用 ?hp=N（调试血量）。
// 语言 / 移动方式 / 调试模式已全部移到【设置窗口】，存 Cookie（见 util.js -> Settings），
// 不再支持 ?i18n= / ?lang= / ?movemode= / ?mode= 这些 URL 参数。
// 支持逗号与 & 混搭的自由组合：?hp=1000 与 ?hp=1000 等价（其余键忽略）。
const _params = new URLSearchParams(location.search.replace(/,/g, '&'));
window.__queryParams = {};
for (const [k, v] of _params) window.__queryParams[k.toLowerCase()] = v;
window.__debug = !!(typeof Settings !== 'undefined' && Settings.get('debug'));

async function boot() {
  let game = null;
  try {
    UI.init();
    try {
      window.GARDEN_DATA = await loadGardenData();
      ASSET_LIST.push(...window.GARDEN_DATA.assets);
    } catch (e) {
      console.error('[loadGardenData]', e);
      UI.refs.loading.textContent = 'Failed to load garden.tmj. Open the game through a local HTTP server.';
      return;
    }
    const canvas = document.getElementById('game');
    game = new Game(canvas);
    game.init();
    game.start();
    game.syncInventory();   // 初始渲染卡槽（花朵下方快捷栏常驻显示）
    window.__game = game;   // 供 UI 取玩家数据（如物品栏落点）
  } catch (e) {
    console.error('[boot] 初始化失败：', e);
  } finally {
    // 注意：不在这里撤 loading —— 必须等全部资源加载完成后再撤（见下方 await）
  }

  // 资源在后台加载（互不阻塞）。【蒙版绝不提前撤】—— 必须等全部资源加载完成。
  // 超过 20s 仍未完成：在正上方中央显示一个定格提示框，但后台继续等（不放弃加载）。
  const slowWarn = setTimeout(() => {
    if (window.GARDEN_DATA && UI.showLoadingWarn) UI.showLoadingWarn();
  }, 20000);
  try {
    await Promise.allSettled(ASSET_LIST.map(([k, s]) => SpriteStore.load(k, s)));
  } catch (e) { /* 单个素材失败不影响其他 */ }
  clearTimeout(slowWarn);
  if (window.GARDEN_DATA) UI.hideLoading();
}

// 脚本已置于 body 末尾，DOM 就绪即可启动（不依赖 window.load 等待全部子资源）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
