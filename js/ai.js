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
// 目前只实现「随机游走」一种 AI，行为节奏：
//   行走一段距离 -> 停下来 -> 等一会儿 -> 换个新方向 -> 再走 …
// 仇恨/追击/逃跑留待有伤害后再接（registry 的 ai 配置已随 mob type 带上来了）。

const MobAI = {
  // 新建一个随机游走 AI。mob 仅用于读取速度等参数（不持有反向引用之外的逻辑）。
  create(mob) {
    return {
      kind: 'wander',
      phase: 'idle',                 // 'idle' 停下等待 | 'walk' 行走
      t: rand(0, 1.4),               // 当前阶段剩余时间（初始错开，避免几只怪同节奏）
      dirX: 1, dirY: 0,              // 当前行走方向（单位向量）
      remain: 0,                     // 这一趟还要走多远（世界像素）
      walked: 0                      // 本趟已走距离（调试/统计用）
    };
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
      return { x: dx / d * mob.chaseSpeed, y: dy / d * mob.chaseSpeed };
    }

    if (ai.phase === 'walk') {
      // 走够了距离（或超时兜底：被墙卡住也不会永远走不完）-> 停下来等一会儿
      if (ai.remain <= 0 || ai.t <= 0) {
        ai.phase = 'idle';
        ai.t = rand(2, 6) * 0.4; // 原地停留缩短为 0.4x（体验优化：游荡停顿不再过久）
        return { x: 0, y: 0 };
      }
      return { x: ai.dirX * mob.wanderSpeed, y: ai.dirY * mob.wanderSpeed };
    }

    // idle：等够了就换一个新方向，开始下一趟
    if (ai.t <= 0) {
      const a = rand(0, TAU);
      ai.dirX = Math.cos(a); ai.dirY = Math.sin(a);
      ai.remain = rand(120, 280);    // 这趟要走的距离
      ai.walked = 0;
      ai.t = 8;                      // 超时兜底
      ai.phase = 'walk';
      return { x: ai.dirX * mob.wanderSpeed, y: ai.dirY * mob.wanderSpeed };
    }
    return { x: 0, y: 0 };
  },

  // 底层引擎回馈本次实际位移（AI 靠它判断"这趟走完了"）
  notifyMoved(ai, d) {
    if (!ai) return;
    if (ai.phase === 'walk' && d > 0) {
      ai.remain -= d;
      ai.walked += d;
    }
  },

  // 期望朝向：行走时朝当前方向；停下时保持最后一次的方向
  facing(ai) {
    if (!ai) return null;
    return Math.atan2(ai.dirY, ai.dirX);
  }
};
