// sim/constants.js — 模拟层常量与纯规则（无 DOM，可在 Node 加载）
'use strict';

const SPEED_SCALE = 5;

// 玩家基础最大移速（生物仇恨追击速度以此为基准）
const PLAYER_BASE_SPEED = 232 * SPEED_SCALE * 0.2;
// ---- 生物移动速度口径（全部以"玩家默认最高速度"为基准）----
const MOB_CHASE_MULT = 0.90;          // 通用追击速度 = 0.90×（瓢虫及默认追击）
const MOB_WANDER_MULT = 0.95;         // 游荡速度的基准倍率（与追击解耦，保持原有游荡手感）
const MOB_WANDER_RANGE = [0.3, 0.5];  // 游荡速度 = 基准 ×(0.3~0.5) 随机
const MOB_WANDER_SCALE = 0.75;        // 游荡速度在基础值上再打 0.75 折（全生物统一）
// 蜜蜂的追击倍率 / 游荡倍率 / S 型开关已迁到数据表（data.js 的 MOB_TRAITS），
// 行为层只读 type.chaseMult / type.wanderFactor / type.sPath，不再按 slug 判断。
const BEE_S_AMP = 0.62;               // 摆头幅度（弧度 ≈ 35°）
const BEE_S_HZ = 0.85;                // Common 蜜蜂的摆头频率（Hz）
// 蜜蜂 S 型的【稀有度渐变】：稀有度越高越"沉稳" —— 摆幅越小、单个 S 越长（越接近直线行走）。
// Common -> Eternal 线性插值，终点的要求：
//   Eternal 单个 "S" 的弧度 = Common 的 0.2 倍；长度 = Common 的 2 倍（=> 频率 = 1/2）。
const BEE_S_AMP_MIN_K = 0.2;          // Eternal 摆幅 / Common 摆幅
const BEE_S_LEN_MAX_K = 2.0;          // Eternal 单个 S 长度 / Common 长度
// 花瓣实体的绘制尺寸（与 draw() 里的 size 必须同一套，阵型偏移要用它换算）
const PETAL_ENT_SIZE = 15 * 0.9;      // 13.5：花瓣视觉缩至原 0.9
const PEAS_FLIGHT_T = 2.0;            // Peas 喷射后的存活时长（s）：到点强制移除
// 蜈蚣（多节生物）的移速不在这里定：它按【0.5 × 瓢虫游荡速度】在 Mob 构造函数里
// 从自己的 wanderSpeed 推算（并记录为 _centSpeedCap 供 update 做硬上限），
// 所以不依赖任何"倍率常量"，也就不存在倍率没生效的可能。
// 花瓣【自转】：独立于公转（绕主角的轨道运动），从实体加载好那一刻起持续、缓慢地转。
// 绘制朝向 = 公转朝向(阵型基准) + 自转；普通花瓣则完全用自转（不再由轨道位置反推）。
const PETAL_SELF_SPIN = 0.9;          // 自转速度（rad/s）
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
// 滞留实体跟随服务端权威位置的插值时长（= 快照间隔 25Hz）：
// 直接采信快照坐标会让它在 60fps 下按 25Hz 台阶跳 -> 被推挤时"一卡一卡/发粘"。
const PETAL_NET_SYNC = 1 / 25;

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
