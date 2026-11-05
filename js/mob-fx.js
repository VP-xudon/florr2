// ============================================================================
// 生物通用特性引擎（MobFX）
//
// 与 PetalFX（花瓣能力引擎）完全对称：
//   PetalFX 决定"花瓣能做什么"，MobFX 决定"生物能做什么"。
//
// 【为什么必须有它】
// 新增一种生物特性（目前是大招）天然横跨 4 个层：
//   引擎调度 js/ai.js  /  实体状态 js/sim/mob.js  /
//   场地产出 js/net/server.js  /  客户端表现 js/game.js
// 之前每一层都写死了蜘蛛的参数（圈数 / 步态速率 / 网半径倍数），于是：
//   · 加第二个物种的大招要同时改 4 个文件；
//   · 漏掉一层就是"服务端招放出来了、客户端毫无反应"这类半截 bug。
// 现在：物种只在 MobFX.register('slug', {...}) 里【声明】一次，四层全部改成"向 MobFX 问"。
//       新增物种的大招 = 加一条 register，不动任何一层。
//
// 【声明格式】
//   MobFX.register('spider', {
//     ultimate: {
//       minRarity: 'super',            // 稀有度门槛（Super 及以上才有大招）
//       cooldownTicks: [1000, 1500],   // 冷却区间（1 秒 = 25 tick → 40~60 秒）
//       duration: 4.5,                 // 大招时长（秒）
//       hold: true,                    // 大招期间定在原地（且不参与推挤）
//       spin: { rate: 4.18879 },       // 自转角速度（rad/s，3 秒 2 圈 = TAU×2/3）
//       gaitRate: 8,                   // 大招期间补步态（它不走位，腿要摆动就得补）
//       field: { kind: 'web', mul: 2 }  // 结束产出：一张 2 倍半径的蛛网
//     }
//   });
//
// 引擎【不认识】具体物种，也不认识具体场地实体：
//   · 场地实体种类也走注册（MobFX.registerField('web', {...})），
//     服务器只提供"怎么造"的原语（ctx），知识留在引擎里。
//   · 想加新物种 / 新场地种类，都只是加一条 register。
// ============================================================================

