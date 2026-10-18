// entities.js — 实体（玩家/生物/卡片/粒子/伤害数字）与绘制辅助
'use strict';

// 世界放大后（瓦片 24→384），移动速度按相同比例放大，保持手感一致。
const SPEED_SCALE = 5;

// 花瓣物理参数
// 采用「欠阻尼弹簧」：加速度 = K·(目标-位置) - D·速度
//   · 回复力与距离成正比、速度无上限 —— 越远拉得越快，磁力吸附感
//   · 稳态跟随滞后 = v·D/K（与旧一阶逼近 v/PETAL_RATE 相同，奔跑观感不变）
//   · 轻微欠阻尼：模式切换/急转向时花瓣先甩出一小段惯性再收敛，绝不瞬移
const PETAL_SPRING_K  = 250;    // 回复刚度(1/s²)：越大吸附越干脆
const PETAL_SPRING_D  = 15.2;   // 阻尼(1/s)：D/K ≈ 0.06s，几乎跟手；ζ≈0.48 回弹明显可见
const PETAL_MAX_SPEED = 2600;   // 安全速度上限（正常游玩永远碰不到，仅防积分爆炸）
const PETAL_DETECT    = 0.5;    // detect 模式收缩系数：轨道半径 ×0.5
const PETAL_REACH    = 2;     // 花瓣中点到主角边缘的距离 = 主角直径(2r) -> reach = r + 2r
const PETAL_R        = 14 * 0.9;  // 12.6：花瓣碰撞半径缩至原 0.9
const PETAL_SPIN     = 1.375 * 2; // 2.75：默认花瓣转速 2 倍

// 通用出场 / 退场动画（所有实体统一遵守，时长 0.5s）
//   出场：大小不变，仅渐显
//   退场（死亡 / 被删除 / 卸下）：平滑放大到 1.5 倍，同时渐隐
const FADE_T      = 0.1;
const DEATH_SCALE = 1.5;
// 卸下/被打碎的花瓣退场时长：与全体实体统一的 0.1s 快速渐隐。
const PETAL_GHOST_T = 0.1;
function spawnFade(age) { return clamp(age / FADE_T, 0, 1); }                 // 出场：0 -> 1 的 alpha
// Q 弹出场：easeOutBack 缩放曲线 —— 从小弹出、过冲到 ~1.1 再落回 1，配合 0.1s 时长很有弹性
function spawnPop(age) {
  const t = clamp(age / FADE_T, 0, 1);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function deathFade(t01) { return { scale: 1 + (DEATH_SCALE - 1) * t01, alpha: 1 - t01 }; }

// 血条颜色：绿 -> 红【连续】hue 插值（替代旧的绿/黄/红三档跳变），满血绿、空血红。
function hpBarColor(ratio) {
  const r = clamp(ratio, 0, 1);
  return 'hsl(' + (110 * r).toFixed(1) + ', 82%, 52%)';
}

// 圆角矩形路径（ cards.js 里那份在闭包内，这里给实体绘制单独放一份）
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 绘制生物贴图：用「裁剪到实际图案」的版本，使图案正好撑满 size（= 碰撞箱直径）。
// 普通 drawSprite 按 viewBox 绘制，生物 SVG 外圈有一大片透明留白，图案会明显小一圈。
function drawMob(ctx, key, size, x, y, rot, scale, alpha, white) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (scale && scale !== 1) ctx.scale(scale, scale);
  if (alpha != null) ctx.globalAlpha = alpha;
  if (white) {
    // 受击白闪：主画布上无法直接做 source-in 合成，用一次性高分辨率白色剪影缓存（512）
    const cv = SpriteStore.whiteCanvas(key, 512);
    if (!cv) { ctx.restore(); return; }
    ctx.drawImage(cv, -size / 2, -size / 2, size, size);
  } else {
    // 真矢量渲染：SVG 文件的 viewBox 已由 tools/crop_mob_svgs.py 烘焙到实际图案
    // 包围盒（preserveAspectRatio=none），整图绘制即图案正好撑满 size×size，
    // 每帧按屏幕分辨率直接光栅化（浏览器画的是矢量），任意尺寸下都绝对锐利。
    const img = SpriteStore.getImage(key);
    if (!img) { ctx.restore(); return; }
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  }
  ctx.restore();
}

// 绘制已预渲染的贴图（支持旋转/缩放/透明）
function drawSprite(ctx, key, size, x, y, rot, scale, alpha) {
  const cv = SpriteStore.canvas(key, size);
  if (!cv) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (scale && scale !== 1) ctx.scale(scale, scale);
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.drawImage(cv, -size / 2, -size / 2, size, size);
  ctx.restore();
}
// 绘制白色剪影（受击闪烁）
function drawWhite(ctx, key, size, x, y, rot, scale, alpha) {
  const cv = SpriteStore.whiteCanvas(key, size);
  if (!cv) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (scale && scale !== 1) ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.drawImage(cv, -size / 2, -size / 2, size, size);
  ctx.restore();
}

