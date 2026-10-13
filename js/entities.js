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
const FADE_T      = 0.5;
const DEATH_SCALE = 1.5;
function spawnFade(age) { return clamp(age / FADE_T, 0, 1); }                 // 出场：0 -> 1 的 alpha
function deathFade(t01) { return { scale: 1 + (DEATH_SCALE - 1) * t01, alpha: 1 - t01 }; }

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
    this.dead = false; this.deathTimer = 0;
    this.breath = 0; this.moving = false;
    this.spin = 0;              // 花瓣环绕角度
    this.petals = [];           // 花瓣实体（各自有实际坐标与速度）
    this.petalGhosts = [];      // 已卸下/被移除的花瓣：原地放大渐隐
    this.petalWorld = [];
    this.name = 'Flower';
    // 模式状态：空格=reach、Shift=detect
    this.mode = 'normal';        // 'normal' | 'reach' | 'detect'
    this.modeT = 0;              // 模式过渡进度 0->1（0.15s）
  }

  recompute() {
    let hp = 0, spd = 0, dmg = 0;
    for (const p of this.slots) {
      if (p) { hp += p.type.hp; dmg += p.type.dmg; spd += p.type.spd; }
    }
    this.maxHp = Math.max(20, 100 + hp);
    this.speed = Math.max(60, this.baseSpeed + spd);
    this.damage = dmg;
  }

  update(dt, dir, map, mobs) {
    if (this.dead) { this.deathTimer += dt; return; }
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
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt);

    this.spin += PETAL_SPIN * dt;
    // 模式过渡动画：0.15s平滑过渡
    const targetT = (this.mode === 'normal') ? 0 : 1;
    const modeRate = 1 / 0.15;  // 0.15秒完成过渡
    this.modeT = damp(this.modeT, targetT, modeRate, dt);
    this._syncPetals(dt, map, mobs);
  }

  // 花瓣是实体 -> 会撞墙、也会撞生物：
  //   期望位置若在墙里，本帧位移会被 map.move 挡住（贴着墙继续挤）；
  //   由于目标点随自转持续转动，转到没墙的一侧时花瓣就自然滑出/弹回去。
  // 取消花瓣与墙体的碰撞：花瓣自由跟随主角，穿墙不卡（仍与生物单向挤出）
  _resolvePetal(b, mx, my, map, mobs) {
    b.x += mx; b.y += my;
    // 与生物：把花瓣挤出生物体外（单向，不推动生物）
    if (mobs) {
      for (const m of mobs) {
        if (!m || m.dead) continue;
        const dx = b.x - m.x, dy = b.y - m.y;
        const d = Math.hypot(dx, dy);
        const rr = PETAL_R + m.r;
        if (d > 0 && d < rr) { b.x = m.x + (dx / d) * rr; b.y = m.y + (dy / d) * rr; }
      }
    }
  }

  // 花瓣 = 实体：每片都有"此刻应在的位置"(target) 与 "实际位置"，平滑吸附过去。
  //   · 按「当前装备数量」平分一圈：2 片 180° 相对、3 片三角、5 片五角……（空槽不占位）
  //   · 刚上场的花瓣初始位置就在人物中心，再慢慢"冒"到应在位置
  //   · 人物跑起来时目标点跟着跑，花瓣会被甩在后面一小段距离，再平滑吸附（故意保留的缓冲感）
  //   · 装备数量变化引起间距重排时，同样走这套吸附过程，绝不瞬移
  _syncPetals(dt, map, mobs) {
    const live = [];
    for (let i = 0; i < this.slots.length; i++) if (this.slots[i]) live.push(i);
    const n = live.length;

    // 同步实体列表：同一张卡保留其运动状态；新出现的卡从人物中心出生
    const bodies = [];
    for (let k = 0; k < n; k++) {
      const slotIndex = live[k];
      const card = this.slots[slotIndex];
      let body = null;
      for (const b of this.petals) if (b.slotIndex === slotIndex && b.card === card) { body = b; break; }
      if (!body) body = { slotIndex, card, x: this.x, y: this.y, age: 0 };
      body.age += dt;
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
    this.petalGhosts = this.petalGhosts.filter((g) => g.age < FADE_T);

    // 计算应在位置，用欠阻尼弹簧吸附过去（帧率无关；目标突变时平滑追赶，绝不瞬移）
    const step = n > 0 ? TAU / n : 0;
    // 花瓣距离：reach模式×2，detect模式×0.5，normal×1
    let reachMult = 1;
    if (this.mode === 'reach') reachMult = 1 + this.modeT;              // 1 -> 2
    else if (this.mode === 'detect') reachMult = 1 - (1 - PETAL_DETECT) * this.modeT;  // 1 -> 0.5
    const reach = this.r * (1 + PETAL_REACH) * 1.105 * reachMult;
    const dtc = Math.min(dt, 0.05);   // 弹簧积分步长上限（防掉帧时数值爆炸）
    for (const b of this.petals) {
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
      // 走碰撞管线：撞生物时被挤出，速度保留（下一帧弹簧自动修正）
      this._resolvePetal(b, b.vx * dtc, b.vy * dtc, map, mobs);
    }

    // 供绘制与碰撞使用
    this.petalWorld = this.petals.map((b) => ({ x: b.x, y: b.y, r: PETAL_R, index: b.slotIndex, age: b.age }));
  }

  draw(ctx) {
    if (this.dead) return;
    // 花瓣实体：出场渐显（大小不变）
    for (const pp of this.petalWorld) {
      const p = this.slots[pp.index];
      const size = 15 * 0.9;                        // 13.5：花瓣视觉缩至原 0.9
      // 朝向 = 由花心指向花瓣：被甩在后面时姿态也会自然跟着偏
      const rot = Math.atan2(pp.y - this.y, pp.x - this.x) + Math.PI / 2;
      const a = spawnFade(pp.age);                // 出场：仅渐显 0.5s
      const cv = CardRenderer.artCanvas(p.type.svg, 128);   // 未就绪时返回 null
      if (cv) drawArt(ctx, cv, size, pp.x, pp.y, rot, 1, a);
      else drawSprite(ctx, 'petal' + p.type.svg, size, pp.x, pp.y, rot, 1, a);  // 回退
    }
    // 被卸下/移除的花瓣：留在原地放大 1.12 倍并渐隐 0.5s
    for (const g of this.petalGhosts) {
      const size = 15 * 0.9;                         // 与在场花瓣同尺寸（原来漏定义 -> 抛错，导致主角脸整帧不画）
      const t01 = clamp(g.age / FADE_T, 0, 1);
      const d = { scale: 1 + 0.12 * t01, alpha: 1 - t01 };   // 卸下花瓣：仅轻微放大+渐隐，避免放大到 1.5 倍盖住主角
      const rot = Math.atan2(g.y - this.y, g.x - this.x) + Math.PI / 2;
      const cv = CardRenderer.artCanvas(g.card.type.svg, 128);
      if (cv) drawArt(ctx, cv, size, g.x, g.y, rot, d.scale, d.alpha);
      else drawSprite(ctx, 'petal' + g.card.type.svg, size, g.x, g.y, rot, d.scale, d.alpha);
    }

    // 主角：黄色笑脸（整体固定正放，不随朝向旋转；只有眼睛里的白色随移动方向偏移）
    const R = this.r * 1.2;                 // 脸部半径
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
  }
}

