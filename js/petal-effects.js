// petal-effects.js — 花瓣特殊效果引擎（检测 / 效果 / 物理能力自由组合的自定义框架）
// 'use strict';
//
// 设计目标：把「花瓣的特殊行为」从 _syncPetals / 战斗结算里彻底剥离。
// 任何花瓣只要在这里注册同名效果（key === card.type.slug，如 'rose'），引擎就会接管它：
//   · 在轨阶段：reload 完成后每帧 detect；命中即激活 start/update（玫瑰回血）；
//   · 被动阶段：passive 定义每帧 tick（叶子持续回血）；
//   · 物理侧  ：脱轨/喷射（detach）、飞行存活（flight）、硬碰撞（onHit）、仇恨吸引（canAttract）
//     —— 行为层（Player / LocalServer）只问引擎，不再按 slug 或字段写分支。
//
// —— 注册格式 ——
//   PetalFX.register(key, {
//     traits?: {...}                  可选：覆盖数据表里的能力字段（见 trait()）
//     detect(ctx)          -> bool    每帧检测（未激活时调用）；返回 true 触发
//     start(ctx)                      触发时初始化（状态挂在 ctx.petal.fx.state）
//     update(ctx, dt)      -> bool    激活后每帧；返回 true = 效果结束（花瓣解管）
//     draw?(ctx2d, ctx)               可选：额外绘制（在花瓣本体之后调用）
//     detach(ctx)          -> plan    可选：脱轨计划，见下方 detach()
//     flight?(ctx)         -> obj     可选：滞留期飞行参数（默认读 traits.launch）
//     onHit(ctx, hit)      -> bool    可选：与生物接触时的【动能传递】结算（不返回 = 走默认软碰撞）。
//                                     硬规则：花瓣与生物【不做任何位置分离】——花瓣穿过生物，
//                                     只在重合的一瞬间传一次冲量，伤害由战斗循环按重合结算。
//     canAttract?(body, player, mob)  可选：该实体能否吸引这只生物（默认只判 traits.attractMobs + 稀有度 + 半径）
//   });
//
// —— 被动形态（passive）——
//   PetalFX.register(key, { passive: true, tick(ctx, dt) });
//   每帧都会调用 tick，但【不接管位置、不跳过战斗】。用于"持续回血/持续光环"这类
//   必须与轨道运动和战斗结算并存的能力（如 Leaf）。
//
// —— ctx API ——
//   ctx.player / ctx.petal(=ctx.body) / ctx.type / ctx.rarity / ctx.stats / ctx.dt
//   ctx.onOrbit()       花瓣是否已弹出至轨道（age ≥ ORBIT_T，出场 Q 弹完成）
//   ctx.popped()        同上但阈值更早（age ≥ ORBIT_T*0.34）
//   ctx.heal(n)         给主角回血（自动 clamp 到 maxHp，返回实际回血量）
//   ctx.consumePetal()  消耗花瓣：转退场幽灵（放大渐隐）+ 该槽重新结算装填
//   激活期间引擎直接把 b.x/b.y 交给特效驱动（跳过轨道弹簧），战斗结算跳过
//   该花瓣（b.fxNoCombat），图层抬高到主角之上。
//
// —— 能力字段（traits）——
//   数据声明仍在 data.js 的 PETAL_TRAITS（构建 type 上的字段）；
//   注册项里的 traits 是可选覆盖，用于「同一个 slug 的某个变体要额外能力」。
//   trait(type, key) 的取值顺序：注册项 traits > type 字段（数据表）> undefined。