// 绘制"花瓣实体"画布（已去字母、已收紧画布），支持旋转/缩放/透明
function drawArt(ctx, cv, size, x, y, rot, scale, alpha) {
  if (!cv) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (scale && scale !== 1) ctx.scale(scale, scale);
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.drawImage(cv, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function moveEntity(entity, dt, map) {
  const dx = entity.vx * dt, dy = entity.vy * dt;
  // 有碰撞外形（生物，外形取自其 SVG 轮廓）就走多边形碰撞；否则按圆形（主角/卡片）
  if (entity.shape && typeof map.moveShape === 'function') {
    const position = map.moveShape(entity.x, entity.y, dx, dy, entity.shape, entity.drawSize);
    entity.x = position.x; entity.y = position.y;
    for (const normal of position.normals) {
      const intoWall = entity.vx * normal.x + entity.vy * normal.y;
      if (intoWall < 0) {
        entity.vx -= intoWall * normal.x;
        entity.vy -= intoWall * normal.y;
      }
    }
    return;
  }
  if (typeof map.move !== 'function') {
    entity.x += dx; entity.y += dy;
    const position = map.clampTo(entity.x, entity.y, entity.r);
    entity.x = position[0]; entity.y = position[1];
    return;
  }

  const position = map.move(entity.x, entity.y, dx, dy, entity.r);
  entity.x = position.x; entity.y = position.y;
  for (const normal of position.normals) {
    const intoWall = entity.vx * normal.x + entity.vy * normal.y;
    if (intoWall < 0) {
      entity.vx -= intoWall * normal.x;
      entity.vy -= intoWall * normal.y;
    }
  }
}

class Player {
  constructor() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.r = 22 * 0.6;   // 主角半径 = 原来的 0.6 倍 (≈13.2)
    this.facing = 0;
    this.baseSpeed = 232 * SPEED_SCALE * 0.2; this.speed = this.baseSpeed;  // 人物移速 = 当前(0.4倍)再放慢一半 = 0.5 倍于当前
    this.maxHp = 100; this.hp = 100;
    this.xp = 0; this.level = 1; this.xpNext = 24;
    this.damage = 0;
    this.slots = emptySlots();      // 花朵花瓣（主槽，已装备）
    this.subSlots = emptySlots();   // 副槽（临时存储，不参与装备）
    this.invBar = [];                              // 即时物品栏（底部常驻淡灰卡槽）
    this.backpack = [];                            // 背包库存（仅在背包面板可见）
    this.maxInvBar = 8;
    this.maxBackpack = 24;
    this.invuln = 0; this.flash = 0;
    this.armor = 0;             // 花朵护甲：受击结算 = max(攻-甲, 0)
    this.bodyDmg = 0;           // 花朵本体攻击（0：本体不造成伤害，输出靠花瓣）
    this.hurtT = 0;             // 受伤红色滤镜剩余时间（0.1s）
    this.hpBarA = 0;            // 血条显示透明度（非满血渐显 0.3s / 满血渐隐 0.3s）
    this.deathRot = 0;          // 死亡时本体固定的随机旋转角
    this.dead = false; this.deathTimer = 0;
    this.breath = 0; this.moving = false;
    this.spin = 0;              // 花瓣环绕角度
    this.petals = [];           // 花瓣实体（各自有实际坐标与速度）
    this.petalGhosts = [];      // 已卸下/被移除的花瓣：原地放大渐隐
    this.petalWorld = [];
    this.reload = [];           // 主槽装填状态：{ card, age, dur } | null（与 slots 等长）
    this.reloadHold = [];       // 主槽装填暂停标记：换卡动画播放期间为 true（UI 置位/清除）
    this.name = 'Flower';
    // 模式状态：空格=reach、Shift=detect
    this.mode = 'normal';        // 'normal' | 'reach' | 'detect'
    this.modeT = 0;              // 模式过渡进度 0->1（0.15s）
    this.age = 0;                // 出场计时：脸部 spawnPop Q 弹（重生时归零重播）
    this.killedBy = null;        // 死因（生物名称），死亡界面显示用
  }

  recompute() {
    // 花瓣血量独立于人物血量：装备花瓣【不再】增加 maxHp（hp 是花瓣自己的"水缸"）。
    let spd = 0, dmg = 0;
    for (const p of this.slots) {
      if (p) {
        const st = petalStatsFor(p.type, p.rarity);   // 按稀有度取值（倍率/整表）
        dmg += st.dmg; spd += p.type.spd;
      }
    }
    this.maxHp = Math.max(20, 100);
    this.speed = Math.max(60, this.baseSpeed + spd);
    this.damage = dmg;
  }

  // 受击结算：返回是否致死。护甲已在调用方扣减。
  // src = 伤害来源（Mob）：致死时记录其名称，死亡界面显示"你死于 XX"。
  hurt(dmg, src) {
    if (this.dead || dmg <= 0) return false;
    this.hp -= dmg;
    this.hurtT = 0.3;                   // 0.3s 红色滤镜（全体实体通用时长）
    if (this.hp <= 0) {
      this.hp = 0;
      this.killedBy = (src && src.name) ? src.name : null;
      this.die();
      return true;
    }
    return false;
  }

  // 花朵死亡：花瓣原地快速渐隐消失，本体随机旋转一个角度后保持不动（叉叉眼 + 哭脸）
  die() {
    this.dead = true; this.deathTimer = 0;
    this.deathRot = rand(0, TAU);
    for (const b of this.petals) this.petalGhosts.push({ card: b.card, x: b.x, y: b.y, age: 0 });
    this.petals = []; this.petalWorld = [];
    this.vx = 0; this.vy = 0;
  }

  update(dt, dir, map, mobs) {
    if (this.dead) {
      this.deathTimer += dt;
      // 死亡瞬间放出的花瓣退场幽灵继续播完渐隐（0.2s）
      for (const g of this.petalGhosts) g.age += dt;
      this.petalGhosts = this.petalGhosts.filter((g) => g.age < PETAL_GHOST_T);
      return;
    }
    this.hurtT = Math.max(0, this.hurtT - dt);
    // 血条透明度：非满血 -> 0.3s 线性渐显；回到满血 -> 0.3s 线性渐隐
    const barTarget = this.hp < this.maxHp ? 1 : 0;
    const barStep = dt / 0.3;
    this.hpBarA = barTarget > this.hpBarA
      ? Math.min(barTarget, this.hpBarA + barStep)
      : Math.max(barTarget, this.hpBarA - barStep);
    // 血条平滑管线（黑框内的填充部分，与黑框无关）：
    //   dispHp  = 绿色主条，指数阻尼【快速】跟随真实血量；
    //   ghostHp = 淡灰缓冲条，欠阻尼弹簧【慢速】跟随主条并轻微过冲再回稳。
    // 平时两者与 hp 重合，缓冲条被主条完全盖住（不可见）；掉血瞬间才露出来。
    if (this.dispHp == null) { this.dispHp = this.hp; this.ghostHp = this.hp; this.ghostV = 0; }
    this.dispHp = damp(this.dispHp, this.hp, 18, dt);
    const gk = 34, gd = 9;                      // 刚度低 + 阻尼欠 -> 追赶时过冲一小段
    this.ghostV += (gk * (this.dispHp - this.ghostHp) - gd * this.ghostV) * dt;
    this.ghostHp = clamp(this.ghostHp + this.ghostV * dt, 0, this.maxHp);
    const len = Math.hypot(dir.x, dir.y);
    let tx = 0, ty = 0;
    if (len > 0) { tx = dir.x / len * this.speed; ty = dir.y / len * this.speed; }
    const rate = (len > 0) ? 9 : 4;   // 加速到默认速度约 0.3s（rate 9）；松开方向键沿用约 0.5s 减速（rate 4）
    this.vx = damp(this.vx, tx, rate, dt);
    this.vy = damp(this.vy, ty, rate, dt);
    moveEntity(this, dt, map);
    this.moving = len > 0;
    if (this.moving) {
      const ta = Math.atan2(this.vy, this.vx);
      this.facing = lerpAngle(this.facing, ta, clamp(dt * 12, 0, 1));
    }
    this.breath += dt;
    this.age += dt;                  // 出场 Q 弹推进
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt);

    this.spin += PETAL_SPIN * dt;
    // 装填计时必须在 _syncPetals 之前：新换上来的卡要先有 reload 状态（age=0 -> 未完成），
    // 这一步之后花瓣实体才会被放出来
    this._tickReload(dt);
    // 模式过渡动画：0.15s平滑过渡
    const targetT = (this.mode === 'normal') ? 0 : 1;
    const modeRate = 1 / 0.15;  // 0.15秒完成过渡
    this.modeT = damp(this.modeT, targetT, modeRate, dt);
    this._syncPetals(dt, map, mobs);
  }

  // ---------------- 主槽装填（reload） ----------------
  // 每条主槽记录「当前这张卡 + 已装填时长 + 总时长」，总时长 = 该花瓣的 reload 秒数（type.spd）。
  // 判定"是否换卡"用【对象身份】而不是 key：同一张卡卸下再装回、或两槽互换，都算"刚替换上来"，
  // 必须重新结算（没装填完就被替换下去 -> 新上来的卡从头开始装填）。
  // reloadHold[i] = true 时暂停计时：卡牌"换上来"的动画（互换翻转 / 飞入卡槽）播放期间不结算冷却，
  // 等卡牌完全落进卡槽后才开始（由 UI 在动画结束时置回 false）。
  _tickReload(dt) {
    for (let i = 0; i < this.slots.length; i++) {
      const c = this.slots[i];
      if (!c) { this.reload[i] = null; this.reloadHold[i] = false; continue; }
      const r = this.reload[i];
      if (!r || r.card !== c) {
        // 冷却时长：优先 type.reload（显式字段）；否则回退 type.spd（历史约定）
        const dur = (c.type && c.type.reload != null)
          ? c.type.reload : Math.max(0, (c.type && c.type.spd) || 0);
        this.reload[i] = { card: c, age: 0, dur };
      } else if (!this.reloadHold[i]) {
        r.age += dt;
      }
    }
  }
  // 该主槽是否装填完成（dur<=0 视为无需装填，立即完成）
  reloadDone(i) {
    const r = this.reload[i];
    return !!r && r.age >= r.dur;
  }

  // 花瓣运动：自由跟随主角。与生物【没有物理碰撞】——花瓣穿过生物本体，
  // 敌对接触只走战斗结算（25 tick/s 双向扣血，见 game.js _combatTick）。
  _resolvePetal(b, mx, my) {
    b.x += mx; b.y += my;
  }

  // 花瓣 = 实体：每片都有"此刻应在的位置"(target) 与 "实际位置"，平滑吸附过去。
  //   · 按「当前装备数量」平分一圈：2 片 180° 相对、3 片三角、5 片五角……（空槽不占位）
  //   · 刚上场的花瓣初始位置就在人物中心，再慢慢"冒"到应在位置
  //   · 人物跑起来时目标点跟着跑，花瓣会被甩在后面一小段距离，再平滑吸附（故意保留的缓冲感）
  //   · 装备数量变化引起间距重排时，同样走这套吸附过程，绝不瞬移
  _syncPetals(dt, map, mobs) {
    // 【装上就算数】：所有已装备的主槽都参与排列（n = 装备总数），
    // 装填中/被打碎重冷的槽位照样占一个位置 —— 其它花瓣自动给它留出空位。
    const equipped = [];
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i]) equipped.push(i);
    }
    const n = equipped.length;

    // 同步实体列表：同一张卡保留其运动状态；新出现的卡从人物中心出生。
    // 只有【装填完成】的槽位才生成花瓣实体；ord 用 equipped 里的序号 -> 空位保留。
    const bodies = [];
    for (let k = 0; k < n; k++) {
      const slotIndex = equipped[k];
      const card = this.slots[slotIndex];
      if (!this.reloadDone(slotIndex)) continue;    // 装填中：占位但不生成
      let body = null;
      for (const b of this.petals) if (b.slotIndex === slotIndex && b.card === card) { body = b; break; }
      if (!body) {
        const st = petalStatsFor(card.type, card.rarity);
        const maxHp = st.hp || 30;
        body = { slotIndex, card, x: this.x, y: this.y, age: 0, hp: maxHp, maxHp, hurtT: 0 };
      }
      body.age += dt;
      body.hurtT = Math.max(0, (body.hurtT || 0) - dt);
      body.ord = k; body.n = n;
      bodies.push(body);
    }
    // 本次已不在装备栏里的花瓣 -> 转为"退场幽灵"（卸下/删除 = 放大 + 渐隐）
    for (const b of this.petals) {
      let kept = false;
      for (const nb of bodies) if (nb.slotIndex === b.slotIndex && nb.card === b.card) { kept = true; break; }
      if (!kept) this.petalGhosts.push({ card: b.card, x: b.x, y: b.y, age: 0 });
    }
    this.petals = bodies;
    // 幽灵推进，超时即真正移除
    for (const g of this.petalGhosts) g.age += dt;
    this.petalGhosts = this.petalGhosts.filter((g) => g.age < PETAL_GHOST_T);

    // 花瓣特效引擎：对每片在轨花瓣跑 detect/update（玫瑰等特殊行为在此触发）。
    // 必须在弹簧之前：激活的特效会直接驱动 b.x/b.y，弹簧随后跳过它们。
    for (const b of this.petals) PetalFX.tick(b, this, dt);

    // 计算应在位置，用欠阻尼弹簧吸附过去（帧率无关；目标突变时平滑追赶，绝不瞬移）
    const step = n > 0 ? TAU / n : 0;
    // 花瓣距离：reach模式×2，detect模式×0.5，normal×1
    let reachMult = 1;
    if (this.mode === 'reach') reachMult = 1 + this.modeT;              // 1 -> 2
    else if (this.mode === 'detect') reachMult = 1 - (1 - PETAL_DETECT) * this.modeT;  // 1 -> 0.5
    const reach = this.r * (1 + PETAL_REACH) * 1.105 * reachMult;
    const dtc = Math.min(dt, 0.05);   // 弹簧积分步长上限（防掉帧时数值爆炸）
    for (const b of this.petals) {
      if (b.fxActive) continue;     // 特效驱动中（如玫瑰飞向主角）：位置由引擎接管
      const ang = this.spin + b.ord * step;
      const tx = this.x + Math.cos(ang) * reach;
      const ty = this.y + Math.sin(ang) * reach;

      // 欠阻尼弹簧：速度带惯性，离目标越远加速越大；
      // 模式切换 / 数量重排 / 急转向都表现为"甩一下再归位"的自然追赶
      if (b.vx == null) { b.vx = 0; b.vy = 0; }
      b.vx += (PETAL_SPRING_K * (tx - b.x) - PETAL_SPRING_D * b.vx) * dtc;
      b.vy += (PETAL_SPRING_K * (ty - b.y) - PETAL_SPRING_D * b.vy) * dtc;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > PETAL_MAX_SPEED) { const s = PETAL_MAX_SPEED / sp; b.vx *= s; b.vy *= s; }
      // 自由运动（无生物物理碰撞；伤害由 game.js 的战斗 tick 结算）
      this._resolvePetal(b, b.vx * dtc, b.vy * dtc);
    }

    // 供绘制与碰撞使用（hurtT：花瓣受伤红滤镜；fxActive：特效驱动中，图层在主角之上）
    this.petalWorld = this.petals.map((b) => ({ x: b.x, y: b.y, r: PETAL_R, index: b.slotIndex, age: b.age, hurtT: b.hurtT || 0, fxActive: !!b.fxActive }));
  }

  draw(ctx) {
    // 死亡：先播完花瓣退场幽灵（渐隐），再画死亡本体（随机角度 + 叉叉眼 + 哭脸）
    if (this.dead) {
      for (const g of this.petalGhosts) {
        const size = 15 * 0.9;
        const d = deathFade(clamp(g.age / PETAL_GHOST_T, 0, 1));
        const rot = Math.atan2(g.y - this.y, g.x - this.x) + Math.PI / 2;
        const cv = CardRenderer.artCanvas(g.card.type.svg, 128);
        if (cv) drawArt(ctx, cv, size, g.x, g.y, rot, d.scale, d.alpha);
        else drawSprite(ctx, 'petal' + g.card.type.svg, size, g.x, g.y, rot, d.scale, d.alpha);
      }
      this._drawDeadBody(ctx);
      return;
    }
    // 花瓣实体：出场渐显（大小不变）。特效驱动中的花瓣（如玫瑰飞向主角）
    // 延后到主角本体之后再画 —— 图层比人物高，"飞到脸上"的观感。
    for (const pp of this.petalWorld) {
      if (pp.fxActive) continue;
      const p = this.slots[pp.index];
      const size = 15 * 0.9;                        // 13.5：花瓣视觉缩至原 0.9
      // 朝向 = 由花心指向花瓣：被甩在后面时姿态也会自然跟着偏
      const rot = Math.atan2(pp.y - this.y, pp.x - this.x) + Math.PI / 2;
      const a = spawnFade(pp.age);                // 出场：0.1s 渐显
      const cv = CardRenderer.artCanvas(p.type.svg, 128);   // 未就绪时返回 null
      if (cv) drawArt(ctx, cv, size, pp.x, pp.y, rot, spawnPop(pp.age), a);
      else drawSprite(ctx, 'petal' + p.type.svg, size, pp.x, pp.y, rot, spawnPop(pp.age), a);  // 回退
      // 花瓣受伤红色滤镜（0.3s，全体实体通用时长）
      if (pp.hurtT > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(pp.hurtT / 0.3, 0, 1) * 0.4;
        ctx.fillStyle = '#ff4040';
        ctx.beginPath(); ctx.arc(pp.x, pp.y, size / 2, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    // 被卸下/移除的花瓣：留在原地平滑放大并渐隐（0.2s 快速消失）
    // 放大到 1.5 倍不会盖住主角：轨道半径约 43px、主角半径 15.6px，
    // 花瓣放大后半宽 10.1px，内缘仍在 33px 处，离主角边缘还有 17px 余量。
    for (const g of this.petalGhosts) {
      const size = 15 * 0.9;                         // 与在场花瓣同尺寸
      const d = deathFade(clamp(g.age / PETAL_GHOST_T, 0, 1));
      const rot = Math.atan2(g.y - this.y, g.x - this.x) + Math.PI / 2;
      const cv = CardRenderer.artCanvas(g.card.type.svg, 128);
      if (cv) drawArt(ctx, cv, size, g.x, g.y, rot, d.scale, d.alpha);
      else drawSprite(ctx, 'petal' + g.card.type.svg, size, g.x, g.y, rot, d.scale, d.alpha);
    }

    // 主角：黄色笑脸（整体固定正放，不随朝向旋转；只有眼睛里的白色随移动方向偏移）。
    // 半径乘 spawnPop：出生/重生时 Q 弹弹出（过冲回落），五官全按 R 缩放同步跟随。
    const R = this.r * 1.2 * spawnPop(this.age);   // 脸部半径
    ctx.save();
    // 脸
    ctx.fillStyle = '#fae26a';            // 介于改前(#f7db45)与改后(#fce98e)之间
    ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.fill();
    ctx.lineWidth = R * 0.085;   // 等比缩放（去下限，保证描边随脸同步缩小）
    ctx.strokeStyle = '#dfbc4e';          // 描边：能看清，又不过分跳
    ctx.stroke();
    // 眼睛：黑色竖椭圆；reach/detect 时用「斜切顶边」重塑眼睛轮廓（不是叠加小三角）
    const look = this.facing;
    const erx = R * 0.138, ery = R * 0.2592;
    // 斜率 k：顶边沿眼宽方向的落差；reach = 外高内低(生气)，detect = 内高外低(伤心)
    const eyeK = 0.45 * this.modeT;                        // 0 -> 0.45，随过渡平滑增长
    const base = (this.mode === 'detect' ? 1 : -1) * eyeK; // 未进入模式(modeT=0)时为 0，不改变形状
    for (const s of [-1, 1]) {
      // 外侧方向：s=+1 右眼外侧在 +x，s=-1 左眼外侧在 -x
      const ex = this.x + s * R * 0.275, ey = this.y - R * 0.20;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(ex, ey, erx, ery, 0, 0, TAU);
      ctx.clip();                                   // 之后的绘制都被裁剪在眼睛椭圆内
      ctx.fillStyle = '#25252a';
      ctx.fillRect(ex - erx, ey - ery, erx * 2, ery * 2);
      // 白色眼球：与黑眼椭圆同形状的缩小长圆形，按移动方向偏移
      const wk = 0.46;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(
        ex + Math.cos(look) * erx * 0.5,
        ey + Math.sin(look) * ery * 0.42,
        erx * wk, ery * wk, 0, 0, TAU
      );
      ctx.fill();
      if (this.modeT > 0.001) {
        // 用面部色盖掉「倾斜顶边」以上的部分 -> 只削掉上缘，保留下方，轮廓成为斜顶（生气眼 / 伤心眼）
        // 注意方向：多边形必须在斜线「上方」，否则会把整只眼睛连同下方一起擦掉（眼睛消失且回不来）
        const k = base * s;      // 每只眼各自朝自己的外侧抬起
        const top = ey - ery, big = R * 2;
        ctx.fillStyle = '#fae26a';
        ctx.beginPath();
        ctx.moveTo(ex - big, top - k * big - big);    // 上边界（比斜线再高 big）
        ctx.lineTo(ex + big, top + k * big - big);
        ctx.lineTo(ex + big, top + k * big);           // 斜线右端
        ctx.lineTo(ex - big, top - k * big);           // 斜线左端
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // 嘴：在同一位置做几何形变（微笑 -> 直线 -> 哭脸），不做旋转，避免嘴巴位置漂移
    // 两端点固定在原圆弧端点 (±0.2408R, y+0.4032R)，只让「鼓起方向」翻转
    ctx.strokeStyle = '#25252a';
    ctx.lineWidth = R * 0.07;
    ctx.lineCap = 'round';
    const mHw = R * 0.2408, mY = this.y + R * 0.4032;
    const bulge = R * 0.1133 * (1 - 2 * this.modeT);   // 正=向下鼓(笑)，0=直线，负=向上鼓(哭)
    ctx.beginPath();
    ctx.moveTo(this.x - mHw, mY);
    ctx.quadraticCurveTo(this.x, mY + 2 * bulge, this.x + mHw, mY);
    ctx.stroke();
    ctx.restore();

    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.flash / 0.18, 0, 1) * 0.85;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // 受伤红色滤镜（0.3s）：红色覆盖脸部，随剩余时间渐隐
    if (this.hurtT > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.hurtT / 0.3, 0, 1) * 0.4;
      ctx.fillStyle = '#ff4040';
      ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // 特效驱动中的花瓣：画在主角本体之上（图层比人物高）
    for (const pp of this.petalWorld) {
      if (!pp.fxActive) continue;
      const p = this.slots[pp.index];
      const size = 15 * 0.9;
      const rot = Math.atan2(pp.y - this.y, pp.x - this.x) + Math.PI / 2;
      const a = spawnFade(pp.age);
      const cv = CardRenderer.artCanvas(p.type.svg, 128);
      if (cv) drawArt(ctx, cv, size, pp.x, pp.y, rot, spawnPop(pp.age), a);
      else drawSprite(ctx, 'petal' + p.type.svg, size, pp.x, pp.y, rot, spawnPop(pp.age), a);
      if (pp.hurtT > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(pp.hurtT / 0.3, 0, 1) * 0.4;
        ctx.fillStyle = '#ff4040';
        ctx.beginPath(); ctx.arc(pp.x, pp.y, size / 2, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    // 花朵血条：仅在非满血时显示（0.3s 渐显 / 0.3s 渐隐）。
    // 粗细/长度与昆虫完全同一份数据（HPBAR_W/HPBAR_H）；不显示名称与稀有度。
    if (this.hpBarA > 0.001) {
      const bw = HPBAR_W;
      const bh = HPBAR_H;
      const bx = this.x - bw / 2, barY = this.y + R + 7;
      const rad = Math.min(bh / 2, 6);
      ctx.save();
      ctx.globalAlpha = this.hpBarA;
      roundRectPath(ctx, bx, barY, bw, bh, rad);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fill();
      // 黑框内先画淡灰缓冲条（慢速跟随、轻微过冲），再画绿色主条（快速跟随）；
      // 主条颜色随血量连续渐变。两者平时重合，缓冲条被完全盖住。
      const dRatio = clamp((this.dispHp == null ? this.hp : this.dispHp) / this.maxHp, 0, 1);
      const gRatio = clamp((this.ghostHp == null ? this.hp : this.ghostHp) / this.maxHp, 0, 1);
      if (gRatio > 0) {
        roundRectPath(ctx, bx, barY, Math.max(bh, bw * gRatio), bh, rad);
        ctx.fillStyle = '#b9bec8';
        ctx.fill();
      }
      if (dRatio > 0) {
        roundRectPath(ctx, bx, barY, Math.max(bh, bw * dRatio), bh, rad);
        ctx.fillStyle = hpBarColor(dRatio);
        ctx.fill();
      }
      ctx.lineWidth = Math.max(1.2, bh * 0.22);
      ctx.strokeStyle = '#000';
      roundRectPath(ctx, bx, barY, bw, bh, rad);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 死亡本体：随机旋转一个角度后保持不动；叉叉眼 + 哭脸嘴（配色与存活时一致）
  _drawDeadBody(ctx) {
    const R = this.r * 1.2;
    ctx.save();
    ctx.translate(this.x, this.y);
    // 死亡瞬间转身：0.35s easeOutCubic 从当前姿态平滑旋到随机角 deathRot（每死一次随机）
    const rk = Math.min(1, this.deathTimer / 0.35);
    ctx.rotate(this.deathRot * (1 - Math.pow(1 - rk, 3)));
    ctx.fillStyle = '#fae26a';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.lineWidth = R * 0.085;
    ctx.strokeStyle = '#dfbc4e';
    ctx.stroke();
    ctx.strokeStyle = '#25252a';
    ctx.lineWidth = R * 0.07;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const ex = s * R * 0.275, ey = -R * 0.20, e = R * 0.15;
      ctx.beginPath();
      ctx.moveTo(ex - e, ey - e); ctx.lineTo(ex + e, ey + e);
      ctx.moveTo(ex - e, ey + e); ctx.lineTo(ex + e, ey - e);
      ctx.stroke();
    }
    const mHw = R * 0.2408, mY = R * 0.4032;
    ctx.beginPath();
    ctx.moveTo(-mHw, mY);
    ctx.quadraticCurveTo(0, mY - 2 * R * 0.1133, mHw, mY);
    ctx.stroke();
    ctx.restore();
  }
}

// 生物视觉直径 = 主角视觉直径 × 各稀有度倍率。
// 主角绘制半径 = r×1.2 = 13.2×1.2 = 15.84 -> 视觉直径 31.68。
// 校准（用户实测）：common = 0.65×旧值；且上一版 super 的尺寸其实是 mythic 应有的尺寸。
// 即 mythic = 旧 ultra 倍率 = 1.9 × step_old^6，common→mythic 共 5 级均匀变化：
// step = (mythic倍率 / common倍率)^(1/5) ≈ 1.4118，ultra/super/eternal/unique 顺势等比。
const PLAYER_VISUAL_D = 13.2 * 1.2 * 2;
const MOB_DIAM_BASE = 1.9 * 0.65;                          // common ≈ 1.235
const _MOB_OLD_STEP = Math.pow(4.5 / 1.9, 1 / 4);          // 旧表步进（仅用于校准点换算）
const MOB_DIAM_STEP = Math.pow(
  (1.9 * Math.pow(_MOB_OLD_STEP, 6)) / MOB_DIAM_BASE, 1 / 5);   // ≈ 1.4118
const MOB_DIAM = (function () {
  const o = {};
  const order = ['common', 'unusual', 'rare', 'epic', 'legendary', 'mythic', 'ultra', 'super', 'eternal', 'unique'];
  for (let i = 0; i < order.length; i++) o[order[i]] = MOB_DIAM_BASE * Math.pow(MOB_DIAM_STEP, i);
  return o;
})();
// 贴图朝向补偿：部分生物 SVG 的「头」不指向 +x（瓢虫的头在图内指向左上 -135°）。
// 绘制与碰撞统一在 facing 上加这个偏角，使头始终朝向实际移动方向。
const MOB_ART_ROT = {
  '3': Math.PI * 3 / 4,       // 瓢虫：头中心在图内朝 -135°，补偿 +135°
};
// 瓢虫描边圈独立图层（assets/mobs/3_ring.svg，main.js 预加载）：
// 绘制顺序 = 本体(无圈) -> 随机圆点 -> 描边圈，圆点永远压在圈的下面。
// RING_RECT = 圈在 base 贴图（3.svg）坐标系里的比例矩形（tools/_split_ring.py 算出）。
const LADYBUG_RING_KEY = 'mob3ring';
const LADYBUG_RING_RECT = [-0.0582, -0.0590, 1.1172, 1.1181];
// 生物 SVG 的实际图案只占 viewBox 的一部分（外圈是 clipPath 留白）。
// 旧实现按 91.667/110 估算这个比例，但真实图案比 clipPath 更小，所以视觉总比碰撞箱小一圈。
// 现在改为运行时按 alpha 通道实测包围盒并裁剪（见 SpriteStore.artCanvas），这里只留注释说明。
const MOB_ART_RATIO = 91.667 / 110;

// 全实体【共用】的血条尺寸（花朵 / 昆虫同一份数据，绝不允许两套公式）。
// 长度 = 基准公式 ×1.3；高度不变。
const HPBAR_W = Math.max(30, Math.min(
  PLAYER_VISUAL_D * MOB_DIAM_BASE / 2 * 1.7,
  PLAYER_VISUAL_D * MOB_DIAM_BASE / 2 * 1.9)) * 1.9 * 0.6 * 1.3;
const HPBAR_H = 6.6 * 0.8;

// —— 精确外观碰撞：把贴图实心度烘焙成 N×N 网格，圆与实心格求交 ——
// 凸包表示不了凹形（瓢虫的头凹槽等），网格直接取自渲染像素 -> 碰撞箱完全依照外观。
const MOB_MASK_N = 64;
function mobMaskHit(m, cx, cy, cr) {
  const g = SpriteStore.alphaGrid('mob' + m.svg, MOB_MASK_N);
  if (!g) return false;                        // 网格未就绪/被污染：调用方退回圆形
  const half = m.drawSize / 2;
  const dx = cx - m.x, dy = cy - m.y;
  const rOut = half + cr;
  if (dx * dx + dy * dy > (rOut + 2) * (rOut + 2)) return false;   // 粗判：外接圆
  // 世界 -> 生物本地（贴图随 facing+artRot 旋转）
  const rot = m.facing + (m.artRot || 0);
  const c = Math.cos(rot), s = Math.sin(rot);
  const lx = dx * c + dy * s, ly = -dx * s + dy * c;
  const cell = m.drawSize / MOB_MASK_N;
  const cr2 = cr * cr;
  const gx0 = Math.max(0, Math.floor((lx - cr + half) / cell));
  const gx1 = Math.min(MOB_MASK_N - 1, Math.floor((lx + cr + half) / cell));
  const gy0 = Math.max(0, Math.floor((ly - cr + half) / cell));
  const gy1 = Math.min(MOB_MASK_N - 1, Math.floor((ly + cr + half) / cell));
  for (let j = gy0; j <= gy1; j++) {
    for (let i = gx0; i <= gx1; i++) {
      if (!g[j * MOB_MASK_N + i]) continue;
      // 圆 vs 实心格 AABB（圆心在格内时最近点=自身，必然命中）
      const nx = Math.max(-half + i * cell, Math.min(lx, -half + (i + 1) * cell));
      const ny = Math.max(-half + j * cell, Math.min(ly, -half + (j + 1) * cell));
      const ex = lx - nx, ey = ly - ny;
      if (ex * ex + ey * ey <= cr2) return true;
    }
  }
  return false;
}
// 命中时沿「圆心-生物中心」方向二分外推到刚好脱离，返回修正后的圆心；推不出（中心陷入）返回 null。
function circleVsMob(m, cx, cy, cr) {
  if (!mobMaskHit(m, cx, cy, cr)) return null;
  let dx = cx - m.x, dy = cy - m.y;
  let len = Math.hypot(dx, dy);
  if (len < 1e-3) { dx = 0; dy = -1; len = 1; }
  const ux = dx / len, uy = dy / len;
  let lo = 0, hi = cr + 2;
  while (mobMaskHit(m, cx + ux * hi, cy + uy * hi, cr)) {
    hi += cr;
    if (hi > m.drawSize) return null;           // 兜底：整个方向都在实心里（几乎不可能）
  }
  for (let k = 0; k < 9; k++) {
    const mid = (lo + hi) / 2;
    if (mobMaskHit(m, cx + ux * mid, cy + uy * mid, cr)) lo = mid; else hi = mid;
  }
  return { x: cx + ux * hi, y: cy + uy * hi };
}

// —— 几何矢量化碰撞（旧凸包方案，保留作参考/兜底） ——
// 生物的碰撞多边形（世界坐标）：SVG 轮廓凸包（归一化 [-0.5,0.5]）× drawSize，按朝向旋转后平移。
// 与 drawMob 的绘制完全同构（同旋转、同尺寸），碰撞箱就是看见的图案本身。
function mobWorldPoly(m) {
  if (!m.shape || m.dead) return null;
  const rot = m.facing + (m.artRot || 0);   // 与绘制同角度：碰撞箱就是看见的图案本身
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const pts = [];
  for (const p of m.shape) {
    const lx = p[0] * m.drawSize, ly = p[1] * m.drawSize;
    pts.push([m.x + lx * cos - ly * sin, m.y + lx * sin + ly * cos]);
  }
  return pts;
}
// 圆 vs 凸多边形：相交时把圆推出到表面相切，返回修正后的圆心；不相交返回 null。
// 对绕向不敏感（射线法判内点 + 全边最近点），圆心在多边形内也能正确推出。
function circleVsConvex(cx, cy, cr, pts) {
  const n = pts.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if (((yi > cy) !== (yj > cy)) && (cx < (xj - xi) * (cy - yi) / (yj - yi) + xi)) inside = !inside;
  }
  let bx = 0, by = 0, bd2 = Infinity;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const L2 = ex * ex + ey * ey;
    let t = L2 > 0 ? ((cx - a[0]) * ex + (cy - a[1]) * ey) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + ex * t, py = a[1] + ey * t;
    const d2 = (cx - px) * (cx - px) + (cy - py) * (cy - py);
    if (d2 < bd2) { bd2 = d2; bx = px; by = py; }
  }
  const d = Math.sqrt(bd2) || 1e-6;
  if (inside) {
    const ux = (bx - cx) / d, uy = (by - cy) / d;
    return { x: bx + ux * cr, y: by + uy * cr };
  }
  if (d >= cr) return null;
  const ux = (cx - bx) / d, uy = (cy - by) / d;
  return { x: bx + ux * cr, y: by + uy * cr };
}

class Mob {
  constructor(type, x, y, level, rarity) {
    this.type = type; this.name = type.name; this.svg = type.svg; this.zh = type.zh || '';
    this.level = level || 1;
    this.rarity = rarity || 'common';
    this.aiConf = type.ai || null;      // 官方 AI 配置（aggro/chase/flee/retaliate…）
    this.ai = MobAI.create(this);       // 运行时 AI 状态（只产出"移动欲望"）
    // 各稀有度数值：有表就整表取用（hp/dmg），否则退回基础值
    const rs = type.rarityStats && type.rarityStats[this.rarity];
    const baseHp = rs ? (rs.hp || 0) : type.hp;
    const baseDmg = rs ? (rs.dmg || 0) : type.dmg;
    // 视觉直径按稀有度取（mobScale(level) 留给日后的星级/等级）
    const diam = Math.round(PLAYER_VISUAL_D * (MOB_DIAM[this.rarity] || MOB_DIAM_BASE) * mobScale(this.level));
    this.visualD = diam;
    this.r = diam / 2;                  // 碰撞/名牌半径跟着视觉直径走
    this.drawSize = diam;               // 贴图裁剪后正好撑满它 -> 视觉与碰撞箱一致
    this.shape = null;                  // 碰撞外形（SVG 轮廓的凸包），贴图就绪后懒加载
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.maxHp = baseHp; this.hp = baseHp;
    this.dmg = baseDmg; this.speed = (type.speed || 0) * SPEED_SCALE;
    this.color = type.color; this.boss = !!type.boss;
    this.facing = rand(0, TAU);         // 朝向（无呼吸/浮动动画，用户要求生物保持静止姿态）
    const svgKey = String(this.svg);    // type.svg 是数字 id，查表统一转字符串
    this.artRot = MOB_ART_ROT[svgKey] || 0;     // 贴图朝向补偿（使头指向 +x）
    this.seed = (Math.random() * 0x7fffffff) | 0;
    this.dots = (svgKey === '3') ? this._makeDots() : null;   // 瓢虫：程序化随机斑点
    this.hostility = (rs && rs.hostility) || type.hostility || 'neutral';   // 仇恨按稀有度（瓢虫 common/unusual 被动、rare+ 中立）
    this.threat = [];                   // 仇恨表 [{ ent, dmg }]：死亡前永久累计，追击累计伤害最高的来源
    this.flash = 0; this.hitCd = 0; this.squash = 0;
    this.dead = false; this.deathTimer = 0;
    this.age = 0;                       // 出场计时（渐隐用）
    this.aggro = false;                 // 仇恨：暂不启用（还没有伤害）
    // 护甲（armor）：registry 有就整表取用，否则按稀有度默认表；攻击结算 = max(攻-甲, 0)
    this.armor = (rs && rs.armor != null) ? rs.armor
      : (type.armor != null) ? type.armor : (MOB_ARMOR[this.rarity] || 0);
    this.hurtT = 0;                     // 受伤红色滤镜剩余时间（0.1s）
    this.xpVal = rs ? (rs.exp || 0) : (4 + type.tier * 4);
  }

  // 受击结算：返回是否致死。护甲已在调用方扣减。
  // src = 伤害来源实体（花瓣造成的伤害由调用方统一记到玩家头上）。
  hurt(dmg, src) {
    if (this.dead || dmg <= 0) return false;
    this.hp -= dmg;
    this.hurtT = 0.3;                   // 0.3s 红色滤镜（全体实体通用时长）
    // 仇恨：永久累计（死亡前不清零）。被动型（passive）不记仇恨、永不追击。
    if (src && this.hostility !== 'passive') {
      const e = this.threat.find((t) => t.ent === src);
      if (e) e.dmg += dmg; else this.threat.push({ ent: src, dmg });
    }
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.deathTimer = 0; return true; }
    return false;
  }

  // 当前最恨的实体：累计伤害最高且还活着；没有则 null
  topThreat() {
    let best = null;
    for (const t of this.threat) {
      if (!t.ent || t.ent.dead) continue;
      if (!best || t.dmg > best.dmg) best = t;
    }
    return best ? best.ent : null;
  }

  // 瓢虫鞘翅斑点（贴图上的圆点已删除，全部改为运行时随机生成）：
  //   · 数量随稀有度递增：common 2 -> super 9
  //   · 位置在鞘翅内圈随机撒、允许重叠；每只生物生成时定型，此后每帧稳定
  //   · 半径围绕标准值 0.075×drawSize 波动（±35%）——标准值随稀有度等比缩放
  _makeDots() {
    const n = 2 + Math.max(0, RARITY_ORDER.indexOf(this.rarity));
    let s = this.seed || 1;
    const rng = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffffff) / 0x1000000; };
    const dots = [];
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU;
      const d = Math.sqrt(rng()) * 0.38;              // 均匀圆盘分布（clip 在鞘翅内圈）
      dots.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 0.11 * (0.65 + 0.7 * rng()) });
    }
    return dots;
  }

  update(dt, player, map) {
    if (this.dead) { this.deathTimer += dt; return; }
    this.age += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.hitCd = Math.max(0, this.hitCd - dt);
    this.squash = damp(this.squash, 0, 10, dt);
    // 碰撞外形要等贴图光栅化后才能从轮廓提取；取到一次就固定（外形不随动画变）
    if (!this.shape) this.shape = SpriteStore.shape('mob' + this.svg, this.drawSize);

    // —— 1) 问 AI：现在想怎么动。AI 只给"移动欲望"，不直接改坐标 ——
    const want = MobAI.step(this.ai, dt, this, player);
    // —— 2) 底层引擎响应欲望：与主角同一套指数阻尼，渐渐起步、渐渐停住 ——
    const desire = (want.x !== 0 || want.y !== 0);
    const rate = desire ? 9 : 4;        // 9 = 起步(约0.3s到位)，4 = 收尾(约0.5s停住)
    this.vx = damp(this.vx, want.x, rate, dt);
    this.vy = damp(this.vy, want.y, rate, dt);
    // —— 3) 位移 + 墙体碰撞（与主角同一条管线）——
    const px = this.x, py = this.y;
    moveEntity(this, dt, map);
    // —— 4) 把实际位移回馈给 AI，它靠这个判断"这趟走完了" ——
    MobAI.notifyMoved(this.ai, dist(px, py, this.x, this.y));
    // —— 5) 朝向跟随真实移动方向；停下来就保持当前朝向（下一趟再转）——
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > this.speed * 0.12) {
      this.facing = lerpAngle(this.facing, Math.atan2(this.vy, this.vx), clamp(dt * 7, 0, 1));
    }
  }

  draw(ctx) {
    let scale = 1 + this.squash * 0.4;
    let alpha = spawnFade(this.age);        // 出场：0.1s 渐显
    if (this.dead) {
      const d = deathFade(clamp(this.deathTimer / FADE_T, 0, 1));   // 退场：0.1s 放大 + 渐隐
      scale *= d.scale;
      alpha = d.alpha;
    } else {
      scale *= spawnPop(this.age);          // Q 弹出场（过冲回落）
    }
    // 注意：生物【不做】呼吸/浮动特效（用户明确要求），尺寸只由受击挤压与退场缩放决定。
    const key = 'mob' + this.svg;
    const rot = this.facing + this.artRot;  // 头始终朝向移动方向
    // drawSize = 视觉直径 = 碰撞箱直径；贴图已按图案包围盒裁剪，正好撑满它
    let bodyAlpha = alpha;
    if (this.flash > 0) {
      bodyAlpha = spawnFade(this.age) * clamp(this.flash / 0.14, 0, 1) * 0.9;
      drawMob(ctx, key, this.drawSize, this.x, this.y, rot, scale, bodyAlpha, true);
    } else {
      drawMob(ctx, key, this.drawSize, this.x, this.y, rot, scale, alpha, false);
    }
    // 瓢虫随机斑点：与本体同变换（旋转/挤压/透明度），受击时随白闪变白。
    // clip 在红色鞘翅内圈（0.48×drawSize），保证圆点永远不越界到圈外；
    // 画完后把独立的描边圈图层盖回最上层 -> 圆点压在描边之下。
    if (this.dots && this.dots.length) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(rot);
      if (scale !== 1) ctx.scale(scale, scale);
      ctx.globalAlpha = bodyAlpha;
      ctx.beginPath();
      ctx.arc(0, 0, 0.48 * this.drawSize, 0, TAU);
      ctx.clip();
      ctx.fillStyle = this.flash > 0 ? '#fff' : '#111';
      for (const d of this.dots) {
        ctx.beginPath();
        ctx.arc(d.x * this.drawSize, d.y * this.drawSize, d.r * this.drawSize, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      // 描边圈盖回（与本体同变换，按对齐矩形落位）
      const ring = SpriteStore.getImage(LADYBUG_RING_KEY);
      if (ring) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(rot);
        if (scale !== 1) ctx.scale(scale, scale);
        ctx.globalAlpha = bodyAlpha;
        const R = LADYBUG_RING_RECT;
        ctx.drawImage(ring,
          (R[0] - 0.5) * this.drawSize, (R[1] - 0.5) * this.drawSize,
          R[2] * this.drawSize, R[3] * this.drawSize);
        ctx.restore();
      }
    }
    // 受伤红色滤镜（0.3s）：红色剪影覆盖本体，随剩余时间渐隐。
    // 瓢虫的描边圈是独立图层，单独补一层红色剪影，保证整个外观都被盖住。
    if (this.hurtT > 0 && !this.dead) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(rot);
      if (scale !== 1) ctx.scale(scale, scale);
      const ra = clamp(this.hurtT / 0.3, 0, 1) * 0.55;
      const rc = SpriteStore.redCanvas(key, 512);
      if (rc) {
        ctx.globalAlpha = ra;
        ctx.drawImage(rc, -this.drawSize / 2, -this.drawSize / 2, this.drawSize, this.drawSize);
      }
      if (this.dots && this.dots.length) {
        const rr = SpriteStore.redCanvas(LADYBUG_RING_KEY, 512);
        if (rr) {
          const R = LADYBUG_RING_RECT;
          ctx.globalAlpha = ra;
          ctx.drawImage(rr,
            (R[0] - 0.5) * this.drawSize, (R[1] - 0.5) * this.drawSize,
            R[2] * this.drawSize, R[3] * this.drawSize);
        }
      }
      ctx.restore();
    }
    // 名牌（参照 生物.png）：名称(上) + 血条(中) + 稀有度(下)。
    // 文字统一 Ubuntu 800 + 纯黑描边（与卡牌/悬浮框同款漫画字）；名称白色，稀有度用其本色。
    if (!this.dead) {
      // 名牌（血条/名称/稀有度）一律用【common 等级的基准尺寸】，不随稀有度缩放 ——
      // 这样大怪小怪的名牌大小一致，远看也读得清。只有"比 common 还小"的生物才按比例收一点，
      // 免得血条比身体还宽。（当前所有生物都 ≥ common，所以实际上就是固定大小。）
      const fs = 12.6 * 0.6 * 1.2;        // 字号（名称/稀有度，当前 1.2 倍）
      const bw = HPBAR_W;                 // 血条宽度（全实体共用，见 HPBAR_W）
      const bh = HPBAR_H;
      const bodyBottom = this.y + this.r;                  // 图案实际底边（半径即 r）
      const nameY = bodyBottom + fs * 1.05;                // 名称基线（血条上方）
      const barY = nameY + fs * 0.34;                      // 血条顶
      const rarY = barY + bh + fs * 1.0;                   // 稀有度基线（血条下方）
      const bx = this.x - bw / 2, br = this.x + bw / 2;    // 血条左右边界

      const rarCol = (typeof RARITIES !== 'undefined' && RARITIES[this.rarity])
        ? RARITIES[this.rarity].color : '#fff';
      const rarName = (typeof I18N !== 'undefined')
        ? I18N.t('Rarities/' + this.rarity + '/Name', this.rarity) : this.rarity;

      ctx.save();
      ctx.font = `800 ${fs.toFixed(1)}px ${CardRenderer.FONT}`;
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round'; ctx.miterLimit = 2;
      ctx.lineWidth = fs * 0.16;
      ctx.strokeStyle = '#000';

      // 名称（白色，左对齐到血条左端）
      ctx.textAlign = 'left';
      ctx.strokeText(this.name, bx, nameY);
      ctx.fillStyle = '#fff';
      ctx.fillText(this.name, bx, nameY);

      // 血条：圆角 + 深色描边，填充色随比例 绿→黄→红
      const rad = Math.min(bh / 2, 6);
      roundRectPath(ctx, bx, barY, bw, bh, rad);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fill();
      const ratio = clamp(this.hp / this.maxHp, 0, 1);
      if (ratio > 0) {
        roundRectPath(ctx, bx, barY, Math.max(bh, bw * ratio), bh, rad);
        // 剩余血量：绿 -> 红 连续渐变（与主角血条同一 helper）
        ctx.fillStyle = hpBarColor(ratio);
        ctx.fill();
      }
      ctx.lineWidth = Math.max(1.2, bh * 0.22);
      ctx.strokeStyle = '#000';
      roundRectPath(ctx, bx, barY, bw, bh, rad);
      ctx.stroke();

      // 稀有度（本色，右对齐到血条右端）
      ctx.textAlign = 'right';
      ctx.lineWidth = fs * 0.16;
      ctx.strokeText(rarName, br, rarY);
      ctx.fillStyle = rarCol;
      ctx.fillText(rarName, br, rarY);
      ctx.restore();
    }
  }
}

