// game.js — 核心循环与系统编排
'use strict';

const WORLD_R = 1500;

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
    this.spawnTimer = 0;
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

    // 输入
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = true;
      if (k === 'b' || k === 'tab') { e.preventDefault(); this.toggleBag(); }
      if (k === 'v') { e.preventDefault(); this.toggleDex(); }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });

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
    UI.onDrop = (drag, target) => this.dispatchDrop(drag, target);

    // 玩家与初始装备
    this.player = new Player();
    this._resetPlayer(true);
    this.camera.x = this.player.x; this.camera.y = this.player.y;

    this.buildBackground();
    this._spawnInitial();
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

  _spawnInitial() {
    for (let i = 0; i < 12; i++) {
      const [x, y] = this.map.spawnPointAwayFrom(this.player.x, this.player.y, 320 * SPEED_SCALE);
      this.mobs.push(new Mob(rollMobType(1), x, y, 1));
    }
  }

  _resize() {
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
  }

  toggleBag() {
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
    if (p.dead) {
      p.update(dt, { x: 0, y: 0 }, this.map);
      if (p.deathTimer > 2.4) this._respawn();
    } else {
      const dir = this._readDir();
      p.update(dt, dir, this.map);
    }

    // 生物
    for (const m of this.mobs) m.update(dt, p, this.map);

    // 刷怪
    this._spawn(dt);

    // 战斗
    this._combat(dt);

    // 卡片
    for (const c of this.cards) {
      c.update(dt, p);
      if (!c.picked && dist2(c.x, c.y, p.x, p.y) < (p.r + 16) * (p.r + 16)) {
        const acc = this.pickupCard(c.type, c.rarity);
        if (acc) {
          c.picked = true;
          this.spawnText(p.x, p.y - p.r - 12, '+' + c.type.name, '#9effa0');
          this.syncInventory();
        }
      }
    }
    this.cards = this.cards.filter(c => !c.done);

    // 粒子 / 伤害数字
    for (const pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter(pt => pt.life > 0);
    for (const d of this.dmgTexts) d.update(dt);
    this.dmgTexts = this.dmgTexts.filter(d => d.life > 0);

    // 清理死亡生物
    this.mobs = this.mobs.filter(m => !(m.dead && m.deathTimer > 0.5));

    // 相机
    this.camera.x = damp(this.camera.x, p.x, 8, dt);
    this.camera.y = damp(this.camera.y, p.y, 8, dt);
    this.shake = Math.max(0, this.shake - dt * 30);

    this.updateHUD();
  }

  _readDir() {
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k['w'] || k['arrowup']) dy -= 1;
    if (k['s'] || k['arrowdown']) dy += 1;
    if (k['a'] || k['arrowleft']) dx -= 1;
    if (k['d'] || k['arrowright']) dx += 1;
    return { x: dx, y: dy };
  }

  _mobLevel() {
    return clamp(1 + Math.floor(this.player.level / 3) + randInt(0, 1), 1, 9);
  }

  _spawn(dt) {
    this.spawnTimer -= dt;
    const target = Math.min(26, 10 + Math.floor(this.player.level * 1.4));
    const alive = this.mobs.filter(m => !m.dead).length;
    if (this.spawnTimer <= 0 && alive < target) {
      this.spawnTimer = 0.9;
      const [x, y] = this.map.spawnPointAwayFrom(this.player.x, this.player.y, 360 * SPEED_SCALE);
      this.mobs.push(new Mob(rollMobType(this.player.level), x, y, this._mobLevel()));
    }
  }

  _combat(dt) {
    const p = this.player;
    if (p.dead) return;

    // 花瓣 -> 生物
    if (p.damage > 0) {
      for (const m of this.mobs) {
        if (m.dead) continue;
        let hit = false;
        for (const pp of p.petalWorld) {
          if (dist2(pp.x, pp.y, m.x, m.y) < (pp.r + m.r) * (pp.r + m.r)) { hit = true; break; }
        }
        if (hit && m.hitCd <= 0) {
          m.hp -= p.damage; m.hitCd = 0.42; m.flash = 0.14; m.squash = 0.5;
          const a = angleTo(p.x, p.y, m.x, m.y);
          m.vx += Math.cos(a) * 130; m.vy += Math.sin(a) * 130;
          for (const s of p.slots) if (s) s.lunge = 0.16;
          this.spawnText(m.x, m.y - m.r, String(Math.round(p.damage)), '#ffffff');
          if (m.hp <= 0) this._killMob(m);
        }
      }
    }

    // 生物 -> 玩家
    for (const m of this.mobs) {
      if (m.dead) continue;
      if (dist2(m.x, m.y, p.x, p.y) < (m.r + p.r * 0.8) * (m.r + p.r * 0.8)) {
        if (p.invuln <= 0) {
          const a = angleTo(m.x, m.y, p.x, p.y);
          p.hp -= m.dmg; p.invuln = 0.6; p.flash = 0.18; this.shake = 9;
          p.vx += Math.cos(a) * 200; p.vy += Math.sin(a) * 200;
          this.spawnText(p.x, p.y - p.r - 6, '-' + Math.round(m.dmg), '#ff6b6b');
          if (p.hp <= 0) this._killPlayer();
        }
      }
    }
  }

  _killMob(m) {
    if (m.dead) return;
    m.dead = true; m.deathTimer = 0;
    this.recordDefeat(m.type.id, m.level);
    this.spawnParticles(m.x, m.y, m.color, m.boss ? 18 : 8);
    this.player.gainXp(m.xpVal);
    const drops = m.boss ? 3 : 1;
    for (let i = 0; i < drops; i++) {
      const drop = rollDrop(m);
      const card = new Card(m.x + rand(-22, 22), m.y + rand(-22, 22), drop.type, drop.rarity);
      this.cards.push(card);
    }
    this.syncInventory();
  }

  _killPlayer() {
    const p = this.player;
    if (p.dead) return;
    p.dead = true; p.deathTimer = 0;
    // 掉落已装备的花瓣
    for (const s of p.slots) {
      if (s) this.cards.push(new Card(p.x + rand(-30, 30), p.y + rand(-30, 30), s.type, s.rarity));
    }
    p.slots = [null, null, null, null, null]; p.recompute();
    UI.showDeath();
    this.syncInventory();
  }

  _respawn() {
    this._resetPlayer(false);
    UI.hideDeath();
    this.camera.x = this.player.x; this.camera.y = this.player.y;
    this.updateHUD();
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
    UI.setDexVisible(!UI.isDexVisible());
    if (UI.isDexVisible()) UI.renderDex(this);
  }

  // ---------- 物品栏模型 ----------
  firstEmptySlot() { return this.player.slots.findIndex(s => !s); }

  // 拾取卡片：优先进物品栏，其次进背包；物品栏满则挤掉最旧的一张
  pickupCard(type, rarity) {
    const p = this.player;
    if (p.invBar.length < p.maxInvBar) { p.invBar.push({ type, rarity }); return true; }
    if (p.backpack.length < p.maxBackpack) { p.backpack.push({ type, rarity }); return true; }
    const squeezed = p.invBar.shift();          // 挤掉：顶出最左（最早）一张
    p.invBar.push({ type, rarity });
    if (squeezed) {
      if (p.backpack.length < p.maxBackpack) p.backpack.push(squeezed);
      else this.cards.push(new Card(p.x + rand(-30, 30), p.y + rand(-30, 30), squeezed.type, squeezed.rarity));
    }
    return true;
  }

  moveInvToSlot(invIndex, slotIndex) {
    const p = this.player;
    if (invIndex < 0 || invIndex >= p.invBar.length) return false;
    const card = p.invBar[invIndex];
    const old = p.slots[slotIndex];
    p.slots[slotIndex] = card;
    p.invBar.splice(invIndex, 1);
    if (old) { if (p.invBar.length < p.maxInvBar) p.invBar.push(old); else p.backpack.push(old); }
    p.recompute(); this.renderInventory(); return true;
  }
  moveBagToSlot(bagIndex, slotIndex) {
    const p = this.player;
    if (bagIndex < 0 || bagIndex >= p.backpack.length) return false;
    const card = p.backpack[bagIndex];
    const old = p.slots[slotIndex];
    p.slots[slotIndex] = card;
    p.backpack.splice(bagIndex, 1);
    if (old) { if (p.invBar.length < p.maxInvBar) p.invBar.push(old); else p.backpack.push(old); }
    p.recompute(); this.renderInventory(); return true;
  }
  moveBagToInv(bagIndex) {
    const p = this.player;
    if (p.invBar.length >= p.maxInvBar) return false;   // 物品栏无空槽 -> 无反应
    if (bagIndex < 0 || bagIndex >= p.backpack.length) return false;
    const card = p.backpack.splice(bagIndex, 1)[0];
    p.invBar.push(card);
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
    if (p.backpack.length >= p.maxBackpack) return false;
    if (invIndex < 0 || invIndex >= p.invBar.length) return false;
    const card = p.invBar.splice(invIndex, 1)[0];
    p.backpack.push(card);
    this.renderInventory(); return true;
  }
  moveSlotToInv(slotIndex) {
    const p = this.player;
    const card = p.slots[slotIndex];
    if (!card) return false;
    if (p.invBar.length < p.maxInvBar) p.invBar.push(card);
    else if (p.backpack.length < p.maxBackpack) p.backpack.push(card);
    else { this.cards.push(new Card(p.x + rand(-30, 30), p.y + rand(-30, 30), card.type, card.rarity)); }
    p.slots[slotIndex] = null; p.recompute(); this.renderInventory(); return true;
  }
  moveSlotToSlot(from, to) {
    const p = this.player;
    if (from === to) return false;
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
    if (!target || !from) return false;
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
  return { type, rarity, lunge: 0 };
}
