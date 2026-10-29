// ai.js — 生物 AI 引擎（注册式，接口与 PetalFX 对齐）
// 'use strict';
//
// 设计原则（重点）：AI 只负责输出「移动欲望」，绝不直接改坐标。
//   · create(mob)              -> 运行时状态（挂在 mob.ai 上）
//   · step(ctx, dt, mob)       -> { x, y } 期望速度向量（0,0 = 想停下）
//   · notifyMoved(ctx, d, mob) -> 底层引擎把本次【实际位移】回馈给 AI
//   · facing(ctx)              -> 当前期望朝向（弧度），仅供贴图朝向参考
//   · init(mob)                -> 可选：由 AI 自己声明该物种的移速/转向/游走节奏
//   · speedLimit(mob)          -> 可选：期望速度的硬上限（蜈蚣用）
//   · onHurt(mob, src, applied)-> 可选：受击通知（内置实现走 Mob.hurt 的 fleeT）
// 真正的加速/减速/位移由底层引擎完成（Mob.update 里与主角同一套 damp + moveEntity），
// 因此生物和人物一样是「渐渐起步、渐渐停住」，不会有瞬移和抖动。
//
// —— 为什么做成注册表（与 PetalFX 同一套路）——
// 以前所有行为都塞在 MobAI._step 里按字段分支（noPause / sPath / turnRate …），
// 想加一只新怪就得改引擎内核，还得小心不影响其它物种。现在：
//   1. 引擎只负责「问 AI -> 限速 -> 位移 -> 回馈」这条固定管线；
//   2. 每个物种的 AI 是一个独立注册项（key = type.slug，如 'ladybug' / 'bee' / 'centipede'）；
//   3. 新增生物只要 MobAI.register('slug', {...})，不必动内核，也不会串味。
// 未注册的物种自动回落到 'wander'（通用游走 + 仇恨追击 + 逃离），即原有行为。
//
// —— 唤醒/休眠 ——
// 休眠由服务端按 MOB_ACTIVE_R 控制（远处不调 update），AI 侧不需要知道。
//
// —— 多节生物（蜈蚣）——
// 只有段首跑 AI；其余节由 LocalServer._solveChains 沿头的真实轨迹刚性摆放。
// 段首被击杀后，后一节自动升为新段首（_lead 置空），继续由本引擎驱动。

