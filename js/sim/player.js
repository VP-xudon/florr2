// sim/player.js — 玩家实体：移动/装填/花瓣轨道/无敌/死亡状态
'use strict';

// 花朵本体的红闪强度：比花瓣淡一点（时长与曲线仍由 sim/exit.js 统一给）。
const PLAYER_HURT_A = 0.4;
const PLAYER_POISON_HURT_T = 0.08;

// 颜色插值（中毒脸的平滑过渡用）：#rrggbb -> #rrggbb
function lerpHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

class Player {
  constructor() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.r = PLAYER_R_STD;   // 主角半径 = 原来的 0.6 倍 (≈13.2)
    this.baseR = this.r;     // 不含 Soil 加成的半径（平滑过渡的基准）
    this.facing = 0;
    this.baseSpeed = PLAYER_BASE_SPEED; this.speed = this.baseSpeed;  // 人物移速 = 当前(0.4倍)再放慢一半 = 0.5 倍于当前
    this.weight = rarityWeight('unusual');   // 花朵本体视为 unusual 生物的重量（玩家也是实体，参与重量推挤）
    // 阵营：玩家 = 'player'（召唤物同阵营）。Mob.noteThreat 按阵营判"是不是敌人"，
    // 没有这个字段时玩家会被当成 'enemy'，与所有野生生物同阵营 ——
    // 于是中立生物（工蚁 / 高稀有度瓢虫）挨打【永远不记仇】，只剩敌对型会主动追。
    this.faction = 'player';
    this.maxHp = 100; this.hp = 100;
    this.baseMaxHp = this.maxHp;   // 不含 Soil 的生命上限（平滑过渡的基准）
    // Soil（泥土）装备加成：多件叠加。extraRadius 相加、flowerHp 相加、
    // speedMul（每件 0.75）按【乘积】叠加；实际生效值在 update 里平滑逼近。
    this.soilRadius = 0;
    this.soilHp = 0;
    this.soilSpeedMul = 1;
    this.xp = 0; this.level = 1; this.xpNext = 24;
    this.slots = emptySlots();      // 花朵花瓣（主槽，已装备）
    this.subSlots = emptySlots();   // 副槽（临时存储，不参与装备）
    this.invBar = [];                              // 即时物品栏（底部常驻淡灰卡槽）
    this.backpack = [];                            // 背包库存（仅在背包面板可见）
    this.maxInvBar = 8;
    this.maxBackpack = 24;
    this.invuln = 0;
    this.clock = 0;             // 单调递增计时器：InvulnFX 的时间基准（绝对到期时间）
    this.invulnSrc = {};        // 无敌来源表：{ 'spawn'|'hurt'|'petal:xxx': 到期时刻 }
    this.invulnTotal = 0;       // 本段无敌总时长（供光晕/血条做淡入淡出包络）
    this.invulnA = 0;           // 无敌视觉强度（平滑 0..1：光晕亮度、血条金白程度）
    this.poisonFx = 0;          // 中毒视觉强度（平滑 0..1：脸色/嘴型过渡）
    this.hurtInvuln = 0;        // 受伤无敌帧计时（只免伤、不出任何无敌特效）
    this.armor = 0;             // 花朵护甲：受击结算 = max(攻-甲, 0)
    this.bodyDmg = FLOWER_BODY_DMG;  // 花朵本体攻击（体伤）；recompute() 会再次同步