const PetalFX = {
  defs: {},
  ORBIT_T: 0.2,          // 弹出至轨道的判定阈值（出生 Q 弹 0.1s + 余量）
  _suppress: false,      // true = 静音表现层输出（服务端权威副本推进时置位）

  // 文字输出钩子：由 game.js 注入（内部转 spawnText）。
  // 特效层不直接持有 Game 实例，只通过这个单一出口弹字，保持「特效只描述意图」的分层。
  textSink: null,

  register(key, def) {
    if (!key || !def) return null;
    this.defs[key] = def;
    return def;
  },

  // 按 card.type 查定义（slug 才是稳定英文名；key 是 'p'+id，永远对不上注册名）
  defOf(type) {
    const k = type && (type.slug || type.key);
    return (k && this.defs[k]) || null;
  },

  // ---- 能力查询：所有「这个花瓣能不能……」的判定都从这里走 ----
  trait(type, key) {
    if (!type) return undefined;
    const def = this.defOf(type);
    if (def && def.traits && (key in def.traits)) return def.traits[key];
    return type[key];
  },

  // ---- 每帧推进（在轨花瓣）----
  tick(body, player, dt) {
    if (!body || body.dead || body.fxDone) return;
    const type = body.card && body.card.type;
    const def = this.defOf(type);
    if (!def) return;

    // 被动效果：每帧都跑，但不接管位置、不置 fxNoCombat（照常参与战斗）。
    if (def.passive) {
      if (def.tick) def.tick(this._ctx(body, player, dt), dt);
      return;
    }

    // 主动效果：detect -> start/update，命中后由特效驱动位置、战斗跳过。
    if (!body.fxActive) {
      if (!def.detect) return;
      const c = this._ctx(body, player, dt);
      if (!def.detect(c)) return;
      body.fx = { key: def.key || (type && type.slug), state: {} };
      body.fxActive = true;
      body.fxNoCombat = true;
      if (def.start) def.start(c);
      return;
    }
    if (!def.update) { body.fxActive = false; return; }
    const done = def.update(this._ctx(body, player, dt), dt);
    if (done) { body.fxActive = false; body.fxNoCombat = false; body.fxDone = true; }
  },

  // ---------------- 物理 / 行为钩子（给 Player 与 LocalServer 调用） ----------------

  // 这张卡是否具备「脱离轨道」能力（数据字段 detachAfter > 0）
  canDetach(body) {
    const type = body && body.card && body.card.type;
    return (this.trait(type, 'detachAfter') || 0) > 0;
  },

  // 脱轨计划：返回 null = 不脱轨，否则 { vx, vy, holdReload }。
  // 默认实现按能力字段生成：有 launch 的喷射出去（Peas），否则保留一点惯性滑行（Pollen / Honey）。
  // 具体物种可以覆盖：detach(ctx) 返回自己的初速/参数。
  detach(body, player) {
    const type = body && body.card && body.card.type;
    if (!type) return null;
    const def = this.defOf(type);
    if (def && def.detach) return def.detach(this._ctx(body, player, 0)) || null;
    const launch = this.trait(type, 'launch');
    if (launch) {
      // 喷射型：朝 N 个方向直直飞出去，速度 = speedK × 主角默认最高移速。
      // 基准必须是 PLAYER_BASE_SPEED（不含 SPEED_SCALE 与 /speed 倍率），
      // 否则豌豆一出膛就飞出屏幕（表现为"炸开一瞬间就没了"）。
      const dirs = launch.count || 4;
      const dir = (body.sub || 0) * (TAU / dirs) + (body.selfRot || 0);
      const sp = (launch.speedK || 1.3) * PLAYER_BASE_SPEED;
      return { vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp, holdReload: false };
    }
    // 滞留型（Pollen / Honey）：保留脱手瞬间的惯性，其余能量在脱手时损耗
    return {
      vx: (body.vx || 0) * PETAL_DETACH_KICK,
      vy: (body.vy || 0) * PETAL_DETACH_KICK,
      holdReload: !!this.trait(type, 'holdReloadUntilDeath')
    };
  },

  // 滞留实体的飞行参数（Peas 用）：匀速直飞 + 到时移除；返回 null = 普通惯性滑行
  flightOf(body) {
    const type = body && body.card && body.card.type;
    const def = this.defOf(type);
    if (def && def.flight) return def.flight(this) || null;
    return this.trait(type, 'launch') || null;
  },

  // 滞留实体的存活上限（秒）：Infinity = 由血量决定（Honey）
  ttlOf(body) {
    const type = body && body.card && body.card.type;
    return this.trait(type, 'holdReloadUntilDeath') ? Infinity : PETAL_DETACH_TTL;
  },

  // 花瓣 vs 生物的【接触传能】（每 tick、每次接触调一次；伤害不在这里）。
  // contact = { dt, mob, hit:{nx,ny,depth}, approach, relN, jmass, jshare, wP, wM, shareP, shareM, kbBoost }
  // 【所有花瓣同一套】：实体分离由 Player._separatePetalFromMobs（花瓣侧）与
  // LocalServer._separateMobFromPetal（生物侧）完成，这里只负责手感：
  //   ① 撞上去那一下传一次动能（kbT 冷却，同一次接触只传一次）；
  //   ② 沿生物表面加一份切向摩擦，生物是"蹭走"而不是被钉在原地（揉搓）。
  // 不再按 PETAL_TRAITS.solid 分叉 —— 那套"有的花瓣穿过生物、有的被挡住"正是
  // "花瓣和生物根本不结算碰撞"的来源。注册项的 onHit 仍拥有最高优先级。
  onHit(body, player, contact) {
    const type = body && body.card && body.card.type;
    const def = this.defOf(type);
    const c = this._ctx(body, player, (contact && contact.dt) || 0);
    if (def && def.onHit) return !!def.onHit(c, contact);
    return this._contactHit(c, contact);
  },

  _contactHit(ctx, c) {
    if (!c) return false;
    const b = ctx.petal, m = c.mob;
    const nx = c.hit.nx, ny = c.hit.ny;
    // ① 一次接触只传一次动能。接触强度取"花瓣撞过来"与"生物撞过来"两者中更大的那个，
    //    否则"站着不动让怪撞"永远传不出力。
    const vN = Math.max(c.approach || 0, c.relN || 0);
    if (vN >= PETAL_KB_MIN_APPROACH && !(b.kbT > 0)) {
      const impact = clamp(vN / PETAL_KB_REF, 0.35, 2.2);
      applyKnockback(m, -nx, -ny, PETAL_KB_BASE * c.jshare * c.jmass * impact * c.kbBoost);
      b.kbT = PETAL_KB_CD;
    }
    // ② 切向摩擦（揉搓）：把生物往"花瓣相对生物"的切向速度上带
    const tx = -ny, ty = nx;
    const relV = ((b.vx || 0) - (m.vx || 0)) * tx + ((b.vy || 0) - (m.vy || 0)) * ty;
    if (relV > 1 || relV < -1) {
      const j = clamp(relV * 0.28, -PETAL_RUB_MAX, PETAL_RUB_MAX);
      m.vx = (m.vx || 0) + tx * j;
      m.vy = (m.vy || 0) + ty * j;
    }
    return true;
  },

  // 该实体能否把这只生物的仇恨拉过来。
  // 默认规则：① traits.attractMobs ② 稀有度不超过该卡的 Max Mob Rarity ③ 在 HONEY_PULL_R 内。
  canAttract(body, player, mob) {
    const card = body && body.card;
    const type = card && card.type;
    if (!type || !this.trait(type, 'attractMobs')) return false;
    const maxR = this.maxMobRarity(type, card.rarity);
    // 该稀有度【没登记上限】（如 common 蜜）-> 什么都吸引不了，而不是"什么都不限"。
    if (!maxR) return false;
    if (RARITY_ORDER.indexOf(mob.rarity) > RARITY_ORDER.indexOf(maxR)) return false;
    const def = this.defOf(type);
    if (def && def.canAttract) return !!def.canAttract(body, player, mob);
    return dist2(body.x, body.y, mob.x, mob.y) <= HONEY_PULL_R * HONEY_PULL_R;
  },

  // 某花瓣在某稀有度下的「Max Mob Rarity」：返回稀有度名或 null
  maxMobRarity(type, rarity) {
    const t = this.trait(type, 'maxMobRarity');
    if (t) return t[rarity] || null;
    return (typeof petalMaxMobRarity === 'function') ? petalMaxMobRarity(type, rarity) : null;
  },

  _ctx(body, player, dt) {
    const card = body && body.card;
    const type = card && card.type;
    return {
      player,
      petal: body,
      body,
      type,
      rarity: card && card.rarity,
      stats: petalStatsFor(type, card && card.rarity),
      dt,
      onOrbit: () => body.age >= this.ORBIT_T,
      // 弹出"一点点"（约 1/3 弹道）：用于"加载即结算"类特效——不等飞满整圈固定位，
      // 花瓣往外弹一点就被拉回主角中心（观感更优美）。
      popped: () => body.age >= this.ORBIT_T * 0.34,
      // 回血：返回【实际回血量】（血量有缺口不足时小于 n；满血返回 0）。
      heal: (n) => {
        const before = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + (n || 0));
        return player.hp - before;
      },
      // 弹飘字：走 textSink（game.spawnText），样式与攻击反馈完全一致（DamageText）。
      // _suppress 为 true 时静音 —— 服务端权威副本也会跑特效逻辑（为了结算治疗量），
      // 但表现层只能由客户端出，否则同一帧会弹两次。
      floatText: (text, color, x, y) => {
        if (PetalFX._suppress) return;
        if (PetalFX.textSink) PetalFX.textSink(x, y, text, color);
      },
      consumePetal: () => this._consume(body, player),
    };
  },

  // 消耗：与 _destroyPetal/_syncPetals 同语义 —— 只打 dead 标记，由 _syncPetals
  // 的差分转成退场幽灵（原地放大渐隐），装填立即重新结算。
  _consume(body, player) {
    body.dead = true;
    const c = body.card;
    const dur = (c.type.reload != null) ? c.type.reload : Math.max(0, c.type.spd || 0);
    player.reload[body.slotIndex] = { card: c, age: 0, dur };
  },
};

