// main.js — 资源加载引导（非阻塞，绝不卡死加载界面）
'use strict';

const ASSET_LIST = [];
// 花瓣/生物素材带 ASSET_VER：内容换过但文件名没变，必须靠版本号强制浏览器重新拉取
for (const p of PETAL_TYPES) ASSET_LIST.push(['petal' + p.svg, 'assets/petals/' + p.svg + '.svg?v=' + ASSET_VER]);
for (const m of MOB_TYPES) ASSET_LIST.push(['mob' + m.svg, 'assets/mobs/' + m.svg + '.svg?v=' + ASSET_VER]);
// 瓢虫描边圈独立层：圆点画在鞘翅上、描边圈之下（见 entities.js LADYBUG_RING_RECT）
ASSET_LIST.push(['mob3ring', 'assets/mobs/3_ring.svg?v=' + ASSET_VER]);

// 调试参数：?mode=debug 开启开发者模式（背包卡牌显示 ∞，怎么拿都拿不空）。
// 支持【逗号与 & 混搭】的自由组合：?mode=debug,hp=1000,lang=zh_cn 与 ?mode=debug&hp=1000 等价。
// 全部解析结果存 window.__queryParams（小写键）；hp 参数由 game.js init() 应用到玩家血量。
const _params = new URLSearchParams(location.search.replace(/,/g, '&'));
window.__queryParams = {};
for (const [k, v] of _params) window.__queryParams[k.toLowerCase()] = v;
window.__debug = _params.get('mode') === 'debug';

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
