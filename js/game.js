// game.js — 核心循环与系统编排
'use strict';

const WORLD_R = 1500 * 0.75;  // 1125：地图/世界缩至原 0.75（主角不变）

// 物理键位 -> 逻辑动作。用 e.code 而非 e.key：e.key 会被输入法吞成 'Process'、
// 且受键盘布局影响；这里每个物理键各占一个标记，方向键之间互不干扰，
// 按住空格/Shift 时四个方向（含右方向）依然能任意组合。
const KEY_ACTION = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'mode1',                        // reach
  ShiftLeft: 'mode2', ShiftRight: 'mode2' // detect
};
// 兜底：个别环境 e.code 缺失/异常时，用 e.key 再判一次（左右 Shift、空格、方向键、WASD）
const KEY_ALIAS = {
  w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down',
  a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right',
  ' ': 'mode1', shift: 'mode2'
};

// 背包堆叠：同类（类型+稀有度）合并为 { type, rarity, count }；种类槽上限 max
function addStack(arr, card, max) {
  for (const s of arr) if (s.type === card.type && s.rarity === card.rarity) { s.count++; return true; }
  if (arr.length >= max) return false;
  arr.push({ type: card.type, rarity: card.rarity, count: 1 });
  return true;
}
// 从堆叠取一张：数量-1，归零则移除该堆叠（UI 端 FLIP 平滑补位）
function takeOne(arr, i) {
  const s = arr[i]; if (!s) return false;
  if (--s.count <= 0) arr.splice(i, 1);
  return true;
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = 0; this.H = 0;
    this.keys = {};
    this.camera = { x: 0, y: 0 };
    this.shake = 0;
    this.last = 0;
    this.selectedSlot = 0;

    this.player = null;
    this.mobs = [];
    this.cards = [];
    this.particles = [];
    this.dmgTexts = [];
    this.dex = {};   // 图鉴：mobId -> Set(level)

    this.gardenData = window.GARDEN_DATA || null;
    this.map = (this.gardenData && this.gardenData.layers.length)
      ? createGardenMap(this.gardenData) : createMap(WORLD_R);
    this.bg = null;
    this.bgHalf = WORLD_R;
  }

  init() {
    this._resize();
    window.addEventListener('resize', () => this._resize());

    // 输入：按「物理键位」(e.code) 注册，与输入法/键盘布局无关。
    // 每个物理键占一个独立标记，因此方向键之间、以及方向键与空格/Shift 之间可以任意组合，
    // 不会出现"按住 Shift 后右方向键和其他方向键组合失效"。
    window.addEventListener('keydown', (e) => {
      const act = KEY_ACTION[e.code] || KEY_ALIAS[e.key.toLowerCase()];
      if (act) {
        this.keys[act] = true;
        if (e.code === 'Space' || e.key === ' ') e.preventDefault();   // 只拦空格（整页滚动）
      }
      const k = e.key.toLowerCase();
      if (k === 'b' || k === 'tab') { e.preventDefault(); this.toggleBag(); }
      if (k === 'v') { e.preventDefault(); this.toggleDex(); }
    });
    window.addEventListener('keyup', (e) => {
      const act = KEY_ACTION[e.code] || KEY_ALIAS[e.key.toLowerCase()];
      if (act) this.keys[act] = false;
    });
    // 失焦时清空按键：避免切窗后"松手了仍在移动 / 模式卡住"
    window.addEventListener('blur', () => { this.keys = {}; });

    // 游戏是一个统一的"窗口"：屏蔽 Ctrl+滚轮 触发的浏览器整页缩放（避免不同元素被单独放大）
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey) e.preventDefault();
    }, { passive: false });

    // UI 由 ui.js 动态生成；绑定回调
    UI.onBagToggle = () => this.toggleBag();
    UI.onDexToggle = () => this.toggleDex();
    UI.onSlotClick = (i) => this.moveSlotToInv(i);          // 点击已装备花瓣 -> 卸下到物品栏
    UI.onInvBarClick = (i) => this.equipFirstEmptyFromInv(i); // 点击物品栏卡 -> 装备到花朵
    UI.onBagCardClick = (i) => this.moveBagToInv(i);        // 点击背包卡 -> 进物品栏（无空槽则无反应）
    UI.onGalleryCardClick = (card) => {                    // 点击画廊卡 -> 仅当有空槽时装备；满槽无反应
      const emptyIdx = this.firstEmptySlot();
      return (emptyIdx >= 0) ? this.addGalleryCard(card.type, card.rarity, { type: 'slot', index: emptyIdx }) : false;
    };
    UI.onCloseAll = () => this.closeAllWindows();
    UI.onDrop = (drag, target) => this.dispatchDrop(drag, target);

    // 玩家与初始装备
    this.player = new Player();
    this._resetPlayer(true);
    this.camera.x = this.player.x; this.camera.y = this.player.y;

    this.buildBackground();
    this.updateHUD();
  }

  _resetPlayer(full) {
    const p = this.player;
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
    p.hp = p.maxHp = 100; p.xp = 0; p.level = 1; p.xpNext = 24;
    p.dead = false; p.deathTimer = 0; p.invuln = 0; p.flash = 0;
    p.slots = [null, null, null, null, null];
    p.invBar = full ? [] : p.invBar;
    p.backpack = full ? [] : p.backpack;
    // 初始花瓣：基础 + 攻击型
    p.slots[0] = makePetal(STARTER_PETAL_A, 'common');
    p.slots[1] = makePetal(STARTER_PETAL_B, 'common');
    p.recompute();
  }

  buildBackground() {
    // 花园瓦片改为在 render() 中实时绘制（见 drawGardenTiles），无需预渲染整张大图。
    const data = this.gardenData;
    if (data && data.layers && data.layers.length) {
      this.bgHalf = (data.width * GARDEN_TILE) / 2;
    } else {
      this.bgHalf = WORLD_R;
    }
    this.bg = null;
  }

  _resize() {
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
  }

  toggleBag() {
    UI.setDexVisible(false);            // 同一时刻只允许一个窗口
    UI.setBagVisible(!UI.isBagVisible());
    if (UI.isBagVisible()) this.renderInventory();
  }

  // ---------- 主循环 ----------
  start() {
    const loop = (ts) => {
      const now = ts / 1000;
      let dt = now - (this.last || now);
      this.last = now;
      dt = Math.min(dt, 0.05);
      this.update(dt);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(dt) {
    const p = this.player;
    const dir = this._readDir();
    // 模式控制：空格 = mode1 -> reach（花瓣距离×2 + 生气眼），Shift = mode2 -> detect（距离×0.3 + 伤心眼）
    p.mode = this.keys['mode1'] ? 'reach' : (this.keys['mode2'] ? 'detect' : 'normal');
    p.update(dt, dir, this.map, this.mobs);   // 传入生物列表：花瓣会与生物碰撞

    // 卡片（拾取 / 入栏）——无战斗时已不掉落，但保留拖拽到世界时的回收
    for (const c of this.cards) {
      c.update(dt, p);
      if (!c.picked && dist2(c.x, c.y, p.x, p.y) < (p.r + 16) * (p.r + 16)) {
        if (this.pickupCard(c.type, c.rarity)) {
          c.picked = true;
          this.syncInventory();
        }
      }
    }
    this.cards = this.cards.filter(c => !c.done);

    // 粒子 / 伤害数字（保留基础设施，目前无战斗触发）
    for (const pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter(pt => pt.life > 0);
    for (const d of this.dmgTexts) d.update(dt);
    this.dmgTexts = this.dmgTexts.filter(d => d.life > 0);

    // 相机锁定玩家：主角永远固定在屏幕中心（地图相对滚动，手感不变；震动 shake 仍叠加）
    this.camera.x = p.x;
    this.camera.y = p.y;
    this.shake = Math.max(0, this.shake - dt * 30);

    this.updateHUD();
  }

  _readDir() {
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k['up']) dy -= 1;
    if (k['down']) dy += 1;
    if (k['left']) dx -= 1;
    if (k['right']) dx += 1;
    return { x: dx, y: dy };
  }



  spawnText(x, y, text, color) { this.dmgTexts.push(new DamageText(x, y, text, color)); }
  spawnParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) this.particles.push(new Particle(x, y, color));
  }

  // ---------- 渲染 ----------
  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);

    const camX = this.camera.x, camY = this.camera.y;
    let shx = 0, shy = 0;
    if (this.shake > 0) { shx = rand(-this.shake, this.shake); shy = rand(-this.shake, this.shake); }

    // 背景：先铺一层草地绿（屏幕空间），瓦片就绪后会在世界空间叠加其上。
    ctx.fillStyle = '#1ea761';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.save();
    ctx.translate(this.W / 2 - camX + shx, this.H / 2 - camY + shy);

    // 真实花园瓦片（实时、仅可见区域）
    if (this.gardenData && this.gardenData.layers.length) {
      try { drawGardenTiles(ctx, this.gardenData, camX, camY, this.W, this.H); }
      catch (e) { console.error('[drawGardenTiles]', e); }
    }

    // 先画卡片（地面），再按 y 排序画生物与玩家
    for (const c of this.cards) c.draw(ctx);
    const drawables = [];
    for (const m of this.mobs) drawables.push(m);
    if (!this.player.dead) drawables.push(this.player);
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) {
      try { d.draw(ctx); } catch (e) { console.error('[draw entity]', e); }
    }

    for (const pt of this.particles) pt.draw(ctx);
    for (const d of this.dmgTexts) d.draw(ctx);

    ctx.restore();

    this._drawMinimap();
  }

  _blitBG(left, top) {
    const ctx = this.ctx, half = this.bgHalf, full = this.bg.width;
    let sx = left + half, sy = top + half, sw = this.W, sh = this.H;
    let dx = left, dy = top;
    if (sx < 0) { dx -= sx; sw += sx; sx = 0; }
    if (sy < 0) { dy -= sy; sh += sy; sy = 0; }
    if (sx + sw > full) sw = full - sx;
    if (sy + sh > full) sh = full - sy;
    if (sw > 0 && sh > 0) ctx.drawImage(this.bg, sx, sy, sw, sh, dx, dy, sw, sh);
  }

  _drawMinimap() {
    const size = 160;
    const rect = { x: this.W - size - 12, y: 12, size };
    UI.drawMinimap(this.ctx, rect, this.map, this.player, this.mobs);
  }

  // ---------- HUD / 背包 ----------
  updateHUD() {
    UI.updateHUD(this.player);
  }

  // ---------- 图鉴 ----------
  recordDefeat(mobId, level) {
    if (!this.dex[mobId]) this.dex[mobId] = new Set();
    this.dex[mobId].add(level);
  }
  isDefeated(mobId, level) { return !!(this.dex[mobId] && this.dex[mobId].has(level)); }

  toggleDex() {
    UI.setBagVisible(false);            // 同一时刻只允许一个窗口
    UI.setDexVisible(!UI.isDexVisible());
    if (UI.isDexVisible()) UI.renderDex(this);
  }

  // 拖拽开始时关闭所有小窗口（背包/图鉴）
  closeAllWindows() {
    UI.setBagVisible(false);
    UI.setDexVisible(false);
  }

  // ---------- 物品栏模型 ----------
  firstEmptySlot() { return this.player.slots.findIndex(s => !s); }

  // 管理员画廊：把一张「新的」花瓣卡放入目标（物品栏 / 卡槽 / 背包 / 花朵）
  addGalleryCard(type, rarity, target) {
    const p = this.player;
    if (!target) return false;
    const card = { type, rarity, lunge: 0 };
    if (target.type === 'slot') {
      const old = p.slots[target.index];
      p.slots[target.index] = card;
      // 旧卡不吞掉：回背包画廊（数量 +1）并从卡槽位置播放飞回背包动画
      if (old) this._slotCardToBag(target.index, old, true);
      p.recompute(); this.renderInventory(); return true;
    }
    if (target.type === 'inv') {
      if (p.invBar.length < p.maxInvBar) { p.invBar.push(card); this.renderInventory(); return true; }
      return false;
    }
    if (target.type === 'bag') {
      if (addStack(p.backpack, card, p.maxBackpack)) { this.renderInventory(); return true; }
      return false;
    }
    if (target.type === 'flower') {
      const s = this.firstEmptySlot();
      if (s < 0) return false;
      p.slots[s] = card; p.recompute(); this.renderInventory(); return true;
    }
    return false;
  }
  // 卡槽里被替换下来的卡统一处理：回「背包画廊」(数量 +1)
  // animate=true 时额外从卡槽位置播放飞回背包动画（替换场景；点击卸下时幽灵已在飞，不重复播放）
  _slotCardToBag(slotIndex, card, animate) {
    if (typeof UI !== 'undefined' && UI.addGalleryCount) UI.addGalleryCount(card.type, card.rarity);
    if (animate && typeof UI !== 'undefined' && UI.flySlotCardToBag) UI.flySlotCardToBag(slotIndex, card);
    this.renderInventory();
  }

  // 拾取掉落：卡牌进入「背包」（=全部花瓣画廊 all petals），数量 +1；调试模式恒为 ∞
  // 背包就是 inventory 的 all-petals 部分，后续掉落直接累计到这里
  pickupCard(type, rarity) {
    if (typeof UI !== 'undefined' && UI.addGalleryCount) UI.addGalleryCount(type, rarity);
    return true;
  }

  moveInvToSlot(invIndex, slotIndex) {
    const p = this.player;
    if (invIndex < 0 || invIndex >= p.invBar.length) return false;
    const card = p.invBar[invIndex];
    const old = p.slots[slotIndex];
    p.slots[slotIndex] = card;
    p.invBar.splice(invIndex, 1);
    // 旧卡飞回背包（数量 +1），不被吞掉
    if (old) this._slotCardToBag(slotIndex, old, true);
    p.recompute(); this.renderInventory(); return true;
  }
  moveBagToSlot(bagIndex, slotIndex) {
    const p = this.player;
    const stack = p.backpack[bagIndex];
    if (!stack) return false;
    const card = { type: stack.type, rarity: stack.rarity };
    takeOne(p.backpack, bagIndex);              // 消耗一张，归零移除并补位
    const old = p.slots[slotIndex];
    p.slots[slotIndex] = card;
    // 旧卡飞回背包（数量 +1），不被吞掉
    if (old) this._slotCardToBag(slotIndex, old, true);
    p.recompute(); this.renderInventory(); return true;
  }
  moveBagToInv(bagIndex) {
    const p = this.player;
    if (p.invBar.length >= p.maxInvBar) return false;   // 物品栏无空槽 -> 无反应
    const stack = p.backpack[bagIndex];
    if (!stack) return false;
    p.invBar.push({ type: stack.type, rarity: stack.rarity });
    takeOne(p.backpack, bagIndex);
    this.renderInventory(); return true;
  }
  moveInvToInv(from, to) {
    const p = this.player;
    if (from === to) return false;
    if (from < 0 || from >= p.invBar.length) return false;
    const card = p.invBar.splice(from, 1)[0];
    let idx = (to < 0) ? p.invBar.length : Math.max(0, Math.min(to, p.invBar.length));
    p.invBar.splice(idx, 0, card);
    this.renderInventory(); return true;
  }
  moveInvToBag(invIndex) {
    const p = this.player;
    if (invIndex < 0 || invIndex >= p.invBar.length) return false;
    const card = p.invBar.splice(invIndex, 1)[0];
    if (!addStack(p.backpack, card, p.maxBackpack)) { p.invBar.push(card); return false; }
    this.renderInventory(); return true;
  }
  moveSlotToInv(slotIndex) {
    const p = this.player;
    const card = p.slots[slotIndex];
    if (!card) return false;
    p.slots[slotIndex] = null;
    p.recompute();
    // 卸下回"背包画廊"（_gc）：该卡会在背包窗口重新出现，而不是丢进未渲染的物品栏被吞掉
    // 点击卸下时拖拽幽灵已在飞回背包，故 animate=false 避免重复播放动画
    this._slotCardToBag(slotIndex, card, false);
    this.renderInventory(); return true;
  }
  moveSlotToSlot(from, to) {
    const p = this.player;
    // 拖回原卡槽：数据本来就没变，但卡面在按下时被 visibility:hidden 了，
    // 必须重渲染让卡面重新出现，否则看起来"卡消失了"（要等下一次刷新才显示）。
    if (from === to) { this.renderInventory(); return true; }
    const a = p.slots[from], b = p.slots[to];
    p.slots[from] = b; p.slots[to] = a;
    p.recompute(); this.renderInventory(); return true;
  }
  equipFirstEmptyFromInv(invIndex) {
    const s = this.firstEmptySlot();
    if (s < 0) return false;
    return this.moveInvToSlot(invIndex, s);
  }
  equipFirstEmptyFromBag(bagIndex) {
    const s = this.firstEmptySlot();
    if (s < 0) return false;
    return this.moveBagToSlot(bagIndex, s);
  }

  // 拖拽落点分发
  dispatchDrop(drag, target) {
    const from = drag.from;
    if (!from) return false;
    if (!target) {
      // 拖到空白处：背包卡留在背包（回退）；卡槽卡卸下回背包
      if (from.type === 'slot') return this.moveSlotToInv(from.index);
      return false;
    }
    if (from.type === 'gallery') return this.addGalleryCard(drag.card.type, drag.card.rarity, target);
    if (target.type === 'slot') {
      if (from.type === 'inv') return this.moveInvToSlot(from.index, target.index);
      if (from.type === 'bag') return this.moveBagToSlot(from.index, target.index);
      if (from.type === 'slot') return this.moveSlotToSlot(from.index, target.index);
    }
    if (target.type === 'inv') {
      if (from.type === 'inv') return this.moveInvToInv(from.index, target.index);
      if (from.type === 'bag') return this.moveBagToInv(from.index);
      if (from.type === 'slot') return this.moveSlotToInv(from.index);
    }
    if (target.type === 'bag') {
      if (from.type === 'inv') return this.moveInvToBag(from.index);
      if (from.type === 'slot') return this.moveSlotToInv(from.index);
    }
    if (target.type === 'flower') {
      if (from.type === 'inv') return this.equipFirstEmptyFromInv(from.index);
      if (from.type === 'bag') return this.equipFirstEmptyFromBag(from.index);
      if (from.type === 'slot') return this.moveSlotToInv(from.index);
    }
    return false;
  }

  // ---------- HUD / 背包 ----------
  updateHUD() { UI.updateHUD(this.player); }

  syncInventory() {
    UI.renderInvBar(this.player);
    if (UI.isBagVisible()) this.renderInventory();
    if (UI.isDexVisible && UI.isDexVisible()) UI.renderDex(this);
  }

  renderInventory() {
    UI.renderInvBar(this.player);
    UI.renderInventory(this.player);
  }
}

function makePetal(typeKey, rarity) {
  const type = PETAL_TYPES.find(t => t.key === typeKey) || PETAL_TYPES[0];
  // 应用稀有度倍率（仅Basic有rarityMultipliers表）
  let dmg = type.dmg, hp = type.hp;
  if (type.rarityMultipliers && type.rarityMultipliers[rarity]) {
    const mult = type.rarityMultipliers[rarity];
    dmg = type.dmg * (mult.dmg || 1);
    hp = type.hp * (mult.hp || 1);
  }
  return { type, rarity, lunge: 0, dmg, hp };
}