// ============================================================================
// 基础花瓣（无特效）—— 显式登记，表示「这些花瓣也由引擎统一分派」，
// 走默认的软碰撞 + 轨道运动；以后要给它们加能力，直接在这里补钩子即可。
// ============================================================================
PetalFX.register('basic', {});
PetalFX.register('light', {});
PetalFX.register('stinger', {});

// —— 内置特效 1：玫瑰（Rose）——
// 检测：reload 完成、已弹出至轨道，且主角血量不满（每帧检测，
//       因此"加载好之后的任何时候"血量不满都会立刻触发，而非只在出生瞬间）。
// 效果：1.5s smoothstep 从触发点飞向主角，结束时回 heal 血并消耗自己
//       （对应卡面冷却文本 "3.5s + 1.5s" 的后半段）。
PetalFX.register('rose', {
  detect(ctx) {
    // 加载即结算：不等回到满圈固定位，花瓣往外弹一点(orbit 1/3)就触发，
    // 随即被拉回主角中心回血（弃用"回固定位再吸入"的复杂做法）。
    return ctx.popped() && (ctx.stats.heal || 0) > 0 && ctx.player.hp < ctx.player.maxHp;
  },
  start(ctx) {
    // 物理施力式起飞：初速 0，update 里持续朝主角加速，飞行途中自然跟随主角本体移动
    ctx.petal.fx.state = { t: 0, vx: 0, vy: 0 };
  },
  update(ctx, dt) {
    const s = ctx.petal.fx.state;
    s.t += dt;
    const p = ctx.player;
    const px = ctx.petal.x, py = ctx.petal.y;
    const dx = p.x - px, dy = p.y - py;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const PULL = 1600;                       // 朝主角的吸引力（加速度，px/s^2）
    s.vx += (dx / dist) * PULL * dt;
    s.vy += (dy / dist) * PULL * dt;
    const damp = Math.exp(-2.6 * dt);        // 阻尼：避免无限加速，靠近时自然减速
    s.vx *= damp; s.vy *= damp;
    ctx.petal.x += s.vx * dt;
    ctx.petal.y += s.vy * dt;
    // 撞到主角（或超时兜底）即结算回血：飞行途中持续跟随主角本体，不锁死在触发点
    if (dist <= (p.r || 0) + 4 || s.t >= 1.5) {
      const got = ctx.heal(ctx.stats.heal);
      if (got > 0) {
        // 数值是【实际回血量】，颜色用 Heal 专用粉，位置在主角上方 —— 与攻击飘字同款式
        ctx.floatText(String(Math.round(got)), HEAL_TEXT_COLOR,
          p.x, p.y - (p.r || 0) - 6);
      }
      ctx.consumePetal();
      return true;
    }
    return false;
  },
});

