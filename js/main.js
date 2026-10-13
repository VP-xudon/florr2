// main.js — 资源加载引导（非阻塞，绝不卡死加载界面）
'use strict';

const ASSET_LIST = [];
for (const p of PETAL_TYPES) ASSET_LIST.push(['petal' + p.svg, 'assets/petals/' + p.svg + '.svg']);
for (const m of MOB_TYPES) ASSET_LIST.push(['mob' + m.svg, 'assets/mobs/' + m.svg + '.svg']);

// 调试模式：?mode=debug 开启开发者模式（背包卡牌显示 ∞，怎么拿都拿不空）
const _params = new URLSearchParams(location.search);
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

  // 资源在后台加载（带超时，互不阻塞）；【全部完成后再撤 loading 蒙版】
  // 加 12s 兜底超时：万一某张素材挂了也不会让 loading 永远挡着画面。
  try {
    await Promise.race([
      Promise.allSettled(ASSET_LIST.map(([k, s]) => SpriteStore.load(k, s))),
      new Promise((res) => setTimeout(res, 12000))
    ]);
  } catch (e) { /* 单个素材失败不影响其他 */ }
  if (window.GARDEN_DATA) UI.hideLoading();
}

// 脚本已置于 body 末尾，DOM 就绪即可启动（不依赖 window.load 等待全部子资源）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