class Mob {
  constructor(type, x, y, level) {
    this.type = type; this.name = type.name; this.svg = type.svg; this.zh = type.zh || '';
    this.level = level || 1;
    const sc = mobScale(this.level);
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.r = type.size * sc; this.drawSize = type.size * 2.2 * sc;
    this.maxHp = type.hp; this.hp = type.hp;
    this.dmg = type.dmg; this.speed = (type.speed || 0) * SPEED_SCALE;
    this.color = type.color; this.boss = !!type.boss;
    this.facing = rand(0, TAU); this.bob = rand(0, TAU);
    this.flash = 0; this.hitCd = 0; this.squash = 0;
    this.dead = false; this.deathTimer = 0;
    this.age = 0;                       // 出场计时（渐显用）
    this.wanderA = rand(0, TAU); this.wanderT = 0;
    this.aggro = false;
    this.xpVal = 4 + type.tier * 4;
  }

  update(dt, player, map) {
    if (this.dead) { this.deathTimer += dt; return; }
    this.age += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.hitCd = Math.max(0, this.hitCd - dt);
    this.squash = damp(this.squash, 0, 10, dt);
    this.bob += dt;
    const d = dist(this.x, this.y, player.x, player.y);
    this.aggro = d < 520 && !player.dead;
    let tx, ty;
    if (this.aggro) {
      const a = angleTo(this.x, this.y, player.x, player.y);
      tx = Math.cos(a) * this.speed; ty = Math.sin(a) * this.speed;
      this.facing = lerpAngle(this.facing, a, clamp(dt * 8, 0, 1));
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) { this.wanderA = rand(0, TAU); this.wanderT = rand(1, 3); }
      tx = Math.cos(this.wanderA) * this.speed * 0.35;
      ty = Math.sin(this.wanderA) * this.speed * 0.35;
      this.facing = lerpAngle(this.facing, this.wanderA, clamp(dt * 4, 0, 1));
    }
    this.vx = damp(this.vx, tx, 6, dt);
    this.vy = damp(this.vy, ty, 6, dt);
    moveEntity(this, dt, map);
  }

  draw(ctx) {
    let scale = 1 + this.squash * 0.4;
    let alpha = spawnFade(this.age);        // 出场：大小不变，渐显
    if (this.dead) {
      const d = deathFade(clamp(this.deathTimer / FADE_T, 0, 1));   // 退场：放大到 1.5 倍 + 渐隐
      scale *= d.scale;
      alpha = d.alpha;
    }
    const bob = 1 + Math.sin(this.bob * 3) * 0.05;
    const key = 'mob' + this.svg;
    if (this.flash > 0) {
      drawWhite(ctx, key, this.drawSize, this.x, this.y, this.facing, scale * bob,
        spawnFade(this.age) * clamp(this.flash / 0.14, 0, 1) * 0.9);
    } else {
      drawSprite(ctx, key, this.drawSize, this.x, this.y, this.facing, scale * bob, alpha);
    }
    // 血条：永远显示在正下方，按当前尺寸缩放宽度，满血也显示
    if (!this.dead) {
      const w = Math.max(22, this.r * 1.8), h = Math.max(3, this.r * 0.16);
      const hx = this.x - w / 2, hy = this.y + this.drawSize * 0.5 + 7;
      const ratio = clamp(this.hp / this.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(hx, hy, w, h);
      // 颜色：高血绿、中黄、低红
      const col = ratio > 0.5 ? '#43d35a' : (ratio > 0.25 ? '#e8c63a' : '#ff5a5a');
      ctx.fillStyle = col; ctx.fillRect(hx, hy, w * ratio, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(hx, hy, w, h);
      // 等级（连带显示在血条上）
      ctx.font = 'bold ' + Math.max(10, Math.round(h * 2.2)) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText('Lv' + fmtNum(this.level), this.x, hy + h / 2);
      ctx.fillStyle = '#ffe27a';
      ctx.fillText('Lv' + fmtNum(this.level), this.x, hy + h / 2);
      // 生物中文名（更直观）
      if (this.zh) {
        ctx.font = '11px sans-serif';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.strokeText(this.zh, this.x, hy + h + 9);
        ctx.fillStyle = '#dfe';
        ctx.fillText(this.zh, this.x, hy + h + 9);
      }
      ctx.textBaseline = 'alphabetic';
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
    const a = spawnFade(this.age);                 // 出场：大小不变，渐显
    ctx.save();
    ctx.shadowColor = this.color; ctx.shadowBlur = 14;
    drawSprite(ctx, 'petal' + this.type.svg, this.size, this.x, this.y + bobY, this.angle, 1, a);
    ctx.restore();
    // 稀有度环
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = this.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(this.x, this.y + bobY, this.r + 4, 0, TAU); ctx.stroke();
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
    this.life = 0.8; this.max = 0.8; this.vy = -42;
  }
  update(dt) { this.y += this.vy * dt; this.vy *= 0.94; this.life -= dt; }
  draw(ctx) {
    const t = clamp(this.life / this.max, 0, 1);
    ctx.globalAlpha = t;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(this.text, this.x, this.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}