class Card {
  constructor(x, y, type, rarity) {
    this.x = x; this.y = y; this.type = type; this.rarity = rarity;
    this.color = RARITIES[rarity].color;
    this.angle = rand(0, TAU); this.bob = rand(0, TAU);
    this.r = 13; this.picked = false; this.done = false; this.pickT = 0;
    this.age = 0;                     // 出场计时（渐显用）
    this.size = 30;
  }
  update(dt, player) {
    this.age += dt;
    this.bob += dt; this.angle += dt * 1.6;
    if (this.picked) {
      this.pickT += dt;
      const t = clamp(this.pickT / FADE_T, 0, 1);   // 退场 0.5s
      this.x = lerp(this.x, player.x, t);
      this.y = lerp(this.y, player.y - 30, t);
      if (t >= 1) this.done = true;
      return;
    }
    const d = dist(this.x, this.y, player.x, player.y);
    if (d < 150) {
      const a = angleTo(this.x, this.y, player.x, player.y);
      const pull = lerp(40, 280, (150 - d) / 150);
      this.x += Math.cos(a) * pull * dt;
      this.y += Math.sin(a) * pull * dt;
    }
  }
  draw(ctx) {
    if (this.picked) {
      const d = deathFade(clamp(this.pickT / FADE_T, 0, 1));   // 退场：放大 + 渐隐
      drawSprite(ctx, 'petal' + this.type.svg, this.size * d.scale,
        this.x, this.y, this.angle, 1, d.alpha);
      return;
    }
    const bobY = Math.sin(this.bob * 2) * 3;
    const a = spawnFade(this.age);                 // 出场：0.1s 渐显
    const pop = spawnPop(this.age);                // Q 弹出场（全体实体统一）
    ctx.save();
    ctx.shadowColor = this.color; ctx.shadowBlur = 14;
    drawSprite(ctx, 'petal' + this.type.svg, this.size * pop, this.x, this.y + bobY, this.angle, 1, a);
    ctx.restore();
    // 稀有度环
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = this.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(this.x, this.y + bobY, (this.r + 4) * pop, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    const a = rand(0, TAU), sp = rand(40, 220);
    this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
    this.life = rand(0.3, 0.7); this.max = this.life;
    this.color = color; this.size = rand(2, 5);
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.92; this.vy *= 0.92;
    this.life -= dt;
  }
  draw(ctx) {
    const t = clamp(this.life / this.max, 0, 1);
    ctx.globalAlpha = t;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size * t, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

class DamageText {
  constructor(x, y, text, color) {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.life = 0.55; this.max = 0.55; this.vy = -60;
    this.age = 0;
  }
  update(dt) {
    this.age += dt;
    this.y += this.vy * dt;
    this.vy *= Math.pow(0.9, dt * 60);   // 帧率无关的上浮衰减
    this.life -= dt;
  }
  draw(ctx) {
    // Q 弹弹出：前 0.15s easeOutBack 缩放（过冲到 ~1.1 再回落），配合快速上跳
    const pt = clamp(this.age / 0.15, 0, 1);
    const c1 = 1.70158, c3 = c1 + 1;
    const scale = 1 + c3 * Math.pow(pt - 1, 3) + c1 * Math.pow(pt - 1, 2);
    // 末段 0.25s 加速渐隐（比旧版 0.8s 全程线性短促得多）
    const alpha = clamp(this.life / 0.25, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    ctx.font = '800 16px ' + CardRenderer.FONT;   // Ubuntu 粗体数字（离线自动回退）
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(this.text, 0, 0);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}
