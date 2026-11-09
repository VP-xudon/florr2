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

  // ---- 给主角的【装备加成】（装上就生效，与是否装填好无关；同类可叠加）----
  // 返回 { rotSpeed: 最大转速加成(rad/s), reach: reach 模式额外伸出距离(px), sight: 视野放大比例 }。
  // 数值默认来自数据表（PETAL_RARITY_OVERRIDES -> rarityStats），注册项可用 bonus() 追加，
  // Player.recompute() 只做求和，绝不按 slug 判断。
  bonus(type, rarity) {
    const def = this.defOf(type);
    // 注册项优先（同一种花瓣可能有数据表之外的额外加成）；
    // 没有注册项时退回数据表 —— 两处都以"该稀有度的实际数值"为准，绝不相加，避免翻倍。
    if (def && def.bonus) {
      const o = def.bonus(type, rarity) || {};
      return { rotSpeed: o.rotSpeed || 0, reach: o.reach || 0, sight: o.sight || 0 };
    }
    const st = (typeof petalStatsFor === 'function') ? petalStatsFor(type, rarity) : null;
    return {
      rotSpeed: (st && st.rotSpeed) || 0,
      reach: (st && st.attackRange) || 0,
      sight: (st && st.sight) || 0
    };
  },

  damageOf(body, mob, player, baseDamage) {
    const def = this.defOf(body && body.card && body.card.type);
    return def && def.damage ? def.damage(this._ctx(body, player, 0), mob, baseDamage) : baseDamage;
  },

  // ---- 装备型饰品（accessory）的绘制（可选）----
  // 返回 true  = 注册项自己画完了（高度自定义，比如 Third Eye 的白色眼珠）；
  // 返回 false = 用玩家层的默认实现（把素材原样画在头顶上方）。
  // 这样普通饰品不需要写任何绘制代码，特殊饰品才需要接管。
  drawAccessory(ctx2d, acc, player, R) {
    const def = acc && acc.card && this.defOf(acc.card.type);
    if (!def || !def.drawAccessory) return false;
    return !!def.drawAccessory(ctx2d, acc, player, R);
  },

  // ---- 素材渲染接管（可选）----
  // 有些花瓣的贴图里【画死了】本该由代码驱动的部件（Third Eye 的白色眼珠就是）。
  // 只画贴图就会出现"两个眼珠"，只画代码又会丢掉贴图里的其它细节。
  // 于是给注册项两条通用钩子，让渲染器保持无特判：
  //   artVariant(svgId, svgText) -> string | null
  //       改写素材文本。渲染管线（卡面 / 世界实体 / 幽灵）统一使用改写后的素材，
  //       所以"去掉死部件"只需要在这里做一次。
  //   artOverlay(ctx, look, box) -> bool
  //       在素材之上按【运行状态】补画可动部件。look = 朝向角（世界），null = 静态（卡面）。
  //       box = { x, y, w, h, ux, uy, uw, uh }：素材被画到的矩形 + 它覆盖的素材窗口
  //       （窗口用素材自身坐标系）。有了它，注册项能把"素材里的某个位置/尺寸"精确换到像素，
  //       于是卡面（窗口 68×79）与世界（窗口 33×41）能画出同一个观感 —— 只按 w/h 取比例做不到。
  // 两条钩子都按 svgId 反查花瓣类型，因此 cards.js / sim 层都不需要认识任何 slug。
  _svgDef(svgId) {
    const t = (typeof getPetal === 'function') ? getPetal(svgId) : null;
    return t ? this.defOf(t) : null;
  },
  artVariant(svgId, txt) {
    const def = this._svgDef(svgId);
    if (!def || !def.artVariant || typeof txt !== 'string') return null;
    return def.artVariant(svgId, txt) || null;
  },
  artOverlay(ctx, svgId, look, box) {
    const def = this._svgDef(svgId);
    if (!def || !def.artOverlay) return false;
    return !!def.artOverlay(ctx, svgId, look, box);
  },
  // 这张素材有没有"可动部件"。卡面据此决定要不要进入动态重绘队列
  // （没有可动部件的卡必须保持"画一次就不动"，否则就是纯浪费）。
  hasOverlay(svgId) {
    const def = this._svgDef(svgId);
    return !!(def && def.artOverlay);
  },
  // 静态界面（卡面 / 悬浮框）复现实装观感时，统一从这里取【本地客户端】的当前朝向。
  // 状态以本地显示为准（不做任何网络同步）；拿不到（未开局/已死亡）返回 null -> 画正中。
  lookAngle() {
    const g = (typeof window !== 'undefined') ? window.__game : null;
    const p = g && g.player;
    if (!p || p.dead) return null;
    return (typeof p.facing === 'number') ? p.facing : null;
  },

  // ---- 在轨花瓣的【目标点微调】（默认没有）----
  // 返回 true 表示把偏移写进了 out.{x,y}（相对应到位置的像素偏移）。
  // 由 Player._syncPetals 在算出轨道目标后调用 —— 花瓣仍然走同一套弹簧，只是目标点在飘。
  orbitOffset(body, player, dt, out) {
    const type = body && body.card && body.card.type;
    const def = this.defOf(type);
    if (!def || !def.orbitOffset) return false;
    return !!def.orbitOffset(this._ctx(body, player, dt), out);
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
  detach(body, player, mobs, orbitAngle) {
    const type = body && body.card && body.card.type;
    if (!type) return null;
    const def = this.defOf(type);
    if (def && def.detach) {
      const ctx = this._ctx(body, player, 0);
      ctx.mobs = mobs || [];
      ctx.orbitAngle = (orbitAngle == null) ? null : orbitAngle;
      return def.detach(ctx) || null;
    }
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
    // 注意传的是【实体】：注册项要按实体自身状态决定怎么飞
    // （Web 成网之后就不再飞了，全靠这里判断 body.isWeb）。
    if (def && def.flight) return def.flight(body) || null;
    return this.trait(type, 'launch') || null;
  },

  // 滞留实体的存活上限（秒）：Infinity = 由血量决定（Honey）
  ttlOf(body) {
    const type = body && body.card && body.card.type;
    // 场地型（Web）：落地后按能力声明里的 duration 计时（10s），与装填无关
    if (body && body.isWeb) {
      const web = this.trait(type, 'web');
      return (web && web.duration > 0) ? web.duration : PETAL_DETACH_TTL;
    }
    return this.trait(type, 'holdReloadUntilDeath') ? Infinity : PETAL_DETACH_TTL;
  },

  // 滞留实体的飞行寿命到期（Peas 飞完 / Web 落地）。返回 true = 注册项自己处理了，
  // 调用方不要再走"退场幽灵 + 移除"（Web 就是在这里变成一张网）。
  onExpire(body, player) {
    if (!body) return false;
    const type = body.card && body.card.type;
    const def = this.defOf(type);
    if (!def || !def.expire) return false;
    return !!def.expire(this._ctx(body, player, 0));
  },

  // 实体被打碎（血量为 0 / 被强制移除）时的通知：注册项可以留下点什么。
  // Web 用它实现"飞行途中被打碎也立刻成网"；轨道上被打碎则什么都不做。
  // 调用方【仍然】照常走通用移除（退场幽灵、装填结算），这里只做额外的事。
  onPop(body, player) {
    if (!body) return false;
    const type = body.card && body.card.type;
    const def = this.defOf(type);
    if (!def || !def.pop) return false;
    return !!def.pop(this._ctx(body, player, 0));
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
    if (!(b.kbT > 0)) {
      // 【与速度彻底解耦】：以前 impact = vN / 参考速度（reach 伸得远、转得快就更猛），
      // 于是同一片花瓣"伸出去"和"贴着"击退强度差一倍。现在统一按
      // 「正常转速下动能的 1.5 倍」给一份固定冲量，只由稀有度/质量分配决定差异。
      // vN 只用来判断"这是一次真实接触"，不参与强度计算。
      const impact = PETAL_KB_IMPACT;
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

PetalFX.register('orange', {
  damage(ctx, mob, baseDamage) {
    const previous = mob.lastHitByPlayer ? (mob.lastHitByPlayer.get(ctx.player) || 0) : 0;
    return Math.min(baseDamage + previous * 0.5, ctx.stats.maxDamage || Infinity);
  },
  artVariant(svgId, txt) {
    if (String(svgId) !== '50') return null;
    const root = txt.match(/<g\b[^>]*transform="translate\(-6\.103 9\.445\)"[^>]*>/);
    if (!root) return txt;
    const paths = [...txt.matchAll(/<path\b[^>]*>/g)].map((match) => match[0]);
    if (paths.length !== 12) return txt;
    const single = root[0] + paths.slice(0, 4).join('') + '</g>';
    return txt.replace(/<g\b[^>]*>[\s\S]*?<\/g>/,
      '<g transform="translate(55 55) scale(0.8) translate(-55 -55)">' + single + '</g>');
  }
});

// 口径（用户要求）：
//   · 不在 reach 模式：正常公转，【尖端朝外】（orientOutward），轨道紧贴本体、不吃 reach；
//   · 进入 reach：立刻从【当前角度】沿尖端方向直线飞出，速度不变，飞行中【不旋转】，
//     2 秒后消失（launch.life）。
// 早期版本会"自动瞄准 ±10° 内最近的生物"，那不是 Missile 的行为，已删除。
PetalFX.register('missile', {
  detach(ctx) {
    const body = ctx.petal, player = ctx.player;
    // 方向 = 它【装填完成、蹦出来那一刻】的轨道角（body.spawnAng）：
    // 用 detach 时刻的当前轨道角会偏离（自转已经转过一段），表现为"朝之前的角度飞"。
    // 老实体没有 spawnAng 时才退回引擎传的轨道角 / 坐标夹角。
    const ang = (body.spawnAng != null) ? body.spawnAng
      : ((ctx.orbitAngle != null) ? ctx.orbitAngle
        : Math.atan2(body.y - player.y, body.x - player.x));
    const speed = (ctx.type.launch.speedK || 1.3) * PLAYER_BASE_SPEED;
    body.flightRot = ang - MISSILE_TIP_ANGLE;   // 绘制：尖端对准飞行方向
    body.flightSpin = 0;                        // 飞行中不旋转
    return { vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, holdReload: false };
  },
  flight(body) {
    return body.card.type.launch;               // { life: 2.0, 无 spinRate } => 飞满 2s 消失
  }
});

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

// —— 内置特效 6：加速（Faster）——
// 数值层面它是普通花瓣（伤害/血量见 PETAL_RARITY_OVERRIDES）；
// 特殊的地方只有两处，都交给引擎：
//   ① bonus.rotSpeed：装备即生效，叠加到主角的【最大转速】（recompute 求和，与装填无关）；
//   ② orbitOffset：在"应到位置"周围做极小范围的不规则飘动 —— 两条不同频率的正弦叠加，
//      相位每片花瓣随机，所以一群 Faster 不会同步摆动，看起来毛茸茸的很活泼。
//      幅度只有 2.6px：手感上完全不影响轨道，只影响观感。
PetalFX.register('faster', {
  bonus(type, rarity) {
    return { rotSpeed: (petalStatsFor(type, rarity).rotSpeed || 0) };
  },
  orbitOffset(ctx, out) {
    const b = ctx.petal;
    if (!b.wob) b.wob = { p1: rand(0, TAU), p2: rand(0, TAU) };
    const t = (b.age || 0) * 3.45;     // 频率 ×3.45（再快 1.5 倍：2.3 → 3.45）
    const A = 5.85;                    // 幅度 3.9 × 1.5（原始 2.6 的 2.25 倍）
    out.x = (Math.sin(t * 5.3 + b.wob.p1) * 0.7 + Math.sin(t * 11.7 + b.wob.p2) * 0.3) * A;
    out.y = (Math.cos(t * 4.7 + b.wob.p2) * 0.7 + Math.sin(t * 13.1 + b.wob.p1) * 0.3) * A;
    return true;
  }
});

// —— 内置特效 7：第三只眼（Third Eye）——
// 装备型（accessory）：不进入轨道、没有装填、不参与战斗。
//   · 表现：固定在人物额头，随朝向转动（渲染见 Player.drawAccessories）；
//   · 数值：bonus.reach = 数据表里的 attackRange，reach 模式下把花瓣再向外伸那么远。
// 眼珠几何 —— 全部【由眼眶实测包围盒推导】，不再有魔法坐标。
// 为什么不能用贴图比例：卡面窗口 68.26×79.38、世界窗口 32.86×32.86，同一个"贴图比例"
// 在两条管线里对应的实际眼眶大小完全不同（卡面上眼眶只占 35% 宽，世界里占 73%），
// 按贴图比例画眼珠会让卡面那颗大出一倍多（就是之前的"巨大白眼球"）。
// 眼眶 = 素材内容包围盒（CardRenderer.contentBox，离屏 getBBox 实测），
// 所以"眼珠的移动中心"就是眼眶的正中间，与素材、窗口、管线都无关。
const EYE_PUPIL = {
  r: 0.2226 * 2,      // 眼珠半径 = 眼眶宽 × 0.445（直径 = 2× 基准）—— 【正圆】，横竖同一半径
  ox: 0.274,          // 朝向偏移（× 眼眶宽）
  oy: 0.159,          // 朝向偏移（× 眼眶高）
  clip: 0.98          // 裁剪 = 眼眶椭圆 × 0.98：眼珠永远不溢出眼眶（视觉上"在眼皮下面"）
};
// —— 内置特效 8：触角（Antennae）——
// 装备型（accessory）：不进入轨道、没有装填、不参与战斗（与 Third Eye 同款形态）。
//   · 效果 = 视野扩大：bonus.sight（0.10 = 看得远 10%）。
//     相机缩放系数 = 1 / (1 + sight) —— 世界里能看到的范围变大，屏幕上看起来是"镜头拉远"。
//     缩放由 Game 的相机实现，并且是【平滑过渡】的（装备/卸下都不会瞬变）。
//   · 同种不可堆叠：视野是全局能力，重复装没有意义（只有最左边那格生效）。
PetalFX.register('antennae', {
  bonus(type, rarity) {
    return { sight: (petalStatsFor(type, rarity).sight || 0) };
  },
  drawAccessory(ctx2d, acc, player, R) {
    const svg = acc.card.type.svg;
    const img = CardRenderer.artImage(svg) || CardRenderer.artCanvas(svg, 256);
    if (!img) return true;
    const size = R * ACC_ART_SIZE_K;
    const baseY = player.y - R * ACC_ART_LIFT_K + size * ACC_ART_DROP_K;
    const scaledSize = size * 3;
    drawPetalArt(ctx2d, img, scaledSize, player.x, baseY - size * 2, 0, 1, 1);
    return true;
  }
});

// 这里显式登记，让"饰品"这一形态和其它花瓣能力一样由引擎声明，而不是散落在渲染/逻辑里。
PetalFX.register('third_eye', {
  bonus(type, rarity) {
    return { reach: (petalStatsFor(type, rarity).attackRange || 0) };
  },
  // 素材里那张脸已经画死了一个浅色眼珠；代码再画一个就会看到【两个眼珠】。
  // 这里把素材里那个浅色眼珠改成与眼眶同色（只改这一张素材的填充），
  // 于是渲染管线里只剩下 artOverlay 画的那一个 —— 世界、卡面、幽灵全部同时生效。
  artVariant(svgId, txt) {
    return txt.replace(/fill="#e+e+e+"/gi, 'fill="#111"');
  },
  // 可动部件：白色眼珠。世界里面朝哪就往哪偏（与主角自带的两个眼珠同一套做法）；
  // 卡面传 look = null -> 正中不动（给 0 会被当成"朝右"，看起来像眼珠错位）。
  artOverlay(ctx2d, svgId, look, box) {
    if (!box || !(box.uw > 0) || !(box.uh > 0)) return false;
    // 眼眶 = 素材内容包围盒（实测），它的中心就是眼珠的运动中心
    const cb = CardRenderer.contentBox(svgId);
    if (!cb || !(cb[2] > 0) || !(cb[3] > 0)) return false;
    const sx = box.w / box.uw, sy = box.h / box.uh;    // 素材单位 -> 像素
    const cx = box.x + (cb[0] + cb[2] / 2 - box.ux) * sx;   // 眼眶正中
    const cy = box.y + (cb[1] + cb[3] / 2 - box.uy) * sy;
    const sw = cb[2] * sx, sh = cb[3] * sy;            // 眼眶在屏幕上的宽 / 高
    const hasLook = (look != null);
    const ox = hasLook ? Math.cos(look) * sw * EYE_PUPIL.ox : 0;
    const oy = hasLook ? Math.sin(look) * sh * EYE_PUPIL.oy : 0;
    ctx2d.save();
    // 裁剪到眼眶内：眼珠再怎么偏、再怎么大也不会溢出 → 视觉上就是"在眼皮下面"
    ctx2d.beginPath();
    ctx2d.ellipse(cx, cy, sw * 0.5 * EYE_PUPIL.clip, sh * 0.5 * EYE_PUPIL.clip, 0, 0, TAU);
    ctx2d.clip();
    ctx2d.fillStyle = '#ffffff';
    ctx2d.beginPath();
    // 【正圆】：半径只取眼眶宽度（横竖同一个值，绝不压成椭圆）
    ctx2d.arc(cx + ox, cy + oy, sw * EYE_PUPIL.r, 0, TAU);
    ctx2d.fill();
    ctx2d.restore();
    return true;
  },
  // 高度自定义的绘制：本体固定在【额头】不随朝向绕圈（位置/尺寸见 sim/constants.js 的 ACC_*）；
  // 随朝向移动的是里面那颗眼珠，交给 artOverlay 统一画。
  // 【矢量】：直接用素材的 SVG <img>（浏览器按目标尺寸实时栅格化），
  // 而不是 128px 的离屏位图 —— 后者在这个尺寸/缩放下会发虚。
  drawAccessory(ctx2d, acc, player, R) {
    const svg = acc.card.type.svg;
    const img = CardRenderer.artImage(svg) || CardRenderer.artCanvas(svg, 256);
    if (!img) return true;                // 素材未就绪：本次不画，也不回退默认尺寸
    const size = R * ACC_ART_SIZE_K;
    const cx = player.x;
    const cy = player.y - R * ACC_ART_LIFT_K + size * ACC_ART_DROP_K;
    drawPetalArt(ctx2d, img, size, cx, cy, 0, 1, 1);
    const win = CardRenderer.entityWindow(svg);
    if (win) {
      PetalFX.artOverlay(ctx2d, svg, player.facing,
        { x: cx - size / 2, y: cy - size / 2, w: size, h: size,
          ux: win[0], uy: win[1], uw: win[2], uh: win[3] });
    }
    return true;
  }
});

// —— 内置特效 8：蛛网（Web）——
// 形态：reach 模式下脱离轨道 -> 顺惯性飞出 0.5s -> 【变成一张网】停在原地。
//   · 网是实体（留在 petals 里，随快照同步），但【没有碰撞箱、不结算伤害】；
//   · 网存活 Duration 秒（能力字段 web.duration），期间给半径内的敌对生物挂"蛛网减速"；
//   · 脱轨那一刻卡片就重新装填（holdReloadUntilDeath = false），与 Pollen 同款"放下就走"。
// 结算侧（谁被减速）不在这里：那是服务端的一次半径扫描（见 LocalServer._fieldTick），
// 效果本身注册在 sim/status.js 的 StatusFX 里 —— 渲染/模拟/数值三者互不知情。
const WEB_FLIGHT_T = 0.5;      // 飞行时长：0.5s 后落地成网
PetalFX.register('web', {
  // 脱轨：顺着脱手瞬间的速度直接飞出去（不额外加速，也不阻尼）
  detach(ctx) {
    const b = ctx.petal;
    return { vx: (b.vx || 0), vy: (b.vy || 0), holdReload: false };
  },
  // 飞行参数：0.5s 到期；inertia = 像 Pollen 那样"阻尼滑行 -> 停住"（不是 Peas 的匀速直飞）
  flight(body) {
    if (body && body.isWeb) return null;
    return { life: WEB_FLIGHT_T, inertia: true };
  },
  // 飞行到期 / 飞行途中被打碎 -> 在当前位置张开一张大网。
  // 【注意】它不接管实体本身：调用方紧接着照常走通用移除（渐大渐隐的退场幽灵）。
  expire(ctx) {
    spawnWebField(ctx);
    return true;
  },
  // 被打碎（服务端 _destroyPetal / 客户端 _killPetalBody 都会问一次）：
  // 只有"已经脱轨、还没落地"的 Web 才需要立刻成网；轨道上被打碎就只是碎掉。
  pop(ctx) {
    const b = ctx.petal;
    if (!b || !b.stationary || b.isWeb) return false;
    spawnWebField(ctx);
    return true;
  }
});

// 在花瓣当前位置张开一张网（半径/时长都来自该稀有度的数据）。
function spawnWebField(ctx) {
  const b = ctx.petal;
  const st = petalStatsFor(ctx.type, ctx.rarity);
  if (!b || !ctx.player || !(st.radius > 0)) return;
  // 标记：这张网已经由这个实体生成过了 —— 紧接着的通用移除（onPop）就不会再来一次
  b.isWeb = true;
  if (typeof ctx.player.spawnWeb !== 'function') return;
  ctx.player.spawnWeb(b.x, b.y, st.radius, st.duration || 10, b.card);
}

// —— 内置特效 9：蜡块（Wax）——
// 形态：加载好【立刻】脱轨（autoDetach），在玩家旁边随机落一块蜡；之后固定在原地。
//   · 没有伤害、不吸引生物（数值里 dmg=0，特性里没有 attractMobs）；
//   · 有碰撞箱：实体半径 = 该稀有度的 radius（见 b.cr），会挡住生物；
//   · 卡面跟着实体走，实体死了才重新装填（holdReloadUntilDeath）。
// 「玩家推它很轻、生物推它按同等级重量」由 server 的分离代码按推者阵营取值。
// 96.svg 的正六边形（归一化，外接圆半径 = 1）—— 见 detach 里的源码推导注释。
const WAX_HEX = [
  [0.540, 0.842], [-0.459, 0.889], [-0.999, 0.047],
  [-0.540, -0.842], [0.459, -0.889], [0.999, -0.047]
];

PetalFX.register('wax', {
  detach(ctx) {
    const b = ctx.petal, p = ctx.player;
    const st = petalStatsFor(ctx.type, ctx.rarity);
    const R = st.radius || 0;
    // 落点：贴着玩家外缘一圈，随机挑一个"不卡墙"的角度（最多试 16 次）。
    const map = p && p._mapRef;
    const dist = (p ? p.r : 16) + R * 0.86;
    const base = (p ? p.facing : 0) + Math.PI;      // 默认落在身后，避免糊脸
    let placed = false;
    // 【生成空间校验】：蜡块是 R 大小的实体，落点周围 R 内都不能有墙。
    // 先按正确角度找；找到后还要过一遍"沿半径采样"的校验（只查中心点会一半陷进墙里）。
    const fits = (cx, cy) => {
      if (!map || !map.solidAtPoint) return true;
      if (map.solidAtPoint(cx, cy)) return false;
      const rr = R * 0.92;
      for (let k = 0; k < 8; k++) {
        const th = (k / 8) * TAU;
        if (map.solidAtPoint(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr)) return false;
      }
      return true;
    };
    for (let i = 0; i < 16; i++) {
      const a = base + (b.slotIndex || 0) * 1.7 + rand(-1.1, 1.1);
      const x = p.x + Math.cos(a) * dist;
      const y = p.y + Math.sin(a) * dist;
      if (!fits(x, y)) continue;
      b.x = x; b.y = y; placed = true;
      break;
    }
    // 一圈都放不下（会被墙卡住且小幅偏移也躲不开）-> 【放弃这次生成，立刻重新装填】。
    // 引擎看到 cancelSpawn 会销毁这个实体并把该槽的装填清零，而不是硬塞一块蜡在墙里。
    if (!placed) {
      b.cancelSpawn = true;
      return { vx: 0, vy: 0, holdReload: false };
    }
    // 碰撞外形 = 【素材里的正六边形】，从 96.svg 源码抄出来的顶点：
    //   g translate(0 7.143)，path d="m66.578 65.889-21.405 1.01-11.578-18.03
    //                                      9.827-19.043 21.405-1.011 11.578 18.031z"
    //   六个绝对顶点（减去 translate）相对包围盒中心 (55,55)，除以外接圆半径 21.43 归一化。
    // 这样碰撞箱严格贴合形状，而不是笼统一个圆。
    b.shapePoly = WAX_HEX;
    b.cr = R;                 // 外接圆半径 = 数据表的 Radius
    b.artSize = R * 2;        // 绘制直径 = 2 × Radius
    b.anchor = true;          // 固定落地：不绕圈、不采信服务端位置插值
    b.selfRot = 0;            // 蜡块不转
    // ---- 【统一实体接口】：与生物完全同构的碰撞字段 ----
    // 生物的碰撞表示是  shape = { pts: 归一化多边形, r: 外接圆半径 }, collSize = 实际尺寸。
    // Wax 用同一套表示（WAX_HEX 本来就是归一化顶点）之后：
    //   mobHitTest(wax, x, y, r) / physicsPushMob(ent, wax) / physicsPush(a, wax)
    // 全部【原样可用】—— 玩家碰蜡块和玩家碰生物走的是同一个函数，零特判。
    // 蜡块不旋转：facing/artRot 恒 0，_mobRot 的旋转矩阵就是单位阵。
    // 从 assets/crbs/petals/96.crb 读【同一份硬编码轮廓】；
    // 物理判定、F3 调试箱、渲染尺寸都以此为准，不会再"大一圈"。
    const crb = (typeof CRB !== 'undefined' && CRB.getPetal)
      ? CRB.getPetal(String(ctx.type.svg)) : null;
    b.shape = crb || { pts: WAX_HEX, r: 1 };
    b.shapePoly = crb ? crb.pts : WAX_HEX;
    b.collSize = R;
    b.r = R;                  // 等面积圆半径（粗判/网格用）
    b.facing = 0; b.artRot = 0;
    b.weight = (typeof rarityWeight === 'function') ? rarityWeight(ctx.rarity) : 1;
    // 重量：与生物完全同一规则（按稀有度）—— 所有实体一视同仁，
    // 玩家/生物推它的差异只来自各自的 weight（统一物理的反质量分配），没有任何特判。
    return { vx: 0, vy: 0, holdReload: true };
  }
});

// 蛛网【自己画的】素材（放射线 + 内凹环），不用 Web 花瓣本身的贴图。
// 懒加载一次，未就绪时返回 null（调用方不画）。
const WEB_NET_KEY = 'web_net';
const WEB_NET_SRC = 'assets/petals/web_net.svg?v=2';   // 改素材内容时改这里（与 ?v= 同一套规则）
PetalFX.netImage = function () {
  if (typeof SpriteStore === 'undefined') return null;
  const img = SpriteStore.get(WEB_NET_KEY);
  if (img) return img;
  if (!this._netLoading) { this._netLoading = true; SpriteStore.load(WEB_NET_KEY, WEB_NET_SRC); }
  return null;
};
