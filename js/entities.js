// entities.js — 实体（玩家/生物/卡片/粒子/伤害数字）与绘制辅助
'use strict';

// 世界放大后（瓦片 24→384），移动速度按相同比例放大，保持手感一致。
const SPEED_SCALE = 5;

// 玩家基础最大移速（生物仇恨追击速度以此为基准）
const PLAYER_BASE_SPEED = 232 * SPEED_SCALE * 0.2;
// ---- 生物移动速度口径（全部以"玩家默认最高速度"为基准）----
const MOB_CHASE_MULT = 0.90;          // 通用追击速度 = 0.90×（瓢虫及默认追击）
const MOB_WANDER_MULT = 0.95;         // 游荡速度的基准倍率（与追击解耦，保持原有游荡手感）
const MOB_WANDER_RANGE = [0.3, 0.5];  // 游荡速度 = 基准 ×(0.3~0.5) 随机
const MOB_WANDER_SCALE = 0.75;        // 游荡速度在基础值上再打 0.75 折（全生物统一）
const BEE_CHASE_MULT = 1.05;          // 蜜蜂追击 = 1.05×（走 S 型，实际推进比直线略慢）
const BEE_WANDER_FACTOR = 1.2;        // 蜜蜂游荡 = 瓢虫同分布游荡速度 ×1.2
// 走 S 型（持续左右摆头）的生物：目前只有蜜蜂
const MOB_S_PATH_SLUGS = { bee: 1 };
const BEE_S_AMP = 0.62;               // 摆头幅度（弧度 ≈ 35°）
const BEE_S_HZ = 0.85;                // 摆头频率（Hz）
// 实体重量按【横截面积(直径²)】换算：直径差 N 倍 -> 重量差 N² 倍。
// 例：super 直径约为 common 的 ~11 倍 -> ~121 倍重（用户要求面积而非线性）。
// 障碍型生物 ×5；花朵本体 = unusual 重量；花瓣 = 对应稀有度重量。
// MOB_DIAM/MOB_DIAM_BASE 在文件后段定义，这里用函数惰性取用（调用发生在实体构造期，晚于其定义）。
function rarityWeight(rarity) {
  const d = MOB_DIAM[rarity] || MOB_DIAM_BASE;
  return Math.pow(d / MOB_DIAM.common, 2);
}
// 实体推挤的恢复系数（0=不弹，1=完全弹性）：低值主要表现为"推挤/阻力"而非弹飞
const PUSH_RESTITUTION = 0.2;

// 花朵本体数值（体伤 / 血量 / 受击保护）。集中在此，避免散落的魔法数。
const FLOWER_BASE_HP     = 100;   // 花朵基础血量（装备花瓣不再额外增加 maxHp）
const FLOWER_BODY_DMG    = 20;    // 花朵本体伤害（体伤）基础值
// 受伤后的无敌帧：只挡掉「同一 tick 里多只生物同时命中」的双扣，
// 不改变战斗本身每 tick 结算的节奏（体伤/接触伤害都是每 tick 正常结算）。
const FLOWER_HURT_INVULN = 0.2;
// 碰撞反弹：被非己方实体打伤时，本体沿远离方向位移的距离（占主角直径的比例）。
const FLOWER_KNOCKBACK = 0.3;
// 反弹总位移在双方之间的分配比例 [玩家份额, 生物份额]（按稀有度查表，份额和恒为 1）。
// 稀有度越高体型越大、越"重"：common 基本是生物被弹开，super 则基本是玩家被弹开。
const KNOCKBACK_SHARE = {
  common: [0.15, 0.85], unusual: [0.25, 0.75], rare: [0.35, 0.65], epic: [0.45, 0.55],
  legendary: [0.55, 0.45], mythic: [0.65, 0.35], ultra: [0.75, 0.25], super: [0.85, 0.15],
  eternal: [0.92, 0.08], unique: [0.92, 0.08]
};
// 反弹是「速度冲量 + 指数衰减」，不是瞬移：
//   施加时给一个初速度 v0 = 目标总位移 × KNOCKBACK_DECAY，随后每帧 damp 回 0，
//   位移对时间的积分正好收敛到目标总位移（∫v0·e^(-kt)dt = v0/k）。
// 观感上是"被撞得滑出去一小段再停住"，而不是"位置突然跳一下"。
const KNOCKBACK_DECAY = 12;
// 施加反弹冲量：ux/uy 为单位方向，total 为希望的总位移（世界像素）
function applyKnockback(ent, ux, uy, total) {
  const v = total * KNOCKBACK_DECAY;
  ent.kbX = (ent.kbX || 0) + ux * v;
  ent.kbY = (ent.kbY || 0) + uy * v;
}
// 每帧推进反弹速度衰减（实体 update 里调用）
function tickKnockback(ent, dt) {
  if (!ent.kbX && !ent.kbY) return;
  ent.kbX = damp(ent.kbX || 0, 0, KNOCKBACK_DECAY, dt);
  ent.kbY = damp(ent.kbY || 0, 0, KNOCKBACK_DECAY, dt);
  if (Math.abs(ent.kbX) < 1) ent.kbX = 0;   // 低于 1px/s 直接归零，避免长尾抖动
  if (Math.abs(ent.kbY) < 1) ent.kbY = 0;
}
// 出生无敌时长（秒）：开局 3 秒保护，配合光晕与金/白血条提示。
const FLOWER_SPAWN_INVULN = 3;
// 无敌光晕：每秒 2 个完整闪烁周期（4π/s），峰值 alpha 0.22 —— 很淡。
const INVULN_PULSE_HZ = 2;
const INVULN_PULSE_MAX = 0.22;
// 无敌血条配色（金色填充 + 白底）。
const INVULN_BAR_FILL = '#ffd75e';
const INVULN_BAR_BACK = '#ffffff';

// ---- 无敌模式（通用，非出生专属） ----
// 设计要点：内部按【绝对到期时间】记录每个来源，取最晚的到期时间作为当前无敌剩余。
// 这样"长无敌生效中又叠加一个短无敌"不会像普通倒计时那样被短的那个提前解除。
// 任何想获得无敌表现的东西（出生保护、受伤无敌帧、未来的无敌花瓣/技能）都调用同一接口：
//   InvulnFX.add(ent, 'petal:rose', 1.5)   // 来源名随意，同一来源重复 add 会覆盖而非叠加
//   InvulnFX.remove(ent, 'petal:rose')     // 提前撤销某个来源
// 视觉（光晕 / 金白血条）由持有 invuln 的实体自行按 invulnA 插值绘制，本模块只管时间。
const InvulnFX = {
  add(ent, src, dur) {
    if (!ent || dur <= 0) return;
    if (!ent.invulnSrc) ent.invulnSrc = {};
    ent.invulnSrc[src] = ent.clock + dur;      // 到期时刻 = 当前时刻 + 时长
    this.sync(ent);
  },
  remove(ent, src) {
    if (!ent || !ent.invulnSrc) return;
    if (!(src in ent.invulnSrc)) return;
    delete ent.invulnSrc[src];
    this.sync(ent);
  },
  // 重算 invuln（剩余秒数）与 invulnTotal（本段无敌的总时长，供淡入淡出取包络）
  sync(ent) {
    if (!ent) return;
    let latest = -Infinity;
    for (const k in ent.invulnSrc) if (ent.invulnSrc[k] > latest) latest = ent.invulnSrc[k];
    const left = Math.max(0, latest - ent.clock);
    // 本段总时长 = 进入本段时的剩余量（只增不减，整段结束才归零）。
    // 这样 (invulnTotal - invuln) 正好是"距本段开始过了多久"，可做淡入包络。
    // 【旧实现是 Math.max(left, ent.invuln)】—— ent.invuln 是上一帧的剩余，
    // 于是 invulnTotal 永远只比 invuln 大一个 dt，淡入包络恒等于 dt/0.25 ≈ 0.07，
    // 光晕被压到设计亮度的 1/15，看起来就是"只闪了一下白色"。
    if (left > (ent.invulnTotal || 0)) ent.invulnTotal = left;
    ent.invuln = left;
    if (left <= 0) { ent.invulnSrc = {}; ent.invulnTotal = 0; }
  },
  // 每帧推进：clock 单调递增，过期来源自然失效
  tick(ent, dt) {
    if (!ent) return;
    ent.clock += dt;
    if (ent.invulnSrc) {
      let dirty = false;
      for (const k in ent.invulnSrc) if (ent.invulnSrc[k] <= ent.clock) { delete ent.invulnSrc[k]; dirty = true; }
      if (dirty || ent.invuln > 0) this.sync(ent);
    }
  }
};

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
let ROT_SCALE = 1;                // 花瓣转速缩放（/rot-speed 0.0~1.0；全局，客户端/服务端共用保持同步）
// 主人物【最高移动速度】倍率（/speed 指令设置；1 = 默认）。
// 用全局而不是每个 Player 实例各存一份：客户端预测副本与服务端权威副本必须同速，
// 否则两边位移不一致（表现为持续被快照拉回/橡皮筋）。
let MOVE_MULT = 1;