const MobAI = {
  defs: {},
  DEFAULT_KEY: 'wander',

  // 注册一套 AI。def 里的字段全部可选，缺省即「什么都不做」。
  register(key, def) {
    if (!key || !def) return null;
    this.defs[key] = Object.assign({ key }, def);
    return this.defs[key];
  },

  // 按物种取 AI 定义：优先 type.aiKey（数据表显式指定），其次 slug，最后回落通用。
  defFor(type) {
    if (!type) return this.defs[this.DEFAULT_KEY] || null;
    const k = type.aiKey || type.slug;
    return (k && this.defs[k]) || this.defs[this.DEFAULT_KEY] || null;
  },

  // 由 Mob 构造函数调用：选定义 -> 让定义配置本体参数 -> 建运行时状态。
  // init 可能改写 wanderSpeed / chaseSpeed / speed / turnRate 等，
  // 所以必须在 Mob 算完基础速度之后再调（见 Mob 构造函数末尾）。
  attach(mob) {
    const def = this.defFor(mob.type);
    mob.aiDef = def;
    mob.aiKey = def ? def.key : null;
    if (def && def.init) def.init(mob);
    mob.ai = (def && def.create) ? def.create(mob) : null;
    if (mob.ai) mob.ai.key = mob.aiKey;
    return mob.ai;
  },

  // 引擎主入口：推进一帧并返回移动欲望。
  step(ai, dt, mob, player) {
    if (!ai || !mob) return { x: 0, y: 0 };
    const def = mob.aiDef;
    if (!def || !def.step) return { x: 0, y: 0 };
    // 撞墙/禁行标记统一在这里衰减：各 AI 只管「看到 >0 就换方向」，
    // 不必自己计时（旧实现里只要有一个分支忘了清零，标记就永远挂着）。
    if (ai.blockedT > 0) ai.blockedT = Math.max(0, ai.blockedT - dt);
    return def.step(ai, dt, mob, player) || { x: 0, y: 0 };
  },

  // 位移回馈：AI 靠它判断「这一趟走完了」
  notifyMoved(ai, d, mob) {
    if (!ai || !mob) return;
    const def = mob.aiDef;
    if (def && def.notifyMoved) { def.notifyMoved(ai, d, mob); return; }
    if (ai.phase === 'walk' && d > 0) ai.remain -= d;
  },

  // 期望朝向
  facing(ai, mob) {
    if (!ai) return null;
    const def = mob && mob.aiDef;
    if (def && def.facing) return def.facing(ai, mob);
    return Math.atan2(ai.dirY, ai.dirX);
  },

  // 期望速度的物种硬上限（返回 0/undefined = 不限）
  limitSpeed(mob, want) {
    const def = mob && mob.aiDef;
    const lim = (def && def.speedLimit) ? def.speedLimit(mob) : 0;
    if (!(lim > 0)) return want;
    const d = Math.hypot(want.x, want.y);
    if (d > lim && d > 1e-6) {
      want.x = want.x / d * lim;
      want.y = want.y / d * lim;
    }
    return want;
  },

  // 受击通知（引擎在 Mob.hurt 尾部调用；没有注册就不做事）
  onHurt(mob, src, applied) {
    const def = mob && mob.aiDef;
    if (def && def.onHurt) def.onHurt(mob, src, applied, mob.ai);
  },

  // ---------------- 共用工具（不属于任何单一物种） ----------------
  _util: {
    // 角度归一化到 (-PI, PI]
    angNorm(a) {
      while (a > Math.PI) a -= TAU;
      while (a <= -Math.PI) a += TAU;
      return a;
    },

    // 以不超过 maxStep 的角度，从 cur 转向 want
    turnToward(cur, want, maxStep) {
      const d = MobAI._util.angNorm(want - cur);
      if (maxStep <= 0 || Math.abs(d) <= maxStep) return want;
      return cur + (d > 0 ? maxStep : -maxStep);
    },

    // 行走碰撞半径（墙体口径）：Mob.walkR = min(等面积半径, 1 格瓦片 0.9 倍的内接圆半径)。
    // AI 的所有"能不能走过去"判断都必须用它，而不是伤害口径的 r。
    walkR(mob) {
      return (mob.walkR != null) ? mob.walkR : (mob.r || 12);
    },

    // 追击路线规划（只看【行走碰撞箱】）：把"直冲目标"的期望角修正成一条走得通的方向。
    // 为什么不做 A*：全图 4000+ 生物逐只栅格寻路不现实，真正在追击的只有看得见目标的
    // 少数个体；"前方一格能不能站"（canStandAt 用 walkR）就足够让它们绕墙、挤进 1 格口。
    //   · 直行通畅 -> 原方向（1 次采样，且只有每 0.3s 一次）；
    //   · 否则按 22.5° / 45° / 67.5° / 90° 左右交替找一个通畅方向（最多 8 次采样）；
    //   · 【缓存的是偏转角 pathOff，不是绝对角】：目标在移动时方位角每帧都在变，
    //     缓存绝对角会因"漂移过大"每帧重算 —— 数百只追击者会把 canStandAt 打成热点。
    //     偏转角在 0.3s 内保持不变，既省采样，又不会让绕行方向滞后于目标。
    steer(mob, ai, wantA, dt) {
      const map = mob._map;
      if (!map || typeof map.canStandAt !== 'function') return wantA;
      const U = MobAI._util;
      ai.pathT = (ai.pathT || 0) - dt;
      if (ai.pathT > 0 && ai.pathOff != null) return wantA + ai.pathOff;
      ai.pathT = 0.3;

      const r = U.walkR(mob);
      const D = Math.max(r * 1.5, MOB_WALK_LOOKAHEAD);
      const free = (a) => map.canStandAt(mob.x + Math.cos(a) * D, mob.y + Math.sin(a) * D, r);
      let off = 0;
      if (!free(wantA)) {
        const side = ai.pathSide || 1;               // 上次的绕行方向（默认右侧）
        let found = null;
        for (let k = 1; k <= 4 && found == null; k++) {
          const d = k * MOB_WALK_STEP_A;
          if (free(wantA + d * side)) found = d * side;
          else if (free(wantA - d * side)) found = -d * side;
        }
        // ±90° 内全不通：沿上次那一侧继续绕，撞墙由 blockedT 兜底重新选向
        off = (found == null) ? side * Math.PI * 0.5 : found;
        if (found != null) ai.pathSide = (found > 0) ? 1 : -1;
      }
      ai.pathOff = off;
      return wantA + off;
    },

    // 仇恨追击：返回移动欲望，或 null 表示「这一帧没有看得见的目标」。
    // 中立/敌对生物优先冲向【累计伤害最高】的来源（被动型 passive 永不追击）。
    // 唯一例外：被蜜（Honey）吸引的目标，连被动型也会主动过去 —— 否则瓢虫
    // 这类生物永远不会理会地上的蜜，看起来就像「蜜没有吸引效果」。
    chase(mob, ai, dt) {
      const tgt = mob.topThreat ? mob.topThreat() : null;
      if (!tgt || (mob.hostility === 'passive' && !tgt.honey)) {
        ai.hadTgt = false;
        return null;
      }
      const dx = tgt.x - mob.x, dy = tgt.y - mob.y;
      const d = Math.hypot(dx, dy) || 1;
      // 路线规划按【行走碰撞箱】修正期望角：大怪也不会顶着 1 格宽的墙口原地磨
      const wantA = MobAI._util.steer(mob, ai, Math.atan2(dy, dx), dt);
      const tr = mob.turnRate || 0;
      if (tr > 0) {
        if (ai.heading == null) ai.heading = wantA;
        const fresh = !ai.hadTgt;                 // 这一帧才刚获得仇恨
        ai.hadTgt = true;
        const behind = Math.abs(MobAI._util.angNorm(wantA - ai.heading)) > Math.PI * 0.55;
        // 唯一允许的锐角：刚获得仇恨 且 目标在身后 -> 立刻掉头。
        // 其余情况一律按 turnRate 平滑转弯（否则会走成折线、身体跟着折）。
        if (fresh && behind) ai.heading = wantA;
        else ai.heading = MobAI._util.turnToward(ai.heading, wantA, tr * dt);
        ai.dirX = Math.cos(ai.heading); ai.dirY = Math.sin(ai.heading);
        return { x: ai.dirX * mob.chaseSpeed, y: ai.dirY * mob.chaseSpeed };
      }
      ai.dirA = wantA; ai.dirX = dx / d; ai.dirY = dy / d;
      return { x: dx / d * mob.chaseSpeed, y: dy / d * mob.chaseSpeed };
    },

    // 逃离（被看不见的敌人偷袭）：触发点在 Mob.hurt，这里只负责跑。
    // 用【追击速度】跑，计时结束回到正常游荡（不是永久脱战）。
    flee(mob, ai, dt) {
      if (!(mob.fleeT > 0)) return null;
      mob.fleeT = Math.max(0, mob.fleeT - dt);
      const dx = mob.x - mob.fleeAX, dy = mob.y - mob.fleeAY;
      const d = Math.hypot(dx, dy) || 1;
      const wantA = Math.atan2(dy, dx);          // 背离攻击者
      const tr = mob.turnRate || 0;
      if (tr > 0) {
        if (ai.heading == null) ai.heading = wantA;
        // 逃跑要果断：允许 3 倍转向速率，但不能瞬间掉头（那样身体会折）
        ai.heading = MobAI._util.turnToward(ai.heading, wantA, tr * 3 * dt);
        ai.dirX = Math.cos(ai.heading); ai.dirY = Math.sin(ai.heading);
      } else {
        ai.dirX = dx / d; ai.dirY = dy / d;
      }
      if (mob.fleeT <= 0) { ai.phase = 'idle'; ai.t = rand(0.2, 0.6); }
      return { x: ai.dirX * mob.chaseSpeed, y: ai.dirY * mob.chaseSpeed };
    },

    // 通用随机游走：行走一段距离 -> 停下来 -> 等一会儿 -> 换个新方向 -> 再走 …
    // 一趟之内方向恒定；turnRate > 0 时以有限角速度逼近目标角（走圆弧而非折线）。
    wanderStep(ai, dt, mob) {
      ai.t -= dt;

      if (ai.phase === 'walk') {
        // 撞到禁行地形：这一趟作废，立刻重新选方向（否则会贴着边界来回蹭）
        if (ai.blockedT > 0) {
          ai.blockedT = 0;
          ai.phase = 'idle';
          ai.t = rand(0.1, 0.4);
          return { x: 0, y: 0 };
        }
        // 走够了距离（或超时兜底：被墙卡住也不会永远走不完）-> 停下来等一会儿
        if (ai.remain <= 0 || ai.t <= 0) {
          ai.phase = 'idle';
          ai.t = rand(2, 6) * 0.4; // 原地停留缩短为 0.4x（体验优化：游荡停顿不再过久）
          return { x: 0, y: 0 };
        }
        // 一趟之内方向【恒定】—— 不做任何正弦摆动（S 型只属于配了 sPath 的蜜蜂）。
        const aNow = ai.dirA;
        // 航向限速：目标角每帧只逼近一小步 -> 走出来是圆弧（有转弯半径），不是折线。
        const tr = mob.turnRate || 0;
        if (tr > 0) {
          if (ai.heading == null) ai.heading = aNow;
          ai.heading = MobAI._util.turnToward(ai.heading, aNow, tr * dt);
          ai.dirX = Math.cos(ai.heading); ai.dirY = Math.sin(ai.heading);
          return { x: ai.dirX * mob.wanderSpeed, y: ai.dirY * mob.wanderSpeed };
        }
        ai.dirX = Math.cos(aNow); ai.dirY = Math.sin(aNow);
        return { x: ai.dirX * mob.wanderSpeed, y: ai.dirY * mob.wanderSpeed };
      }

      // idle：等够了就换一个新方向，开始下一趟
      if (ai.t <= 0) {
        // 每趟距离由生物自身配置（mob.wanderRange）：默认 [120,280]，
        // 蜈蚣这类「一次要走很远」的生物会配成几百像素。
        const rr = (mob.wanderRange && mob.wanderRange.length === 2) ? mob.wanderRange : [120, 280];
        // 转向角限制（mob.maxTurn，弧度）：不配 = 完全随机方向（原有行为）；
        // 配了就在【上一次方向】的基础上最多偏 ±maxTurn —— 这样不会突然掉头。
        let a;
        if (mob.maxTurn > 0 && ai.dirA != null) {
          a = ai.dirA + rand(-mob.maxTurn, mob.maxTurn);
        } else {
          a = rand(0, TAU);
        }
        ai.dirA = a;
        ai.remain = rand(rr[0], rr[1]);   // 这趟要走的距离
        // 超时兜底必须按【走完这趟所需的时间】给，不能写死 8s：
        // 慢速生物 8 秒只走几百像素，还不到下限，于是每一趟都在走完之前被强行换向。
        // 留 2.5 倍余量，被墙卡住时仍能兜底；上限 24s 避免僵太久。
        ai.t = Math.min(24, Math.max(8, (rr[1] / Math.max(1, mob.wanderSpeed || 1)) * 2.5));
        ai.phase = 'walk';
        // 起步同样受限速约束：不会一开走就朝新方向猛拐
        let aNow = a;
        const tr = mob.turnRate || 0;
        if (tr > 0) {
          if (ai.heading == null) ai.heading = a;
          ai.heading = MobAI._util.turnToward(ai.heading, a, tr * dt);
          aNow = ai.heading;
        }
        ai.dirX = Math.cos(aNow); ai.dirY = Math.sin(aNow);
        return { x: ai.dirX * mob.wanderSpeed, y: ai.dirY * mob.wanderSpeed };
      }
      return { x: 0, y: 0 };
    },
  },
};