const MobFX = {
  defs: {},        // slug -> 物种特性声明
  fields: {},      // kind -> 场地实体种类（怎么造）
  _projectileSeq: 1,

  async prepareAssets() {
    if (this._assetsReady) return true;
    const response = await fetch('assets/mobs/11.svg?v=' + ASSET_VER);
    if (!response.ok) throw new Error('Hornet SVG load failed: ' + response.status);
    const source = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'image/svg+xml');
    const root = doc.documentElement;
    const group = root.querySelector('g');
    const paths = group ? Array.from(group.children).filter((node) => node.localName === 'path') : [];
    if (!group || paths.length < 2) throw new Error('Hornet tail paths not found');
    const emptyRoot = root.cloneNode(true);
    const emptyGroup = emptyRoot.querySelector('g');
    Array.from(emptyGroup.children).filter((node) => node.localName === 'path').slice(0, 2)
      .forEach((node) => node.remove());
    const serialize = (node) => 'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(node));
    await SpriteStore.load('mob11_empty', serialize(emptyRoot));
    this._assetsReady = true;
    return true;
  },

  // ---------------- 注册 ----------------
  register(slug, def) {
    this.defs[slug] = def || {};
    return this.defs[slug];
  },

  createMissile(mob) {
    const stats = (mob.type.rarityStats && mob.type.rarityStats[mob.rarity]) || {};
    return {
      id: mob.netId + ':missile:' + (this._projectileSeq++),
      parentId: mob.netId, x: mob.x, y: mob.y, facing: mob.facing + Math.PI,
      vx: 0, vy: 0, hp: stats.missileHp || 1, maxHp: stats.missileHp || 1,
      dmg: stats.missileDmg || 0, armor: mob.armor, life: stats.missileDur || 2,
      age: 0, hurtT: 0, flight: false, dead: false, exiting: false,
      radius: mob.drawSize * 0.12
    };
  },

  initMob(mob) {
    const def = this.defOf(mob);
    if (def && def.init) def.init(mob);
  },

  hitMissile(mob, damage) {
    const st = mob && mob.hornet;
    const missile = st && st.missile;
    if (!missile || missile.dead || missile.exiting || !(damage > 0)) return 0;
    const applied = Math.min(damage, missile.hp);
    missile.hp -= applied;
    missile.hurtT = 0.3;
    if (missile.hp <= 0) {
      missile.hp = 0;
      missile.dead = true;
      missile.exiting = true;
      ExitFX.begin(missile);
      st.reloadT = 0;
      mob.ai.hornetMode = 'reload';
    }
    return applied;
  },
  registerField(kind, def) {
    this.fields[kind] = def || {};
    return this.fields[kind];
  },
  defOf(mob) {
    const slug = mob && mob.type && mob.type.slug;
    return (slug && this.defs[slug]) || null;
  },
  artSvgOf(mob) {
    const def = this.defOf(mob);
    if (!def) return null;
    if (def.artSvgOf) return def.artSvgOf(mob) || null;
    return def.artSvg || null;
  },
  facingLocked(mob) {
    const def = this.defOf(mob);
    return !!(def && def.facingLocked && def.facingLocked(mob));
  },

  stepMob(mob, dt, player) {
    const def = this.defOf(mob);
    return def && def.step ? def.step(mob, dt, player) : null;
  },

  tickMob(mob, dt, player) {
    const def = this.defOf(mob);
    if (def && def.tick) def.tick(mob, dt, player);
  },

  drawMob(ctx, mob) {
    const def = this.defOf(mob);
    if (def && def.draw) def.draw(ctx, mob, mob._drawScale || 1, mob._drawAlpha == null ? 1 : mob._drawAlpha);
  },

  drawMissile(ctx, missile, size, alpha) {
    if (!missile || (missile.dead && !missile.exiting)) return;
    let scale = spawnPop(missile.age || 0);
    let a = alpha * spawnFade(missile.age || 0);
    if (missile.exiting) {
      scale *= ExitFX.scale(missile);
      a = ExitFX.alpha(missile);
    }
    const art = CardRenderer.artCanvas('9', 128);
    if (art) drawPetalArt(ctx, art, size * scale, missile.x, missile.y,
      (missile.facing || 0) - MISSILE_TIP_ANGLE, 1, a);
  },

  // ---------------- 大招：稀有度门槛 ----------------
  // 口径：只有 Super 及以上（Super / Eternal）稀有度才可能有大招。
  ultimateOf(mob) {
    const d = this.defOf(mob);
    const u = d && d.ultimate;
    if (!u) return null;
    const order = (typeof RARITY_ORDER !== 'undefined') ? RARITY_ORDER : null;
    if (!order) return null;
    const min = u.minRarity || 'super';
    const ri = order.indexOf(mob.rarity);
    const mi = order.indexOf(min);
    if (ri < 0 || mi < 0 || ri < mi) return null;
    return u;
  },

  // 冷却：按区间随机（单位 tick，1 秒 = 25 tick）
  _ultDelay(u) {
    const cd = (u && u.cooldownTicks) || MOB_ULT_COOLDOWN_TICKS;
    return rand(cd[0], cd[1]) * MOB_TICK_S;
  },

  // ---------------- 大招状态机（调度 + 通用表现）----------------
  // 返回 null = 本帧不接管（普通 AI 继续跑）；返回向量 = 大招接管中。
  stepUltimate(mob, dt) {
    const u = this.ultimateOf(mob);
    if (!u) return null;
    const ai = mob.ai;
    if (ai.ultActive) {
      ai.ultT += dt;
      let out = { x: 0, y: 0 };
      if (u.during) {
        out = u.during(ai, dt, mob) || out;        // 物种自定义行为（优先于通用表现）
      } else {
        // 通用表现 1：自转。朝向由大招驱动，此时不能被"朝向跟随移动方向"覆盖。
        if (u.spin) {
          const rate = u.spin.rate;
          mob.facing = wrapAngle(mob.facing + rate * dt);
          ai.ultSpin = (ai.ultSpin || 0) + rate * dt;
        }
        // 通用表现 2：补步态。它不走位，步态不会自然推进，腿要摆动只能按固定速率补。
        if (u.gaitRate) mob.gait += u.gaitRate * dt;
      }
      if (ai.ultT >= (ai.ultDur || 0)) {
        ai.ultActive = false;
        this._endUltimate(mob, u);
        ai.ultCd = this._ultDelay(u);               // 重新武装下一次大招
      }
      return out;
    }
    // 冷却中：首次延迟也按同样的区间随机（各生物不同步，不会齐刷刷一起放）
    ai.ultCd = (ai.ultCd == null) ? this._ultDelay(u) : ai.ultCd - dt;
    if (ai.ultCd > 0) return null;
    // 到点：起手
    ai.ultActive = true;
    ai.ultT = 0;
    ai.ultDur = (typeof u.duration === 'function') ? u.duration(ai, mob) : (u.duration || 1);
    this._startUltimate(mob, u);
    return { x: 0, y: 0 };
  },

  _startUltimate(mob, u) {
    mob.ultActive = true;
    if (u.hold) mob.ultHold = { x: mob.x, y: mob.y };   // 定在原地（引擎每帧把它按回锚点）
    mob.ai.ultSpin = 0;
    if (u.start) u.start(mob.ai, mob);
  },

  _endUltimate(mob, u) {
    mob.ultActive = false;
    if (u.hold) mob.ultHold = null;
    if (u.field) {
      // 产出【请求】交给服务端权威生成（客户端只做画面镜像）——
      // 谁被减速必须由服务端说了算，客户端不能自己造一张有减速效果的网。
      mob.ultFieldReq = { kind: u.field.kind, mul: u.field.mul, dur: u.field.dur };
    }
    if (u.end) u.end(mob.ai, mob);
  },

  // ---------------- 各层向引擎查询（不写死物种）----------------
  // 大招期间的定住锚点（没有大招 = null）
  holdOf(mob) { return (mob && mob.ultHold) || null; },
  // 大招期间要补的步态速率（腿继续摆动）
  gaitRateOf(mob) {
    const u = this.ultimateOf(mob);
    return (u && u.gaitRate) || 0;
  },

  // ---------------- 场地实体产出（服务端权威）----------------
  // ctx = { webType(), addWeb(ent), webDur() } —— 服务器提供的原语
  produceField(mob, req, ctx) {
    if (!req) return null;
    const f = this.fields[req.kind];
    if (!f || !f.create) return null;
    const ent = f.create(mob, req, ctx);
    if (!ent) return null;
    if (ctx && ctx.addWeb) ctx.addWeb(ent);
    return ent;
  },

  // ---------------- 客户端镜像（表现，不是逻辑）----------------
  // 大招进行中：腿继续摆（服务端权威的 ultActive，客户端只补表现）
  clientTick(view, dt) {
    if (!view || !view.ultActive) return;
    const rate = this.gaitRateOf(view);
    if (rate) view.gait += rate * dt;
  },
  // 大招结束：客户端补一张"看起来一样的"场地实体（服务端已权威生成，这里只是画面镜像）
  clientEnd(view, ctx) {
    if (!view) return null;
    const u = this.ultimateOf(view);
    if (!u || !u.field) return null;
    const f = this.fields[u.field.kind];
    if (!f || !f.create) return null;
    const ent = f.create(view, u.field, ctx);
    if (ent && ctx && ctx.addWeb) ctx.addWeb(ent);
    return ent;
  },
};