    this.hurtT = 0;             // 受伤红色滤镜剩余时间（由 EntityFX.hurt 设定，update 里衰减）
    this.kbX = 0; this.kbY = 0; // 反弹冲量速度（px/s，指数衰减到 0）
    this.hpBarA = 0;            // 血条显示透明度（非满血渐显 0.3s / 满血渐隐 0.3s）
    this.deathRot = 0;          // 死亡时本体固定的随机旋转角
    this.dead = false; this.corpseT = 0;
    this.breath = 0; this.moving = false;
    this.spin = 0;              // 花瓣环绕角度
    this.petals = [];           // 花瓣实体（各自有实际坐标与速度）
    // 已离场的花瓣实体：走 EntityFX 退场，播完由这张受控表回收。
    this.petalExit = createEntitySet('petal');
    // 场级实体（网）的唯一客户端容器：服务端下发的玩家网 + 蜘蛛网合并成一张表。
    // 网没有碰撞箱、不占轨道位、不参与伤害，只按半径挂状态（服务端算，客户端只画）。
    this.netWebs = null;
    // 权威侧的网容器（只有 LocalServer 会注入，指向 server.fields）：
    // 客户端没有它，于是"客户端自己造一张有减速效果的网"在结构上不可能发生。
    this.webSink = null;
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
    this.age = 0;                // 出场计时：脸部 Q 弹（EntityFX.pop，重生时归零重播）
    this.killedBy = null;        // 死因（生物名称），死亡界面显示用
    // 遁地（Shovel）：burrowT = 剩余时长（秒）、burrowDur = 本次总时长、stealth = 隐身+无碰撞箱。
    // 客户端预测副本与服务端权威副本都按同一份装备/模式/装填状态推进，两端自然一致。
    this.burrowT = 0;
    this.burrowDur = 0;
    this.stealth = false;
  }

  recompute() {
    // 装备加成（装上即生效，与装填进度无关；同类可叠加）。数值由 PetalFX.bonus 提供：
    //   rotSpeed：Faster   → 最大转速
    //   reach   ：Third Eye → reach 模式的花瓣外伸距离
    //   sight   ：Antennae  → 视野放大比例，相机缩放 = 1/(1+sight)
    // 花瓣的 type.spd 只描述花瓣自身飞行速度，不参与玩家移速。
    let rotBonus = 0, reachBonus = 0, sightBonus = 0, healBonus = 0;
    // Soil（泥土）：额外半径 / 花朵生命上限（相加）、移速倍率（相乘）
    let extraRadius = 0, flowerHp = 0, speedMul = 1;
    const seenType = Object.create(null);
    this.slotActive = [];        // 每格是否生效（不可堆叠花瓣的重复件为 false）
    this.accessories = [];       // 装备型饰品：不进入轨道，直接画在人物身上
    for (let i = 0; i < this.slots.length; i++) {
      const p = this.slots[i];
      let active = !!p;
      // 不可堆叠：只有最左边那格生效，其余同类显示为未装填
      if (p && p.type.stackable === false) {
        if (seenType[p.type.key]) active = false;
        else seenType[p.type.key] = 1;
      }
      this.slotActive[i] = active;
      if (!p || !active) continue;
      if (typeof PetalFX !== 'undefined' && PetalFX.bonus) {
        const b = PetalFX.bonus(p.type, p.rarity);
        rotBonus += b.rotSpeed || 0;
        reachBonus += b.reach || 0;
        sightBonus += b.sight || 0;
        healBonus += b.healBonus || 0;      // Healing Bonus（Basil）：同类可叠加，求和
        extraRadius += b.extraRadius || 0;  // Soil：额外半径（可叠加）
        flowerHp += b.flowerHp || 0;        // Soil：花朵生命上限（可叠加）
        speedMul *= (b.speedMul == null) ? 1 : b.speedMul;   // Soil：移速倍率（乘积）
      }
      if (p.type.accessory) this.accessories.push({ card: p, slot: i });
    }
    // maxHp 只由构造函数与重生入口维护，换装不重置（?hp=N 依赖这一点）。
    // Soil：移速倍率是"乘积叠加"，直接乘在基础移速上（上限移速同步下降）。
    this.speed = this.baseSpeed * speedMul;
    // Soil 的目标加成（实际生效值在 update 里平滑逼近，见 _tickSoil）
    this.soilRadius = extraRadius;
    this.soilHp = flowerHp;
    this.soilSpeedMul = speedMul;
    this.bodyDmg = FLOWER_BODY_DMG;
    // 最大转速 = 基础 + 所有 Faster 加成（叠加）。/rot-speed 只能在这个值上打 0.1~1.0 的倍率，
    // 所以转速上限是【动态】的，绝不硬编码在别处。
    this.rotMax = PETAL_SPIN + rotBonus;
    this.reachBonus = reachBonus;
    // 视野放大（Antennae）：0 = 正常视野。相机缩放 = 1/(1+sight)（看得更远）。
    this.sightBonus = sightBonus;
    // 回血增幅：给 PetalFX.ctx.heal 用（最后结算，只乘一次）
    this.healBonus = healBonus;
  }

  // 受击结算：返回本次是否真正扣血（护甲已在调用方扣减），
  // 与是否致死无关（致死看 this.dead / this.hp）。
  // src = 伤害来源（Mob），致死时记录名称用于死亡界面。
  // invuln > 0 或 hurtInvuln > 0 时完全免伤，也不触发红闪。
  hurt(dmg, src) {
    if (this.dead || dmg <= 0) return false;
    if (this.invuln > 0 || this.hurtInvuln > 0) return false;
    this.hp -= dmg;
    EntityFX.hurt(this);                // 红闪统一走实体引擎（时长/强度只有一个来源）
    this.hurtInvuln = FLOWER_HURT_INVULN;   // 受伤无敌帧：独立计时，只挡连续扣血，不产生任何无敌特效
    if (this.hp <= 0) {
      this.hp = 0;
      this.killedBy = (src && src.name) ? src.name : null;
      this.die();
    }
    return true;
  }

  // 离场朝向 = 【进入退场那一刻的画面朝向】（与 _drawPetalEntity 的取角规则逐条对应）。
  // 飞行体（Missile）的朝向由速度决定（flightRot）：死亡时若切回"轨道径向"，
  // 就会在消失的一瞬间歪一下 —— 所以退场必须定格在它当前看到的那个角度。
  _petalExitRot(b) {
    if (!b) return 0;
    if (b.flightRot != null) return b.flightRot + (b.flightSpin || 0);
    if (b.anchor) return 0;
    if (b.fxActive) return Math.atan2(b.y - this.y, b.x - this.x) + Math.PI / 2;
    return (b.stationary ? 0 : (b.drawRot != null ? b.drawRot : 0)) + (b.selfRot || 0);
  }

  // 花朵死亡：花瓣原地快速渐隐消失，本体随机旋转一个角度后保持不动（叉叉眼 + 哭脸）
  die() {
    this.dead = true; this.corpseT = 0;
    this.deathRot = rand(0, TAU);
    // 遁地中死亡：先取消隐身/无碰撞，否则尸体仍然"感知不到"
    this.burrowT = 0; this.burrowDur = 0; this.stealth = false;
    // 每个花瓣实体各自进入通用退场（多体花瓣本就是 N 个实体，无需特殊处理）
    for (const b of this.petals) {
      if (b.dead || b.exiting) continue;
      b.exitRot = this._petalExitRot(b);
      EntityFX.despawn(b);
      this.petalExit.adopt(b);
    }
    this.petals = [];
    this.vx = 0; this.vy = 0;
  }

  // 中毒：按 StatusFX 记录的 dps 每帧连续扣血。
  // 不走 hurt()：它有 0.2s 受伤无敌帧，会把持续伤害吃掉大半。
  // 无敌期间不吃毒；致死仍走同一条 die()。
  _tickPoison(dt) {
    if (this.dead || typeof StatusFX === 'undefined') return;
    if (this.invuln > 0 || this.hurtInvuln > 0) return;   // 无敌不吃毒
    const rec = StatusFX.get(this, 'poison');
    if (!rec || !(rec.value > 0)) return;
    const dmg = rec.value * dt;
    if (!(dmg > 0)) return;
    this.hp -= dmg;
    EntityFX.hurt(this, PLAYER_POISON_HURT_T);
    if (this.hp <= 0) {
      this.hp = 0;
      if (!this.killedBy) {
        this.killedBy = (typeof I18N !== 'undefined')
          ? I18N.t('Status/Poison/Name', 'Poison') : 'Poison';
      }
      this.die();
    }
  }

  // ---- 场地型实体（Web 落地后的那张大网）----
  // 只有权威侧能造网：webSink 指向 server.fields（由 LocalServer.attach 注入），
  // 客户端没有 sink 时返回 null，其网一律来自快照（p.netWebs）。
  spawnWeb(x, y, radius, duration, card) {
    const sink = this.webSink;
    if (!sink || !(radius > 0)) return null;
    const f = {
      x, y, r: radius, t: 0,
      dur: (duration > 0) ? duration : 10,
      card: card || null,
      owner: 'player',     // 玩家网：只给【生物】挂减速（_fieldTick 按 owner 区分）
    };
    sink.add(f);           // add() 负责分配全局单调 netId（见 createEntitySet 的 idGen）
    return f;
  }

  // 出生 / 重生的唯一重置入口：客户端预测副本与服务端权威副本都必须走这里。
  // 重置字段必须覆盖花瓣实体、_petalGen 与 reloadHold：
  // 世代号残留会让快照键永久失配（花瓣不掉血、不碎），reloadHold 残留会让该槽卡在暂停态。
  resetForSpawn(pos) {
    if (pos) { this.x = pos.x; this.y = pos.y; }
    this.vx = 0; this.vy = 0;
    this.hp = this.maxHp;
    this.dead = false; this.corpseT = 0; this.deathRot = 0;
    this.hurtT = 0; this.killedBy = null;
    this.hurtInvuln = 0;
    // 状态效果一并清空：重生不继承毒伤
    if (typeof StatusFX !== 'undefined') this.status = [];
    this.poisonFx = 0;                     // 脸色/嘴型从"中毒"平滑回到正常
    this.invuln = 0; this.invulnSrc = {}; this.invulnTotal = 0; this.invulnA = 0;
    this.age = 0;
    this.dispHp = this.hp; this.ghostHp = this.hp; this.ghostV = 0;
    // 花瓣实体、世代号、退场表是同一份状态，必须一起清（退场表让旧实体播完再回收）
    this.petals = []; this._petalGen = [];
    // 场上的网不属于这条命的状态：权威侧由 LocalServer 自己按时长回收，
    // 客户端镜像表 netWebs 只跟随快照，这里都不动。
    this.netPetals = null;                 // 旧快照键映射作废，避免重生瞬间串状态
    // 遁地状态不属于"下一条命"：重生必须清掉，否则会带着隐身出生。
    this.burrowT = 0; this.burrowDur = 0; this.stealth = false;
    this.reload = this.slots.map((c) => c ? {
      card: c, age: 0,
      dur: petalReloadOf(c)
    } : null);
    this.reloadHold = this.slots.map(() => false);
    InvulnFX.add(this, 'spawn', FLOWER_SPAWN_INVULN);
    return this;
  }

  update(dt, dir, map, mobs) {
    // 场级实体（网）镜像表的退场推进：与花瓣/生物同一套 EntityFX 通道
    if (this.netWebs) this.netWebs.sweep(dt);
    // 出场计时（脸部 Q 弹）与受伤红闪：统一由实体引擎推进，只有一份来源
    EntityFX.tickEntity(this, dt);
    if (this.dead) {
      this.corpseT += dt;
      // 死亡瞬间放出的花瓣退场实体继续播完渐隐（0.1s）
      this.petalExit.sweep(dt);
      return;
    }
    // 花瓣退场表始终推进（换装/碎裂的实体在播完前仍需计时）
    this.petalExit.sweep(dt);
    // Soil：额外半径 / 生命上限的平滑过渡（必须在血量条平滑之前）
    this._tickSoil(dt);
    // 地形减速：站在 foliage / seaweed / vine 这类瓦片上时——
    //   · 移动速度 = 默认值的 40%
    //   · 所有花瓣强制回到"待加载"状态（装填进度清零、不生成实体），离开后重新装填
    this.slowTile = !!(map && map.slowAt && map.slowAt(this.x, this.y));
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
      // 减速瓦片：×0.4；遁地（Shovel）期间同样按这个系数减速（用户口径：幅度与树丛一致）。
      // /speed 的倍率再整体乘上来（客户端/服务端共用同一个 MOVE_MULT）；
      // 状态效果（如踩到蛛网）：统一走 StatusFX.speedMul —— 与上面的倍率相乘。
      const spd = this.speed * MOVE_MULT
        * ((this.slowTile || this.burrowT > 0) ? SLOW_TILE_SPEED : 1)
        * ((typeof StatusFX !== 'undefined') ? StatusFX.speedMul(this) : 1);
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
      // wrapAngle：持续同向转圈时朝向会无限累加，必须每帧归一到 (-PI, PI]
      this.facing = wrapAngle(lerpAngle(this.facing, ta, clamp(dt * 12, 0, 1)));
    }
    this.breath += dt;
    InvulnFX.tick(this, dt);            // 无敌时间推进（多来源，取最晚到期）
    if (typeof StatusFX !== 'undefined') {
      StatusFX.tick(this, dt);      // 状态效果时长
      this._tickPoison(dt);         // 中毒持续掉血
      // 中毒的【视觉强度】：0..1 平滑过渡（脸色/嘴型都按它插值，不硬切）
      this.poisonFx = damp(this.poisonFx || 0, StatusFX.has(this, 'poison') ? 1 : 0, 6, dt);
    }
    // 无敌视觉强度平滑跟随：进入/退出都是渐变，绝不硬切换（光晕亮度与血条金白共用它）。
    // 只跟随 invuln（出生/召唤/花瓣类）；受伤无敌帧走独立的 hurtInvuln，不产生任何视觉。
    this.invulnA = damp(this.invulnA, this.invuln > 0 ? 1 : 0, 8, dt);
    this.hurtInvuln = Math.max(0, this.hurtInvuln - dt);   // 受伤无敌帧衰减

    // 转速 = 【动态最大转速】× 倍率。最大转速由装备（Faster）决定，倍率由 /rot-speed 决定。
    this.spin += (this.rotMax || PETAL_SPIN) * ROT_SCALE * dt;
    // 装填计时必须在 _syncPetals 之前：新换上来的卡要先有 reload 状态（age=0 -> 未完成），
    // 这一步之后花瓣实体才会被放出来
    this._tickReload(dt);
    // 模式过渡动画：0.15s平滑过渡
    const targetT = (this.mode === 'normal') ? 0 : 1;
    const modeRate = 1 / 0.15;  // 0.15秒完成过渡
    this.modeT = damp(this.modeT, targetT, modeRate, dt);
    // 落位型花瓣（Wax）要在脱轨那一刻找一个"不卡墙"的位置，需要地图
    this._mapRef = map;
    this._syncPetals(dt, map, mobs);
  }

  // ---------------- 遁地（Shovel）----------------
  // 唯一入口：装填完成 + 处于 burrow.mode（detect）-> 立即遁地 dur 秒。
  // 遁地期间：所有花瓣强制下架（走通用退场）、装填冻结、生物感知不到、没有碰撞箱。
  // 客户端预测副本与服务端权威副本调用的是同一份逻辑，因此两端表现一致。
  _startBurrow(dur) {
    if (this.dead || this.burrowT > 0) return false;
    const d = (dur > 0) ? dur : 2;
    this.burrowT = d;
    this.burrowDur = d;
    this.stealth = true;
    // 花瓣全部下架：不是凭空消失 —— 统一走 EntityFX 退场，播完由 petalExit 回收
    for (const b of this.petals) {
      if (!b || b.dead) continue;
      b.dead = true;
      b.exitRot = this._petalExitRot(b);
      EntityFX.despawn(b);
      this.petalExit.adopt(b);
    }
    this.petals = [];
    // 所有槽位从头装填（遁地期间冻结，恢复后重新计时）
    for (let i = 0; i < this.slots.length; i++) {
      this._petalGen[i] = (this._petalGen[i] | 0) + 1;
      const c = this.slots[i];
      this.reload[i] = c
        ? { card: c, age: 0, dur: petalReloadOf(c), frozen: true }
        : null;
    }
    return true;
  }

  _endBurrow() {
    const was = this.burrowT > 0;
    this.burrowT = 0;
    this.burrowDur = 0;
    this.stealth = false;
    if (!was) return;
    // 恢复：所有槽位从 0 开始重新装填（不继承遁地前的进度）
    for (let i = 0; i < this.reload.length; i++) {
      const r = this.reload[i];
      if (!r) continue;
      r.frozen = false;
      r.age = 0;
      r.hold = false;
    }
  }

  // Soil（泥土）：装备即生效的加成 —— 额外半径 / 花朵生命上限【平滑】逼近目标值。
  //   · 多件 Soil 叠加（recompute 已把目标值求和/求积算好）；
  //   · 装上变大、卸下变小都是渐变（指数阻尼），绝不瞬移/瞬变；
  //   · 生命上限变化时，当前血量与血条的两条平滑值按【同一比例】缩放，
  //     于是血条的剩余百分比在加减 Soil 的整个过程中保持不变。
  _tickSoil(dt) {
    // 过渡速率 3（= 原来的 6 的 0.5 倍）：装上/卸下都是更缓慢的渐变。
    const RATE = 3;
    const targetR = this.baseR + (this.soilRadius || 0);
    if (Math.abs(this.r - targetR) > 0.01) this.r = damp(this.r, targetR, RATE, dt);
    const targetMax = this.baseMaxHp + (this.soilHp || 0);
    if (Math.abs(this.maxHp - targetMax) > 0.05) {
      const prev = this.maxHp;
      this.maxHp = damp(this.maxHp, targetMax, RATE, dt);
      const k = (prev > 0) ? (this.maxHp / prev) : 1;
      if (k > 0 && k !== 1) {
        this.hp = Math.min(this.maxHp, this.hp * k);
        if (this.dispHp != null) this.dispHp *= k;
        if (this.ghostHp != null) this.ghostHp *= k;
      }
    }
  }

  // 滞留型花瓣（Pollen / Honey）的脱轨条件：
  // 只要处在 reach / detect 模式就立刻生效 —— 按下按键那一刻模式就已经切换，
  // 不能等花瓣飞到扩展轨道的位置（那是"外观过渡"，与机制无关）。
  // normal 模式下一律跟随轨道。
  _detachReady() {
    if (this.dead) return false;
    return this.mode === 'reach' || this.mode === 'detect';
  }

  // 客户端侧销毁一朵花瓣实体：进入通用退场（放大 + 渐隐），该槽按规则重新装填。
  // 与服务端 _destroyPetal 语义一致，但这里只做表现。
  _killPetalBody(b) {
    if (b.dead) return;
    // 先问引擎（与服务端同一套语义）：飞行途中的 Web 被打碎要立刻成网
    if (typeof PetalFX !== 'undefined' && PetalFX.onPop) PetalFX.onPop(b, this);
    b.dead = true;
    b.exitRot = this._petalExitRot(b);
    EntityFX.despawn(b);                 // 入场/退场/红闪统一由实体引擎打标记
    this.petalExit.adopt(b);             // 退场播完由 petalExit.sweep 回收
    // 与服务端 _destroyPetal 同一规则：放在地上的滞留实体（Pollen / Honey）碎了就是碎了，
    // 不触发卡片重装。少了这一条，客户端会把该槽冷却重置一遍 -> 之后每次装填都比服务端慢一拍。
    if (b.stationary) return;
    const c = b.card;
    const dur = petalReloadOf(c);
    const cnt = (CardRenderer.lightSubCount) ? CardRenderer.lightSubCount(c.type, c.rarity) : 1;
    if (cnt > 1) {
      // 多实体卡：只有这一个实体进入自己的重装填（服务端权威计时），卡片【不】进入
      // reload —— 所以卡面不会出现扇形阴影；同槽其它实体照常飞舞。
      return;
    }
    this.reload[b.slotIndex] = { card: c, age: 0, dur };
  }

  // 把服务端下发的花瓣战斗状态（hp / 受伤红闪 / 是否已碎）应用到当前花瓣实体上。
  // 由 _syncPetals 每帧调用；快照到达时也由 Game._applySnap 立即调一次，
  // 保证同帧就能看到掉血/碎裂。
  // 主键 = (槽位, 子序号, 世代号)：一张卡可能对应多个独立实体（Light 的每个光点），
  // 滞留型花瓣（Pollen/Honey）还会同时存在多批（地上的 + 轨道上的）。
  // 【兜底】世代号是客户端/服务端各自维护的计数器（脱轨那一刻 +1），滑动窗口里可能差一拍：
  // 按 key 匹配不到时，退化成 (槽位, 子序号) 的唯一记录。
  // 关键约束：兜底【不许改写实体自己的 gen】。同一张卡的两代实体同时在场（旧导弹还在飞、
  // 新导弹刚出膛）时，把新实体"对齐"到旧记录的世代号会让两者共用一个键 ——
  // 之后一条记录同时喂给两个实体（速度/位置/存活被同一份覆盖），表现就是
  // "两发导弹叠成一发飞、只剩一个能看见、方向还乱"。
  // 所以兜底只认【本帧还没被其它实体按精确键认领】的那一条记录（claimed 由调用方逐帧清空）。
  _netPetalFor(b, claimed) {
    const np = this.netPetals;
    if (!np) return null;
    const sub = b.sub || 0, gen = b.gen || 0;
    const key = petalNetKey(b.slotIndex, sub, gen);
    const exact = np.get(key);
    if (exact) { if (claimed) claimed.add(key); return exact; }
    // 退化成"同槽同子号的唯一未认领记录"：多于一条就不猜（宁可不更新）。
    let one = null, oneKey = null, n = 0;
    for (const [k, x] of np) {
      if (!x || x.slot !== b.slotIndex || (x.sub || 0) !== sub) continue;
      if (claimed && claimed.has(k)) continue;
      n++; one = x; oneKey = k;
      if (n > 1) break;
    }
    if (n !== 1) return null;
    if (claimed) claimed.add(oneKey);
    return one;
  }

  // 服务端此刻这一槽有没有活着的实体（按 slot 判断，不参与世代号匹配：gen 可能差一拍）。
  // 没有快照（首帧 / 远端模式还没连上）时一律放行，退回纯本地计时。
  // 【为什么需要它】：本地 reload 计时与服务端不是同一个钟，客户端会早一两帧跑完，
  // 于是画出一片服务端还不存在的花瓣 —— 它从生物身上飘过去却什么都不结算。
  _netSlotHasLive(slot) {
    const np = this.netPetals;
    if (!np) return true;
    let any = false, live = false;
    for (const [, o] of np) {
      if (!o || o.slot !== slot) continue;
      any = true;
      if (!o.dead) live = true;
    }
    return any ? live : true;
  }

  _applyNetPetalStates() {
    if (!this.netPetals) return;
    // 一条快照记录只能喂给一个实体：记下本帧已被认领的键（见 _netPetalFor）。
    const claimed = this._netClaimed || (this._netClaimed = new Set());
    claimed.clear();
    for (const b of this.petals) {
      const ns = this._netPetalFor(b, claimed);
      if (!ns) continue;
      b.hp = ns.hp; b.maxHp = ns.maxHp;
      // 花瓣位置与速度一律取服务端权威值，客户端只负责渲染与插值。
      // 插值而不是直接赋值：快照 25Hz，直接采信会按台阶跳变。
      if (ns.x != null) {
        // 不把坐标硬赋值过去：那样它会跟着 25Hz 的快照台阶跳 —— 被连续推挤时
        // 就是明显的"一卡一卡 / 很粘"。改为记录起终点，由每帧插值还原平滑位移。
        if (b.nToX == null || Math.abs(ns.x - b.nToX) > 0.01 || Math.abs(ns.y - b.nToY) > 0.01) {
          b.nFromX = b.x; b.nFromY = b.y;
          b.nToX = ns.x; b.nToY = ns.y;
          b.nBlend = 0;
        }
        b.vx = ns.vx || 0; b.vy = ns.vy || 0;
        // 飞行朝向不在这里写：实体推进里每帧由速度统一重算（唯一一处）。
      }
      // 受伤红闪取"更亮"的那个，避免本地已衰减到一半时被覆盖掉
      if (ns.hurtT > (b.hurtT || 0)) b.hurtT = ns.hurtT;
      if (ns.dead && !b.dead) {
        this._killPetalBody(b);
      } else if (!ns.dead && b.dead) {
        // 多实体卡的单个实体装填完成 -> 复活：取消上一次离场并重新入场（Q 弹）。
        // 必须走 petalExit.reclaim：只把 dead 置回 false 会留下 exiting=true 的退场标记，
        // 实体就永远停在"退场最后一帧"（alpha≈0）-> 看不见但仍参与判定。
        // 坐标同样拉回花朵中心：否则它会从"死亡处"（可能正贴着生物）原地冒出，
        // 看起来就像从生物身上突然出现、而不是从花瓣中心飞出去。
        b.dead = false;
        b.hp = b.maxHp;
        this.petalExit.reclaim(b);
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
        // 冷却时长：唯一入口 petalReloadOf（支持按稀有度，Shovel）
        this.reload[i] = { card: c, age: 0, dur: petalReloadOf(c) };
      } else if (this.burrowT > 0) {
        // 遁地（Shovel）：所有花瓣强制禁用 —— 装填进度清零并冻结，
        // 恢复（_endBurrow）后全部从 0 重新装填。
        r.age = 0;
        r.frozen = true;
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
    if (this.burrowT > 0) return false;   // 遁地期间：所有花瓣强制禁用
    const r = this.reload[i];
    return !!r && r.age >= r.dur;
  }

  // 某片花瓣的自转速率（rad/s）——【生成时算一次并记住】，之后不再随公转变化。
  // 口径：公转 + 自转 = PETAL_SELF_TURN_T 秒一圈（= 2s，玩家看到的整圈速度）；
  // 花瓣自带 selfSpin 时优先用它。
  // 注：绘制角 = drawRot(公转角) + selfRot，所以这里必须减去公转，
  // 否则两段叠加会让花瓣转得比设定值快（1.07s 一圈）。
  _petalSelfRate(b) {
    if (b.selfRate != null) return b.selfRate;
    const type = b && b.card && b.card.type;
    const own = type && (typeof type.selfSpin === 'number') ? type.selfSpin : null;
    if (own != null) return own;
    const orbit = (this.rotMax || PETAL_SPIN) * ROT_SCALE;
    const target = (PETAL_SELF_TURN_T > 0) ? (TAU / PETAL_SELF_TURN_T) : PETAL_SELF_SPIN;
    return (target - orbit) || PETAL_SELF_SPIN;
  }

  // 花瓣运动：自由跟随主角（位移积分），实体碰撞由 _separatePetalFromMobs 负责。
  _resolvePetal(b, mx, my) {
    b.x += mx; b.y += my;
  }

  // 花瓣 vs 生物【实体分离】（碰撞的"花瓣一侧"）：重叠时把花瓣推出生物轮廓。
  //   · 反质量份额：花瓣越重，生物让得越多；被刚性粘合的链节永不让位（份额 0）；
  //   · 保留 PETAL_CONTACT_SKIN 的穿透量 —— 推成"刚好相切"会让下一 tick 判不到接触，
  //     表现就是"卡在轮廓外沿、既打不到也不再受伤"；
  //   · 法线方向的速度按 PETAL_BOUNCE 反弹：撞上去弹开再绕回来，不会被弹簧一直顶在
  //     生物表面白嫖伤害；切向速度保留，于是沿表面"蹭"过去（揉搓感）。
  // 客户端与服务端跑同一段代码（服务端 mobs 权威、客户端是视图，位置差 1~2px），
  // 位移只有几像素且随即被弹簧拉回，两端不会累积偏差。
  // 生物一侧的分离在 LocalServer._separateMobFromPetal 里做（生物只有服务端能动）。
  _separatePetalFromMobs(b, mobs) {
    if (!mobs || !mobs.length) return;
    // 没有碰撞箱的实体（Web 落地后的那张网）：只是"一块场地"，不参与任何分离
    if (b.noCollide) return;
    // 穿透型花瓣（Glass）：没有碰撞箱，直接穿过生物
    if (b.card && b.card.type && b.card.type.noPush) return;
    for (const m of mobs) {
      if (!m || m.dead) continue;
      // 先用【轮廓外接圆】做一次廉价排除：nearMobs 是按"吸附范围"筛的，比真实接触范围大一圈，
      // 逐片花瓣 × 每只近邻都跑轮廓求交是纯浪费（轮廓有近百条边）。
      // 半径取法与 circleVsMobPoly 内部完全一致（poly.r × collSize），不会漏判。
      const dx = m.x - b.x, dy = m.y - b.y;
      const bound = ((m.shape && m.shape.r) ? m.shape.r * m.collSize : (m.r || 0)) + (b.cr || PETAL_R);
      if (dx * dx + dy * dy > bound * bound) continue;
      const hit = entityHitMob(m, b);
      if (!hit || hit.depth <= PETAL_CONTACT_SKIN) continue;
      const invP = 1 / (b.weight || 1);
      const invM = m._chainLocked ? 0 : 1 / (m.weight || 1);
      const shareP = invP / ((invP + invM) || 1);
      const push = (hit.depth - PETAL_CONTACT_SKIN) * PETAL_SEP_K * shareP;
      if (push > 0) { b.x += hit.nx * push; b.y += hit.ny * push; }
      if (b.vx == null) { b.vx = 0; b.vy = 0; }
      const vn = b.vx * hit.nx + b.vy * hit.ny;
      if (vn < 0) {
        b.vx -= hit.nx * vn * (1 + PETAL_BOUNCE);
        b.vy -= hit.ny * vn * (1 + PETAL_BOUNCE);
      }
    }
  }

  // 花瓣 = 实体：每片都有"此刻应在的位置"(target) 与 "实际位置"，平滑吸附过去。
  //   · 按「当前装备数量」平分一圈：2 片 180° 相对、3 片三角、5 片五角……（空槽不占位）
  //   · 刚上场的花瓣初始位置就在人物中心，再慢慢"冒"到应在位置
  //   · 人物跑起来时目标点跟着跑，花瓣会被甩在后面一小段距离，再平滑吸附（故意保留的缓冲感）
  //   · 装备数量变化引起间距重排时，同样走这套吸附过程，绝不瞬移
  _syncPetals(dt, map, mobs) {
    // ---- 遁地（Shovel）状态机：唯一入口 ----
    if (this.burrowT > 0) {
      this.burrowT = Math.max(0, this.burrowT - dt);
      if (this.burrowT <= 0) this._endBurrow();
      else return;                       // 遁地期间：不生成、不更新任何花瓣实体
    }
    // 装填完成 + 处于 burrow.mode 指定的模式 -> 立即遁地。
    // 判定放在实体生成【之前】：那一片铲子直接被"用掉"，不会先飞出去再消失。
    if (!this.dead) {
      for (let i = 0; i < this.slots.length; i++) {
        const c = this.slots[i];
        const bt = c && (typeof PetalFX !== 'undefined') && PetalFX.trait(c.type, 'burrow');
        if (!bt || !this.reloadDone(i)) continue;
        if (this.mode !== (bt.mode || 'detect')) continue;
        if (this._startBurrow(bt.dur)) return;
      }
    }
    // 【装上就算数】：所有已装备的主槽都参与排列（n = 装备总数），
    // 装填中/被打碎重冷的槽位照样占一个位置 —— 其它花瓣自动给它留出空位。
    const equipped = [];
    for (let i = 0; i < this.slots.length; i++) {
      const c = this.slots[i];
      if (!c) continue;
      // 不可堆叠花瓣的重复件不参与轨道（它们本来就是暗灰未装填态）
      if (this.slotActive && this.slotActive[i] === false) continue;
      // 装备型饰品（Third Eye）固定贴在人物身上，不占轨道位、不生成花瓣实体
      if (c.type.accessory) continue;
      equipped.push(i);
    }
    const n = equipped.length;

    // Light 多体：一个槽由 N 个独立光点组成（等同装了 N 个单体 Light），
    // 每个光点各占一个轨道位 —— 所以轨道总数 = Σ 各槽光点数。
    const cntOf = (card) => (card && CardRenderer.lightSubCount)
      ? CardRenderer.lightSubCount(card.type, card.rarity) : 1;
    // 【阵型多体】：整坨共享中心角；formationOrbitSpots 可额外预留角位（Orange 用于避让邻瓣）。
    // 其余一卡多体（Light / Pollen）仍然是每个实体各占一个轨道位、各自独立飞。
    const spotOf = (card) => (card && card.type && card.type.formation)
      ? Math.max(1, card.type.formationOrbitSpots || 1) : cntOf(card);
    let totalSpots = 0;
    for (let k = 0; k < n; k++) totalSpots += spotOf(this.slots[equipped[k]]);
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
      // 已碎的滞留实体：走通用退场后由 petalExit 回收，不留在 petals 里越积越多。
      if (b.dead) {
        if (!b.exiting) {
          b.exitRot = this._petalExitRot(b);
          EntityFX.despawn(b);
          this.petalExit.adopt(b);
        }
        continue;
      }
      // 卡片 ↔ 实体严格对应：这张卡被切下/换掉，地上的实体立刻消失。
      // （否则切下 Honey 再切回来会凭空多出一批实体，越切越多。）
      if (this.slots[b.slotIndex] !== b.card) {
        b.dead = true;
        b.exitRot = this._petalExitRot(b);
        EntityFX.despawn(b);
        this.petalExit.adopt(b);
        continue;
      }
      b.life = (b.life || 0) + dt;

      // 存活上限：Pollen 有；Honey 靠血量撑（Infinity）。
      // 口径由 PetalFX.ttlOf 统一给出（能力字段 holdReloadUntilDeath 决定）。
      const lim = PetalFX.ttlOf(b);
      if (b.life >= lim) {
        this._killPetalBody(b);      // 通用移除（自带渐大渐隐退场）
        continue;
      }
      bodies.push(b);
    }
    let spotBase = 0;
    for (let k = 0; k < n; k++) {
      const slotIndex = equipped[k];
      const card = this.slots[slotIndex];
      const cnt = cntOf(card);
      const nSpot = spotOf(card);   // 本槽占用几个轨道位（阵型型恒为 1）
      const myBase = spotBase;      // 该槽占用的第一个轨道位（装填中也照占，保持排布稳定）
      spotBase += nSpot;
      if (!this.reloadDone(slotIndex)) continue;    // 装填中：占位但不生成
      const st = petalStatsFor(card.type, card.rarity);
      // 血量按【卡面总 hp】均分：一张卡有 N 个实体，每个实体占卡面 hp 的 1/N。
      // 卡槽的"水缸"阴影则按存活实体的血量总和 / 卡面总 hp 计算（见 ui.js _reloadTick）。
      // 例外：【阵型型】（Stinger / Peas）不均分 —— 每个子实体就是给出的"单个体"数值
      // （如 Peas 单球 5 血；卡面按【合并口径】显示合计 20，见 PETAL_STAT_DISPLAY），
      // 否则会被除以 N 变成 1.25，完全失真。
      // 没有血量的花瓣（Glass）：实体也没有 hp（打不碎），不能走 "hp 缺失就补 30" 的回退
      const cardHp = st.hp > 0 ? st.hp : (card.type.noHealth ? 0 : 30);
      const maxHp = (cnt > 1 && !card.type.formation) ? cardHp / cnt : cardHp;
      const gen = this._petalGen[slotIndex] | 0;
      for (let sub = 0; sub < cnt; sub++) {
        let body = null;
        for (const b of this.petals) {
          // 匹配本世代的同一子体。死亡的独立子体也保留在 petals 中：
          // 权威副本靠它推进 respawnT / holdRespawn，客户端靠它等待快照复活；
          // 退场绘制与计时仍由 petalExit 负责，战斗、运动和正常绘制均跳过 dead。
          if (!b.stationary && (b.gen | 0) === gen
            && b.slotIndex === slotIndex && b.card === card && b.sub === sub) { body = b; break; }
        }
        if (body && body.dead) { bodies.push(body); continue; }
        if (!body) {
          // 新实体只在服务端确实有它时才生成：本地 reload 可能早一两帧跑完，
          // 那几帧里服务端还没有这片花瓣，客户端生成出来也无法结算伤害。
          if (!this._netSlotHasLive(slotIndex)) continue;
          // 花瓣实体重量与 Mob / Player 共用 rarityWeight 模型（common=1 … eternal≈249）。
          body = { slotIndex, sub, gen, card, x: this.x, y: this.y, hp: maxHp, maxHp,
            weight: rarityWeight(card.rarity),
            // 护甲走同一张数据表（花瓣与生物同一套伤害口径：dmg - armor）
            armor: st.armor || 0,
            kbT: 0 };        // 传能冷却（伤害没有冷却：每 tick 都结算）
          EntityFX.spawn(body, 'petal');   // 出场计时/退场/红闪统一由实体引擎维护
        }
        body.ord = k; body.n = n;
        body.cnt = cnt;
        body.spot = (nSpot === 1) ? myBase
          : (card.type.formation ? myBase + (nSpot - 1) * 0.5 : myBase + sub);
        // 出生朝向：【底边朝着花朵】= 公转角度 + 90°（素材默认"下方"指向花心），
        // 自转速率也在这里定死（见 _petalSelfRate），之后公转变化不再影响它。
        if (body.selfRot == null) {
          body.selfRot = this.spin + body.spot * spotStep + Math.PI / 2;
          body.selfRate = this._petalSelfRate(body);
        }
        // ---- 阵型多体：子实体按登记布局锁定偏移 + 各自朝向 ----
        // 每个子实体仍是完全独立的个体（各自结算碰撞、各自有血量），
        // 只是位置/朝向常年被布局锁定成卡面那一坨的形状。
        if (card.type.formation && cnt > 1) {
          const lay = (typeof CardRenderer !== 'undefined' && CardRenderer.entityFormationLayout)
            ? CardRenderer.entityFormationLayout(card.type.svg, card.rarity)
            : ((typeof CardRenderer !== 'undefined' && CardRenderer.multiLayout)
              ? CardRenderer.multiLayout(card.type.svg, card.rarity) : null);
          const s = (lay && lay[sub]) ? lay[sub] : null;
          if (s) {
            // 与其它花瓣（Stinger）【完全相同的公式】：k = 1，单位就是 D。
            // 卡面 D = lightDRatio(svg, false) × dw；实体 D = lightDRatio(svg, true) × PETAL_ENT_SIZE。
            // 两边同一套公式 -> 卡面与实体天然同比例（不能再额外乘/除任何系数）。
            // 关键：实体必须用【与卡面同一个比例基准】（false = 卡面窗口）。
            // 之前实体用 true（实体窗口）、卡面用 false（卡面窗口），两个窗口对同一张素材
            // 归一化出来的比例不相等 —— 于是不管布局参数怎么调，卡面和实体都不可能同比例。
            // 现在两边共用 lightDRatio(svg, false)，只是各自乘自己的基准尺寸，
            // 比例严格一致（这也是其它阵型花瓣应有的行为）。
            // D = 【该上下文里单个子体的实际显示直径】。
            // uniformWindow 会让同一张素材在"卡面窗口(68.26)"与"实体窗口(32.86)"下
            // 得到不同的占比，所以两边必须各自代入自己的窗口比例：
            //   卡面 D = ball / 卡面窗口 × dw
            //   实体 D = ball / 实体窗口 × PETAL_ENT_SIZE   ← 这里用 true
            // 之前实体错用了 false（卡面比例），D 只有真实球径的一半，
            // 间距随之减半 -> 实体整簇比卡面紧凑一倍。这不是特判，同一个 D 定义而已。
            const _dr = (typeof CardRenderer !== 'undefined' && CardRenderer.lightDRatio)
              ? CardRenderer.lightDRatio(String(card.type.svg), true) : 1;
            const entD = _dr * PETAL_ENT_SIZE;
            body.formK = s.k || 1;
            body.formD = entD;
            body.formArcBase = !!card.type.formationArcBase;
            body.formOff = body.formArcBase ? null : { x: s.x * entD, y: s.y * entD };
            body.formRot = s.rot || 0;
            // 与 Stinger 同一套布局换算，不做单球索引或二次缩放。
          }
        }
        // 标记"会吸引仇恨的花瓣"：AI 据此判断"被吸引"的生物连被动型也会主动过来啃
        body.honey = !!PetalFX.trait(card.type, 'attractMobs');
        // ---- 滞留型花瓣（Pollen / Honey / Peas）：reach / detect 模式加载完成后脱轨 ----
        // 只有这两种模式才会"甩出去留在原地"（normal 模式永远跟着轨道）。
        // 脱轨时机、初速、装填策略全部由 PetalFX 的注册定义决定（能力字段 + detach 钩子），
        // 这里只负责把计划套到实体与卡片状态上，不再判断"是不是哪种花瓣"。
        const detachAt = PetalFX.trait(card.type, 'detachAfter') || 0;
        const launchMode = PetalFX.trait(card.type, 'launchMode');
        const launchDelay = PetalFX.trait(card.type, 'launchDelay') || 0;
        let detachReady = this._detachReady();
        // 自动落地型（Wax）：加载好就脱轨，不需要 reach/detect ——
        // 它自己会在玩家旁边找位置（见 PetalFX 的 wax.detach）。
        // 【必须同时进入外层条件】只改 detachReady 没用：外层原本要求
        // detachAfter > 0 或 launchMode，Wax 两个都没有 -> 永远走不进脱轨分支。
        const autoDetach = !!PetalFX.trait(card.type, 'autoDetach');
        if (autoDetach) detachReady = true;
        if (launchMode) {
          body.launchModeT = this.mode === launchMode ? (body.launchModeT || 0) + dt : 0;
          // 【必须真的在 launchMode 里】才允许脱轨：launchDelay 默认 0，
          // 只判 launchModeT >= 0 的话，normal 模式下第一次同步就满足条件
          // —— 表现就是"没按空格导弹自己飞出去了"（Missile 的老 bug）。
          detachReady = (this.mode === launchMode) && body.launchModeT >= launchDelay;
        }
        if ((detachAt > 0 || launchMode || autoDetach) && !body.dead
          && body.age >= detachAt && detachReady) {
          // 把【当前轨道角】一并交给引擎：Missile 要沿"它此刻指向的方向"飞出去，
          // 而它可能刚生成（位置还在本体中心），光看坐标算不出方向。
          const plan = PetalFX.detach(body, this, mobs,
            this.spin + (body.spot || 0) * spotStep);
          // 落位型实体（Wax）判定"这块地方放不下"：销毁实体、该槽立刻重新装填，
          // 绝不把半块蜡塞进墙里（这是"生成空间不足就重新加载"的落点）。
          if (body.cancelSpawn) {
            body.dead = true;
            body.exitRot = this._petalExitRot(body);
            EntityFX.despawn(body);
            this.petalExit.adopt(body);
            this._petalGen[slotIndex] = gen + 1;
            this.reload[slotIndex] = { card, age: 0, dur: petalReloadOf(card) };
            continue;
          }
          body.stationary = true;                   // 脱离轨道：不再跟随
          body.life = 0;
          if (plan) {
            body.vx = plan.vx || 0;
            body.vy = plan.vy || 0;
          }
          bodies.push(body);                        // 仍然是实体，只是换了运动规则
          this._petalGen[slotIndex] = gen + 1;      // 本槽换代：下一批实体用新世代号
          // 卡面进入冷却：Pollen / Peas 立刻重新装填；Honey 等实体死亡（r.hold，见 _tickReload）
          const r = { card, age: 0, dur: petalReloadOf(card) };
          const hold = plan ? plan.holdReload : PetalFX.trait(card.type, 'holdReloadUntilDeath');
          if (hold) r.hold = true;
          this.reload[slotIndex] = r;
          continue;
        }
        bodies.push(body);
      }
    }
    // 已不在装备栏里的实体：转入退场（放大 + 渐隐）
    for (const b of this.petals) {
      if (b.stationary) continue;                  // 滞留实体由 ① 保留
      let kept = false;
      for (const nb of bodies) {
        if (nb.slotIndex === b.slotIndex && nb.card === b.card && nb.sub === b.sub && !nb.stationary) { kept = true; break; }
      }
      // 已碎的独立子体已在死亡时离场，这里不重复
      if (!kept && !b.exiting) {
        // 卸下 = 离场：必须 despawn 后再收养，否则实体既不计时也无法被回收
        b.exitRot = this._petalExitRot(b);
        EntityFX.despawn(b);
        this.petalExit.adopt(b);
      }
    }
    this.petals = bodies;
    // 统一步长：每片在场花瓣的 age / hurtT 只在这里推进一次；
    // 已碎的（dead）已经进 petalExit，退场计时由 petalExit.sweep 推进 —— 不重复计时。
    for (const b of this.petals) if (!b.dead) EntityFX.tickEntity(b, dt);

    // ---- 服务端花瓣战斗状态回填 ----
    // 客户端不跑战斗（战斗在服务端），所以花瓣的 hp / 受伤红闪 / 是否已碎
    // 全部由快照下发到这里。缺了这一步，服务端花瓣掉血碎掉而客户端毫无反应，
    // 外观上就是"花瓣永远不受伤、永远不会碎"。
    this._applyNetPetalStates();

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
    // 轨道半径用【标准半径】而不是 this.r：Soil 只让花朵本体变大，
    // 花瓣与人物的距离保持标准状况（否则 +10 半径会把整圈花瓣一起推远，看起来像整只放大了）。
    const baseReach = PLAYER_R_STD * (1 + PETAL_REACH) * 1.105;
    const dtc = Math.min(dt, 0.05);   // 弹簧积分步长上限（防掉帧时数值爆炸）
    // 吸附候选：先在玩家附近筛一遍（轨道半径 + 触发距离 + 余量），
    // 避免全图 1600+ 只生物时每片花瓣都扫全表。
    // 吸附有效范围：轨道半径 + 触发距离 + 3 个花瓣直径的余量。
    // （原来额外加 240px，导致"生物离玩家很远也算附近"，花瓣黏住后永远不松手。）
    const pullR = baseReach + PETAL_D * (PETAL_PULL_RANGE + 3);
    let nearMobs = null;
    // 只有存在活花瓣时才需要预筛：装填期间 petals 为空，整段扫描是纯浪费。
    // 距离判定用平方距，避免每帧数千次 sqrt（全图 4500+ 只，客户端与服务端各跑一遍）。
    if (mobs && mobs.length && this.petals.length) {
      nearMobs = [];
      for (const m of mobs) {
        if (!m || m.dead) continue;
        const dx = m.x - this.x, dy = m.y - this.y;
        const reach = pullR + (m.r || 0);
        if (dx * dx + dy * dy > reach * reach) continue;
        nearMobs.push(m);
      }
    }
    for (const b of this.petals) {
      if (b.dead) continue;         // 已碎实体：留在原位等重装填完成（不绘制、不运动）
      // 自转：独立于公转，从加载好起持续转动（喷射飞行的实体也照样转）
      if (!b.card.type.orientOutward && !b.anchor) {
        b.selfRot = (b.selfRot || 0) + this._petalSelfRate(b) * dtc;
      }

      // 滞留实体（Pollen / Honey）：脱离轨道后只用惯性滑行 -> 阻尼停住，
      // 不再跟随轨道、也不参与生物吸附（它就"放在地上"）。
      if (b.stationary) {
        const flight = PetalFX.flightOf(b);
        if (flight) {
          // 注意：b.life 已在上面的"滞留实体"循环（_syncPetals 开头）每帧 +dt，
          // 这里再加一次会让存活时长减半 —— 绝不重复累加。
          if (b.life >= (flight.life || PEAS_FLIGHT_T)) {
            // 到期：先让引擎做"落地"该做的事（Web 在这里原地张开大网），
            // 再走【通用移除接口】—— 小 web 实体因此照样有"渐大渐隐"的退场表现。
            PetalFX.onExpire(b, this);
            this._killPetalBody(b);
            continue;
          }
          // 飞行花瓣（Missile / Peas / Web）：按服务端下发的 vx/vy 匀速直飞，
          // 客户端与服务端速度口径一致，位置自然对齐，不再覆盖插值（避免 25Hz 快照
          // 导致的逐帧位置跳变 / 闪现）。无服务端数据时回退到本地惯性预测。
          if (flight.spinRate) b.flightSpin = (b.flightSpin || 0) + flight.spinRate * dtc;
          // inertia：与 Pollen 同款"阻尼滑行 -> 停住"（Web 落地前就是这样滑一小段），
          // 而不是 Peas 那种"匀速直飞"。
          if (flight.inertia) {
            b.vx = damp(b.vx || 0, 0, PETAL_DETACH_DRAG, dt);
            b.vy = damp(b.vy || 0, 0, PETAL_DETACH_DRAG, dt);
            if (Math.abs(b.vx) < 1 && Math.abs(b.vy) < 1) { b.vx = 0; b.vy = 0; }
          }
          if (b.vx || b.vy) this._resolvePetal(b, (b.vx || 0) * dtc, (b.vy || 0) * dtc);
          // 飞行朝向：声明了素材尖端角的花瓣（Missile）朝向【每帧由速度唯一决定】——
          // 不等快照、也不会因为被弹开/偏转而留下旧朝向（那就是"看起来在平移"）。
          if (b.flightRot != null && (b.vx || b.vy)) {
            const tip = (typeof PetalFX !== 'undefined') ? PetalFX.artTip(b.card && b.card.type) : null;
            if (tip != null) b.flightRot = Math.atan2(b.vy, b.vx) - tip;
          }
          continue;
        }
        // 落位型实体（Wax）：自己就"长"在原地，不采信服务端位置插值
        //（两端各自落点，插值反而会把它拽来拽去）。
        if (b.shape) {
          // 玩家阵营推蜡块：重量≈0（一碰就动），与服务端 4b 段同一口径、同一函数。
          // 位移必须过地形（physicsPushOnMap）：否则会被一路推进墙里。
          b.static = false; b.weight = 1e-4;
          if (typeof physicsPushOnMap === 'function') physicsPushOnMap(this, b, this._mapRef);
          else if (typeof physicsPushMob === 'function') physicsPushMob(this, b);
          continue;
        }
        // 服务端权威位置插值（25Hz 快照 -> 每帧）：这是"推动时一卡一卡"的主因，
        // 直接采信快照坐标就会按 25Hz 台阶跳。改为帧间线性插值，位移连续平滑。
        // 有权威位置时不再叠加本地惯性 —— 两者同时跑会互相打架，观感发"粘"。
        if (b.nToX != null) {
          b.nBlend = Math.min(1, (b.nBlend || 0) + dtc / SNAP_DT);
          b.x = b.nFromX + (b.nToX - b.nFromX) * b.nBlend;
          b.y = b.nFromY + (b.nToY - b.nFromY) * b.nBlend;
          continue;
        }
        if (b.vx == null) { b.vx = 0; b.vy = 0; }
        b.vx = damp(b.vx, 0, PETAL_DETACH_DRAG, dt);
        b.vy = damp(b.vy, 0, PETAL_DETACH_DRAG, dt);
        if (Math.abs(b.vx) < 1 && Math.abs(b.vy) < 1) { b.vx = 0; b.vy = 0; }
        if (b.vx || b.vy) this._resolvePetal(b, b.vx * dtc, b.vy * dtc);
        continue;
      }
      if (b.fxActive) continue;     // 特效驱动中（如玫瑰飞向主角）：位置由引擎接管
      // 逐个花瓣取倍率：标了 noReach 的花瓣（Rose / Peas）【不计算 reach 的延长】。
      // fixedReach（Peas）= 恒定使用某个模式的距离，不受当前模式的伸/缩幅度影响 ——
      // 它只结算模式的【特殊效果】（reach 的派生行为、detect 的判定），不再改轨道半径。
      const ptype = b.card && b.card.type;
      const noReach = !!(ptype && ptype.noReach);
      const fixed = ptype && ptype.fixedReach;
      const mult = (fixed === 'detect') ? PETAL_DETECT
        : (noReach ? Math.min(1, reachMult) : reachMult);
      // Third Eye 的 reach 加成：只在 reach 模式下生效，并按模式过渡量平滑放大，
      // 松开按键时同样平滑收回（modeT 回落到 0）。
      // 【reach 免疫的花瓣（Rose 等）连这份加成也不吃】—— 它们必须永远待在基础轨道距离上。
      // 之前只把倍率钳到 1、却照样加 reachBonus，表现就是"玫瑰还是被 reach 出去了，只是短一点"。
      const rb = noReach ? 0 : (this.reachBonus || 0) * (this.mode === 'reach' ? this.modeT : 0);
      const formationOffset = (ptype && ptype.formationOrbitOffset || 0) * PETAL_D;
      // orbitK：贴花系数（Missile 这类需要紧贴本体的花瓣），只缩放基础轨道半径，
      // 不吃 reach 加成（它本身也是 reach 免疫的）。
      const orbitK = (ptype && ptype.orbitK) || 1;
      // reachWave（Wing）：reach 模式下轨道距离在
      //   [正常reach距离, 正常reach距离 + spanK×天然reach距离]
      // 之间按三角函数平滑往复，period 秒一个周期。
      // 天然reach距离 = baseReach（未加任何附加效果的默认值）。
      // 用 modeT 做进出 reach 的收敛，退出时不会瞬移回基础距离。
      let waveAdd = 0;
      const wv = ptype && ptype.reachWave;
      if (wv) {
        if (this.mode === 'reach') {
          b._waveT = (b._waveT || 0) + dtc;
          waveAdd = baseReach * wv.spanK * (0.5 - 0.5 * Math.cos(b._waveT / wv.period * TAU));
        } else {
          b._waveT = 0;
        }
        waveAdd *= (this.mode === 'reach' ? 1 : 0) * (typeof this.modeT === 'number' ? this.modeT : 1);
      }
      const reach = baseReach * mult * orbitK + rb + formationOffset + waveAdd;
      const ang = this.spin + (b.spot || 0) * spotStep;
      let tx = this.x + Math.cos(ang) * reach;
      let ty = this.y + Math.sin(ang) * reach;
      // 尖端朝外（Missile 公转时）：尖端角同样只问 PetalFX，不在这里引特定素材的常量。
      if (b.card.type.orientOutward) {
        b.selfRot = ang - ((typeof PetalFX !== 'undefined' ? PetalFX.artTip(b.card.type) : null) || 0);
      }
      // 引擎钩子：花瓣可以微调自己的"应到位置"（Faster 的活泼飘动走这里）
      if (typeof PetalFX !== 'undefined' && PetalFX.orbitOffset) {
        if (!this._wob) this._wob = { x: 0, y: 0 };
        if (PetalFX.orbitOffset(b, this, dtc, this._wob)) {
          tx += this._wob.x; ty += this._wob.y;
        }
      }
      // 阵型偏移：整坨跟着同一个轨道位走，各子体再叠加【旋转到本瓣朝向】的布局偏移 ——
      // 于是它们恒保持卡面那一坨的形状（"被神秘力量锁定排列在一起"）。
      // 旋转基准取 R = ang + π/2，与单片花瓣自身的绘制朝向同一帧：
      // 这样世界里的排布 = 卡面排布整体旋转 R，与卡面严格同构。
      if (b.formArcBase) {
        const edge = 5 * (b.formD || PETAL_ENT_SIZE);
        const half = Math.asin(Math.min(1, edge / (2 * reach)));
        b.drawRot = ang + Math.PI / 2 + (b.formRot || 0);
        if (b.sub === 0) {
          const apexR = reach * Math.cos(half) + edge * Math.sqrt(3) / 2;
          tx = this.x + Math.cos(ang) * apexR;
          ty = this.y + Math.sin(ang) * apexR;
        } else {
          const side = b.sub === 1 ? -1 : 1;
          tx = this.x + Math.cos(ang + side * half) * reach;
          ty = this.y + Math.sin(ang + side * half) * reach;
        }
      } else if (b.formOff) {
        const R = ang + Math.PI / 2;
        // 绘制朝向也要【由阵型基准统一给出】：否则每个子体各自按自身位置算朝向，
        // Ultra Stinger 的"尖端朝向中心"会被各子体自己那点偏移带偏而失真。
        b.drawRot = R + (b.formRot || 0);
        const cR = Math.cos(R), sR = Math.sin(R);
        tx += b.formOff.x * cR - b.formOff.y * sR;
        ty += b.formOff.x * sR + b.formOff.y * cR;
      }

      // ---- 花瓣吸附（果冻感）----
      // 【sticky 花瓣才会被吸到生物表面】（数据见 data.js PETAL_TRAITS）。
      // 注意：吸附只管"往哪儿飞"，和碰撞无关 —— 所有花瓣都是实体、都会和生物分离并结算伤害，
      // 吸附只是让 sticky 花瓣主动贴上去揉搓（蜜的用法）。
      const sticky = !!(b.card && b.card.type && PetalFX.trait(b.card.type, 'sticky'));
      let gx = tx, gy = ty, K = PETAL_SPRING_K;
      let mob = sticky ? b.pullMob : null;
      if (!sticky && b.pullMob) b.pullMob = null;
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
      if (sticky && !mob && !(b.pullCd > 0) && nearMobs && nearMobs.length) {
        // 找"到轮廓的距离"最近、且在触发范围内的生物（按真实外形，不按外接圆）
        let best = null, bestEdge = PETAL_D * PETAL_PULL_RANGE;
        for (const m of nearMobs) {
          if (!m || m.dead) continue;
          const q = mobShapeNearest(m, b.x, b.y);
          if (q && q.dist <= bestEdge) { bestEdge = q.dist; best = m; }
        }
        if (best) { mob = best; b.pullD0 = orbitGap; b.pullT = 0; }
      }
      b.pullMob = mob;
      if (mob) {
        // 落点 = 轮廓上的最近点 + 外法线 × 轻微嵌入量。
        // 用轮廓而不是外接圆：凹处/细长处花瓣才不会悬在空气里（就是"飘一下"的来源）。
        const q = mobShapeNearest(mob, b.x, b.y);
        if (q) { gx = q.x + q.nx * (PETAL_R * 0.55); gy = q.y + q.ny * (PETAL_R * 0.55); }
        else { gx = mob.x; gy = mob.y; }   // 无外形时不吸附，落在生物中心附近
        K = PETAL_SPRING_K * PETAL_PULL_K;               // 吸附力远大于回轨力：吸上就难回来
      }

      // 欠阻尼弹簧：速度带惯性，离目标越远加速越大；
      // 模式切换 / 数量重排 / 急转向都表现为"甩一下再归位"的自然追赶
      if (b.vx == null) { b.vx = 0; b.vy = 0; }
      // ---- 公转解耦（重要）----
      // 轨道点是匀速公转的。若让弹簧直接追这个高速旋转的目标，显式积分误差会随角速度累积，
      // 稳态半径随转速漂移（表现为转速越高、reach 伸距越短）。
      // 解法：先把花瓣随轨道整体搬运同一角度（解析公转，零积分误差），弹簧只修残差；
      // 于是轨道半径严格等于 reach、与转速无关；
      // 玩家位移造成的拖尾感（故意保留的缓冲）仍然来自残差弹簧，手感不变。
      // 吸附（sticky）时目标是生物表面而不是轨道点，不做搬运。
      const dang = mob ? 0 : (this.rotMax || PETAL_SPIN) * ROT_SCALE * dtc;
      if (dang) {
        const cw = Math.cos(dang), sw = Math.sin(dang);
        const dxp = b.x - this.x, dyp = b.y - this.y;
        b.x = this.x + dxp * cw - dyp * sw;
        b.y = this.y + dxp * sw + dyp * cw;
        const v0x = b.vx, v0y = b.vy;
        b.vx = v0x * cw - v0y * sw;
        b.vy = v0x * sw + v0y * cw;
      }
      b.vx += (K * (gx - b.x) - PETAL_SPRING_D * b.vx) * dtc;
      b.vy += (K * (gy - b.y) - PETAL_SPRING_D * b.vy) * dtc;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > PETAL_MAX_SPEED) { const s = PETAL_MAX_SPEED / sp; b.vx *= s; b.vy *= s; }
      // 自由运动（花瓣是【实体】，与生物的分离见 _separatePetalFromMobs）
      this._resolvePetal(b, b.vx * dtc, b.vy * dtc);
      // 与生物做实体分离：花瓣不许和生物重合（碰撞的"花瓣一侧"）
      this._separatePetalFromMobs(b, nearMobs);
    }

    // 绘制直接读 this.petals（实体字段齐全），不再每帧复制一份 projection。
  }

  // 装备型花瓣（饰品）绘制：不进入轨道，固定贴在人物身上。
  // 版面（尺寸 / 头顶高度 / 下压量）统一在 sim/constants.js 的 ACC_* 里，默认实现与
  // 注册项共用同一套，避免"默认画一个尺寸、接管又画另一个尺寸"。
  _drawAccessories(ctx, R) {
    const list = this.accessories;
    if (!list || !list.length) return;
    for (const a of list) {
      // 引擎优先：注册项可以完全接管绘制（Third Eye 的可动眼珠就是自定义的）
      if (typeof PetalFX !== 'undefined' && PetalFX.drawAccessory
        && PetalFX.drawAccessory(ctx, a, this, R)) continue;
      // 默认实现：素材原样画在【额头】—— 不随朝向绕圈，普通饰品不需要写绘制代码。
      // 素材用【矢量】版（SVG <img>），任意尺寸都清晰；位图只作未就绪时的兜底。
      const svg = a.card.type.svg;
      const img = CardRenderer.artImage(svg) || CardRenderer.artCanvas(svg, 256);
      if (!img) continue;
      const size = R * ACC_ART_SIZE_K;
      const cx = this.x;
      const cy = this.y - R * ACC_ART_LIFT_K + size * ACC_ART_DROP_K;
      drawPetalArt(ctx, img, size, cx, cy, 0, 1, 1);
      // 可动部件（如果这张花瓣声明了的话）由引擎统一补画，默认实现不必知道细节。
      // box = 画出的矩形 + 它覆盖的素材窗口（引擎据此把素材坐标换成像素）。
      const win = CardRenderer.entityWindow(svg);
      if (win && typeof PetalFX !== 'undefined' && PetalFX.artOverlay) {
        PetalFX.artOverlay(ctx, svg, this.facing, {
          x: cx - size / 2, y: cy - size / 2, w: size, h: size,
          ux: win[0], uy: win[1], uw: win[2], uh: win[3]
        });
      }
    }
  }

  // 场地型实体（网）绘制：地面层 —— 在【掉落物与生物之下】（由 game.render 调用），半透明。
  // 网只有一个来源：服务端下发的 netWebs（玩家网 + 蜘蛛网合并成一张表）。
  // 入场弹出与到期退场都在这张表里走 EntityFX，这里只负责画。
  drawWebs(ctx) {
    if (!this.netWebs || !this.netWebs.length) return;
    const img = (typeof PetalFX !== 'undefined' && PetalFX.netImage) ? PetalFX.netImage() : null;
    drawWebList(ctx, this.netWebs, img);
  }

  // 画一片花瓣实体：入场/退场/红闪统一由 EntityFX 施加，paint 里只画局部坐标 (0,0)。
  // exitMode = true 时使用离场那一刻定格的朝向（旧幽灵就是"相对主角的方向"）。
  _drawPetalEntity(ctx, b, exitMode) {
    if (!b) return;
    const svg = b.svg || (b.card && b.card.type ? b.card.type.svg : null) || null;
    // 绘制直径：与卡面同一套比例（素材窗口 / Basic 参考窗口）。
    // 窗口尺寸由素材实测得出（素材未就绪前拿不到），所以下面在【拿到画布之后】再取值。
    const entSize = () => ((b.artSize != null) ? b.artSize
      : ((typeof CardRenderer !== 'undefined' && CardRenderer.entityArtSize)
        ? CardRenderer.entityArtSize(svg, PETAL_ENT_SIZE) : PETAL_ENT_SIZE));
    if (b.anchor) {
      // 落位型实体（Wax）：直径 = 2×radius、不旋转、按自己的外形闪红
      EntityFX.draw(ctx, b, (c) => {
        const img = svg ? (CardRenderer.artImage(svg) || CardRenderer.artCanvas(svg, 256)) : null;
        if (img) drawPetalArt(c, img, entSize(), 0, 0, 0, 1, null);
        EntityFX.drawHurtPoly(c, b, 0, 0, b.shapePoly, (b.cr || PETAL_R));
      });
      return;
    }
    let rot;
    if (exitMode && b.exitRot != null) {
      rot = b.exitRot;
    } else if (b.fxActive) {
      // 特效驱动中（玫瑰飞向主角）：朝向沿用"由花心指向花瓣"的旧口径
      rot = Math.atan2(b.y - this.y, b.x - this.x) + Math.PI / 2;
    } else if (b.flightRot != null) {
      rot = b.flightRot + (b.flightSpin || 0);
    } else {
      rot = (b.stationary ? 0 : (b.drawRot != null ? b.drawRot : 0)) + (b.selfRot || 0);
    }
    const so = b.card && b.card.type ? b.card.type.spinOrigin : null;
    EntityFX.draw(ctx, b, (c) => {
      const cv = svg ? CardRenderer.artCanvas(svg, 128) : null;
      // 拿到画布 = 素材已就绪 => 实体窗口也已实测出来，尺寸可以取准。
      const size = entSize();
      const artSize = size * (b.formK != null ? b.formK : 1);
      const ox = so ? so.x : 0, oy = so ? so.y : 0;
      if (cv) drawPetalArt(c, cv, artSize, 0, 0, rot, 1, null, ox, oy);
      // 花瓣受伤红闪 = 【贴图自己的形状】（用户口径：跟随形状，不是一个圆）：
      // 用同一张素材染红后的剪影、同一个变换（含 spinOrigin 轴心偏移）叠上去，
      // 所以任何形状（导弹的长条、翅膀的弯月、多体子瓣）都严丝合缝。
      // 素材还没就绪时退回碰撞半径圆（PETAL_R），保证任何时候都有受击反馈。
      const hurtA = EntityFX.hurtAlpha(b);
      if (!(hurtA > 0)) return;
      const red = svg ? CardRenderer.redArtCanvas(svg) : null;
      if (red) {
        // drawArt 会【赋值】globalAlpha，这里把实体自身的入场/退场透明度乘进去
        drawPetalArt(c, red, artSize, 0, 0, rot, 1, c.globalAlpha * hurtA, ox, oy);
      } else {
        EntityFX.drawHurtShape(c, b, 0, 0, b.shapePoly || null, b.cr || 0, b.cr || PETAL_R);
      }
    });
  }

  // 图层高于生物的花瓣（Glass）：Player.draw 里跳过它们，由 game.render 在生物与
  // 主角都画完之后调用这里补一遍 —— 于是它们永远压在所有生物之上（与生物一样高）。
  // 遁地阴影：与主人物【完全相同大小】的灰色半透明纯色圆（无渐变、无描边），
  // 画在【所有实体之下】（见 game.render）。
  // 遁地期间本体完全不画（Player.draw 直接 return），所以画面里只剩这一个圆。
  drawBurrowShadow(ctx) {
    if (!(this.burrowT > 0) || this.dead) return;
    const R = this.r * 1.2 * EntityFX.pop(this.age);   // 与脸部半径同一口径（R = r × 1.2）
    if (!(R > 0)) return;
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#3a3f43';
    ctx.beginPath();
    ctx.arc(this.x, this.y, R, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawOverMobs(ctx) {
    if (this.dead || this.burrowT > 0) return;
    for (const b of this.petals) {
      if (b.dead || b.fxActive) continue;
      const t = b.card && b.card.type;
      if (t && t.overMobs) this._drawPetalEntity(ctx, b, false);
    }
  }

  draw(ctx) {
    // 遁地：本体完全不可见（只剩 game.render 在最底层画的那片阴影）
    if (this.burrowT > 0) return;
    // 死亡：先播完花瓣退场（渐隐），再画死亡本体（随机角度 + 叉叉眼 + 哭脸）
    if (this.dead) {
      for (const b of this.petalExit) this._drawPetalEntity(ctx, b, true);
      this._drawDeadBody(ctx);
      return;
    }
    // 花瓣实体：入场/退场统一由 EntityFX 施加（特效驱动的延后到主角之后再画）
    for (const b of this.petals) {
      if (b.fxActive || b.dead) continue;
      // 图层在生物之上的花瓣（Glass）留给 drawOverMobs，不在这一层画
      if (b.card && b.card.type && b.card.type.overMobs) continue;
      this._drawPetalEntity(ctx, b, false);
    }
    // 被卸下/移除/碎裂的花瓣：留原地播放通用退场（放大 + 渐隐），播完由 petalExit 回收。
    for (const b of this.petalExit) this._drawPetalEntity(ctx, b, true);

    // 主角：黄色笑脸（整体固定正放，不随朝向旋转；只有眼睛里的白色随移动方向偏移）。
    // 半径乘 EntityFX.pop：出生/重生时 Q 弹弹出（过冲回落），五官全按 R 缩放同步跟随。
    const R = this.r * 1.2 * EntityFX.pop(this.age);   // 脸部半径
    // 中毒：整张脸平滑过渡到淡紫（描边同步），嘴平滑过渡到哭脸 —— 见下方 mood/bulge。
    const pf = clamp(this.poisonFx || 0, 0, 1);
    const FACE_FILL = lerpHex('#fae26a', '#d9bce8', pf);
    const FACE_LINE = lerpHex('#dfbc4e', '#a882c6', pf);
    ctx.save();
    // 脸
    ctx.fillStyle = FACE_FILL;            // 正常：介于改前(#f7db45)与改后(#fce98e)之间
    ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.fill();
    ctx.lineWidth = R * 0.085;   // 等比缩放（去下限，保证描边随脸同步缩小）
    ctx.strokeStyle = FACE_LINE;          // 描边：能看清，又不过分跳
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
        ctx.fillStyle = FACE_FILL;
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
    // 正=向下鼓(笑)，0=直线，负=向上鼓(哭)；中毒强度平滑推进哭脸（与模式取更"哭"的那个）
    const mood = Math.min(1, Math.max(this.modeT, pf));
    const bulge = R * 0.1133 * (1 - 2 * mood);
    ctx.beginPath();
    ctx.moveTo(this.x - mHw, mY);
    ctx.quadraticCurveTo(this.x, mY + 2 * bulge, this.x + mHw, mY);
    ctx.stroke();
    ctx.restore();

    // 装备型饰品（Third Eye 等）：贴在【朝向那侧的额头】上，随朝向绕本体移动并自转。
    this._drawAccessories(ctx, R);

    // 受伤红色滤镜：时长与曲线来自实体引擎，只有"花朵本体比花瓣淡一点"这一处自带强度。
    // 花朵本体的碰撞箱就是一个圆（R），所以红闪也是这个圆
    EntityFX.drawHurtShape(ctx, this, this.x, this.y, null, 0, R, PLAYER_HURT_A);
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
    for (const b of this.petals) {
      if (!b.fxActive || b.dead) continue;
      this._drawPetalEntity(ctx, b, false);
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
    const rk = Math.min(1, this.corpseT / 0.35);
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
// 主角绘制半径 = r×1.2 = 13.2×1.2 = 15.84 → 视觉直径 31.68。
// common→mythic 按 5 级等比变化：step = (mythic 倍率 / common 倍率)^(1/5) ≈ 1.4118，
// ultra / super / eternal 顺势等比。