// ---- 花瓣吸附（果冻手感）----
// 生物边缘到花瓣的距离 ≤ 0.75 倍花瓣直径 -> 强力吸过去（吸力远大于回轨力，吸上就难回来）；
// 吸住后贴附在生物轮廓表面，被轨道拖着"揉搓"，满足任一条件即松手回轨道：
//   ① 被轨道拉开超过 2.5 倍花瓣直径（绝对容差，不再叠加吸住时的差值 -> 不会越黏越远）
//   ② 该生物已离开玩家附近（不在吸附有效范围内）
//   ③ 单次吸附超过 PETAL_PULL_HOLD_T 秒（否则玩家站着不动时花瓣会永久黏在生物表面）
const PETAL_D = PETAL_R * 2;
const PETAL_PULL_RANGE = 0.75;     // 触发距离（× 花瓣直径，按生物轮廓算）
const PETAL_PULL_BREAK = 2.5;      // 松手阈值（× 花瓣直径，绝对容差）
const PETAL_PULL_K = 3.2;          // 吸附时的弹簧刚度倍率
const PETAL_PULL_HOLD_T = 1.0;     // 单次吸附最长时长（秒）
const PETAL_PULL_CD = 0.5;         // 松手后对该生物的再吸附冷却（秒），避免立刻又黏上去

// ---- 滞留型花瓣（Pollen / Honey）脱离轨道后的物理 ----
const PETAL_DETACH_KICK = 0.55;   // 脱离瞬间保留的惯性比例（其余能量在"脱手"时损耗）
const PETAL_DETACH_DRAG = 3.2;    // 惯性衰减速率：越大越快停住（3.2 ≈ 一两秒滑停）
const PETAL_DETACH_TTL = 30;      // Pollen 实体最长存在时间（秒）；Honey 由血量决定

// 花瓣对生物只做【动能传递】，不是硬碰撞：接触瞬间传一次，之后就贴着揉搓。
//   · 大小 = 基础位移 × 稀有度份额(重量) × 花瓣质量 × 接近速度系数
//   · 停在表面摩擦时接近速度≈0 -> 完全不推（不会像硬碰撞那样被顶着走）
const PETAL_KB_BASE = 26;          // px：单次接触传递的位移（系数 1.0 时）
const PETAL_KB_MIN_APPROACH = 90;  // px/s：低于此速度视为揉搓，不传能量
const PETAL_KB_REF = 340;          // 接近速度归一化基准
const PETAL_KB_CD = 0.28;          // 同一片花瓣两次传能的最小间隔（秒）

// 花瓣对生物的"果冻碰撞"基础推力（px，每 1/25s tick 一次）。
// applyKnockback 的语义是"希望造成的总位移"，冲量 = total × KNOCKBACK_DECAY(12)，
// 每 40ms 衰减到 62%，所以持续接触时的稳态速度 ≈ total × 31.5 px/s。
//   基础 5.5 × 份额0.85(common) × 重量0.8 × 摩擦0.8 ≈ 2.99 -> 稳态约 94px/s
//   （比生物自己的游荡速度还快，贴着就能把怪推着走）；高速撞击约 280px/s。
//   高稀有度生物份额降到 0.08 -> 约 9px/s（几乎推不动，符合"重"的直觉）
const PETAL_JELLY_PUSH = 5.5;
// 撞击强度：花瓣朝生物方向的速度越大推得越狠（贴住摩擦用小推力，飞过来撞是大推力）
const PETAL_JELLY_IMPACT_V = 500;   // 速度归一到这个值时 ≈ 1.9 倍推力
const PETAL_JELLY_IMPACT_MIN = 0.8;
const PETAL_JELLY_IMPACT_MAX = 2.4;

// 地形减速瓦片（foliage / seaweed / vine，见 map.js slowAt）上的移速系数：
// 默认速度的 40%；同时所有花瓣被打回"待加载"（见 Player._tickReload / reloadDone）。
const SLOW_TILE_SPEED = 0.4;

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
// 颜色插值：支持 #rgb/#rrggbb/hsl(...) 输入，按 t(0..1) 线性混合后返回 #rrggbb。
// 用途：无敌期间血条在「正常配色」与「金/白」之间平滑过渡（t 由 invulnA 驱动）。
function mixHex(a, b, t) {
  const pa = parseColor(a), pb = parseColor(b);
  const k = clamp(t, 0, 1);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * k));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
// 解析颜色为 [r,g,b]：支持 #rgb / #rrggbb / hsl(h, s%, l%)
function parseColor(s) {
  if (s[0] === '#') {
    const h = s.length === 4
      ? s[1] + s[1] + s[2] + s[2] + s[3] + s[3]
      : s.slice(1, 7);
    return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
  }
  const m = /hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/.exec(s);
  if (!m) return [255, 255, 255];
  const h = parseFloat(m[1]) / 360, sat = parseFloat(m[2]) / 100, l = parseFloat(m[3]) / 100;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = sat * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)].map((v) => Math.round(clamp(v, 0, 1) * 255));
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
    // 受击白闪：用裁剪到图案包围盒的白色剪影（与本体同一裁剪管线），
    // 否则未裁剪的全 viewBox 剪影会比本体小一圈且偏移，看着像"只有中间变白"。
    const cv = SpriteStore.artWhiteCanvas(key, size);
    if (!cv) { ctx.restore(); return; }
    ctx.drawImage(cv, -size / 2, -size / 2, size, size);
  } else {
    // 真矢量渲染：统一走「裁剪到实际图案包围盒」的 artCanvas，
    // 保证与下面的白闪/红闪（artWhiteCanvas / artRedCanvas）同裁剪、同坐标系，
    // 三者在 size×size 里完全对齐（否则红/白闪会偏小且偏移）。
    const cv = SpriteStore.artCanvas(key, size);
    if (!cv) { ctx.restore(); return; }
    ctx.drawImage(cv, -size / 2, -size / 2, size, size);
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

// 绘制一片花瓣的图形。多体花瓣（Light）在实体里【不套用卡面的紧凑排布】：
// 它的每个光点各占一个轨道位（见 _syncPetals 的 b.lights），这里只负责画单个光点。
function drawPetalArt(ctx, cv, size, x, y, rot, scale, alpha) {
  drawArt(ctx, cv, size, x, y, rot, scale, alpha);
}

// 基于重量与动能的实体推挤（玩家↔生物、生物↔生物通用）。
// 位置修正按反质量分配（重的一方几乎不动）；再把沿法线的"接近速度"以低恢复系数转成冲量，
// 于是：小生物推不动大生物；重生物能推飞小生物；很快的玩家能推动"更大一点"重量的生物。
function physicsPush(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const rr = a.r + b.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 <= 1e-6) return;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  const overlap = rr - d;
  const invA = 1 / (a.weight || 1), invB = 1 / (b.weight || 1), sum = invA + invB;
  // 位置修正：按反质量分配（重 = 少动）
  const pa = overlap * invA / sum, pb = overlap * invB / sum;
  a.x -= nx * pa; a.y -= ny * pa;
  b.x += nx * pb; b.y += ny * pb;
  // 冲量：接近速度 -> 低恢复推挤（快 = 推动更重的；重 = 难被推动）
  const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (closing > 0) {
    const j = (1 + PUSH_RESTITUTION) * closing / sum;
    a.vx -= j * invA * nx; a.vy -= j * invA * ny;
    b.vx += j * invB * nx; b.vy += j * invB * ny;
  }
}

