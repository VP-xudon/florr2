// sim/drops.js — 掉落物：掉落表渲染缓存与地面卡实体
'use strict';

const DROP_SIZE = 36;            // 世界像素边长（与旧的地面卡片 30 接近，略大一点便于辨认）
const DROP_FACE_PX = 144;        // 离屏卡面分辨率（4 倍超采样，缩小绘制仍然清晰）
const DROP_PICK_R = 2;           // 拾取半径 = 2 × 玩家【直径】
const DROP_FLY_T = 0.26;         // 飞回玩家中心并缩小的时长（秒）
const DROP_POP_T = 0.34;         // 从死亡点弹到目标位置的时长（秒）
// 掉落物存活时长（秒，按掉落物自身稀有度）：common 30 / unusual 60 / rare 90 / epic 120 /
// legendary 150 / mythic 180 / ultra 210；super 及以上不过期（Infinity）。
const DROP_LIFETIME = {
  common: 30, unusual: 60, rare: 90, epic: 120, legendary: 150,
  mythic: 180, ultra: 210, super: Infinity, eternal: Infinity, unique: Infinity
};
const DROP_DESPAWN_T = 0.5;      // 到期后的渐隐消失时长（秒）
// 呼吸起伏：每 2 秒 3 个来回 -> 周期 2/3 s -> 角频率 2π×(3/2)
const DROP_BREATH_W = (TAU * 3) / 2;
const DROP_BREATH_AMP = 0.024;   // 幅度 2.4%（原 1.2% 的 2 倍）
const DROP_FX_CONT = new Set(['ultra', 'super', 'eternal', 'unique']);   // 持续冒粒子的稀有度
const _dropFaceCache = {};       // slug|rarity -> 已渲染好的卡面 canvas

function dropFaceCanvas(slug, rarity, name, svg) {
  const k = slug + '|' + rarity;
  const hit = _dropFaceCache[k];
  if (hit) return hit;
  const cv = document.createElement('canvas');
  if (typeof CardRenderer !== 'undefined' && CardRenderer.renderCardTo) {
    CardRenderer.renderCardTo(cv, {
      svg: (svg != null) ? svg : null, name: name || null,
      rarity, px: DROP_FACE_PX, pad: 0.0756, radius: 0.0588
    });
  }
  _dropFaceCache[k] = cv;
  return cv;
}

// 多张掉落物的排布偏移（相对死亡点）：
//   1 张  -> 正中央
//   2 张  -> 水平并排（中间留 gap）
//   3~6 张 -> 与 Light 多体同思路的环形排布，但半径更大（"离得远一点"）
function dropLayoutOffset(i, n, gap) {
  if (n <= 1) return { x: 0, y: 0 };
  if (n === 2) return { x: (i - 0.5) * gap, y: 0 };
  const R = gap * (n <= 4 ? 0.82 : 0.98);
  const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
  return { x: Math.cos(a) * R, y: Math.sin(a) * R };
}