// ============================================================================
// 内置 AI 1：通用游走（wander）—— 默认回落
// 仇恨追击 -> 逃离 -> 行走/停顿状态机。瓢虫等绝大多数生物直接用它。
// ============================================================================
MobAI.register('wander', {
  create() {
    return {
      kind: 'wander',
      phase: 'idle',                 // 'idle' 停下等待 | 'walk' 行走
      t: rand(0, 1.4),               // 当前阶段剩余时间（初始错开，避免几只怪同节奏）
      dirA: rand(0, TAU),            // 这一趟的目标方向（角度）
      dirX: 0, dirY: 0,              // 实际航向（单位向量）
      heading: null,                 // 实际航向（角度，受 turnRate 限速）；null = 还没建立
      remain: 0,                     // 这一趟还要走多远（世界像素）
      hadTgt: false                  // 上一帧是否有仇恨目标（用于识别「刚获得仇恨」）
    };
  },
  step(ai, dt, mob) {
    const U = MobAI._util;
    const chase = U.chase(mob, ai, dt);
    if (chase) return chase;
    const flee = U.flee(mob, ai, dt);
    if (flee) return flee;
    return U.wanderStep(ai, dt, mob);
  },
  notifyMoved(ai, d) {
    if (ai.phase === 'walk' && d > 0) ai.remain -= d;
  },
  facing(ai) {
    return Math.atan2(ai.dirY, ai.dirX);
  },
});

