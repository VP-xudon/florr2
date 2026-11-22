// main.js — 资源加载引导：Loading 蒙版会等到所有素材真正解码、窗口预热完成后才撤
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
// 渲染专用生物素材统一放 assets/entities/（与 assets/mobs/ 的原始贴图分离）：
//   瓢虫 = 本体(mobs/3.svg 已裁到图案、去掉了描边圈) + 描边圈独立图层，
//   绘制顺序：本体 -> 随机圆点 -> 描边圈（圆点永远压在圈的下面）。
//   描边圈的裁剪矩形见 sim/mob-shape.js 的 LADYBUG_RING_RECT。
ASSET_LIST.push(['mob3', 'assets/entities/3_body.svg?v=' + ASSET_VER]);
ASSET_LIST.push(['mob3ring', 'assets/entities/3_ring.svg?v=' + ASSET_VER]);
// 蜈蚣（多节生物）：头节带触角 / 身体节两套贴图（图鉴仍用 mobs/12.svg）
ASSET_LIST.push(['mob12_h', 'assets/mobs/12_h.svg?v=' + ASSET_VER]);
ASSET_LIST.push(['mob12_b', 'assets/mobs/12_b.svg?v=' + ASSET_VER]);

// 运行参数：仅保留开发用 ?hp=N（调试血量）。
// 语言 / 移动方式 / 调试模式由设置窗口管理，存 Cookie（见 util.js -> Settings）。
// 支持逗号与 & 混搭的自由组合：?hp=1000 与 ?hp=1000 等价（其余键忽略）。
const _params = new URLSearchParams(location.search.replace(/,/g, '&'));
window.__queryParams = {};
for (const [k, v] of _params) window.__queryParams[k.toLowerCase()] = v;
window.__debug = !!(typeof Settings !== 'undefined' && Settings.get('debug'));