// ============================================================================
// 场地实体种类：蛛网（蜘蛛自铺的网 / 蜘蛛大招产出的超大网）
// 半径口径 = 【该稀有度对应的 Web 花瓣半径】× 倍率（倍率 1 = 普通网）
// ============================================================================
MobFX.registerField('web', {
  radius(mob, req, ctx) {
    const wt = ctx && ctx.webType ? ctx.webType() : null;
    const base = wt ? (petalStatsFor(wt, mob.rarity).radius || 120) : 120;
    return Math.round(base * (req.mul || 1));
  },
  create(mob, req, ctx) {
    return {
      x: mob.x, y: mob.y,
      r: this.radius(mob, req, ctx),
      t: 0,
      dur: (req.dur != null) ? req.dur : (ctx && ctx.webDur ? ctx.webDur() : 10),
      pop: 0,
    };
  },
});

// ============================================================================
// 物种声明：蜘蛛（Super / Eternal 大招）
//   · 定在原地不动，原地自转：3 秒 2 圈；
//   · 自转期间八条腿一起摆动（它不走位，步态不会自然推进，按固定速率补）；
//   · 自转满 3 圈（约 4.5 秒）后在原地生成一张【半径 = 同等级蛛网 × 2】的超大蛛网；
//   · 放完立刻恢复正常 AI（引擎在 end 之后重新武装下一次冷却）。
// ============================================================================
MobFX.register('spider', {
  ultimate: {
    minRarity: 'super',
    cooldownTicks: [1000, 1500],                        // 1000~1500 tick = 40~60 秒（1 秒 = 25 tick）
    // 3 圈 ÷ (2 圈 / 3 秒) = 4.5 秒
    duration: SPIDER_ULT_TURNS / SPIDER_ULT_TURNS_PER_SEC,
    hold: true,                                        // 定在原地（且不参与推挤）
    spin: { rate: TAU * SPIDER_ULT_TURNS_PER_SEC },     // 3 秒 2 圈
    gaitRate: MOB_ULT_GAIT_RATE,                       // 腿继续摆动
    field: { kind: 'web', mul: SPIDER_ULT_WEB_MUL },   // 2 倍半径的超大蛛网
  },
});

