// sim/mob.js — 生物实体：AI 驱动、血量、表现计时
'use strict';

class Mob {
  constructor(type, x, y, level, rarity) {
    this.type = type; this.name = type.name; this.svg = type.svg; this.zh = type.zh || '';
    this.level = level || 1;
    this.rarity = rarity || 'common';
    this.aiConf = type.ai || null;      // 官方 AI 配置（aggro/chase/flee/retaliate…）
    this.ai = MobAI.create(this);       // 运行时 AI 状态（只产出"移动欲望"）
    // 名牌显示模式（多节生物用）：
    //   'classic' = 经典名牌：名称 + 血条 + 稀有度，常显（普通生物与蜈蚣【头节】）
    //   'player'  = 主角血条模式：只有血条，满血不显示、掉血渐显，不显示名称与稀有度
    // 模式在【生成时】定死：非头节即使后来因被打断而升为一段的头，也仍然是 'player'。
    this.plateStyle = 'classic';
    this.hpBarA = 0;                    // 'player' 模式的血条淡入淡出透明度
    // 各稀有度数值：有表就整表取用（hp/dmg），否则退回基础值
    const rs = type.rarityStats && type.rarityStats[this.rarity];
    const baseHp = rs ? (rs.hp || 0) : type.hp;
    const baseDmg = rs ? (rs.dmg || 0) : type.dmg;
    // 视觉直径 = 稀有度倍率 × 等级缩放 × 该物种的等比体型倍数（数据表 MOB_TRAITS.sizeScale）
    const sizeScale = type.sizeScale || 1;
    const diam = Math.round(PLAYER_VISUAL_D * (MOB_DIAM[this.rarity] || MOB_DIAM_BASE)
      * mobScale(this.level) * sizeScale);
    this.visualD = diam;
    this.drawSize = diam;               // 视觉裁剪框（含体型倍数，决定画多大）
    // 碰撞尺寸 = 绘制尺寸。
    // 旧写法是 diam / sizeScale（蜈蚣 1/1.4 =71%、蜜蜂 1/1.2555 =80%），
    // 于是"看到的身体"比"实际判定"大一圈：玩家明明贴上了蜈蚣身体却不结算体伤，
    // 明显打到了却打空。所有生物一视同仁 —— 画多大就判多大，没有按物种的口径。
    this.collSize = diam;
    this.r = this.collSize / 2;
    this.shape = null;                  // 碰撞外形：SVG 轮廓多边形 { pts, r }（玩家/接触判定用）
    this.hull = null;                   // 同一轮廓的凸包（墙体碰撞用，凹处不会卡）
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.maxHp = baseHp; this.hp = baseHp;
    this.dmg = baseDmg;
    // 障碍型生物（registry type=障碍型生物 或 speed=0）：几乎不可移动
    this.obstacle = (type.type === 'Obstacle') || !(type.speed > 0);
    // 速度统一（瓢虫为原型，全体非障碍生物通用）：
    //   仇恨追击 = 玩家默认最高速度 0.90 倍；随机游荡 = 基准 0.95 × (0.3~0.5)
    //   个别物种的差异走数据表（chaseMult / wanderFactor），这里不再判断 slug：
    //   蜜蜂追击 1.05 倍（走 S 型所以实际推进更慢）、游荡 = 瓢虫游荡 ×1.2
    const ladybugWander = MOB_WANDER_MULT * PLAYER_BASE_SPEED * rand(MOB_WANDER_RANGE[0], MOB_WANDER_RANGE[1]);
    const chaseMult = (type.chaseMult != null) ? type.chaseMult : MOB_CHASE_MULT;
    this.chaseSpeed = chaseMult * PLAYER_BASE_SPEED;
    this.wanderSpeed = this.obstacle ? 0
      : (ladybugWander * (type.wanderFactor || 1)) * MOB_WANDER_SCALE;
    this.speed = this.wanderSpeed;
    // 蜈蚣（多节生物）：整条一起动，视觉位移是"整段"而不是单只，
    // 所以要比普通生物明显更慢（0.15×），否则看着就是飞出去。
    // 判定只看数据表字段（segmented），不再同时比对 slug 与 svg id。
    this._isCentipede = !!type.segmented;
    if (this._isCentipede) {
      // 速度口径：
      //   · 游荡 = 原 0.5×瓢虫游荡 再 ×1.3  = 0.65×瓢虫游荡
      //   · 追击 = 与瓢虫【完全一致】的通用追击倍率（0.90×玩家默认最高移速）
      //     —— 之前把它压到和游荡同一量级，所以追人极慢。
      const base = this.wanderSpeed || (MOB_WANDER_MULT * PLAYER_BASE_SPEED);
      this.wanderSpeed = base * 0.65;
      this.chaseSpeed = MOB_CHASE_MULT * PLAYER_BASE_SPEED;
      // speed 只用于"朝向跟随"的阈值（sp > speed*0.12），保持游荡量级即可
      this.speed = this.wanderSpeed;
      // 硬上限必须取【两者较大值】：若仍按游荡速度给，
      // update 里的限速会直接把追击重新压回慢速，改了也看不出来。
      this._centSpeedCap = this.chaseSpeed;
      // 游荡节奏（喂给 MobAI，属于"这个生物的 AI 参数"，不是渲染特判）：
      //   · 一趟走很远：直线段够长，身体才不会一直处在转弯状态；
      //   · 转向限幅 ±30°：不会突然掉头（掉头会让整条链瞬间折返、看着像抽搐）；
      //   · 停顿时间不动 = 与瓢虫同一套（AI 里 rand(2,6)*0.4）。
      this.wanderRange = [420, 900];
      // 头部行走规则（用户口径）：
      //   · 每一趟是【干脆的直线】—— 不做任何 S 型摆动；
      //   · 换趟时方向变化上限 ±30°（任意时刻的偏转角都不超过 30°）；
      //   · 转弯不是折角，而是以 turnRate 恒速转向 => 定半径的圆弧
      //     （半径 ≈ 速度 / turnRate ≈ 40 / 0.45 ≈ 90px）；
      //   · 唯一例外：刚获得仇恨、且目标在身后 -> 立刻锐角掉头（见 ai.js）。
      this.maxTurn = Math.PI / 6;
      this.turnRate = 0.45;
    }
    // S 型路线（蜜蜂）：朝向按正弦持续左右偏摆，走出一条蛇形曲线。
    // 稀有度越高越沉稳：摆幅按比例收窄、单个 S 拉长（频率 = 基准频率 / 长度倍数）。
    // Common(1.0×摆幅 / 1.0×长度) -> Eternal(0.2×摆幅 / 2.0×长度)，中间按稀有度线性插值。
    this.sPath = !!type.sPath;
    const _ri = (typeof RARITY_ORDER !== 'undefined') ? RARITY_ORDER.indexOf(this.rarity) : 0;
    const _t01 = _ri < 0 ? 1 : clamp(_ri / Math.max(1, RARITY_ORDER.length - 1), 0, 1);  // 0=common, 1=eternal
    this.sAmp = BEE_S_AMP * (1 + (BEE_S_AMP_MIN_K - 1) * _t01);
    this.sHz = BEE_S_HZ / (1 + (BEE_S_LEN_MAX_K - 1) * _t01);
    // 重量：按横截面积(直径²)；障碍型 ×5（几乎推不动）
    this.weight = rarityWeight(this.rarity) * (this.obstacle ? 5 : 1);
    this.color = type.color; this.boss = !!type.boss;
    this.facing = rand(0, TAU);         // 朝向（无呼吸/浮动动画，用户要求生物保持静止姿态）
    const svgKey = String(this.svg);    // type.svg 是数字 id，查表统一转字符串
    // 多节生物（蜈蚣）的每一节【必须】用本节自己的贴图 key：
    //   头节 = 12_h、身体节 = 12_b（由 _spawnChain 赋值）。
    // 但 /summon 等路径可能不经过链生成 -> artSvg 为空 -> 会回落到 'mob12'，
    // 那是【整条蜈蚣】的图和轮廓，套在一节上就是"鬼样子 + 不规则碰撞箱"。
    // 所以这里给一个贴图级默认（身体节），绝不回落到 mob12。
    if (!this.artSvg && type.segmented) this.artSvg = '12_b';
    // 贴图朝向补偿：优先按【实际用的贴图】查（蜈蚣头 12_h / 身 12_b 可分别调整），
    // 取不到再按物种 id（12）查。
    this.artRot = MOB_ART_ROT[String(this.artSvg || this.svg)] || MOB_ART_ROT[svgKey] || 0;
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
    this.noteThreat(src, applied);
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.deathTimer = 0;
      return { applied, killed: true };
    }
    return { applied, killed: false };
  }

  // 追加仇恨值（纯记录，不做传播）
  _addThreat(src, amount) {
    const e = this.threat.find((t) => t.ent === src);
    if (e) e.dmg += amount; else this.threat.push({ ent: src, dmg: amount });
  }

  // 记仇恨的唯一入口（由 hurt() 调用，amount = 本击【实际造成】的伤害）。
  //
  // 只有真受伤才记仇：被护甲全额吸收（applied = 0）的情况【不记】，
  // 那是刻意保留的规则 —— 打不动就不要有仇恨。
  //
  // 多节生物是一个【个体】：任一节受伤，段首也要记同一笔，
  // 否则打身体后半段时整条毫无反应（段首没有威胁值就不追击）。
  noteThreat(src, amount) {
    if (!src || this.hostility === 'passive') return;
    this._addThreat(src, amount);
    if (this.segIdx != null) {
      let h = this;
      while (h._lead && !h._lead.dead) h = h._lead;
      if (h !== this) h._addThreat(src, amount);
    }
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

  // 建立碰撞外形。服务端在 update 里建；【客户端视图也必须建】——
  // 视图 Mob 不跑 update（只做插值/动画计时），不在 draw 里建的话 shape 永远是空的，
  // 调试碰撞箱(/pending crash)就会显示空或残留的旧外形。
  _ensureShape() {
    if (this.shape) return;
    let ct = SpriteStore.contour('mob' + (this.artSvg || this.svg), this.drawSize);
    // 本节贴图缺失时退回物种贴图（多节生物 = 整条外形，虽然不准，但总比没有碰撞/不可见好）
    if (!ct && this.artSvg && this.artSvg !== this.svg) {
      ct = SpriteStore.contour('mob' + this.svg, this.drawSize);
    }
    if (!ct) return;                       // 素材未就绪：不缓存失败，下一帧再试
    this.shape = ct;
    const uniq = [];
    for (const p of ct.pts) {
      if (!uniq.some((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6)) uniq.push(p);
    }
    this.hull = uniq.length >= 3 ? convexHull(uniq) : null;
    // 【关键】圆形半径 = 同一份轮廓的【等面积圆半径】。
    // physicsPush 用圆（r 相加），伤害判定用多边形（缩放 collSize），
    // 两者必须同源同尺寸，否则就是"走路一套、打人一套"。
    //   · 旧 r = collSize/2 = 绘制框一半 -> 蜈蚣(0.345)被 0.5 挡住，靠不过去
    //   · 直接用外接半径(ct.r) 又会被翅膀/尖角撑大（蜜蜂 0.412 vs 身体 0.350）
    // 等面积圆：圆形主体时【精确等于】真实半径，带尖角的形状取等效值，不虚胖。
    let area2 = 0;
    for (let i = 0, n2 = ct.pts.length; i < n2; i++) {
      const a = ct.pts[i], b = ct.pts[(i + 1) % n2];
      area2 += a[0] * b[1] - b[0] * a[1];
    }
    const seqR = Math.sqrt(Math.abs(area2) * 0.5 / Math.PI);
    this.r = (seqR > 0 ? seqR : ct.r) * this.drawSize;
  }

  // 血条淡入淡出（【主角血条模式】专用，见 Mob.draw 的 'player' 分支）：
  // 非满血 -> 0.3s 渐显；回到满血 -> 0.3s 渐隐，与主角血条同一手感与时长。
  // 视图生物不走 Mob.update，因此由 game.js _tickMobViews 调用推进
  //（不推进的话 hpBarA 恒为 0，血条永远不出现）。
  _tickHpBarA(dt) {
    const target = this.hp < this.maxHp ? 1 : 0;
    const step = dt / 0.3;
    this.hpBarA = target > this.hpBarA
      ? Math.min(target, this.hpBarA + step)
      : Math.max(target, this.hpBarA - step);
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
    // 碰撞外形：统一走 _ensureShape（客户端 draw 也调它）——
    // 之前这里内联复制了一份一模一样的逻辑，改一处漏一处，正是"两套碰撞"的来源之一。
    if (!this.shape) this._ensureShape();

    // 多节生物里被【刚性粘合】的节：位置与朝向全由 net.js _solveChains 解算，
    // 这里绝不跑 AI / 位移（两套逻辑同时改坐标 = 原地打转、左右抽搐、连不成一条）。
    if (this._chainLocked) return;
    // —— 1) 问 AI：现在想怎么动。AI 只给"移动欲望"，不直接改坐标 ——
    // 这里只服务【段首】（头节）：非头节在上面的 _chainLocked 分支就已返回，
    // 位置全部由 _solveChains 沿头的真实路径解算（不是"跟随前一节"）。
    const want = MobAI.step(this.ai, dt, this, player);
    // 蜈蚣移速【硬上限】：不管 AI 走的是 chaseSpeed / wanderSpeed / 别的分支，
    // 都把"移动欲望"的模长钳死在这里，保证整条一定比普通生物慢。
    if (this._isCentipede) {
      const lim = this._centSpeedCap || (MOB_WANDER_MULT * PLAYER_BASE_SPEED * 0.5);
      const wd = Math.hypot(want.x, want.y);
      if (wd > lim && wd > 1e-6) {
        want.x = want.x / wd * lim;
        want.y = want.y / wd * lim;
      }
    }
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
    this._ensureShape();          // 客户端视图也要建外形（见 _ensureShape）
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
    // 多节生物：头节/身体节用不同贴图。本节贴图【没加载成功】时退回物种贴图，
    // 否则 drawMob 会直接 return —— 表现就是"整条蜈蚣没有头"（12_h 素材 404/缓存损坏时）。
    let key = 'mob' + (this.artSvg || this.svg);
    if (!SpriteStore.ready(key) && this.artSvg && this.artSvg !== this.svg) {
      key = 'mob' + this.svg;
    }
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
        // 红闪必须和本体用【同一个旋转轴心位移】。之前这里只写了 -size/2，
        // 于是像蜈蚣头这种主体不在画布中心的贴图，本体被平移了 -pv*size、
        // 红闪却没有 —— 表现为"红闪偏后、和身体不重合"。三条绘制路径现在同源。
        const pv = SpriteStore.mobPivot(key);
        ctx.globalAlpha = ra;
        ctx.drawImage(rc,
          -this.drawSize / 2 - pv.x * this.drawSize,
          -this.drawSize / 2 - pv.y * this.drawSize,
          this.drawSize, this.drawSize);
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
    // 名牌模式：'classic'（普通生物 / 蜈蚣【头节】）= 名称 + 血条 + 稀有度，常显；
    //           'player' （蜈蚣【非头节】）= 只有血条、满血不显示、无名称无稀有度（见下方分支）。
    if (!this.dead && (this.plateStyle || 'classic') === 'classic') {
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
    } else if (!this.dead && (this.hpBarA || 0) > 0.001) {
      // 【主角血条模式】（多节生物的非头节，且生成后即使升为一段的头也保持此模式）：
      // 只画一条血条，贴在本体底边下方；满血不显示、掉血才渐显；不显示名称与稀有度。
      const bw = HPBAR_W, bh = HPBAR_H;
      const bx = this.x - bw / 2, barY = this.y + this.r + 4;
      const rad = Math.min(bh / 2, 6);
      const dRatio = clamp((this.dispHp == null ? this.hp : this.dispHp) / this.maxHp, 0, 1);
      ctx.save();
      ctx.globalAlpha = this.hpBarA;
      roundRectPath(ctx, bx, barY, bw, bh, rad);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fill();
      if (dRatio > 0) {
        roundRectPath(ctx, bx, barY, Math.max(bh, bw * dRatio), bh, rad);
        ctx.fillStyle = hpBarColor(dRatio);        // 绿 -> 红 连续渐变（与主角同一 helper）
        ctx.fill();
      }
      ctx.lineWidth = Math.max(1.2, bh * 0.22);
      ctx.strokeStyle = '#000';
      roundRectPath(ctx, bx, barY, bw, bh, rad);
      ctx.stroke();
      ctx.restore();
    }
  }
}