// ============================================================================
// 内置 AI 2：蜜蜂（bee）—— 通用游走 + 持续摆头的 S 型路径
// 把「移动欲望」整体旋转一个随时间正弦变化的角度：速度大小不变，于是一边前进
// 一边左右绕。稀有度越高越沉稳（摆幅按比例收窄、单个 S 拉长）。
// ============================================================================
MobAI.register('bee', {
  init(mob) {
    mob.sPath = true;
    const ri = (typeof RARITY_ORDER !== 'undefined') ? RARITY_ORDER.indexOf(mob.rarity) : 0;
    const t01 = ri < 0 ? 1 : clamp(ri / Math.max(1, RARITY_ORDER.length - 1), 0, 1); // 0=common 1=eternal
    mob.sAmp = BEE_S_AMP * (1 + (BEE_S_AMP_MIN_K - 1) * t01);
    mob.sHz = BEE_S_HZ / (1 + (BEE_S_LEN_MAX_K - 1) * t01);
  },
  create() {
    const ai = MobAI.defs.wander.create();
    ai.kind = 'bee';
    ai.sT = rand(0, 1);              // S 型相位错开
    return ai;
  },
  step(ai, dt, mob) {
    const v = MobAI.defs.wander.step(ai, dt, mob);
    if (!v.x && !v.y) return v;
    ai.sT = (ai.sT || 0) + dt;
    const a = Math.sin(ai.sT * (mob.sHz || 0.85) * TAU) * (mob.sAmp || 0.6);
    const c = Math.cos(a), s = Math.sin(a);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
  },
  notifyMoved(ai, d) { MobAI.defs.wander.notifyMoved(ai, d); },
  facing(ai) { return Math.atan2(ai.dirY, ai.dirX); },
});

