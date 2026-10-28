// ai.js — 生物 AI 接口库
// 'use strict';
//
// 设计原则（重点）：AI 只负责输出「移动欲望」，绝不直接改坐标。
//   · step(ai, dt, mob)  ->  { x, y }  期望速度向量（0,0 = 想停下）
//   · notifyMoved(ai, d) ->  底层引擎把本次【实际位移】回馈给 AI
//   · facing(ai)         ->  当前期望朝向（弧度），仅供贴图朝向参考
// 真正的加速/减速/位移由底层引擎完成（Mob.update 里与主角同一套 damp + moveEntity），
// 因此生物和人物一样是「渐渐起步、渐渐停住」，不会有瞬移和抖动。
//
// 行为节奏：行走一段距离 -> 停下来 -> 等一会儿 -> 换个新方向 -> 再走 …
//
// 【转向速率】（mob.turnRate，rad/s）：
//   不配 = 移动欲望直接指向目标方向（原有行为，瞬时转向）。
//   配了 = 实际航向以不超过 turnRate 的角速度【平滑逼近】目标方向，
//         于是走出来的是一条有转弯半径的圆弧，而不是折线。
//         这一条对蜈蚣尤其重要：身体是沿头的真实路径铺的，
//         头若瞬转 60°，身体会立刻出现一个"折角"，看着就硬。