function moveEntity(entity, dt, map) {
  // 位移 = 自主移动速度 + 反弹冲量速度（kbX/kbY，由 tickKnockback 衰减）
  const dx = (entity.vx + (entity.kbX || 0)) * dt;
  const dy = (entity.vy + (entity.kbY || 0)) * dt;
  // 有碰撞外形（生物，外形取自其 SVG 轮廓）就走多边形碰撞；否则按圆形（主角/卡片）
  if (entity.hull && typeof map.moveShape === 'function') {
    const position = map.moveShape(entity.x, entity.y, dx, dy, entity.hull, entity.drawSize);
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
    this.baseSpeed = PLAYER_BASE_SPEED; this.speed = this.baseSpeed;  // 人物移速 = 当前(0.4倍)再放慢一半 = 0.5 倍于当前
    this.weight = rarityWeight('unusual');   // 花朵本体视为 unusual 生物的重量（玩家也是实体，参与重量推挤）
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
    this.clock = 0;             // 单调递增计时器：InvulnFX 的时间基准（绝对到期时间）
    this.invulnSrc = {};        // 无敌来源表：{ 'spawn'|'hurt'|'petal:xxx': 到期时刻 }
    this.invulnTotal = 0;       // 本段无敌总时长（供光晕/血条做淡入淡出包络）
    this.invulnA = 0;           // 无敌视觉强度（平滑 0..1：光晕亮度、血条金白程度）
    this.hurtInvuln = 0;        // 受伤无敌帧计时（只免伤、不出任何无敌特效）
    this.armor = 0;             // 花朵护甲：受击结算 = max(攻-甲, 0)
    this.bodyDmg = FLOWER_BODY_DMG;  // 花朵本体攻击（体伤）；recompute() 会再次同步
    this.hurtT = 0;             // 受伤红色滤镜剩余时间（0.1s）
    this.kbX = 0; this.kbY = 0; // 反弹冲量速度（px/s，指数衰减到 0）
    this.hpBarA = 0;            // 血条显示透明度（非满血渐显 0.3s / 满血渐隐 0.3s）
    this.deathRot = 0;          // 死亡时本体固定的随机旋转角
    this.dead = false; this.deathTimer = 0;
    this.breath = 0; this.moving = false;
    this.spin = 0;              // 花瓣环绕角度
    this.petals = [];           // 花瓣实体（各自有实际坐标与速度）
    this.petalGhosts = [];      // 已卸下/被移除的花瓣：原地放大渐隐
    this.petalWorld = [];
    // 一卡多批（Pollen / Honey）：每个槽一个"世代号"。脱轨的实体【继续留在 this.petals】
    // 里（stationary），新一批实体用递增的世代号区分 —— 花瓣实体始终是同一套东西，
    // 不区分"跟着玩家的"和"放在地上的"，绘制/碰撞/战斗/仇恨全部复用同一条路径。
    this._petalGen = [];
    this.reload = [];           // 主槽装填状态：{ card, age, dur } | null（与 slots 等长）
    this.reloadHold = [];       // 主槽装填暂停标记：换卡动画播放期间为 true（UI 置位/清除）
    this.slowTile = false;      // 是否站在减速瓦片（foliage/seaweed/vine）上：移速 ×0.4 + 花瓣待加载
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
    // 注意：maxHp 不在这里重置——它由构造函数给默认值 100，调试参数 ?hp=N 在之外覆盖。
    // 若在此硬编码写回 FLOWER_BASE_HP，则每次换装 recompute() 都会把 ?hp 覆盖回 100，
    // 表现为"一碰就死 / ?hp 无效"。speed / damage 等依赖装填的字段照常重算。
    this.speed = Math.max(60, this.baseSpeed + spd);
    this.damage = dmg;
    this.bodyDmg = FLOWER_BODY_DMG;   // 体伤：与 maxHp 同源，重算后稳定为 20
  }

  // 受击结算：返回【本击是否真正扣到了血】（护甲已在调用方扣减）。
  // 注意语义：返回 true 表示"掉血了"，不等于"死了"—— 是否致死看 this.dead / this.hp。
  // （旧实现返回的是"是否致死"，导致非致命受伤时反弹/屏幕抖动全部不触发。）
  // src = 伤害来源（Mob）：致死时记录其名称，死亡界面显示"你死于 XX"。
  // invuln > 0 时完全免伤（不扣血、不触发红闪）——出生无敌/受伤无敌帧/未来的无敌花瓣都走这里。
  hurt(dmg, src) {
    if (this.dead || dmg <= 0) return false;
    if (this.invuln > 0 || this.hurtInvuln > 0) return false;
    this.hp -= dmg;
    this.hurtT = 0.3;                   // 0.3s 红色滤镜（全体实体通用时长，唯一受击反馈，不再叠加白闪）
    this.hurtInvuln = FLOWER_HURT_INVULN;   // 受伤无敌帧：独立计时，只挡连续扣血，不产生任何无敌特效
    if (this.hp <= 0) {
      this.hp = 0;
      this.killedBy = (src && src.name) ? src.name : null;
      this.die();
    }
    return true;
  }

  // 花朵死亡：花瓣原地快速渐隐消失，本体随机旋转一个角度后保持不动（叉叉眼 + 哭脸）
  die() {
    this.dead = true; this.deathTimer = 0;
    this.deathRot = rand(0, TAU);
    // 每个花瓣实体各自转幽灵（多体花瓣本就是 N 个实体，无需特殊处理）
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
    // 地形减速：站在 foliage / seaweed / vine 这类瓦片上时——
    //   · 移动速度 = 默认值的 40%
    //   · 所有花瓣强制回到"待加载"状态（装填进度清零、不生成实体），离开后重新装填
    this.slowTile = !!(map && map.slowAt && map.slowAt(this.x, this.y));
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
    if (len > 0) {
      // dir 模长 = 目标速度占比(0..1)：鼠标移动模式用"指针距离"映射速度；
      // 键盘 dir 恒 ≥1（单键=1、对角=√2），min(len,1)=1 对键盘零影响。据此缩放目标速度，
      // 并复用下方同一套 rate 9/4 指数平滑加减速。
      const sc = Math.min(len, 1);
      // 减速瓦片：×0.4；/speed 的倍率再整体乘上来（客户端/服务端共用同一个 MOVE_MULT）
      const spd = this.speed * MOVE_MULT * (this.slowTile ? SLOW_TILE_SPEED : 1);
      tx = dir.x / len * spd * sc;
      ty = dir.y / len * spd * sc;
    }
    const rate = (len > 0) ? 9 : 4;   // 加速到默认速度约 0.3s（rate 9）；松开方向键沿用约 0.5s 减速（rate 4）
    this.vx = damp(this.vx, tx, rate, dt);
    this.vy = damp(this.vy, ty, rate, dt);
    tickKnockback(this, dt);          // 反弹冲量衰减（必须在 moveEntity 之前：本帧的位移要带上它）
    moveEntity(this, dt, map);
    this.moving = len > 0;
    if (this.moving) {
      const ta = Math.atan2(this.vy, this.vx);
      this.facing = lerpAngle(this.facing, ta, clamp(dt * 12, 0, 1));
    }
    this.breath += dt;
    this.age += dt;                  // 出场 Q 弹推进
    InvulnFX.tick(this, dt);            // 无敌时间推进（多来源，取最晚到期）
    // 无敌视觉强度平滑跟随：进入/退出都是渐变，绝不硬切换（光晕亮度与血条金白共用它）。
    // 只跟随 invuln（出生/召唤/花瓣类）；受伤无敌帧走独立的 hurtInvuln，不产生任何视觉。
    this.invulnA = damp(this.invulnA, this.invuln > 0 ? 1 : 0, 8, dt);
    this.hurtInvuln = Math.max(0, this.hurtInvuln - dt);   // 受伤无敌帧衰减
    this.flash = Math.max(0, this.flash - dt);

    this.spin += PETAL_SPIN * ROT_SCALE * dt;
    // 装填计时必须在 _syncPetals 之前：新换上来的卡要先有 reload 状态（age=0 -> 未完成），
    // 这一步之后花瓣实体才会被放出来
    this._tickReload(dt);
    // 模式过渡动画：0.15s平滑过渡
    const targetT = (this.mode === 'normal') ? 0 : 1;
    const modeRate = 1 / 0.15;  // 0.15秒完成过渡
    this.modeT = damp(this.modeT, targetT, modeRate, dt);
    this._syncPetals(dt, map, mobs);
  }

  // 滞留型花瓣（Pollen / Honey）的脱轨条件：
  // 只要处在 reach / detect 模式就立刻生效 —— 按下按键那一刻模式就已经切换，
  // 不能等花瓣飞到扩展轨道的位置（那是"外观过渡"，与机制无关）。
  // normal 模式下一律跟随轨道。
  _detachReady() {
    if (this.dead) return false;
    return this.mode === 'reach' || this.mode === 'detect';
  }

  // 客户端侧销毁一朵花瓣实体：转退场幽灵（由 _syncPetals 的差分完成）+
  // 该槽重新结算装填。与服务端 _destroyPetal 语义一致，但这里只做表现。
  _killPetalBody(b) {
    if (b.dead) return;
    b.dead = true;
    const c = b.card;
    const dur = (c.type.reload != null) ? c.type.reload : Math.max(0, c.type.spd || 0);
    const cnt = (CardRenderer.lightSubCount) ? CardRenderer.lightSubCount(c.type, c.rarity) : 1;
    if (cnt > 1) {
      // 多实体卡：只有这一个实体进入自己的重装填（服务端权威计时），卡片【不】进入
      // reload —— 所以卡面不会出现扇形阴影；同槽其它实体照常飞舞。
      // 死亡视觉：原地放大渐隐（此实体不会像单体卡那样从实体表里消失）。
      this.petalGhosts.push({ card: c, x: b.x, y: b.y, age: 0 });
      return;
    }
    this.reload[b.slotIndex] = { card: c, age: 0, dur };
  }

  // 把服务端下发的花瓣战斗状态（hp / 受伤红闪 / 是否已碎）应用到当前花瓣实体上。
  // 由 _syncPetals 每帧调用；快照到达时也由 Game._applySnap 立即调一次，
  // 保证同帧就能看到掉血/碎裂，不用等下一帧。
  _applyNetPetalStates() {
    if (!this.netPetals) return;
    for (const b of this.petals) {
      // 按 (槽位, 子序号, 世代号) 匹配：一张卡可能对应多个独立实体（Light 的每个光点），
      // 滞留型花瓣（Pollen/Honey）还会同时存在多批 -> 必须带世代号，否则会串血。
      const ns = this.netPetals[b.slotIndex + '|' + (b.sub || 0) + '|' + (b.gen || 0)]
        || (typeof this.netPetals.find === 'function'
          ? this.netPetals.find((x) => x.slot === b.slotIndex && (x.sub || 0) === (b.sub || 0)
            && (x.gen || 0) === (b.gen || 0))
          : null);
      if (!ns) continue;
      b.hp = ns.hp; b.maxHp = ns.maxHp;
      // 受伤红闪取"更亮"的那个，避免本地已衰减到一半时被覆盖掉
      if (ns.hurtT > (b.hurtT || 0)) b.hurtT = ns.hurtT;
      if (ns.dead && !b.dead) {
        this._killPetalBody(b);
      } else if (!ns.dead && b.dead) {
        // 多实体卡的单个实体装填完成 -> 复活：Q 弹重生（age 归零）。
        // 坐标同样拉回花朵中心：否则它会从"死亡处"（可能正贴着生物）原地冒出，
        // 看起来就像从生物身上突然出现、而不是从花瓣中心飞出去。
        b.dead = false;
        b.age = 0;
        b.x = this.x; b.y = this.y;
        b.vx = 0; b.vy = 0;
      }
    }
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
      } else if (this.slowTile) {
        // 减速瓦片（foliage / seaweed / vine）：所有花瓣强制回到"待加载"，进度清零。
        r.age = 0;
        r.frozen = true;
      } else if (r.frozen) {
        // 离开瓦片：不是"直接变好"，而是【重新计算 reload】—— 从 0 开始重新装填。
        // 所有"待加载 -> 正常"的转换都遵循这条规则（不保留、不继承旧进度）。
        r.frozen = false;
        r.age = 0;
      } else if (!this.reloadHold[i] && !r.hold) {
        r.age += dt;
      }
      // r.hold：Honey 卡在"放在地上的实体"存活期间暂停冷却，实体全部消失后才开始冷却。
      // 判据直接看 petals 里的滞留实体（客户端/服务端同一份数据，不需要额外同步）。
      // 注意 r 可能为 undefined（本帧刚建好 reload 记录）：必须判空，否则每帧抛异常 -> 黑屏。
      if (r && r.hold) {
        let alive = false;
        for (const b of this.petals) {
          if (b.stationary && !b.dead && b.slotIndex === i) { alive = true; break; }
        }
        if (!alive) { r.hold = false; r.age = 0; }
      }
    }
  }
  // 该主槽是否装填完成（dur<=0 视为无需装填，立即完成）
  reloadDone(i) {
    if (this.slowTile) return false;      // 减速瓦片上：一律视为"待加载"
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

    // Light 多体：一个槽由 N 个独立光点组成（等同装了 N 个单体 Light），
    // 每个光点各占一个轨道位 —— 所以轨道总数 = Σ 各槽光点数。
    const cntOf = (card) => (card && CardRenderer.lightSubCount)
      ? CardRenderer.lightSubCount(card.type, card.rarity) : 1;
    let totalSpots = 0;
    for (let k = 0; k < n; k++) totalSpots += cntOf(this.slots[equipped[k]]);
    const spotStep = totalSpots > 0 ? TAU / totalSpots : 0;

    // 同步实体列表：同一张卡保留其运动状态；新出现的实体从人物中心出生。
    // 【一张卡 ≠ 一个实体】：Light 这类多体花瓣，一个槽生成 N 个【独立实体】——
    // 各自占一个轨道位、各自有血量、各自结算伤害与碰撞，等同装了 N 个单体花瓣。
    // 只有【装填完成】的槽位才生成实体；轨道位按实体数分配 -> 空位保留。
    const bodies = [];
    // ① 滞留实体（Pollen / Honey 脱轨后的那一批）：仍然是 petals 里的实体，
    //    只是不再跟随轨道。原样保留，并累计存活时间（Pollen 有存活上限）。
    for (const b of this.petals) {
      if (!b.stationary) continue;
      // 已碎的滞留实体直接丢掉：它不属于任何一批，也不会"重装填复活"，
      // 留着只会在 petals 里越积越多（退场幽灵在下死手那一刻已经生成）。
      if (b.dead) continue;
      // 卡片 ↔ 实体严格对应：这张卡被切下/换掉，地上的实体立刻消失。
      // （否则切下 Honey 再切回来会凭空多出一批实体，越切越多。）
      if (this.slots[b.slotIndex] !== b.card) {
        b.dead = true;
        this.petalGhosts.push({ card: b.card, x: b.x, y: b.y, age: 0 });
        continue;
      }
      b.age += dt;
      b.hurtT = Math.max(0, (b.hurtT || 0) - dt);
      b.life = (b.life || 0) + dt;
      // 存活上限：Pollen 有；Honey 靠血量撑（Infinity）
      const lim = (b.card && b.card.type && b.card.type.holdReloadUntilDeath)
        ? Infinity : PETAL_DETACH_TTL;
      if (b.life >= lim) {
        b.dead = true;
        this.petalGhosts.push({ card: b.card, x: b.x, y: b.y, age: 0 });
        continue;
      }
      bodies.push(b);
    }
    let spotBase = 0;
    for (let k = 0; k < n; k++) {
      const slotIndex = equipped[k];
      const card = this.slots[slotIndex];
      const cnt = cntOf(card);
      const myBase = spotBase;      // 该槽占用的第一个轨道位（装填中也照占，保持排布稳定）
      spotBase += cnt;
      if (!this.reloadDone(slotIndex)) continue;    // 装填中：占位但不生成
      const st = petalStatsFor(card.type, card.rarity);
      // 血量按【卡面总 hp】均分：一张卡有 N 个实体，每个实体占卡面 hp 的 1/N。
      // 卡槽的"水缸"阴影则按存活实体的血量总和 / 卡面总 hp 计算（见 ui.js _reloadTick）。
      const cardHp = st.hp || 30;
      const maxHp = cnt > 1 ? cardHp / cnt : cardHp;
      const gen = this._petalGen[slotIndex] | 0;
      for (let sub = 0; sub < cnt; sub++) {
        let body = null;
        for (const b of this.petals) {
          // 匹配"本世代"的实体：脱轨后世代号 +1，旧实体不再被这里复用
          if (!b.stationary && (b.gen | 0) === gen
            && b.slotIndex === slotIndex && b.card === card && b.sub === sub) { body = b; break; }
        }
        if (!body) {
          body = { slotIndex, sub, gen, card, x: this.x, y: this.y, age: 0, hp: maxHp, maxHp, hurtT: 0 };
        }
        body.age += dt;
        body.hurtT = Math.max(0, (body.hurtT || 0) - dt);
        body.ord = k; body.n = n;
        body.cnt = cnt; body.spot = myBase + sub;   // 该实体占用的轨道位
        // 标记"这是蜜"：AI 用它判断"被蜜吸引"的生物连被动型也会主动过来啃
        body.honey = (card.type.slug === 'honey');
        // ---- 滞留型花瓣（Pollen / Honey）：reach / detect 模式加载完成后 0.5s 脱轨 ----
        // 只有这两种模式才会"甩出去留在原地"（normal 模式永远跟着轨道）。
        const detachAt = card.type.detachAfter || 0;
        if (detachAt > 0 && !body.dead && body.age >= detachAt && this._detachReady()) {
          body.stationary = true;                   // 留在原地：不再跟随轨道
          body.life = 0;
          body.vx = (body.vx || 0) * PETAL_DETACH_KICK;
          body.vy = (body.vy || 0) * PETAL_DETACH_KICK;
          bodies.push(body);                        // 仍然是实体，只是换了运动规则
          this._petalGen[slotIndex] = gen + 1;      // 本槽换代：下一批实体用新世代号
          // 卡面进入冷却：Pollen 立刻重新装填；Honey 等实体死亡（r.hold，见 _tickReload）
          const dur = (card.type.reload != null) ? card.type.reload : 0;
          const r = { card, age: 0, dur };
          if (card.type.holdReloadUntilDeath) r.hold = true;
          this.reload[slotIndex] = r;
          continue;
        }
        bodies.push(body);
      }
    }
    // 本次已不在装备栏里的实体 -> 转为"退场幽灵"（卸下/删除 = 放大 + 渐隐）
    for (const b of this.petals) {
      if (b.stationary) continue;                  // 滞留实体由 ① 保留
      let kept = false;
      for (const nb of bodies) {
        if (nb.slotIndex === b.slotIndex && nb.card === b.card && nb.sub === b.sub && !nb.stationary) { kept = true; break; }
      }
      // 多体卡的已碎实体：死亡瞬间已经单独生成过幽灵，这里不重复
      if (!kept && !(b.dead && (b.cnt || 1) > 1)) {
        this.petalGhosts.push({ card: b.card, x: b.x, y: b.y, age: 0 });
      }
    }
    this.petals = bodies;

    // ---- 服务端花瓣战斗状态回填 ----
    // 客户端不跑战斗（战斗在服务端），所以花瓣的 hp / 受伤红闪 / 是否已碎
    // 全部由快照下发到这里。缺了这一步，服务端花瓣掉血碎掉而客户端毫无反应，
    // 外观上就是"花瓣永远不受伤、永远不会碎"。
    this._applyNetPetalStates();
    // 幽灵推进，超时即真正移除
    for (const g of this.petalGhosts) g.age += dt;
    this.petalGhosts = this.petalGhosts.filter((g) => g.age < PETAL_GHOST_T);

    // 花瓣特效引擎：对每片在轨花瓣跑 detect/update（玫瑰等特殊行为在此触发）。
    // 必须在弹簧之前：激活的特效会直接驱动 b.x/b.y，弹簧随后跳过它们。
    // 已碎的实体（多体卡的单个光点）不参与特效与运动。
    for (const b of this.petals) { if (!b.dead) PetalFX.tick(b, this, dt); }

    // 计算应在位置，用欠阻尼弹簧吸附过去（帧率无关；目标突变时平滑追赶，绝不瞬移）
    // 目标角 = 该实体自己的轨道位（多体花瓣的每个实体各占一位，独立飞舞）。
    // 花瓣距离：reach模式×2，detect模式×0.5，normal×1
    let reachMult = 1;
    if (this.mode === 'reach') reachMult = 1 + this.modeT;              // 1 -> 2
    else if (this.mode === 'detect') reachMult = 1 - (1 - PETAL_DETECT) * this.modeT;  // 1 -> 0.5
    const baseReach = this.r * (1 + PETAL_REACH) * 1.105;
    const dtc = Math.min(dt, 0.05);   // 弹簧积分步长上限（防掉帧时数值爆炸）
    // 吸附候选：先在玩家附近筛一遍（轨道半径 + 触发距离 + 余量），
    // 避免全图 1600+ 只生物时每片花瓣都扫全表。
    // 吸附有效范围：轨道半径 + 触发距离 + 3 个花瓣直径的余量。
    // （原来额外加 240px，导致"生物离玩家很远也算附近"，花瓣黏住后永远不松手。）
    const pullR = baseReach + PETAL_D * (PETAL_PULL_RANGE + 3);
    let nearMobs = null;
    if (mobs && mobs.length) {
      nearMobs = [];
      for (const m of mobs) {
        if (!m || m.dead) continue;
        if (Math.hypot(m.x - this.x, m.y - this.y) > pullR + (m.r || 0)) continue;
        nearMobs.push(m);
      }
    }
    for (const b of this.petals) {
      if (b.dead) continue;         // 已碎实体：留在原位等重装填完成（不绘制、不运动）
      // 滞留实体（Pollen / Honey）：脱离轨道后只用惯性滑行 -> 阻尼停住，
      // 不再跟随轨道、也不参与生物吸附（它就"放在地上"）。
      if (b.stationary) {
        if (b.vx == null) { b.vx = 0; b.vy = 0; }
        b.vx = damp(b.vx, 0, PETAL_DETACH_DRAG, dt);
        b.vy = damp(b.vy, 0, PETAL_DETACH_DRAG, dt);
        if (Math.abs(b.vx) < 1 && Math.abs(b.vy) < 1) { b.vx = 0; b.vy = 0; }
        if (b.vx || b.vy) this._resolvePetal(b, b.vx * dtc, b.vy * dtc);
        continue;
      }
      if (b.fxActive) continue;     // 特效驱动中（如玫瑰飞向主角）：位置由引擎接管
      // 逐个花瓣取倍率：标了 noReach 的花瓣（如 Rose）【不计算 reach 的延长】，
      // 保持基础轨道距离（detect 的收拢仍然生效，因为它 ≤ 1）。
      const noReach = !!(b.card && b.card.type && b.card.type.noReach);
      const mult = noReach ? Math.min(1, reachMult) : reachMult;
      const reach = baseReach * mult;
      const ang = this.spin + (b.spot || 0) * spotStep;
      const tx = this.x + Math.cos(ang) * reach;
      const ty = this.y + Math.sin(ang) * reach;

      // ---- 花瓣吸附（果冻感）----
      // 生物边缘离花瓣 ≤ 1 倍花瓣直径时被强力吸过去；一旦吸住就贴在生物表面
      //（目标点 = 生物表面沿当前方向的接触点），于是被轨道拖着在生物身上"揉搓"。
      // 只有轨道应在位置相对吸住时被拉开 2.5 倍直径（人跑远了）才松手回轨道。
      let gx = tx, gy = ty, K = PETAL_SPRING_K;
      let mob = b.pullMob;
      if (mob && mob.dead) mob = null;
      const orbitGap = dist(tx, ty, b.x, b.y);
      if (b.pullCd > 0) b.pullCd = Math.max(0, b.pullCd - dtc);   // 再吸附冷却
      if (mob) {
        b.pullT = (b.pullT || 0) + dtc;
        // 松手条件：① 被轨道拉开超过绝对容差（人跑远了）；② 生物已离开吸附有效范围；
        //           ③ 本次吸附超时（否则玩家站着不动，花瓣会永久黏在生物表面）
        const breakAt = PETAL_D * PETAL_PULL_BREAK;
        const mobFar = Math.hypot(mob.x - this.x, mob.y - this.y) > pullR + (mob.r || 0);
        if (orbitGap > breakAt || mobFar || b.pullT >= PETAL_PULL_HOLD_T) {
          mob = null;
          b.pullT = 0;
          b.pullCd = PETAL_PULL_CD;      // 冷却期内不再黏同一片区域
        }
      }
      if (!mob && !(b.pullCd > 0) && nearMobs && nearMobs.length) {
        // 找"到轮廓的距离"最近、且在触发范围内的生物（按真实外形，不按外接圆）
        let best = null, bestEdge = PETAL_D * PETAL_PULL_RANGE;
        for (const m of nearMobs) {
          if (!m || m.dead) continue;
          const q = mobShapeNearest(m, b.x, b.y);
          if (q.dist <= bestEdge) { bestEdge = q.dist; best = m; }
        }
        if (best) { mob = best; b.pullD0 = orbitGap; b.pullT = 0; }
      }
      b.pullMob = mob;
      if (mob) {
        // 落点 = 轮廓上的最近点 + 外法线 × 轻微嵌入量。
        // 用轮廓而不是外接圆：凹处/细长处花瓣才不会悬在空气里（就是"飘一下"的来源）。
        const q = mobShapeNearest(mob, b.x, b.y);
        gx = q.x + q.nx * (PETAL_R * 0.55);
        gy = q.y + q.ny * (PETAL_R * 0.55);
        K = PETAL_SPRING_K * PETAL_PULL_K;               // 吸附力远大于回轨力：吸上就难回来
      }

      // 欠阻尼弹簧：速度带惯性，离目标越远加速越大；
      // 模式切换 / 数量重排 / 急转向都表现为"甩一下再归位"的自然追赶
      if (b.vx == null) { b.vx = 0; b.vy = 0; }
      b.vx += (K * (gx - b.x) - PETAL_SPRING_D * b.vx) * dtc;
      b.vy += (K * (gy - b.y) - PETAL_SPRING_D * b.vy) * dtc;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > PETAL_MAX_SPEED) { const s = PETAL_MAX_SPEED / sp; b.vx *= s; b.vy *= s; }
      // 自由运动（花瓣不是硬碰撞体；对生物的"果冻碰撞"由战斗 tick 结算击退）
      this._resolvePetal(b, b.vx * dtc, b.vy * dtc);
    }

    // 供绘制与碰撞使用（hurtT：花瓣受伤红滤镜；fxActive：特效驱动中，图层在主角之上；
    // dead：该实体已碎、正在独立重装填 —— 不绘制）
    this.petalWorld = this.petals.map((b) => ({
      x: b.x, y: b.y, r: PETAL_R, index: b.slotIndex, age: b.age,
      hurtT: b.hurtT || 0, fxActive: !!b.fxActive, dead: !!b.dead,
      stationary: !!b.stationary,
      // 自带贴图键：滞留实体可能在卡片被卸下之后还存在，不能再依赖 slots[index]
      svg: (b.card && b.card.type) ? b.card.type.svg : null,
      hp: b.hp, maxHp: b.maxHp
    }));
  }

  draw(ctx) {
    // 死亡：先播完花瓣退场幽灵（渐隐），再画死亡本体（随机角度 + 叉叉眼 + 哭脸）
    if (this.dead) {
      for (const g of this.petalGhosts) {
        const size = 15 * 0.9;
        const d = deathFade(clamp(g.age / PETAL_GHOST_T, 0, 1));
        const rot = Math.atan2(g.y - this.y, g.x - this.x) + Math.PI / 2;
        const cv = CardRenderer.artCanvas(g.card.type.svg, 128);
        if (cv) drawPetalArt(ctx, cv, size, g.x, g.y, rot, d.scale, d.alpha);
        // 未就绪不画（同在场花瓣：回退 drawSprite 会得到极小尺寸）
      }
      this._drawDeadBody(ctx);
      return;
    }
    // 花瓣实体：出场渐显（大小不变）。特效驱动中的花瓣（如玫瑰飞向主角）
    // 延后到主角本体之后再画 —— 图层比人物高，"飞到脸上"的观感。
    for (const pp of this.petalWorld) {
      if (pp.fxActive || pp.dead) continue;         // 已碎实体不绘制（等独立重装填）
      const p = this.slots[pp.index];
      const size = 15 * 0.9;                        // 13.5：花瓣视觉缩至原 0.9
      // 朝向 = 由花心指向花瓣：被甩在后面时姿态也会自然跟着偏
      // 滞留实体（放在地上的 Pollen/Honey）固定正向、不做出场渐显
      const svgKey = pp.svg || (p && p.type && p.type.svg);
      const rot = pp.stationary ? 0 : Math.atan2(pp.y - this.y, pp.x - this.x) + Math.PI / 2;
      const a = pp.stationary ? 1 : spawnFade(pp.age);
      const cv = svgKey ? CardRenderer.artCanvas(svgKey, 128) : null;   // 未就绪时返回 null
      if (cv) drawPetalArt(ctx, cv, size, pp.x, pp.y, rot, spawnPop(pp.age), a);
      // 未就绪【不画】也不能回退 drawSprite：那按原始 viewBox contain 绘制，
      // 图形会缩得极小（"错误加载的大小"），就绪后由 artCanvas 统一管线补上。
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
      if (cv) drawPetalArt(ctx, cv, size, g.x, g.y, rot, d.scale, d.alpha);
      // 未就绪不画（同在场花瓣：回退 drawSprite 会得到极小尺寸）
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

    // 受伤红色滤镜（0.3s）：红色覆盖脸部，随剩余时间渐隐。受击只红闪，不再叠加白闪。
    if (this.hurtT > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.hurtT / 0.3, 0, 1) * 0.4;
      ctx.fillStyle = '#ff4040';
      ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // 无敌光晕：淡白色、平滑闪烁（每秒 INVULN_PULSE_HZ 下），进入与退出都有淡入淡出包络。
    // 与受伤红闪/白闪互不干扰：三者 alpha 叠加，视觉上仍是"很淡地一闪一闪"。
    if (this.invulnA > 0.002) {
      const pulse = 0.5 + 0.5 * Math.sin(this.clock * Math.PI * 2 * INVULN_PULSE_HZ);   // 平滑 0..1
      const env = Math.min(1, this.invuln / 0.25, Math.max(0, (this.invulnTotal - this.invuln) / 0.25));
      ctx.save();
      ctx.globalAlpha = pulse * env * this.invulnA * INVULN_PULSE_MAX;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // 特效驱动中的花瓣：画在主角本体之上（图层比人物高）
    for (const pp of this.petalWorld) {
      if (!pp.fxActive || pp.dead) continue;
      const p = this.slots[pp.index];
      const size = 15 * 0.9;
      const rot = Math.atan2(pp.y - this.y, pp.x - this.x) + Math.PI / 2;
      const a = spawnFade(pp.age);
      const cv = CardRenderer.artCanvas(p.type.svg, 128);
      if (cv) drawPetalArt(ctx, cv, size, pp.x, pp.y, rot, spawnPop(pp.age), a);
      // 未就绪不画（同在场花瓣：回退 drawSprite 会得到极小尺寸）
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
      ctx.fillStyle = mixHex('#2b2b33', INVULN_BAR_BACK, this.invulnA || 0);
      ctx.fill();
      // 黑框内先画淡灰缓冲条（慢速跟随、轻微过冲），再画绿色主条（快速跟随）；
      // 主条颜色随血量连续渐变。两者平时重合，缓冲条被完全盖住。
      // 无敌期间整体平滑过渡为「金色填充 + 白底」（invulnA 做连续插值，不是硬切换）。
      const gold = this.invulnA || 0;
      const dRatio = clamp((this.dispHp == null ? this.hp : this.dispHp) / this.maxHp, 0, 1);
      const gRatio = clamp((this.ghostHp == null ? this.hp : this.ghostHp) / this.maxHp, 0, 1);
      if (gRatio > 0) {
        roundRectPath(ctx, bx, barY, Math.max(bh, bw * gRatio), bh, rad);
        ctx.fillStyle = mixHex('#b9bec8', INVULN_BAR_BACK, gold);
        ctx.fill();
      }
      if (dRatio > 0) {
        roundRectPath(ctx, bx, barY, Math.max(bh, bw * dRatio), bh, rad);
        ctx.fillStyle = mixHex(hpBarColor(dRatio), INVULN_BAR_FILL, gold);
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
// 注：生物体型【只用稀有度表】，不再有"按生物种类偏移几档"的特例。
// 各生物的相对大小由 SpriteStore 的固定比例裁剪决定（所有贴图共用同一个裁剪框，
// 以瓢虫的实际图案范围为基准标定）—— 素材画多大就显示多大。
//
// 个别生物需要整体比同稀有度的瓢虫更大/更小：用【等比倍数】而不是"偏移几档"。
//   bee = 1.395：使蜜蜂 common 正好等于原本 unusual 的大小（所有稀有度同比例放大）
const MOB_SIZE_SCALE = { bee: 1.395 };

// 贴图朝向补偿：部分生物 SVG 的「头」不指向 +x（瓢虫的头在图内指向左上 -135°）。
// 绘制与碰撞统一在 facing 上加这个偏角，使头始终朝向实际移动方向。
const MOB_ART_ROT = {
  '3': Math.PI * 3 / 4,       // 瓢虫：头中心在图内朝 -135°，补偿 +135°
  '4': Math.PI * 3 / 4,       // 蜜蜂：尾针在右下角(76.8,76.8)，头同样朝左上，补偿相同
};
// 瓢虫描边圈独立图层（assets/entities/3_ring.svg，main.js 预加载）：
// 渲染专用的生物素材统一放在 assets/entities/，assets/mobs/ 只存原始贴图。
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

// —— 生物碰撞箱：取自 SVG 实绘图形的轮廓多边形（marching squares 提取）——
// 网格直接取自渲染像素，因此凹形（瓢虫头凹槽）也能表达；多边形顶点表与地图碰撞同形态，
// 消费方做「圆 vs 多边形」求交（思路同 map.js 的 circleContact）。

// 生物轮廓几何核心：本地坐标下求"最近点 + 是否在内"。
// 圆-多边形求交、花瓣吸附落点都复用这一份，避免两套几何算法各算各的。
function _mobLocalNearest(poly, D, lx, ly) {
  const pts = poly.pts;
  // 内外判定用射线法（与绕向无关，轮廓提取不保证绕向）
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const ax = pts[j][0] * D, ay = pts[j][1] * D;
    const bx = pts[i][0] * D, by = pts[i][1] * D;
    if ((ay > ly) !== (by > ly) && lx < (bx - ax) * (ly - ay) / (by - ay) + ax) inside = !inside;
  }
  // 逐边求最近点
  let bx = 0, by = 0, bd2 = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const ax = pts[j][0] * D, ay = pts[j][1] * D;
    const ex = pts[i][0] * D - ax, ey = pts[i][1] * D - ay;
    const len2 = ex * ex + ey * ey || 1e-9;
    let t = ((lx - ax) * ex + (ly - ay) * ey) / len2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const px = ax + t * ex, py = ay + t * ey;
    const ddx = lx - px, ddy = ly - py;
    const d2 = ddx * ddx + ddy * ddy;
    if (d2 < bd2) { bd2 = d2; bx = px; by = py; }
  }
  return { px: bx, py: by, dist: Math.sqrt(bd2), inside };
}

// 贴图旋转（facing + artRot），与 draw 完全一致
function _mobRot(m) {
  const rot = m.facing + (m.artRot || 0);
  return { c: Math.cos(rot), s: Math.sin(rot) };
}

// 圆 vs 生物轮廓多边形。命中返回 { nx, ny, depth }（世界空间法线，指向生物外），否则 null。
// 复杂度 = O(顶点数)，顶点已抽样简化（通常几十个），比逐格扫描更快。
function circleVsMobPoly(m, cx, cy, cr) {
  const poly = m.shape;
  if (!poly || !poly.pts || poly.pts.length < 3) return null;
  const D = m.drawSize;
  // 世界 -> 生物本地（贴图随 facing + artRot 旋转，与绘制完全一致）
  const { c, s } = _mobRot(m);
  const dx = cx - m.x, dy = cy - m.y;
  const lx = dx * c + dy * s, ly = -dx * s + dy * c;
  // 粗判：本地外接圆
  const rr = D * poly.r + cr;
  if (lx * lx + ly * ly > rr * rr) return null;

  const q = _mobLocalNearest(poly, D, lx, ly);
  if (!q.inside && q.dist >= cr) return null;      // 完全在外且没碰到
  let nlx, nly;
  if (q.dist > 1e-6) {
    nlx = (lx - q.px) / q.dist; nly = (ly - q.py) / q.dist;
    if (q.inside) { nlx = -nlx; nly = -nly; }      // 圆心在内部：法线反向（指向出口）
  } else { nlx = 1; nly = 0; }
  const depth = q.inside ? cr + q.dist : cr - q.dist;
  if (depth <= 0) return null;
  // 本地法线 -> 世界
  return { nx: nlx * c - nly * s, ny: nlx * s + nly * c, depth };
}

// 轮廓上离 (x,y) 最近的点（世界坐标）+ 外法线 + 距离（在内为负）。
// 花瓣吸附的落点必须贴着【真实外形】——用外接圆会把花瓣拉到空气里（"飘"）。
function mobShapeNearest(m, x, y) {
  const poly = m.shape;
  if (!poly || !poly.pts || poly.pts.length < 3) {
    const dx = x - m.x, dy = y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d, r = m.r || 0;
    return { x: m.x + nx * r, y: m.y + ny * r, nx, ny, dist: d - r, inside: d < r };
  }
  const D = m.drawSize;
  const { c, s } = _mobRot(m);
  const dx = x - m.x, dy = y - m.y;
  const lx = dx * c + dy * s, ly = -dx * s + dy * c;
  const q = _mobLocalNearest(poly, D, lx, ly);
  let nlx, nly;
  if (q.dist > 1e-6) {
    nlx = (lx - q.px) / q.dist; nly = (ly - q.py) / q.dist;
    if (q.inside) { nlx = -nlx; nly = -nly; }
  } else { nlx = 1; nly = 0; }
  return {
    x: m.x + (q.px * c - q.py * s),
    y: m.y + (q.px * s + q.py * c),
    nx: nlx * c - nly * s,
    ny: nlx * s + nly * c,
    dist: q.inside ? -q.dist : q.dist,
    inside: q.inside
  };
}

// 统一的生物碰撞入口：优先用 SVG 轮廓多边形（严格按几何形状判定），
// 轮廓尚未提取（贴图刚加载 / 提取失败）时退回外接圆，避免"完全不碰撞"。
// 返回 { nx, ny, depth }：法线由生物表面指向圆心（世界空间）。
function mobHitTest(m, cx, cy, cr) {
  const poly = m.shape;
  const shaped = !!(poly && poly.pts && poly.pts.length >= 3);   // 轮廓是否可用
  if (shaped) {
    const hit = circleVsMobPoly(m, cx, cy, cr);
    if (hit) return hit;
    return null;                                                 // 有轮廓：以轮廓为准
  }
  // 没有轮廓（贴图未就绪 / 提取失败 / 退化）：退回外接圆，保证一定能撞到
  const rr = (m.r || 0) + cr;
  if (dist2(cx, cy, m.x, m.y) < rr * rr) {
    const dx = cx - m.x, dy = cy - m.y;
    const d = Math.hypot(dx, dy) || 1;
    return { nx: dx / d, ny: dy / d, depth: rr - d };
  }
  return null;
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
    // 视觉直径 = 稀有度倍率 × 等级缩放 × 该物种的等比体型倍数（见 MOB_SIZE_SCALE）
    const sizeScale = MOB_SIZE_SCALE[type.slug] || 1;
    const diam = Math.round(PLAYER_VISUAL_D * (MOB_DIAM[this.rarity] || MOB_DIAM_BASE)
      * mobScale(this.level) * sizeScale);
    this.visualD = diam;
    this.r = diam / 2;                  // 碰撞/名牌半径跟着视觉直径走
    this.drawSize = diam;               // 贴图裁剪后正好撑满它 -> 视觉与碰撞箱一致
    this.shape = null;                  // 碰撞外形：SVG 轮廓多边形 { pts, r }（玩家/接触判定用）
    this.hull = null;                   // 同一轮廓的凸包（墙体碰撞用，凹处不会卡）
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.maxHp = baseHp; this.hp = baseHp;
    this.dmg = baseDmg;
    // 障碍型生物（registry type=障碍型生物 或 speed=0）：几乎不可移动
    this.obstacle = (type.type === 'Obstacle') || !(type.speed > 0);
    // 速度统一（瓢虫为原型，全体非障碍生物通用）：
    //   仇恨追击 = 玩家默认最高速度 0.90 倍；随机游荡 = 基准 0.95 × (0.3~0.5)
    //   蜜蜂例外：追击 1.05 倍（走 S 型所以实际推进更慢）、游荡 = 瓢虫游荡 ×1.2
    const isBee = !!MOB_S_PATH_SLUGS[type.slug];
    const ladybugWander = MOB_WANDER_MULT * PLAYER_BASE_SPEED * rand(MOB_WANDER_RANGE[0], MOB_WANDER_RANGE[1]);
    this.chaseSpeed = (isBee ? BEE_CHASE_MULT : MOB_CHASE_MULT) * PLAYER_BASE_SPEED;
    this.wanderSpeed = this.obstacle ? 0
      : (isBee ? ladybugWander * BEE_WANDER_FACTOR : ladybugWander) * MOB_WANDER_SCALE;
    this.speed = this.wanderSpeed;
    // S 型路线（蜜蜂）：朝向按正弦持续左右偏摆，走出一条蛇形曲线
    this.sPath = isBee;
    this.sAmp = BEE_S_AMP;
    this.sHz = BEE_S_HZ;
    // 重量：按横截面积(直径²)；障碍型 ×5（几乎推不动）
    this.weight = rarityWeight(this.rarity) * (this.obstacle ? 5 : 1);
    this.color = type.color; this.boss = !!type.boss;
    this.facing = rand(0, TAU);         // 朝向（无呼吸/浮动动画，用户要求生物保持静止姿态）
    const svgKey = String(this.svg);    // type.svg 是数字 id，查表统一转字符串
    this.artRot = MOB_ART_ROT[svgKey] || 0;     // 贴图朝向补偿（使头指向 +x）
    this.seed = (Math.random() * 0x7fffffff) | 0;
    this.dots = (svgKey === '3') ? this._makeDots() : null;   // 瓢虫：程序化随机斑点
    this.hostility = (rs && rs.hostility) || type.hostility || 'neutral';   // 仇恨按稀有度（瓢虫 common/unusual 被动、rare+ 中立）
    this.threat = [];                   // 仇恨表 [{ ent, dmg }]：死亡前永久累计，追击累计伤害最高的来源
    this.honeyT = 0;                    // 被蜜影响的累计时长（秒）
    this.honeyImmune = false;           // 被蜜影响满 40s 后永久免疫所有蜜
    this.flash = 0; this.hitCd = 0; this.squash = 0;
    this.kbX = 0; this.kbY = 0; // 反弹冲量速度（px/s，指数衰减到 0）
    // 血条平滑管线（与花朵同款）：主条快速跟随 + 缓冲条慢速过冲
    this.dispHp = null; this.ghostHp = null; this.ghostV = 0;
    this.dead = false; this.deathTimer = 0;
    this.age = 0;                       // 出场计时（渐隐用）
    this.aggro = false;                 // 仇恨：暂不启用（还没有伤害）
    // 护甲（armor）：registry 有就整表取用，否则按稀有度默认表；攻击结算 = max(攻-甲, 0)
    this.armor = (rs && rs.armor != null) ? rs.armor
      : (type.armor != null) ? type.armor : (MOB_ARMOR[this.rarity] || 0);
    this.hurtT = 0;                     // 受伤红色滤镜剩余时间（0.1s）
    this.xpVal = rs ? (rs.exp || 0) : (4 + type.tier * 4);
  }

  // 受击结算：返回 { applied, killed }。
  //   applied = 本击【实际造成的伤害】，不会超过剩余血量 —— 伤害飘字只认这个值，
  //             所以"打出 80000 秒杀只剩 300 血的怪"只会弹 300，绝不会超额。
  //   killed  = 是否被这一击致死（调用方据此立即弹飘字，保证秒杀也有反馈）。
  // 护甲已在调用方扣减；src = 伤害来源实体（花瓣造成的伤害由调用方统一记到玩家头上）。
  hurt(dmg, src) {
    if (this.dead || dmg <= 0) return { applied: 0, killed: false };
    const applied = Math.min(dmg, this.hp);
    this.hp -= applied;
    this.hurtT = 0.3;                   // 0.3s 红色滤镜（全体实体通用时长，唯一受击反馈；不缩放，缩放只留给死亡退场）
    // 仇恨：永久累计（死亡前不清零）。被动型（passive）不记仇恨、永不追击。
    if (src && this.hostility !== 'passive') {
      const e = this.threat.find((t) => t.ent === src);
      if (e) e.dmg += applied; else this.threat.push({ ent: src, dmg: applied });
    }
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.deathTimer = 0;
      return { applied, killed: true };
    }
    return { applied, killed: false };
  }

  // 当前最恨的实体：蜜（Honey）**强制排首位**（官方：蜜会强行抢走仇恨），
  // 其余按累计伤害最高且还活着；被蜜影响满 40s 后永久免疫所有蜜（honeyImmune）。
  topThreat() {
    let honey = null, best = null;
    for (const t of this.threat) {
      if (!t.ent || t.ent.dead) continue;
      if (t.ent.honey) {
        if (!this.honeyImmune && (!honey || t.dmg > honey.dmg)) honey = t;
        continue;
      }
      if (!best || t.dmg > best.dmg) best = t;
    }
    const pick = honey || best;
    return pick ? pick.ent : null;
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

  // 血条平滑管线（与花朵血条完全同款，只是没有"非满血才显示"的透明度逻辑）：
  //   dispHp  = 主条，指数阻尼【快速】跟随真实血量；
  //   ghostHp = 淡灰缓冲条，欠阻尼弹簧【慢速】跟随主条并轻微过冲再回稳。
  // 平时两者重合，掉血瞬间缓冲条才露出来 —— 这就是"掉血时露白条再追平"的观感。
  _tickHpSmooth(dt) {
    if (this.dispHp == null) { this.dispHp = this.hp; this.ghostHp = this.hp; this.ghostV = 0; }
    this.dispHp = damp(this.dispHp, this.hp, 18, dt);
    const gk = 34, gd = 9;                      // 刚度低 + 阻尼欠 -> 追赶时过冲一小段
    this.ghostV += (gk * (this.dispHp - this.ghostHp) - gd * this.ghostV) * dt;
    this.ghostHp = clamp(this.ghostHp + this.ghostV * dt, 0, this.maxHp);
  }

  update(dt, player, map) {
    if (this.dead) { this.deathTimer += dt; return; }
    this.age += dt;
    this._tickHpSmooth(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.hitCd = Math.max(0, this.hitCd - dt);
    this.squash = damp(this.squash, 0, 10, dt);
    tickKnockback(this, dt);          // 反弹冲量衰减（在 moveEntity 之前）
    // 碰撞外形要等贴图光栅化后才能从轮廓提取；取到一次就固定（外形不随动画变）
    if (!this.shape) {
      const ct = SpriteStore.contour('mob' + this.svg, this.drawSize);
      if (ct) {
        this.shape = ct;
        // 凸包：把轮廓点两两去重后取凸包，供 map.moveShape（墙体）使用
        const uniq = [];
        for (const p of ct.pts) {
          if (!uniq.some((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6)) uniq.push(p);
        }
        this.hull = uniq.length >= 3 ? convexHull(uniq) : null;
      }
    }

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
    // 受击只做红色滤镜（hurtT -> 下方 artRedCanvas 红闪），不再叠加白闪剪影。
    drawMob(ctx, key, this.drawSize, this.x, this.y, rot, scale, alpha, false);
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
      ctx.fillStyle = '#111';   // 斑点恒为黑色；受击由整体红色滤镜统一表现，不再随白闪变白
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
      const rc = SpriteStore.artRedCanvas(key, this.drawSize);
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

      // 血条：圆角 + 深色描边，填充色随比例 绿→黄→红。
      // 黑框内先画淡灰缓冲条（慢速跟随、轻微过冲），再画主条（快速跟随）；
      // 两者平时重合，掉血瞬间缓冲条才露出来 —— 由 _tickHpSmooth 驱动。
      const rad = Math.min(bh / 2, 6);
      roundRectPath(ctx, bx, barY, bw, bh, rad);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fill();
      const gRatio = clamp((this.ghostHp == null ? this.hp : this.ghostHp) / this.maxHp, 0, 1);
      const dRatio = clamp((this.dispHp == null ? this.hp : this.dispHp) / this.maxHp, 0, 1);
      if (gRatio > 0) {
        roundRectPath(ctx, bx, barY, Math.max(bh, bw * gRatio), bh, rad);
        ctx.fillStyle = '#b9bec8';
        ctx.fill();
      }
      if (dRatio > 0) {
        roundRectPath(ctx, bx, barY, Math.max(bh, bw * dRatio), bh, rad);
        // 剩余血量：绿 -> 红 连续渐变（与主角血条同一 helper）
        ctx.fillStyle = hpBarColor(dRatio);
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

// ---------------- 地面掉落物（生物死亡掉落） ----------------
// 视觉 = 真实卡面（与背包/卡槽同一条 CardRenderer.renderCardTo 管线）+ 右上角数量角标。
// 图层：全体掉落物都画在【实体与玩家尸体之下】（见 game.render 的绘制顺序）。
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
