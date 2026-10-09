// entities.js — 实体（玩家/生物/卡片/粒子/伤害数字）与绘制辅助
'use strict';

// 世界放大后（瓦片 24→384），移动速度按相同比例放大，保持手感一致。
const SPEED_SCALE = 5;

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
    this.r = 22;
    this.facing = 0;
    this.baseSpeed = 232 * SPEED_SCALE; this.speed = this.baseSpeed;
    this.maxHp = 100; this.hp = 100;
    this.xp = 0; this.level = 1; this.xpNext = 24;
    this.damage = 0;
    this.slots = [null, null, null, null, null];   // 花朵花瓣（卡槽，已装备）
    this.invBar = [];                              // 即时物品栏（底部常驻淡灰卡槽）
    this.backpack = [];                            // 背包库存（仅在背包面板可见）
    this.maxInvBar = 8;
    this.maxBackpack = 24;
    this.invuln = 0; this.flash = 0;
    this.dead = false; this.deathTimer = 0;
    this.breath = 0; this.moving = false;
    this.petalWorld = [];
    this.name = 'Flower';
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

  update(dt, dir, map) {
    if (this.dead) { this.deathTimer += dt; return; }
    const len = Math.hypot(dir.x, dir.y);
    let tx = 0, ty = 0;
    if (len > 0) { tx = dir.x / len * this.speed; ty = dir.y / len * this.speed; }
    this.vx = damp(this.vx, tx, 12, dt);
    this.vy = damp(this.vy, ty, 12, dt);
    moveEntity(this, dt, map);
    this.moving = len > 0;
    if (this.moving) {
      const ta = Math.atan2(this.vy, this.vx);
      this.facing = lerpAngle(this.facing, ta, clamp(dt * 12, 0, 1));
    }
    this.breath += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt);

    // 计算每片花瓣的世界坐标（用于绘制与碰撞）
    this.petalWorld = [];
    const step = TAU / this.slots.length;
    for (let i = 0; i < this.slots.length; i++) {
      const p = this.slots[i];
      if (!p) continue;
      const ang = this.facing + i * step + this.breath * 0.6;
      const reach = this.r + 15 + (p.lunge > 0 ? p.lunge * 38 : 0) + Math.sin(this.breath * 3 + i) * 2;
      this.petalWorld.push({
        x: this.x + Math.cos(ang) * reach,
        y: this.y + Math.sin(ang) * reach,
        r: 14, index: i, ang
      });
    }
    for (const p of this.slots) if (p && p.lunge > 0) p.lunge = Math.max(0, p.lunge - dt);
  }

  gainXp(n) {
    this.xp += n;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.round(this.xpNext * 1.22 + 8);
      this.maxHp += 12;
      this.hp = this.maxHp;
    }
  }

  draw(ctx) {
    if (this.dead) return;
    // 花瓣
    for (const pp of this.petalWorld) {
      const p = this.slots[pp.index];
      const size = 30;
      const rot = pp.ang + Math.PI / 2;
      // 稀有度光晕
      ctx.save();
      ctx.shadowColor = p.type.color || '#fff';
      ctx.shadowBlur = 10;
      drawSprite(ctx, 'petal' + p.type.svg, size, pp.x, pp.y, rot, 1, 1);
      ctx.restore();
      if (p.lunge > 0) {
        drawWhite(ctx, 'petal' + p.type.svg, size, pp.x, pp.y, rot, 1, p.lunge * 3);
      }
    }
    // 身体（花心）
    const bs = this.r * 2.4 * (1 + 0.04 * Math.sin(this.breath * 2));
    const grad = ctx.createRadialGradient(this.x - bs * 0.12, this.y - bs * 0.12, bs * 0.1, this.x, this.y, bs * 0.6);
    grad.addColorStop(0, '#fff7e6');
    grad.addColorStop(1, '#f2d79a');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(this.x, this.y, bs * 0.5, 0, TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(150,110,40,0.5)'; ctx.stroke();

    // 眼睛（朝向移动方向）
    const look = this.facing;
    const ex = Math.cos(look) * bs * 0.16, ey = Math.sin(look) * bs * 0.16;
    for (const s of [-1, 1]) {
      const ox = this.x + Math.cos(look + Math.PI / 2) * bs * 0.18 * s;
      const oy = this.y + Math.sin(look + Math.PI / 2) * bs * 0.18 * s;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ox, oy, bs * 0.13, 0, TAU); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(ox + ex * 0.5, oy + ey * 0.5, bs * 0.07, 0, TAU); ctx.fill();
    }

    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.flash / 0.18, 0, 1) * 0.85;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(this.x, this.y, bs * 0.5, 0, TAU); ctx.fill();
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
    this.wanderA = rand(0, TAU); this.wanderT = 0;
    this.aggro = false;
    this.xpVal = 4 + type.tier * 4;
  }

  update(dt, player, map) {
    if (this.dead) { this.deathTimer += dt; return; }
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
    let alpha = 1;
    if (this.dead) {
      const t = clamp(this.deathTimer / 0.5, 0, 1);
      scale *= (1 - t);
      alpha = 1 - t;
    }
    const bob = 1 + Math.sin(this.bob * 3) * 0.05;
    const key = 'mob' + this.svg;
    if (this.flash > 0) {
      drawWhite(ctx, key, this.drawSize, this.x, this.y, this.facing, scale * bob, clamp(this.flash / 0.14, 0, 1) * 0.9);
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
      ctx.strokeText('Lv' + this.level, this.x, hy + h / 2);
      ctx.fillStyle = '#ffe27a';
      ctx.fillText('Lv' + this.level, this.x, hy + h / 2);
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
    this.size = 30;
  }
  update(dt, player) {
    this.bob += dt; this.angle += dt * 1.6;
    if (this.picked) {
      this.pickT += dt;
      const t = clamp(this.pickT / 0.25, 0, 1);
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
      const t = clamp(this.pickT / 0.25, 0, 1);
      drawSprite(ctx, 'petal' + this.type.svg, this.size * (1 - t * 0.6),
        this.x, this.y, this.angle, 1, 1 - t);
      return;
    }
    const bobY = Math.sin(this.bob * 2) * 3;
    ctx.save();
    ctx.shadowColor = this.color; ctx.shadowBlur = 14;
    drawSprite(ctx, 'petal' + this.type.svg, this.size, this.x, this.y + bobY, this.angle, 1, 1);
    ctx.restore();
    // 稀有度环
    ctx.strokeStyle = this.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(this.x, this.y + bobY, this.r + 4, 0, TAU); ctx.stroke();
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
