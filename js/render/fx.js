// render/fx.js — 表现层特效：粒子、掉落火花、伤害飘字
'use strict';

class DropSpark {
  constructor(x, y, color, mode, half) {
    const rise = mode === 'rise';
    const h = Math.max(0, half || 0);
    // 四周边缘取点：0=上 1=右 2=下 3=左（t = 沿该边的位置 -1..1）
    const side = Math.floor(Math.random() * 4);
    const t = rand(-1, 1);
    let px, py;
    if (side === 0) { px = t * h; py = -h; }
    else if (side === 1) { px = h; py = t * h; }
    else if (side === 2) { px = t * h; py = h; }
    else { px = -h; py = t * h; }
    this.x = x + px;
    this.y = y + py;
    this.color = color;
    this.size = rand(5, 10);                        // 基础大小 ×2（原 2.5~5）
    // 速度：沿该边的外法线飞出（±0.5rad 抖动）。
    // 【不做任何竖直偏置】—— 四条边被等概率选中，于是上下左右四个方向的粒子数相等，
    // 看起来是"平等地向四周冒出"，而不是总往上飘。
    const nx = side === 1 ? 1 : (side === 3 ? -1 : 0);
    const ny = side === 0 ? -1 : (side === 2 ? 1 : 0);
    const sp = rise ? rand(26, 90) : rand(120, 300);
    const ja = rand(-0.5, 0.5);
    const ca = Math.cos(ja), sa = Math.sin(ja);
    this.vx = (nx * ca - ny * sa) * sp;
    this.vy = (nx * sa + ny * ca) * sp;
    // 重力也压小（burst）／取消（rise）：重力方向单一，会把"向四周"拉成"向下坠"。
    this.grav = rise ? 0 : 140;
    this.rot = rand(0, TAU);
    this.vr = rand(-8, 8);
    this.life = rand(0.45, 0.85);
    this.max = this.life;
  }
  update(dt) {
    this.vy += this.grav * dt;
    this.vx *= 0.97; this.vy *= 0.97;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.rot += this.vr * dt;
    this.life -= dt;
  }
  draw(ctx) {
    const t = clamp(this.life / this.max, 0, 1);
    const s = this.size * (0.55 + 0.45 * t);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = this.color;
    ctx.fillRect(-s / 2, -s / 2, s, s);
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