async function boot() {
  const bootStart = performance.now();
  // 预热的循环之间主动让出一帧：否则同步构建会占满主线程，SVG 动画只播一下就冻住。
  const yieldFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  let game = null;
  try {
    UI.init();
    try {
      window.GARDEN_DATA = await loadGardenData();
      ASSET_LIST.push(...window.GARDEN_DATA.assets);
    } catch (e) {
      console.error('[loadGardenData]', e);
      if (UI.refs.loadText) UI.refs.loadText.textContent = 'Failed to load garden.tmj. Open the game through a local HTTP server.';
      return;
    }
    // 碰撞箱数据必须在实体创建前就位（生物/花瓣/F3 全读同一份 .crb）
    await Promise.race([CRB.loadAll(), new Promise((r) => setTimeout(r, 5000))]);
    const canvas = document.getElementById('game');
    game = new Game(canvas);
    game.init();
    game.start();
    game.syncInventory();   // 初始渲染卡槽（花朵下方快捷栏常驻显示）
    window.__game = game;   // 供 UI 取玩家数据（如物品栏落点）
    // 背包是服务端权威：启动后拉一次镜像，之后所有增减都走 UI._invRequest 的回执。
    if (UI && typeof UI.syncInventoryFromServer === 'function') await UI.syncInventoryFromServer();
  } catch (e) {
    console.error('[boot] 初始化失败：', e);
  } finally {
    // 注意：不在这里撤 loading —— 必须等全部资源加载完成后再撤（见下方 await）
  }

  // 【蒙版绝不提前撤】：必须等所有素材真正解码、所有窗口预热完成后才撤。
  // 超过 30s 仍未完成才弹定格提示（后台继续等，不放弃加载）。
  const slowWarn = setTimeout(() => {
    if (window.GARDEN_DATA && UI.showLoadingWarn) UI.showLoadingWarn();
  }, 30000);
  try {
    // 1) 卡面 / 世界实体素材：fetch + getBBox + dataURL + Image 解码一次做完。
    //    同时也消除了第一次打开背包/合成时的集中卡顿。
    if (typeof CardRenderer !== 'undefined' && typeof CardRenderer.prewarm === 'function') {
      await CardRenderer.prewarm(PETAL_TYPES.map((p) => String(p.svg)), yieldFrame);
    }
    await yieldFrame();
    // 2) 生物派生素材：Hornet 空壳 / 无触角身体 / Pollen，以及蜘蛛步态与蚂蚁分件。
    await MobFX.prepareAssets();
    if (typeof SpiderGait !== 'undefined' && SpiderGait.prewarm) await SpiderGait.prewarm();
    if (typeof AntArt !== 'undefined' && AntArt.prewarm) await AntArt.prewarm();
    await yieldFrame();
    // 3) 清单素材 + 派生素材（data URL / 动态部件）一并校验：失败/超时自动重试。
    const derived = Object.keys(SpriteStore.sources || {}).map((k) => [k, SpriteStore.sources[k]]);
    await SpriteStore.loadAll(ASSET_LIST.concat(derived));
    await yieldFrame();
    // 3b) 瓦片位图：loadAll 只把 SVG 解码成 Image，首帧才逐格建 288² canvas。
    //     这里把地图实际用到的 svg + 翻转组合一次性栅格化。
    try {
      const seen = new Set();
      let n = 0;
      for (const layer of (window.GARDEN_DATA && window.GARDEN_DATA.layers) || []) {
        for (const t of layer.tiles || []) {
          if (!t || t === -1) continue;
          let name = t, flags = 0;
          if (typeof t === 'string') {
            const h = t.indexOf('#');
            if (h >= 0) { name = t.slice(0, h); flags = parseInt(t.slice(h + 1), 10) || 0; }
          }
          const sig = name + '#' + flags;
          if (seen.has(sig)) continue;
          seen.add(sig);
          SpriteStore.canvasFlip('tile' + name, GARDEN_TILE, flags);
          if (++n % 8 === 0) await yieldFrame();
        }
      }
      await yieldFrame();
    } catch (e) { /* 瓦片预热失败不影响进入游戏 */ }
    // 3c) 生物位图 / 轴心 / 轮廓：按首屏实体的实际 drawSize 建缓存，
    //     避免撤蒙版后第一帧集中做 2× 超采样、裁剪与轮廓提取。
    try {
      const g = window.__game;
      if (g && g.mobs && typeof SpriteStore.prewarmMobs === 'function') {
        await SpriteStore.prewarmMobs(g.mobs, yieldFrame);
      }
      await yieldFrame();
    } catch (e) { /* 生物预热失败不影响进入游戏 */ }
    // 4) 字体就绪后统一重绘卡面；网络异常时最多等 5s，不让蒙版挂死。
    await Promise.race([
      (async () => {
        if (document.fonts && document.fonts.load) await document.fonts.load('800 16px Ubuntu');
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
      })(),
      new Promise((r) => setTimeout(r, 5000))
    ]);
    await yieldFrame();
    // 5) 背包/合成窗口的 DOM、canvas、事件绑定全部建好，首次打开零构建。
    if (UI && typeof UI.prewarmWindows === 'function') await UI.prewarmWindows(yieldFrame);
    await yieldFrame();
    // 6) 小地图位图预热：覆盖过渡中会用到的全部尺寸（含大档的 _mmFullPx 全图位图）。
    const g = window.__game;
    if (g && g.map && typeof g.map.minimapCanvas === 'function') {
      const px = [192, 512];
      if (typeof UI._mmFullPx === 'function') px.push(UI._mmFullPx());
      if (typeof UI._mmBmpPx === 'function') px.push(UI._mmBmpPx(160 * 1.2));
      for (const s of new Set(px)) {
        g.map.minimapCanvas(s);
        await yieldFrame();
      }
    }
  } catch (e) { console.error('[boot] 预热阶段失败：', e); }
  // 蒙版至少展示 5s：素材命中缓存时预热会瞬间完成，不兜底就看不到蜘蛛动画。
  const left = 5000 - (performance.now() - bootStart);
  if (left > 0) await new Promise((r) => setTimeout(r, left));
  clearTimeout(slowWarn);
  if (window.GARDEN_DATA) UI.hideLoading();
  window.__uiBooted = true;
}

// 脚本已置于 body 末尾，DOM 就绪即可启动（不依赖 window.load 等待全部子资源）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