// ============================================================================
// 内置 AI 3：蜈蚣（centipede）—— 全程弧线，不存在任何角度突变
//
// 硬性规则（用户口径）：不许有「角度转向」—— 换向、追击、逃跑、撞墙，
// 一律只能通过【连续变化的曲率】实现，连钝角/掉头也只能绕大弯。
//
// 做法：AI 从不直接改 heading，而是维护一个【角速度 curv】：
//   1) 每帧先算「目标角速度」curvTarget：
//        · 游荡：±arcRate（长弧爬行）；
//        · 追击 / 逃跑：按航向误差做比例控制，并钳到 chaseTurn / fleeTurn；
//        · 撞墙 / 换向：只翻转 curvTarget 的符号，绝不碰 heading。
//   2) 让 curv 以指数阻尼逼近 curvTarget（turnK）——
//      曲率本身连续，轨迹就永远是光滑弧线；换向时是平滑的 S 弯，而不是尖角。
//   3) heading += curv * dt。
// 速度口径：游荡 = 0.65× 瓢虫游荡；追击 = 通用 0.90× 玩家最高速。
// ============================================================================
MobAI.register('centipede', {
  init(mob) {
    const base = mob.wanderSpeed || (MOB_WANDER_MULT * PLAYER_BASE_SPEED);
    mob.wanderSpeed = base * 0.65;
    mob.chaseSpeed = MOB_CHASE_MULT * PLAYER_BASE_SPEED;
    mob.speed = mob.wanderSpeed;
    mob._centSpeedCap = mob.chaseSpeed;
    // 最小转弯半径 = 1 倍单个体节直径：只给【追击 / 逃跑 / 避墙】这类必须回到窄口的转向用。
    // 曲率上限 = 速度 / 半径 —— 于是任何角度变化都是弧，不存在折角。
    mob.turnRadius = Math.max(16, mob.visualD || (mob.r || 12) * 2);
    // 游荡路径 = 【大半径长弧】（用户口径）：上一版 common 的半径 = 55 × 18 = 990px，
    // 这次整体取 0.6 倍 -> 55 × 18 × 0.6 = 594px（下限 900 × 0.6 = 540px）。
    // 稀有度越高体型越大（turnRadius ∝ visualD），弧半径随之等比变大。
    // 曲率 = 游荡速度 / 半径；半径越大，同样速度下轨迹越平缓。
    mob.arcRadius = Math.max(540, mob.turnRadius * 10.8);
    mob.arcRate = mob.wanderSpeed / mob.arcRadius;
    mob.chaseTurn = mob.chaseSpeed / mob.turnRadius;
    mob.fleeTurn = mob.chaseSpeed / (mob.turnRadius * 0.85);
    // 与墙保持至少 1 个瓦片的距离（探测距离 = 瓦片边长）
    mob.wallKeep = (typeof GARDEN_TILE === 'number') ? GARDEN_TILE : 288;
    mob.turnK = 5;                  // 曲率逼近速度（1/s）：约 0.2s 完成过渡
    mob.segmentedAI = true;
  },
  create() {
    return {
      kind: 'centipede',
      heading: rand(0, TAU),
      curv: 0,                      // 当前角速度（rad/s）：它连续，heading 才连续
      dirX: 0, dirY: 0,
      blockedT: 0,
      arcT: 0,                      // 当前弧段已持续时间
      arcSign: Math.random() < 0.5 ? -1 : 1,
      arcHold: rand(8, 16),         // 本段长弧持续 8~16s：半径 900px 时只转 20~40°，弧很长
      probeT: 0,                    // 避墙探测的冷却（0.2s 一次，别每帧查地图）
      probeDir: 0                   // -1 左弯 / 0 正常 / +1 右弯
    };
  },
  // 避墙探测：前方 / 左侧 / 右侧各取「1 个瓦片」距离，判断能不能站人。
  // 返回 -1（向左弯）/ 0（不需要避）/ +1（向右弯）。
  // 朝向左手法线 = heading - PI/2（屏幕 y 向下时是左上方），右侧 = heading + PI/2。
  _wallProbe(mob, ai) {
    const map = mob._map;
    if (!map || typeof map.canStandAt !== 'function') return 0;
    // 走路口径：walkR 已被钳在 0.9 格内接圆以内，巨型个体也判得出"能过 1 格口"
    const r = MobAI._util.walkR(mob);
    const D = mob.wallKeep || 288;
    const h = ai.heading;
    const ok = (a) => map.canStandAt(mob.x + Math.cos(a) * D, mob.y + Math.sin(a) * D, r);
    const okF = ok(h);
    const okL = ok(h - Math.PI / 2);
    const okR = ok(h + Math.PI / 2);
    if (!okF) {
      // 前面 1 个瓦片内就有墙：朝空的一侧弯；两侧都不空就顺着当前弧向拐出去
      if (okL && !okR) return -1;
      if (okR && !okL) return +1;
      return ai.arcSign || 1;
    }
    // 前面通畅，但侧向已经贴墙：朝远离墙的一侧弯，把距离拉回 1 个瓦片
    if (!okL && okR) return +1;
    if (!okR && okL) return -1;
    return 0;
  },
  step(ai, dt, mob) {
    const U = MobAI._util;
    if (ai.heading == null) ai.heading = rand(0, TAU);

    // ---- 1) 目标曲率 ----
    let curvTarget = 0;
    let speed = mob.wanderSpeed;
    const tgt = mob.topThreat ? mob.topThreat() : null;
    const chasing = !!tgt && (mob.hostility !== 'passive' || tgt.honey);

    if (chasing) {
      // 比例控制：误差越大转得越快，但硬上限保证「只能绕弧」。
      // 【不再保留「目标在身后就立刻掉头」】—— 那正是尖角/钝角折返的来源。
      // 期望角先按【行走碰撞箱】做一次扇形探路：只改"想去的方向"，不碰曲率本身，
      // 所以仍然是连续弧线（走 1 格窄口时也只是把大弯对准通道）。
      const wantA = U.steer(mob, ai, Math.atan2(tgt.y - mob.y, tgt.x - mob.x), dt);
      curvTarget = clamp(U.angNorm(wantA - ai.heading) * 2.2,
        -(mob.chaseTurn || 0.8), (mob.chaseTurn || 0.8));
      speed = mob.chaseSpeed;
      ai.arcT += dt;                // 追击期间弧段计时照走，脱战后不会立刻换向
    } else if (mob.fleeT > 0) {
      mob.fleeT = Math.max(0, mob.fleeT - dt);
      const wantA = Math.atan2(mob.y - mob.fleeAY, mob.x - mob.fleeAX);   // 背离攻击者
      curvTarget = clamp(U.angNorm(wantA - ai.heading) * 2.6,
        -(mob.fleeTurn || 1.1), (mob.fleeTurn || 1.1));
      speed = mob.chaseSpeed;
      ai.arcT += dt;
    } else {
      // ---- 游荡：长弧 + 很久才换弯 ----
      ai.arcT += dt;
      // 撞墙/禁行：只翻转目标曲率的符号，由下面的阻尼平滑过零（绝不瞬转）
      if (ai.blockedT > 0) {
        ai.blockedT = 0;
        ai.arcSign = -ai.arcSign;
        ai.arcHold = ai.arcT + rand(6, 12);
      }
      if (!ai.arcHold || ai.arcT >= ai.arcHold) {
        // 换弯间隔远大于旧值（2.5~5s）：半径 900px 时一次只弯 20~40°，
        // 观感是"沿着一段很长的弧慢慢走"，而不是左右摆动的 S 形。
        ai.arcHold = ai.arcT + rand(8, 16);
        ai.arcSign = -ai.arcSign;
      }
      curvTarget = ai.arcSign * (mob.arcRate || 0.10);
    }

    // ---- 2) 避墙：与墙体保持至少 1 个瓦片距离 ----
    // 探测降频到 5Hz（canStandAt 要查碰撞多边形，没必要每帧三次）。
    // 需要避让时把目标曲率拉到「半径 = 1 节直径」对应的角速度：
    // 方向取探测结果，大小取 max(当前, 最小转弯曲率) —— 始终是弧，不是折角。
    ai.probeT = (ai.probeT || 0) - dt;
    if (ai.probeT <= 0) {
      ai.probeDir = MobAI.defs.centipede._wallProbe(mob, ai);
      ai.probeT = 0.25;
    }
    if (ai.probeDir) {
      const minCurv = speed / (mob.turnRadius || 32);
      curvTarget = ai.probeDir * Math.max(Math.abs(curvTarget), minCurv);
    }

    // ---- 3) 曲率平滑：所有方向变化都发生在这里，而不是直接改 heading ----
    ai.curv = damp(ai.curv || 0, curvTarget, mob.turnK || 4, dt);
    ai.heading += ai.curv * dt;
    ai.dirX = Math.cos(ai.heading); ai.dirY = Math.sin(ai.heading);
    return { x: ai.dirX * speed, y: ai.dirY * speed };
  },
  speedLimit(mob) { return mob._centSpeedCap; },
  facing(ai) { return Math.atan2(ai.dirY, ai.dirX); },
});
