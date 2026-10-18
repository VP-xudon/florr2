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
      if (k === 'b' || k === 'z' || k === 'tab') { e.preventDefault(); this.toggleBag(); }
      if (k === 'v') { e.preventDefault(); this.toggleDex(); }
      if (k === 'r') { e.preventDefault(); this.swapSlotRows(); }
      if (k === 'm') { e.preventDefault(); if (UI.cycleMinimapMode) UI.cycleMinimapMode(); }
      const d = '1234567890'.indexOf(e.key);   // 1-9 -> 第1~9槽，0 -> 第10槽
      if (d >= 0) { e.preventDefault(); this.swapSlotColumn(d); }
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
    UI.onSlotClick = (i) => this.swapSlotColumn(i);         // 点击主槽卡 -> 与副槽同列互换（不再飞回背包）
    UI.onInvBarClick = (i) => this.equipFirstEmptyFromInv(i); // 点击物品栏卡 -> 装备到花朵
    UI.onSubClick = (i) => this.swapSlotColumn(i);          // 点击副槽卡 -> 与主槽同列互换
    UI.onBagCardClick = (i) => this.moveBagToInv(i);        // 点击背包卡 -> 进物品栏（无空槽则无反应）
    UI.onGalleryCardClick = (card, target) => {            // 点击画廊卡 -> 装备到空槽（含副槽）；满槽无反应
      // target 由 UI 的飞行动画预先确定并回传（保证"飞向哪格就装进哪格"）；
      // 没有回传时才现场检索：主槽优先、从左到右，主槽满则副槽。
      const t = target || this.firstEmptyAny();
      if (!t) return false;
      // 注意字段名：firstEmptyAny() 给的是 {row,index}，而 addGalleryCard/dispatchDrop 认的是
      // {type,index}。不归一化的话 target.type 为 undefined，会穿过所有分支返回 false ——
      // 表现就是"卡飞进空槽后消失被吞、槽位却仍然空着，还能继续放、继续吞"。
      return this.addGalleryCard(card.type, card.rarity, t.type ? t : { type: t.row, index: t.index });
    };
    UI.onCloseAll = () => this.closeAllWindows();
    UI.onDrop = (drag, target) => this.dispatchDrop(drag, target);
    UI.onRespawn = () => this.respawn();   // 死亡界面 Continue 按钮 -> 重生

    // 玩家与初始装备
    this.player = new Player();
    this._resetPlayer(true);
    // 调试参数 ?hp=N（可与 mode/lang 逗号混搭）：直接设定人物血量上限与当前血量。
    // 必须在 _resetPlayer/recompute 之后应用，避免被覆盖；非法值（非正数）忽略。
    const hpParam = parseFloat(window.__queryParams && window.__queryParams.hp);
    if (hpParam > 0) {
      this.player.maxHp = hpParam;
      this.player.hp = hpParam;
      this.player.dispHp = hpParam; this.player.ghostHp = hpParam; this.player.ghostV = 0;
    }
    this.camera.x = this.player.x; this.camera.y = this.player.y;
    this._spawnStarterMobs();          // 出生点附近的初始生物

    this.buildBackground();
    this.updateHUD();
  }

  // 初始生物：在玩家出生点附近生成 3 只 Ladybug（common / legendary / super）。
  // 目前只做「实体 + 随机游走 + 名牌」，还没有伤害，所以不做仇恨与实体碰撞。
  _spawnStarterMobs() {
    const type = MOB_BY_ID[STARTER_MOB_ID] || null;
    if (!type) return;
    this.mobs = [];
    for (let i = 0; i < STARTER_MOB_RARITIES.length; i++) {
      const rarity = STARTER_MOB_RARITIES[i];
      const m = new Mob(type, 0, 0, 1, rarity);
      // 距离按体型加成：高稀有度直径可能是主角的 4~8 倍，放太近会直接盖住出生点，
      // 所以基础半径之外再各自让开半个身位（整体仍在"不远处"）。
      const d = STARTER_MOB_RADIUS + m.r * 0.9;
      // 几个方向均匀铺开（再各自带一点抖动），彼此间隔适中
      const a = (i / STARTER_MOB_RARITIES.length) * TAU + rand(-0.35, 0.35);
      m.x = this.player.x + Math.cos(a) * d;
      m.y = this.player.y + Math.sin(a) * d;
      this.mobs.push(m);
    }
  }

  _resetPlayer(full) {
    const p = this.player;
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
    p.hp = p.maxHp = 100; p.xp = 0; p.level = 1; p.xpNext = 24;
    p.dead = false; p.deathTimer = 0; p.invuln = 0; p.flash = 0;
    p.slots = emptySlots();
    p.subSlots = emptySlots();
    p.dispHp = null; p.ghostHp = null; p.ghostV = 0;   // 血条平滑值重置（update 中重新对齐）
    p.invBar = full ? [] : p.invBar;
    p.backpack = full ? [] : p.backpack;
    // 初始花瓣：基础 + 攻击型
    p.slots[0] = makePetal(STARTER_PETAL_A, 'common');
    p.slots[1] = makePetal(STARTER_PETAL_B, 'common');
    p.recompute();
  }

  // 重生：死亡界面 Continue 按钮触发。与 _resetPlayer 的关键区别：
  // 【死亡不会导致花瓣消失】—— slots/subSlots/invBar/backpack/xp/level 全保留，
  // 只重置生命状态并让所有花瓣重新装填（reload 从头结算，出场自带渐显+Q 弹）。
  respawn() {
    const p = this.player;
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;         // 重生点
    p.hp = p.maxHp;
    p.dead = false; p.deathTimer = 0;
    p.invuln = 2;                                  // 2s 无敌：起身缓冲
    p.hurtT = 0; p.flash = 0; p.killedBy = null;
    p.age = 0;                                     // 本体 Q 弹重生（spawnPop）
    p.dispHp = p.hp; p.ghostHp = p.hp; p.ghostV = 0;
    p.petalGhosts = [];                            // 死亡时的退场幽灵早已播完，兜底清空
    // 所有花瓣重新装填：reload 各槽从头结算
    for (let i = 0; i < p.slots.length; i++) {
      const c = p.slots[i];
      p.reloadHold[i] = false;
      p.reload[i] = c
        ? { card: c, age: 0, dur: (c.type.reload != null) ? c.type.reload : Math.max(0, c.type.spd || 0) }
        : null;
    }
    this._deathShown = false;
    this.camera.x = 0; this.camera.y = 0;
    this.updateHUD();
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

    // 生物：推进 AI / 动画计时，并回收退场结束的个体。
    // 【必须更新】否则 Mob.age 永远是 0 -> spawnFade(0)=0 -> 本体以全透明绘制，
    // 看起来就是"只有血条和名字、没有生物本体"。
    for (const m of this.mobs) m.update(dt, p, this.map);
    this.mobs = this.mobs.filter((m) => !(m.dead && m.deathTimer > FADE_T));

    // 敌对实体伤害数字：0.12s 聚合窗口到期就把累计伤害一次性弹出（精确到个位）
    for (const m of this.mobs) {
      if (m.dmgTextT > 0) { m.dmgTextT = Math.max(0, m.dmgTextT - dt); continue; }
      if (m.pendDmg > 0) {
        this.spawnText(m.x + rand(-m.r * 0.2, m.r * 0.2), m.y - m.r * 0.5,
          String(Math.round(m.pendDmg)), '#ff4040');
        m.pendDmg = 0;
      }
    }

    // 玩家 vs 昆虫碰撞：把玩家挤出生物的精确外观碰撞（掩码网格）。
    // 网格未就绪或中心陷入实心推不出时，退回圆形互斥。
    if (!p.dead) {
      for (const m of this.mobs) {
        if (m.dead) continue;
        const rr = p.r + m.r;
        if (dist2(p.x, p.y, m.x, m.y) > rr * rr) continue;
        let fixed = circleVsMob(m, p.x, p.y, p.r);
        if (!fixed && mobMaskHit(m, p.x, p.y, p.r)) {
          const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1;
          fixed = { x: m.x + dx / d * rr, y: m.y + dy / d * rr };
        }
        if (fixed) { p.x = fixed.x; p.y = fixed.y; }
      }
    }

    // 战斗结算：25 tick/s 固定步长，每 tick 对所有接触中的敌对实体双向扣血
    this.combatAcc = (this.combatAcc || 0) + dt;
    while (this.combatAcc >= 1 / 25) {
      this.combatAcc -= 1 / 25;
      this._combatTick();
    }

    // 死亡检测：弹出死亡界面（只弹一次，重生时复位）
    if (p.dead && !this._deathShown) {
      this._deathShown = true;
      UI.showDeathScreen(p.killedBy);
    }

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

    // 相机：默认锁定玩家（主角固定在屏幕中心）。
    // 但走到地图边缘时【不再让视角越界】，而是把相机夹住 —— 环境停住、人物继续走动，
    // 这样屏幕上永远不会出现地图之外的部分（与一档小地图贴边时的行为一致）。
    // 视图比整张地图还大时（窗口很大 / 地图很小）夹紧区间退化为一个点，相机停在地图中心。
    const half = this.map.R || (this.map.width * (this.map.tile || 1)) / 2;
    const hw = Math.min(this.W / 2, half), hh = Math.min(this.H / 2, half);
    this.camera.x = clamp(p.x, -half + hw, half - hw);
    this.camera.y = clamp(p.y, -half + hh, half - hh);
    this.shake = Math.max(0, this.shake - dt * 30);

    this.updateHUD();
  }

  // ---------------- 战斗结算（25 tick/s 固定步长） ----------------
  // 阵营：花朵本体 + 花瓣 vs 全部昆虫/生物。
  // 每 tick：两个敌对实体接触时，双方【同时】各扣 max(对方攻击 - 己方护甲, 0) 点血。
  _combatTick() {
    const p = this.player;
    for (const m of this.mobs) {
      if (m.dead) continue;
      // —— 花瓣 vs 昆虫（接触用精确外观掩码，网格未就绪退回圆形） ——
      for (const b of p.petals) {
        if (b.dead || b.fxNoCombat) continue;     // 已被打碎等幽灵 / 特效进行中（如玫瑰治疗）不参战
        const rr = PETAL_R + m.r;
        const touch = mobMaskHit(m, b.x, b.y, PETAL_R)
          || dist2(b.x, b.y, m.x, m.y) < rr * rr;
        if (!touch) continue;
        const st = petalStatsFor(b.card.type, b.card.rarity);   // 按稀有度取攻/血
        if (b.hp == null) { b.hp = b.maxHp = (st.hp || 30); }   // 兜底初始化
        const toPetal = Math.max((m.dmg || 0) - 0, 0);          // 花瓣护甲按 0
        const toMob = Math.max((st.dmg || 0) - (m.armor || 0), 0);
        if (toPetal > 0) { b.hp -= toPetal; b.hurtT = 0.3; }
        // 花瓣造成的伤害统一记到玩家头上（src 传 p）
        if (toMob > 0) {
          m.pendDmg = (m.pendDmg || 0) + toMob;
          if (!(m.dmgTextT > 0)) m.dmgTextT = 0.12;
          if (m.hurt(toMob, p)) this._onMobKilled(m);
        }
        if (b.hp <= 0) { this._destroyPetal(b); break; }
        if (m.dead) break;
      }
      if (m.dead || p.dead) continue;
      // —— 花朵本体 vs 昆虫 ——
      // 玩家常被推出到与昆虫恰好相切：严格 < 会漏判（表现为"贴着但不掉血"），
      // 所以接触判定带 +1 epsilon，同样优先用外观掩码。
      const rr2 = p.r + m.r;
      const touch = mobMaskHit(m, p.x, p.y, p.r + 1)
        || dist2(p.x, p.y, m.x, m.y) < (rr2 + 1) * (rr2 + 1);
      if (touch) {
        const toMob = Math.max((p.bodyDmg || 0) - (m.armor || 0), 0);
        const toFlower = Math.max((m.dmg || 0) - (p.armor || 0), 0);
        if (toMob > 0) {
          m.pendDmg = (m.pendDmg || 0) + toMob;
          if (!(m.dmgTextT > 0)) m.dmgTextT = 0.12;
          if (m.hurt(toMob, p)) this._onMobKilled(m);
        }
        if (toFlower > 0) p.hurt(toFlower, m);   // 传 m：死亡时记录死因（生物名称）
      }
    }
    // —— 昆虫与昆虫之间的互斥碰撞（圆形，成对推开各半）——
    const ms = this.mobs;
    for (let i = 0; i < ms.length; i++) {
      const a = ms[i]; if (a.dead) continue;
      for (let j = i + 1; j < ms.length; j++) {
        const b = ms[j]; if (b.dead) continue;
        const rr = a.r + b.r;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dd = dx * dx + dy * dy;
        if (dd >= rr * rr || dd <= 0) continue;
        const d = Math.sqrt(dd), push = (rr - d) / 2;
        const ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
      }
    }
  }

  // 花瓣被打碎：卡片保持装备，该槽【重新结算装填冷却】——装填完成后花瓣带着
  // 满血重新生成（渐显）。本体不在这里移除：只打 dead 标记，下一帧 _syncPetals
  // 的差分会把它转成退场幽灵（原地放大渐隐），保证消失渐隐与全体实体统一。
  _destroyPetal(b) {
    if (b.dead) return;
    b.dead = true;
    const p = this.player;
    const c = p.slots[b.slotIndex];
    if (c === b.card) {
      const dur = (c.type.reload != null) ? c.type.reload : Math.max(0, c.type.spd || 0);
      p.reload[b.slotIndex] = { card: c, age: 0, dur };
    }
  }

  // 昆虫死亡落地：记入图鉴（退场放大渐隐动画由 Mob.draw 负责）
  _onMobKilled(m) {
    this.recordDefeat(m.type.id != null ? m.type.id : m.name, m.level);
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
    // 玩家死亡也照画：Player.draw 的 dead 分支会画尸体（原地 X 眼+哭脸，保留到重生）
    drawables.push(this.player);
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
    UI.drawMinimap(this.ctx, this.W, this.H, this.map, this.player, this.mobs);
  }

  // ---------- HUD / 背包 ----------
  updateHUD() {
    UI.updateHUD(this.player);
    // 卡槽"水缸"阴影已改由 ui.js _reloadTick 在卡牌 canvas 内驱动，HUD 无需再推
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
  // 空槽计算包含副槽：主槽满则落到副槽（临时存储）
  firstEmptyAny() {
    const p = this.player;
    const s = p.slots.findIndex(x => !x);
    if (s >= 0) return { row: 'slot', index: s };
    const t = p.subSlots.findIndex(x => !x);
    if (t >= 0) return { row: 'subslot', index: t };
    return null;
  }

  // R 键：整排互换主槽 / 副槽（显式垂直交换动画，只动被交换的卡）
  swapSlotRows() {
    const p = this.player;
    const t = p.slots; p.slots = p.subSlots; p.subSlots = t;
    p.recompute(); this.renderInventory();
    if (typeof UI !== 'undefined' && UI.animateRowSwap) UI.animateRowSwap(null);
    return true;
  }
  // 数字键 / 点击副槽：单列互换（主槽 i <-> 副槽 i）
  swapSlotColumn(i) {
    const p = this.player;
    if (i < 0 || i >= p.slots.length) return false;
    const t = p.slots[i]; p.slots[i] = p.subSlots[i]; p.subSlots[i] = t;
    p.recompute(); this.renderInventory();
    if (typeof UI !== 'undefined' && UI.animateRowSwap) UI.animateRowSwap([i]);
    return true;
  }
  // 任意主槽/副槽位置互换（拖拽跨行）
  moveSlotCard(mainIndex, subIndex) {
    const p = this.player;
    if (mainIndex < 0 || mainIndex >= p.slots.length) return false;
    if (subIndex < 0 || subIndex >= p.subSlots.length) return false;
    const t = p.slots[mainIndex]; p.slots[mainIndex] = p.subSlots[subIndex]; p.subSlots[subIndex] = t;
    p.recompute(); this.renderInventory(); return true;
  }
  moveInvToSub(invIndex, subIndex) {
    const p = this.player;
    if (invIndex < 0 || invIndex >= p.invBar.length) return false;
    if (subIndex < 0 || subIndex >= p.subSlots.length) return false;
    const card = p.invBar[invIndex];
    const old = p.subSlots[subIndex];
    p.subSlots[subIndex] = card;
    p.invBar.splice(invIndex, 1);
    if (old) this._slotCardToBag(subIndex, old, false, 'sub');
    this.renderInventory(); return true;
  }
  moveBagToSub(bagIndex, subIndex) {
    const p = this.player;
    if (subIndex < 0 || subIndex >= p.subSlots.length) return false;
    const stack = p.backpack[bagIndex];
    if (!stack) return false;
    const card = { type: stack.type, rarity: stack.rarity };
    takeOne(p.backpack, bagIndex);
    const old = p.subSlots[subIndex];
    p.subSlots[subIndex] = card;
    if (old) this._slotCardToBag(subIndex, old, false, 'sub');
    this.renderInventory(); return true;
  }
  moveSubToSub(from, to) {
    const p = this.player;
    if (from === to) { this.renderInventory(); return true; }
    if (from < 0 || from >= p.subSlots.length || to < 0 || to >= p.subSlots.length) return false;
    const a = p.subSlots[from], b = p.subSlots[to];
    p.subSlots[from] = b; p.subSlots[to] = a;
    this.renderInventory(); return true;
  }
  moveSubToBag(subIndex) {
    const p = this.player;
    if (subIndex < 0 || subIndex >= p.subSlots.length) return false;
    const card = p.subSlots[subIndex];
    if (!card) return false;
    p.subSlots[subIndex] = null;
    this._slotCardToBag(subIndex, card, false);
    this.renderInventory(); return true;
  }

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
    if (target.type === 'subslot') {
      const old = p.subSlots[target.index];
      p.subSlots[target.index] = card;
      // 旧卡不吞掉：回背包画廊（数量 +1）；副槽替换不播飞回动画（避免误导性的"飞回去"）
      if (old) this._slotCardToBag(target.index, old, false, 'sub');
      this.renderInventory(); return true;   // 副槽不参与装备，无需 recompute
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
  _slotCardToBag(slotIndex, card, animate, row) {
    if (typeof UI !== 'undefined' && UI.addGalleryCount) UI.addGalleryCount(card.type, card.rarity);
    if (animate && typeof UI !== 'undefined' && UI.flySlotCardToBag) UI.flySlotCardToBag(slotIndex, card, row);
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
    const t = this.firstEmptyAny();
    if (!t) return false;
    return (t.row === 'slot') ? this.moveInvToSlot(invIndex, t.index)
                              : this.moveInvToSub(invIndex, t.index);
  }
  equipFirstEmptyFromBag(bagIndex) {
    const t = this.firstEmptyAny();
    if (!t) return false;
    return (t.row === 'slot') ? this.moveBagToSlot(bagIndex, t.index)
                              : this.moveBagToSub(bagIndex, t.index);
  }

  // 拖拽落点分发
  dispatchDrop(drag, target) {
    const from = drag.from;
    if (!from) return false;
    if (!target) {
      // 拖到空白处：卡槽卡 / 副槽卡都卸下回背包画廊；背包卡留在背包（回退）
      // 早先这里漏了 subslot 分支 -> 副槽卡拖到空白处毫无反应，表现为"无法从副槽拖出花瓣"
      if (from.type === 'slot') return this.moveSlotToInv(from.index);
      if (from.type === 'subslot') return this.moveSubToBag(from.index);
      return false;
    }
    if (from.type === 'gallery') return this.addGalleryCard(drag.card.type, drag.card.rarity, target);
    if (target.type === 'slot') {
      if (from.type === 'inv') return this.moveInvToSlot(from.index, target.index);
      if (from.type === 'bag') return this.moveBagToSlot(from.index, target.index);
      if (from.type === 'slot') return this.moveSlotToSlot(from.index, target.index);
      if (from.type === 'subslot') return this.moveSlotCard(target.index, from.index);
    }
    if (target.type === 'subslot') {
      if (from.type === 'inv') return this.moveInvToSub(from.index, target.index);
      if (from.type === 'bag') return this.moveBagToSub(from.index, target.index);
      if (from.type === 'slot') return this.moveSlotCard(from.index, target.index);
      if (from.type === 'subslot') return this.moveSubToSub(from.index, target.index);
    }
    if (target.type === 'inv') {
      if (from.type === 'inv') return this.moveInvToInv(from.index, target.index);
      if (from.type === 'bag') return this.moveBagToInv(from.index);
      if (from.type === 'slot') return this.moveSlotToInv(from.index);
    }
    if (target.type === 'bag') {
      if (from.type === 'inv') return this.moveInvToBag(from.index);
      if (from.type === 'slot') return this.moveSlotToInv(from.index);
      if (from.type === 'subslot') return this.moveSubToBag(from.index);   // 副槽也能拖回背包
    }
    if (target.type === 'flower') {
      if (from.type === 'inv') return this.equipFirstEmptyFromInv(from.index);
      if (from.type === 'bag') return this.equipFirstEmptyFromBag(from.index);
      if (from.type === 'slot') return this.moveSlotToInv(from.index);
    }
    return false;
  }

  // ---------- HUD / 背包 ----------
  // （注意：这里【不能】再定义第二个 updateHUD —— 类内后定义的会覆盖前面的，
  //  曾导致带 updatePetalShadows 的版本被顶掉、卡槽水缸阴影永远 0% 看不见。）

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