// —— 内置特效 2：叶（Leaf）——
// 持续回血：只要实体在轨且未死亡，就按 heal/s 连续回血（封顶 maxHp，不弹字）。
// 被动形态：不接管位置、不跳过战斗 —— 叶子照常参与碰撞与伤害结算。
// 这段规则原先是 net/server.js 战斗循环里按 slug 特判、且被 25Hz 节流成阶梯回血；
// 现在和其它花瓣能力一样，由效果引擎按类型驱动。
PetalFX.register('leaf', {
  passive: true,
  tick(ctx, dt) {
    const heal = (ctx.stats.heal || 0) * dt;
    if (heal > 0 && ctx.player.hp < ctx.player.maxHp) ctx.heal(heal);
  },
});

// —— 内置特效 3：花粉（Pollen）——
// 滞留型：reach / detect 模式下加载 0.5s 后脱轨，留在原地形成一小摊"花粉"。
// 脱轨参数来自能力字段（detachAfter），物理由引擎默认 detach 处理（惯性滑行）。
PetalFX.register('pollen', {});

// —— 内置特效 4：豌豆（Peas）——
// 喷射型：加载后 0.05s 朝 4 个方向直直射出去（launch 参数来自能力字段），
// 飞行期间照常参与碰撞与伤害结算，2s 后强制移除。
// 这里不需要覆写钩子：引擎默认 detach 已经能读 launch 生成初速，
// flightOf 也能读到同一份参数；显式登记只是把"这只花瓣由引擎接管"写明。
PetalFX.register('peas', {});

// —— 内置特效 5：蜜（Honey）——
// ① 实体碰撞：这条【不写在这里】。所有花瓣都是实体（分离 + 双向伤害由战斗循环统一处理），
//    蜜的区别只有 `sticky: true` —— 会被生物吸到表面"揉搓"（见 data.js PETAL_TRAITS）。
// ② 仇恨吸引：把周围生物的仇恨拉到自己身上（不造成伤害，只负责挨打）。
//    吸引范围与稀有度上限仍由数据字段声明，判定逻辑集中在 canAttract()。
PetalFX.register('honey', {
  canAttract(body, player, mob) {
    return dist2(body.x, body.y, mob.x, mob.y) <= HONEY_PULL_R * HONEY_PULL_R;
  },
});