const MobAI = {
  // 新建一个随机游走 AI。mob 仅用于读取速度等参数（不持有反向引用之外的逻辑）。
  create(mob) {
    return {
      kind: 'wander',
      phase: 'idle',                 // 'idle' 停下等待 | 'walk' 行走
      t: rand(0, 1.4),               // 当前阶段剩余时间（初始错开，避免几只怪同节奏）
      dirA: rand(0, TAU),            // 这一趟的目标方向（角度）
      dirX: 0, dirY: 0,              // 实际航向（单位向量，= 下面 heading 的向量形式）
      heading: null,                 // 实际航向（角度，受 turnRate 限速）；null = 还没建立
      remain: 0,                     // 这一趟还要走多远（世界像素）
      hadTgt: false                  // 上一帧是否有仇恨目标（用于识别"刚获得仇恨"）
    };
  },

  // 角度归一化到 (-PI, PI]
  _angNorm(a) {
    while (a > Math.PI) a -= TAU;
    while (a <= -Math.PI) a += TAU;
    return a;
  },

  // 以不超过 maxStep 的角度，从 cur 转向 want
  _turnToward(cur, want, maxStep) {
    const d = MobAI._angNorm(want - cur);
    if (maxStep <= 0 || Math.abs(d) <= maxStep) return want;
    return cur + (d > 0 ? maxStep : -maxStep);
  },

  // 推进状态机并返回本帧的移动欲望。
  // 走 S 型路线的生物（蜜蜂）在这里统一做「摆头」后处理：
  // 把欲望速度整体旋转一个随时间正弦变化的角度 —— 速度大小不变，
  // 于是一边前进一边左右绕，路径变成蛇形（推进速度比直线追击略慢）。
  step(ai, dt, mob, player) {
    const v = MobAI._step(ai, dt, mob, player);
    if (!mob || !mob.sPath || (!v.x && !v.y)) return v;
    ai.sT = (ai.sT || 0) + dt;
    const a = Math.sin(ai.sT * (mob.sHz || 0.85) * TAU) * (mob.sAmp || 0.6);
    const c = Math.cos(a), s = Math.sin(a);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
  },

  // 原始状态机（不含 S 型摆动）
  _step(ai, dt, mob, player) {
    if (!ai || !mob) return { x: 0, y: 0 };
    ai.t -= dt;

    // 仇恨追击：中立/敌对生物优先冲向【累计伤害最高】的来源（被动型 passive 永不追击）。
    // 仇恨在死亡前永久保留；花瓣造成的伤害由调用方统一记到玩家头上。
    // 被蜜（Honey）吸引的目标是特例：连被动型生物也会主动过去攻击，
    // 否则瓢虫这类 passive 生物永远不会理会地上的蜜（看起来就像"蜜没有吸引效果"）。
    const tgt = mob.topThreat ? mob.topThreat() : null;
    if (tgt && (mob.hostility !== 'passive' || tgt.honey)) {
      const dx = tgt.x - mob.x, dy = tgt.y - mob.y;
      const d = Math.hypot(dx, dy) || 1;
      let wantA = Math.atan2(dy, dx);
      const tr = mob.turnRate || 0;
      if (tr > 0) {
        if (ai.heading == null) ai.heading = wantA;
        const fresh = !ai.hadTgt;                 // 这一帧才刚获得仇恨
        ai.hadTgt = true;
        const behind = Math.abs(MobAI._angNorm(wantA - ai.heading)) > Math.PI * 0.55;
        // 唯一允许的锐角：刚获得仇恨 且 目标在身后 -> 立刻掉头。
        // 其余情况一律按 turnRate 平滑转弯（否则会走成折线、身体跟着折）。
        if (fresh && behind) ai.heading = wantA;
        else ai.heading = MobAI._turnToward(ai.heading, wantA, tr * dt);
        ai.dirX = Math.cos(ai.heading); ai.dirY = Math.sin(ai.heading);
        return { x: ai.dirX * mob.chaseSpeed, y: ai.dirY * mob.chaseSpeed };
      }
      ai.dirA = wantA; ai.dirX = dx / d; ai.dirY = dy / d;
      return { x: dx / d * mob.chaseSpeed, y: dy / d * mob.chaseSpeed };
    }
    ai.hadTgt = false;

    if (ai.phase === 'walk') {
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
        ai.heading = MobAI._turnToward(ai.heading, aNow, tr * dt);
        ai.dirX = Math.cos(ai.heading); ai.dirY = Math.sin(ai.heading);
        return { x: ai.dirX * mob.wanderSpeed, y: ai.dirY * mob.wanderSpeed };
      }
      ai.dirX = Math.cos(aNow); ai.dirY = Math.sin(aNow);
      return { x: ai.dirX * mob.wanderSpeed, y: ai.dirY * mob.wanderSpeed };
    }

    // idle：等够了就换一个新方向，开始下一趟
    if (ai.t <= 0) {
      // 每趟距离由生物自身配置（mob.wanderRange）：默认 [120,280]，
      // 蜈蚣这类"一次要走很远"的生物会配成几百像素。
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
      // 慢速生物（蜈蚣 ~42px/s）8 秒只走 ~340px，还不到 420px 的下限，
      // 于是每一趟都在走完之前被强行换向 -> 每 8 秒拐一次 ±30° ->
      // 看上去就是"脑袋左右摆、走 S"。留 2.5 倍余量，被墙卡住时仍能兜底。
      // 上限 24s：既保证慢速生物能走完整趟，又不至于被墙卡住时僵太久。
      ai.t = Math.min(24, Math.max(8, (rr[1] / Math.max(1, mob.wanderSpeed || 1)) * 2.5));
      ai.phase = 'walk';
      // 起步同样受限速约束：不会一开走就朝新方向猛拐
      let aNow = a;
      const tr = mob.turnRate || 0;
      if (tr > 0) {
        if (ai.heading == null) ai.heading = a;
        ai.heading = MobAI._turnToward(ai.heading, a, tr * dt);
        aNow = ai.heading;
      }
      ai.dirX = Math.cos(aNow); ai.dirY = Math.sin(aNow);
      return { x: ai.dirX * mob.wanderSpeed, y: ai.dirY * mob.wanderSpeed };
    }
    return { x: 0, y: 0 };
  },

  // 底层引擎回馈本次实际位移（AI 靠它判断"这趟走完了"）
  notifyMoved(ai, d) {
    if (!ai) return;
    if (ai.phase === 'walk' && d > 0) {
      ai.remain -= d;
    }
  },

  // 期望朝向：行走时朝当前方向；停下时保持最后一次的方向
  facing(ai) {
    if (!ai) return null;
    return Math.atan2(ai.dirY, ai.dirX);
  }
};