class DropCard {
  constructor(slug, svg, rarity, name, x, y, off) {
    this.slug = slug;
    this.svg = svg;
    this.rarity = rarity;
    this.name = name || slug;
    // 出生在【生物死亡点】，再"弹"到各自的目标位置（不是直接出现在那里）
    this.ox = x; this.oy = y;                    // 弹出起点 = 死亡点
    this.tx = x + (off ? off.x : 0);             // 目标位置
    this.ty = y + (off ? off.y : 0);
    this.x = x; this.y = y;
    this.popT = 0;           // 弹出进度 0->1（easeOutBack：先冲出去、再轻轻回落）
    this.count = 1;          // 完全相同的卡牌堆叠在同一张卡上
    this.age = 0;
    this.size = DROP_SIZE;
    this.life = (DROP_LIFETIME[this.rarity] != null) ? DROP_LIFETIME[this.rarity] : DROP_LIFETIME.common;
    this.fade = 0;           // 到期渐隐进度 0~1（1 = 彻底消失）
    this.fly = 0;            // 0 = 停留；0~1 = 正在飞向玩家（同时缩小）
    this.sx = 0; this.sy = 0;
    this.done = false;
    this.picked = false;     // 是否已被玩家捡走（到期自然消失 = false）
    this.sparkT = 0;         // Ultra+ 持续粒子的发射计时
    // 随机偏转：-15° ~ +15°（左右各 15 度），让掉在地上的卡看起来是"散落"而非整齐排列。
    // 生成时定死，飞行拾取过程中不再变化。
    this.rot = rand(-Math.PI / 12, Math.PI / 12);
  }
  // 开始拾取：记下起点，之后沿缓出曲线飞向玩家中心
  pick() {
    if (this.fly) return;
    this.fly = 0.0001;
    this.picked = true;        // 区分"被捡走"与"到期自然消失"（后者不能进背包）
    this.sx = this.x; this.sy = this.y;
  }
  update(dt, player) {
    this.age += dt;
    // ① 存活时长到期：没有被捡走就开始渐隐，直到完全消失（super 及以上永不过期）
    if (!this.fly && Number.isFinite(this.life) && this.age >= this.life) {
      this.fade = Math.min(1, this.fade + dt / DROP_DESPAWN_T);
      if (this.fade >= 1) { this.done = true; return; }
    }
    // ② 弹出阶段：从死亡点飞向目标位置（期间不可拾取）
    if (this.popT < 1) {
      this.popT = Math.min(1, this.popT + dt / DROP_POP_T);
      const t = this.popT, c1 = 1.10158, c3 = c1 + 1;
      const e = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);   // easeOutBack，轻微过冲
      this.x = this.ox + (this.tx - this.ox) * e;
      this.y = this.oy + (this.ty - this.oy) * e;
      if (this.popT >= 1) { this.x = this.tx; this.y = this.ty; }
      return;
    }
    if (!this.fly) return;
    this.fly = Math.min(1, this.fly + dt / DROP_FLY_T);
    const t = this.fly;
    const e = 1 - Math.pow(1 - t, 2);            // easeOut：起步快、末端吸附
    this.x = this.sx + (player.x - this.sx) * e;
    this.y = this.sy + (player.y - this.sy) * e;
    if (t >= 1) this.done = true;
  }
  // 飞行中缩小到 0.18（看起来就是"被吸进背包"）
  get scale() { return this.fly ? (1 - 0.82 * this.fly) : 1; }
  draw(ctx) {
    const pop = spawnPop(this.age);                 // 出场 Q 弹（与全局实体一致）
    // 呼吸：幅度 2.4%，每 2 秒 3 个来回（周期 2/3 s）
    const breathe = 1 + DROP_BREATH_AMP * Math.sin(this.age * DROP_BREATH_W);
    // 到期渐隐时同步缩一点，读起来像"慢慢化掉"而不是突然消失
    const fadeK = 1 - this.fade;
    const d = this.size * this.scale * pop * breathe * (1 - 0.15 * this.fade);
    if (d <= 0.5 || fadeK <= 0) return;
    const cv = dropFaceCanvas(this.slug, this.rarity, this.name, this.svg);
    ctx.save();
    if (this.fly || this.fade) {
      const a = Math.max(0, 1 - this.fly * 0.85) * fadeK;
      if (a < 1) ctx.globalAlpha = a;
    }
    // 整张卡绕自身中心旋转 Math.rot（随机 ±15°），角标跟着一起转
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    if (cv) {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(cv, -d / 2, -d / 2, d, d);
    } else {
      // 卡面素材尚未就绪：先用稀有度色块占位（不闪烁，拿不到真实卡面时才出现）
      const col = (typeof RARITIES !== 'undefined' && RARITIES[this.rarity]) ? RARITIES[this.rarity].color : '#888';
      ctx.fillStyle = col;
      ctx.fillRect(-d / 2, -d / 2, d, d);
    }
    // 数量角标：与背包 .card-count 同一套样式（右上角、右倾 30°、白字黑描边、字号 0.236×卡宽）
    if (this.count > 1) {
      ctx.translate(d * 0.42, -d * 0.30);
      ctx.rotate(Math.PI / 6);
      const fs = Math.max(6, d * 0.236);
      ctx.font = '800 ' + fs + 'px ' + CardRenderer.FONT;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.miterLimit = 2;
      ctx.lineWidth = fs * 0.115;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#fff';
      const txt = 'x' + fmtNum(this.count);
      ctx.strokeText(txt, 0, 0);
      ctx.fillText(txt, 0, 0);
    }
    ctx.restore();
  }
}

// 掉落物粒子（正方形小块，稀有度色）：
//   mode 'burst' = 落地瞬间向四周炸开（Mythic 及以下只有这一下，随后渐隐）
//   mode 'rise'  = Ultra 及以上持续冒出（轻微上飘）
// 出生点固定落在【卡片四周边缘】上（随机一条边、随机位置），并沿外法线方向飞出，
// 所以看起来是从卡面四周冒出来，而不是从卡中心点冒出来。
