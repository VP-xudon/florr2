// main.js — 资源加载引导（非阻塞，绝不卡死加载界面）
'use strict';

const ASSET_LIST = [];
for (const p of PETAL_TYPES) ASSET_LIST.push(['petal' + p.svg, 'assets/petals/' + p.svg + '.svg']);
for (const m of MOB_TYPES) ASSET_LIST.push(['mob' + m.svg, 'assets/mobs/' + m.svg + '.svg']);

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
    window.__game = game;   // 供 UI 取玩家数据（如物品栏落点）
  } catch (e) {
    console.error('[boot] 初始化失败：', e);
  } finally {
    // 立即隐藏加载界面，绝不让资源加载阻塞游戏
    if (window.GARDEN_DATA) UI.hideLoading();
  }

  // 资源在后台加载（带超时，互不阻塞）；加载完成后无需重绘（drawSprite 会按需取图）
  Promise.allSettled(ASSET_LIST.map(([k, s]) => SpriteStore.load(k, s)))
    .catch(() => {});
}

// 脚本已置于 body 末尾，DOM 就绪即可启动（不依赖 window.load 等待全部子资源）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
