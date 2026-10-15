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
// 卸下花瓣（卡牌实体消失）的退场时长：0.2s 快速渐隐。
// 单独一个常量而不用 FADE_T：生物死亡、掉落卡片、拾取特效仍保持 0.5s，只把"卸下花瓣"调快。
const PETAL_GHOST_T = 0.2;
function spawnFade(age) { return clamp(age / FADE_T, 0, 1); }                 // 出场：0 -> 1 的 alpha
function deathFade(t01) { return { scale: 1 + (DEATH_SCALE - 1) * t01, alpha: 1 - t01 }; }

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
  const cv = white ? SpriteStore.artWhiteCanvas(key, size) : SpriteStore.artCanvas(key, size);
  if (!cv) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (scale && scale !== 1) ctx.scale(scale, scale);
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.drawImage(cv, -size / 2, -size / 2, size, size);
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
    // 只有【装填完成】的主槽才生成花瓣实体 —— 装填中的槽位暂时没有花瓣
    const live = [];
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i] && this.reloadDone(i)) live.push(i);
    }
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
    this.petalGhosts = this.petalGhosts.filter((g) => g.age < PETAL_GHOST_T);

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

// 生物视觉直径 = 主角视觉直径 × 各稀有度倍率。
// 主角绘制半径 = r×1.2 = 13.2×1.2 = 15.84 -> 视觉直径 31.68。
// 倍率按用户给的两个基准点等比取值：common ≈ 1.9×、legendary ≈ 4.5×，
// 每升一级稀有度 ×1.2406，super/eternal/unique 顺势外推。
const PLAYER_VISUAL_D = 13.2 * 1.2 * 2;
const MOB_DIAM_STEP = Math.pow(4.5 / 1.9, 1 / 4);        // common -> legendary 共 4 级
const MOB_DIAM_BASE = 1.9;                                // common 的直径倍率
const MOB_DIAM = (function () {
  const o = {};
  const order = ['common', 'unusual', 'rare', 'epic', 'legendary', 'mythic', 'ultra', 'super', 'eternal', 'unique'];
  for (let i = 0; i < order.length; i++) o[order[i]] = MOB_DIAM_BASE * Math.pow(MOB_DIAM_STEP, i);
  return o;
})();
// 生物 SVG 的实际图案只占 viewBox 的一部分（外圈是 clipPath 留白）。
// 旧实现按 91.667/110 估算这个比例，但真实图案比 clipPath 更小，所以视觉总比碰撞箱小一圈。
// 现在改为运行时按 alpha 通道实测包围盒并裁剪（见 SpriteStore.artCanvas），这里只留注释说明。
const MOB_ART_RATIO = 91.667 / 110;

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
    this.flash = 0; this.hitCd = 0; this.squash = 0;
    this.dead = false; this.deathTimer = 0;
    this.age = 0;                       // 出场计时（渐隐用）
    this.aggro = false;                 // 仇恨：暂不启用（还没有伤害）
    this.xpVal = rs ? (rs.exp || 0) : (4 + type.tier * 4);
  }

  update(dt, player, map) {
    if (this.dead) { this.deathTimer += dt; return; }
    this.age += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.hitCd = Math.max(0, this.hitCd - dt);
    this.squash = damp(this.squash, 0, 10, dt);
    // 碰撞外形要等贴图光栅化后才能从轮廓提取；取到一次就固定（外形不随动画变）
    if (!this.shape) this.shape = SpriteStore.shape('mob' + this.svg, this.drawSize);

    // —— 1) 问 AI：现在想怎么动。AI 只给"移动欲望"，不直接改坐标 ——
    const want = MobAI.step(this.ai, dt, this);
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
    let alpha = spawnFade(this.age);        // 出场：大小不变，渐显
    if (this.dead) {
      const d = deathFade(clamp(this.deathTimer / FADE_T, 0, 1));   // 退场：放大到 1.5 倍 + 渐隐
      scale *= d.scale;
      alpha = d.alpha;
    }
    // 注意：生物【不做】呼吸/浮动特效（用户明确要求），尺寸只由受击挤压与退场缩放决定。
    const key = 'mob' + this.svg;
    // drawSize = 视觉直径 = 碰撞箱直径；贴图已按图案包围盒裁剪，正好撑满它
    if (this.flash > 0) {
      drawMob(ctx, key, this.drawSize, this.x, this.y, this.facing, scale,
        spawnFade(this.age) * clamp(this.flash / 0.14, 0, 1) * 0.9, true);
    } else {
      drawMob(ctx, key, this.drawSize, this.x, this.y, this.facing, scale, alpha, false);
    }
    // 名牌（参照 生物.png）：名称(上) + 血条(中) + 稀有度(下)。
    // 文字统一 Ubuntu 800 + 纯黑描边（与卡牌/悬浮框同款漫画字）；名称白色，稀有度用其本色。
    if (!this.dead) {
      // 名牌（血条/名称/稀有度）一律用【common 等级的基准尺寸】，不随稀有度缩放 ——
      // 这样大怪小怪的名牌大小一致，远看也读得清。只有"比 common 还小"的生物才按比例收一点，
      // 免得血条比身体还宽。（当前所有生物都 ≥ common，所以实际上就是固定大小。）
      const baseR = PLAYER_VISUAL_D * MOB_DIAM_BASE / 2;      // common 的半径 ≈ 30.1
      const fs = 12.6;                                        // 字号
      const bw = Math.max(30, Math.min(baseR * 1.7, this.r * 1.9));
      const bh = 6.6;                                         // 条高
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
        ctx.fillStyle = ratio > 0.5 ? '#5fd36a' : (ratio > 0.25 ? '#e8c63a' : '#ff5a5a');
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