MobFX.register('hornet', {
  artSvgOf(mob) {
    const missile = mob.hornet && mob.hornet.missile;
    return missile && !missile.dead && !missile.exiting ? '11' : '11_empty';
  },
  facingLocked(mob) {
    const phase = mob.hornet && mob.hornet.spinPhase;
    return phase === 'aim' || phase === 'return';
  },
  draw(ctx, mob, scale, alpha) {
    const attached = (mob.hornet && mob.hornet.missile) || mob.hornetMissile;
    if (attached && (attached.flight || attached.exiting)) {
      MobFX.drawMissile(ctx, attached, attached.drawSize || mob.drawSize * 0.4, alpha == null ? 1 : alpha);
    }
  },
  init(mob) {
    mob.hornet = { mode: 'approach', missile: MobFX.createMissile(mob), projectiles: [], spinT: 0, launchAngle: 0, reloadT: 0 };
  },
  tick(mob, dt) {
    const st = mob.hornet || (mob.hornet = { mode: 'wander', missile: null, projectiles: [], spinT: 0, launchAngle: 0, reloadT: 0 });
    if (st.missile) {
      const missile = st.missile;
      if (missile.exiting) {
        ExitFX.tick(missile, dt);
        if (ExitFX.done(missile)) st.missile = null;
      }
      missile.age += dt;
      missile.hurtT = Math.max(0, missile.hurtT - dt);
      if (!missile.flight && !missile.exiting) {
        const tailA = mob.facing + Math.PI;
        const offset = mob.drawSize * 0.39;
        missile.x = mob.x + Math.cos(tailA) * offset;
        missile.y = mob.y + Math.sin(tailA) * offset;
        missile.facing = tailA;
      }
    } else if (mob.ai.hornetMode === 'reload') {
      st.reloadT += dt;
      if (st.reloadT >= 0.5) {
        st.missile = MobFX.createMissile(mob);
        mob.ai.hornetMode = 'approach';
        st.reloadT = 0;
      }
    }
  },
  step(mob, dt, player) {
    const st = mob.hornet || (mob.hornet = { mode: 'wander', missile: null, projectiles: [], spinT: 0, launchAngle: 0, reloadT: 0 });
    const spinRate = TAU * 3;
    if (st.spinPhase === 'return') {
      const back = MobAI._util.angNorm(st.baseFacing - mob.facing);
      const step = Math.sign(back) * Math.min(Math.abs(back), spinRate * dt);
      mob.facing = wrapAngle(mob.facing + step);
      if (Math.abs(back) <= spinRate * dt) st.spinPhase = null;
      return { x: 0, y: 0 };
    }
    if (st.spinPhase === 'aim') {
      const turn = MobAI._util.angNorm(st.aimFacing - mob.facing);
      const step = Math.sign(turn) * Math.min(Math.abs(turn), spinRate * dt);
      mob.facing = wrapAngle(mob.facing + step);
      if (Math.abs(turn) <= spinRate * dt) {
        const missile = st.missile;
        if (missile && !missile.dead && !missile.exiting) {
          const speed = 1.3 * PLAYER_BASE_SPEED;
          missile.flight = true;
          missile.facing = st.launchAngle;
          missile.vx = Math.cos(st.launchAngle) * speed;
          missile.vy = Math.sin(st.launchAngle) * speed;
          missile.life = (mob.type.rarityStats[mob.rarity] || {}).missileDur || 2;
          (st.projectiles || (st.projectiles = [])).push(missile);
          st.missile = null;
          mob.ai.hornetMode = 'reload';
          st.reloadT = 0;
        } else {
          st.spinPhase = 'return';
          return { x: 0, y: 0 };
        }
        st.spinPhase = 'return';
      }
      return { x: 0, y: 0 };
    }
    if (st.missile && st.missile.exiting) return { x: 0, y: 0 };
    const tgt = mob.topThreat();
    if (!tgt || !mob.canSee(tgt)) {
      mob.ai.hornetMode = 'wander';
      return MobAI.defs.bee.step(mob.ai, dt, mob, player);
    }
    if (!st.missile || st.missile.exiting || st.missile.dead) {
      mob.ai.hornetMode = 'reload';
      const dx = tgt.x - mob.x, dy = tgt.y - mob.y;
      const distance = Math.hypot(dx, dy) || 1;
      const desiredRange = Math.max(220, mob.drawSize * 1.8);
      if (distance > desiredRange + 12) {
        return { x: dx / distance * mob.chaseSpeed, y: dy / distance * mob.chaseSpeed };
      }
      if (distance < desiredRange - 12) {
        return { x: -dx / distance * mob.chaseSpeed, y: -dy / distance * mob.chaseSpeed };
      }
      return { x: 0, y: 0 };
    }
    const dx = tgt.x - mob.x, dy = tgt.y - mob.y;
    const d = Math.hypot(dx, dy) || 1;
    const desiredRange = Math.max(220, mob.drawSize * 1.8);
    if (d > desiredRange + 12) {
      mob.ai.hornetMode = 'approach';
      return { x: dx / d * mob.chaseSpeed, y: dy / d * mob.chaseSpeed };
    }
    if (d < desiredRange - 12) {
      mob.ai.hornetMode = 'approach';
      return { x: -dx / d * mob.chaseSpeed, y: -dy / d * mob.chaseSpeed };
    }
    if (Math.hypot(mob.vx || 0, mob.vy || 0) > 8) {
      mob.ai.hornetMode = 'stop';
      return { x: 0, y: 0 };
    }
    if (!st.spinPhase) {
      const ri = RARITY_ORDER.indexOf(mob.rarity);
      const lead = ri >= RARITY_ORDER.indexOf('epic') ? clamp(d / Math.max(1, PLAYER_BASE_SPEED * 1.3), 0, 0.7) : 0;
      const px = tgt.x + (tgt.vx || 0) * lead;
      const py = tgt.y + (tgt.vy || 0) * lead;
      st.launchAngle = Math.atan2(py - mob.y, px - mob.x);
      st.baseFacing = mob.facing;
      st.aimFacing = wrapAngle(st.launchAngle - Math.PI);
      st.spinPhase = 'aim';
      mob.ai.hornetMode = 'aim';
    }
    return { x: 0, y: 0 };
  },
});
