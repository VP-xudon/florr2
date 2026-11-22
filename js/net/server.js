// net/server.js — LocalServer：权威模拟世界（无 DOM / Canvas 依赖）
'use strict';

// 一步之内跑哪些系统、按什么顺序 —— 唯一的步进声明。
// 想加一步：在这里加名字 + 写一个同名的 sysXxx(dt) 方法。
const STEP_SYSTEMS = [
  'sysPlayer',      // 玩家权威副本 / 检查点 / 召唤物跟随 / 多体卡重装填
  'sysMobs',        // 醒睡分区 + AI + 移动 + 退场回收 + 弹体（建 this._awake）
  'sysSpawn',       // 按生成表维持人口
  'sysPush',        // 玩家↔生物 / 生物↔生物 / Wax / 召唤物 的推挤与硬碰撞
  'sysCombat',      // 固定 25 tick/s 的战斗结算
  'sysChains',      // 多节生物刚性粘合 + 把玩家顶出链体（必须在所有改坐标的步骤之后）
  'sysFields',      // 场地实体（网）状态与寿命
  'sysMobTraits',   // 生物特性（Bumble Bee 产 Pollen）
];

class LocalServer {
  constructor() {
    this.t = 0;                 // 服务端累计时间（秒）
    this._idSeq = 1;            // 全局单调实体 id（生物 / 网 / 子实体全部从这里取）
    this.ents = [];             // 权威 Mob 实体（只增不减由 cull 负责）
    this.fields = createEntitySet('web', () => this.nextEntityId());   // 场地型实体单源：玩家网 + 敌方蛛网合并一张表
    this.hornetProjectiles = new Map(); // 已发射的独立 Hornet 导弹，不随母体回收（Map<id, projectile>）
    this.player = null;         // 玩家权威副本（跑同一套物理，供战斗定位）
    this.map = null;            // 碰撞地图（与客户端同一份）
    this._input = { dx: 0, dy: 0, mode: 'normal' };
    // 客户端上报的可视半径（世界 px，见 applyInput）：醒/睡范围只认它 + MOB_ACTIVE_PAD。
    // 客户端一帧都还没上报时用 MOB_ACTIVE_R 兜底（旧口径，等价于"看不看得见都先醒着"）。
    this.viewR = MOB_ACTIVE_R;
    this._events = [];          // 待投递事件（聊天、系统私信）
    // 背包权威：type.key|rarity -> 数量。客户端 _gc 只是它的镜像，
    // 任何增减都必须经 invRequest，插件改本地镜像改不到这里。
    this.inventory = Object.create(null);
    this._debugInv = false;
    // 已扣下、等待合成的装载材料（key + 数量）。客户端不能自带数量，
    // craft 只能消费这份服务端记录，避免"装载不扣/重复扣/伪造数量"。
    this.pendingCraft = null;
    // 已合成但玩家还没"拿下来"的成品：拿下/被替下之前不计入 inventory，
    // 所以背包与合成列表都不会提前显示结果，也无法在客户端提前读到。
    this.pendingResult = null;
    this._combatAcc = 0;
    this._started = false;
    this._inited = false;      // 是否已按生成表初始化过（每张地图只自动跑一次）
    // 复活点（检查点）状态，见 _ensureCheckpoints
    this.cpOf = null;          // 当前绑定的 checkpoints 数组（换图时重算）
    this.cpMax = -1;           // 走到过的最远检查点下标
    this.cpIdx = 0;            // 当前复活点下标
    this.cpStays = CP_RESPAWN_STAYS;
    this.cpAcc = 0;
  }

  // 绑定地图与玩家副本；客户端在 init 后调用一次。
  // 调用方必须先把 ?hp=N 等调试参数应用到 playerTemplate：
  // 客户端每帧会用快照的 hp 覆盖自己，服务端副本的初始血量必须与之一致。
  attach(map, playerTemplate) {
    this.map = map;
    // 权威玩家副本：复用 Player 类（移动 + 花瓣 + 装填全都在），
    // 这样战斗判定用的是与服务端完全一致的物理，不需要另写一套。
    this.player = new Player();
    const p = this.player;
    p.slots = playerTemplate.slots;
    p.name = playerTemplate.name;
    // 血量相关全部从模板继承（maxHp/hp 与血条平滑值）。
    // 非有限数一律拒绝：Infinity/NaN 灌进权威副本后，战斗、平滑血条、快照都会一路 NaN。
    p.maxHp = (Number.isFinite(playerTemplate.maxHp) && playerTemplate.maxHp > 0)
      ? playerTemplate.maxHp : FLOWER_BASE_HP;
    p.hp = Number.isFinite(playerTemplate.hp) ? Math.min(playerTemplate.hp, p.maxHp) : p.maxHp;
    // Soil 的生命上限加成以【模板上限】为基准（权威副本与客户端同口径）
    p.baseMaxHp = p.maxHp;
    p.recompute();
    // 出生状态统一走 Player.resetForSpawn：出生无敌 + 花瓣实体/世代号/装填 与客户端同源。
    // 少了出生无敌时，服务端副本从第 0 帧起就能被打 -> 客户端被快照置为 dead -> 一碰就死。
    p.resetForSpawn(playerTemplate);
    p.webSink = this.fields;        // 玩家生成的网（Web 花瓣）统一进 server.fields（场级实体单源）
    // 调试模式给一张"取之不尽"的库存（用大数代替 Infinity，保证可 JSON 序列化）。
    this._debugInv = !!(typeof window !== 'undefined' && window.__debug);
    const sk = (typeof STARTER_INV_KEY !== 'undefined') ? STARTER_INV_KEY : null;
    if (sk && !(sk in this.inventory)) this.inventory[sk] = 1;
    this._slotSig = '';
    // 地图/玩家就位后立刻按生成表把全图铺满（等价于 /init <map>），避免开局空场
    this.spawnT = 0;
    this._autoInit();
  }

  // 客户端装备发生变化时把最新 slots 同步给权威副本（按签名去重，避免每帧 recompute）
  syncLoadout(slots, hold) {
    const p = this.player;
    if (!p || !slots) return;
    // 换卡动画期间的"装填暂停"是客户端表现层状态，必须上行同步给权威副本，
    // 否则两端装填进度不一致。
    if (hold && p.reloadHold) {
      if (p.reloadHold.length !== hold.length) p.reloadHold = hold.slice();
      else for (let i = 0; i < hold.length; i++) p.reloadHold[i] = !!hold[i];
    }
    const sig = slots.map((c) => (c ? c.type.key + c.rarity : '-')).join(',');
    if (sig === this._slotSig) return;
    this._slotSig = sig;
    p.slots = slots;
    p.recompute();
  }

  start() {
    if (this._started) return;
    this._started = true;
    // 用【地图自带生成表】初始化生物；connect() 先于 attach()，
    // 谁先就位由 _autoInit 自己判断，两处都调用也不会重复初始化。
    this.spawnT = 0;
    this._autoInit();
  }

  // 默认初始化：服务器（含本地模拟服务器）一就位就按生成表铺一遍，
  // 之后交给 spawnOne 维持。地图或玩家还没绑定就跳过，等另一侧就位时再触发。
  _autoInit() {
    if (this._inited || !this.map || !this.player) return false;
    const res = this.initMap();
    this._inited = true;
    if (res && res.ok) {
      console.info('[spawn] init ' + (this.map.name || 'map') + ': ' + res.spawned +
        '/' + res.total + ' mobs, alive=' + this.aliveMobs());
    }
    return !!(res && res.ok);
  }

  applyInput(input) {
    this._input = input;
    // 视野半径是"客户端知道、服务端不知道"的信息（窗口大小 + 相机缩放 + 相机偏移），
    // 所以由客户端每帧上报。非法值忽略，绝不把醒/睡半径写成 NaN。
    if (input && Number.isFinite(input.viewR) && input.viewR > 0) this.viewR = input.viewR;
  }

  requestRespawn() {
    const p = this.player;
    if (!p) return null;
    const pos = this._respawnPos();
    // 统一重置：与客户端 Game.respawn 调用同一个方法，字段清单只有一份
    p.resetForSpawn(pos);
    for (const m of this.ents) if (m.threat) m.threat.length = 0;   // 重生后仇恨豁免
    // 客户端要跟着把预测副本搬到同一个点（否则会被下一帧快照硬拽过去）
    this._events.push({ kind: 'respawned', x: pos.x, y: pos.y, cp: pos.idx });
    return pos;
  }

  // ---------------- 复活点（地图 checkpoints 区域） ----------------
  // 地图顺序 = (level 升序, 距原点升序)，也就是由近及远的推进顺序。
  // 复活点是【检查点】（走过就记住位置），不是可"收集"的东西 —— 所以：
  //   · 只有"走到过更远的检查点"才会改变复活策略，而且全程【不弹任何提示】
  //   · 走到更远的检查点 -> 复活点重置为"它的上一个"，并【强制重新保底 3 次】
  //   · 复活落在当前复活点；在该点满 3 次后重新结算：往前推一个（最多推到最远到访点）
  _ensureCheckpoints() {
    const cps = (this.map && this.map.checkpoints) || [];
    if (this.cpOf === cps) return;
    this.cpOf = cps;
    this.cpMax = -1;                        // 走到过的最远检查点下标（-1 = 还没到过）
    this.cpIdx = 0;                         // 当前使用的复活点下标
    this.cpStays = CP_RESPAWN_STAYS;        // 当前复活点还剩几次保底
    this.cpAcc = 0;
  }

  _checkCheckpoints() {
    this._ensureCheckpoints();
    const p = this.player;
    if (!p || p.dead || !this.map || !this.map.checkpointAt) return;
    const i = this.map.checkpointAt(p.x, p.y);
    if (i < 0 || i <= this.cpMax) return;   // 没走进更远的检查点：什么都不做
    this.cpMax = i;
    this.cpIdx = Math.max(0, i - 1);        // "最远检查点的上一个"
    this.cpStays = CP_RESPAWN_STAYS;        // 更远 -> 强制重新保底 3 次
  }

  _respawnPos() {
    this._ensureCheckpoints();
    const cps = (this.map && this.map.checkpoints) || [];
    if (!cps.length) return { x: 0, y: 0, idx: -1 };
    // 站立半径按玩家本体：复活点必须是"整个人站得下"的位置，而不是只有一个空点。
    const pr = (this.player && this.player.r) ? this.player.r : 22;
    if (this.cpMax < 0) {
      // 还没走到过任何检查点：就在【等级最低的那个复活区域】里随机复活（不固定回原点 0,0）
      const base = this.map.checkpointSpawnPoint ? this.map.checkpointSpawnPoint(cps[0], pr) : { x: 0, y: 0 };
      return { x: base.x, y: base.y, idx: 0 };
    }
    if (this.cpStays <= 0) {                // 保底用完 -> 重新结算复活点
      this.cpIdx = Math.min(this.cpIdx + 1, this.cpMax);
      this.cpStays = CP_RESPAWN_STAYS;
    }
    this.cpStays--;
    const cp = cps[Math.min(this.cpIdx, cps.length - 1)];
    // 复活落地：整片检查点区域内【随机】一个能站人的位置（不再固定区域中心）
    const pos = this.map.checkpointSpawnPoint ? this.map.checkpointSpawnPoint(cp, pr) : { x: 0, y: 0 };
    return { x: pos.x, y: pos.y, idx: this.cpIdx };
  }

  // /tp 确认后调用：只有"真正能站人"的坐标才传送，否则返回错误文案键（不挪人）。
  teleport(x, y) {
    const p = this.player;
    if (!p || !this.map) return 'Chat/CommandError/InternalError';
    const fx = Number(x), fy = Number(y);
    if (!isFinite(fx) || !isFinite(fy)) return 'Chat/Command/tp/Usage';
    if (this.map.isInside && !this.map.isInside(fx, fy)) return 'Chat/Command/tp/Blocked';
    if (this.map.solidAtPoint && this.map.solidAtPoint(fx, fy)) return 'Chat/Command/tp/Blocked';
    // 半径内压墙也算"到不了"：collide 会把圆心推开，推得明显就说明目标位置嵌在墙里
    // （map.collide 返回的是 [x, y] 数组，不是对象）
    if (this.map.canStandAt && !this.map.canStandAt(fx, fy, p.r || 22)) {
      return 'Chat/Command/tp/Blocked';
    }
    p.x = fx; p.y = fy; p.vx = 0; p.vy = 0;
    if (p.petals) for (const b of p.petals) { b.x = fx; b.y = fy; b.vx = 0; b.vy = 0; }
    this._events.push({ kind: 'teleported', x: fx, y: fy });
    return null;
  }

  // ---------------- 醒/睡分区 ----------------
  // 权威列表 this.ents 是【全图人口】（要进快照给小地图看），只有玩家【看得见】的个体
  // 需要跑 AI/物理。拆成两张表：_act（醒着）/ _rest（睡着）。
  //   · 半径 = 客户端上报的视野半径 + MOB_ACTIVE_PAD（见 activeR）——
  //     不是固定常量：Antennae 拉远镜头后视野里的生物必须继续算 AI；
  //   · 每步只遍历 _act；
  //   · _rest 每 0.2s 扫一次，把够近的叫醒（_wakeNearby）；
  //   · 数量对不上时自动重建（_rebuildPartition）—— 兜住"外部直接往 ents 塞个体"。
  // 当前醒/睡半径（px）：视野半径 + 余量，钳下限。
  activeR() {
    const v = Number.isFinite(this.viewR) ? this.viewR : MOB_ACTIVE_R;
    return Math.max(MOB_ACTIVE_MIN, v + MOB_ACTIVE_PAD);
  }

  // 单只生物"是否醒着"的【唯一判据】（分区 / 周期唤醒 / 每步休眠都读它）。
  //   · 死掉的个体必须留在醒着：退场动画还要继续推进（EntityFX.tickEntity）；
  //   · 多节生物按【整条链】判定：锚点取链头，半径加上整条链长 ——
  //     否则链尾进视野时链头还在睡，_solveChains 没有头可解，那半条链会僵在原地。
  _isAwake(m, p, R) {
    if (m.dead) return true;
    const head = (m._head && !m._head.dead) ? m._head : m;
    const lim = R + (head._chainLen || 0);
    return dist2(head.x, head.y, p.x, p.y) <= lim * lim;
  }

  _rebuildPartition() {
    const act = this._act || (this._act = []);
    const rest = this._rest || (this._rest = []);
    act.length = 0; rest.length = 0;
    const p = this.player;
    if (!p) return;
    const R = this.activeR();
    for (const m of this.ents) {
      if (this._isAwake(m, p, R)) act.push(m);
      else rest.push(m);
    }
  }

  _wakeNearby() {
    const rest = this._rest, act = this._act;
    const p = this.player;
    if (!p || !rest) return;
    const R = this.activeR();
    let n = 0;
    for (let i = 0; i < rest.length; i++) {
      const m = rest[i];
      if (this._isAwake(m, p, R)) { act.push(m); continue; }
      rest[n++] = m;
    }
    rest.length = n;
  }

  _tickHornetProjectiles(dt) {
    const map = this.hornetProjectiles;
    for (const [id, projectile] of map) {
      // 入场/红闪/退场全部交给实体引擎：弹体也是实体，没有第二套计时。
      if (!projectile.exiting) {
        EntityFX.tickEntity(projectile, dt);
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.life -= dt;
        if (projectile.life <= 0) EntityFX.despawn(projectile);
      } else {
        EntityFX.tickEntity(projectile, dt);
        if (EntityFX.done(projectile)) map.delete(id);
      }
    }
  }

  // 全局单调实体 id：生物、网、子实体（花苞/召唤物）都从这里取，客户端只按 id 对齐。
  // 唯一的例外是 Hornet 导弹：它是母体的子实体，id = 父 id + 序号（两端各自可复现），
  // 见 MobFX 的 createMissile —— 子实体不进世界人口表，不需要全局唯一。
  nextEntityId() { return this._idSeq++; }

  // 新个体登记：同时进权威列表与醒/睡分区（否则它会一直不跑 AI，看起来像木桩）。
  _addEnt(m) {
    this.ents.push(m); // Add entity to the list
    (this._act || (this._act = [])).push(m);
    return m;
  }

  // ---------------- 生物生成（按地图生成表，服务端全局管理） ----------------
  // 生成表是【地图/服务端数据】，不围绕玩家转：
  //   · 每个 spawn_mobs 区有自己的目标数量 = 面积(格) × density × SPAWN_PER_TILE（单区封顶）
  //   · 全图总和超过 GLOBAL_MAX_MOBS 时按比例缩减（保持各区相对比例）
  //   · /init <map> 一次性把全图补到目标；之后每 SPAWN_INTERVAL 秒补最缺的那一只
  //   · 稀有度由该区 difficulty 决定；位置在区多边形内随机（不挑玩家附近）
  //   · 远处生物休眠（只保留位置，不跑 AI），所以全图人口不等于全图负载
  aliveMobs() {
    let n = 0;
    for (const m of this.ents) if (!m.dead && !m.isSubEntity) n++;
    return n;
  }

  _zoneCount(zone) {
    let n = 0;
    for (const m of this.ents) if (!m.dead && m.spawnZone === zone) n++;
    return n;
  }

  // 生成表 -> Map(zone -> 目标数量)；总和超过全局上限时等比缩减。
  // 【密度口径：只按"总只数"算】—— 每个区只算一个总数，物种用权重【挑】（见 _pickSpawnType），
  // 一次生成只出一条。所以一个区里写 1 个物种还是 10 个物种，总密度完全一样，
  // 只是构成比例不同。以后扩表也不会把密度顶飞。
  zoneTargets() {
    const zones = (this.map && this.map.spawnZones) || [];
    const raw = [];
    let sum = 0;
    for (const z of zones) {
      // 生成表里写的全是我们还没实现的物种（rock / ant_hole / ant_soldier …）：
      // 这个区不参与人口分配，也不会退回默认物种（否则石头区里会长出瓢虫）。
      if (z._noSpawn === undefined) {
        z._noSpawn = !!String(z.mobs || '').trim() && parseSpawnMobs(z.mobs).length === 0;
      }
      if (z._noSpawn) continue;
      const tiles = z.area / (GARDEN_TILE * GARDEN_TILE);
      let want = Math.round(tiles * z.density * SPAWN_PER_TILE);
      want = clamp(want, 0, PER_ZONE_MAX);
      raw.push([z, want]);
      sum += want;
    }
    const out = new Map();
    const k = (sum > GLOBAL_MAX_MOBS) ? (GLOBAL_MAX_MOBS / sum) : 1;
    let total = 0;
    for (const [z, want] of raw) {
      const v = (k === 1) ? want : Math.round(want * k);
      out.set(z, v);
      total += v;
    }
    return { map: out, total };
  }

  // 从该区的物种权重里【挑一个】—— 注意不是"每个物种各生成一批"，
  // 否则密度会随物种数量线性膨胀（这正是要保持不变的东西）。
  _pickSpawnType(zone) {
    if (zone && zone._noSpawn) return null;      // 全是不存在的物种：这个区不刷怪
    const list = zone ? parseSpawnMobs(zone.mobs) : [];
    if (!list.length) {
      const t = MOB_TYPES.find((m) => m.slug === DEFAULT_SPAWN_SLUG) || MOB_TYPES[0] || null;
      return t ? { type: t, weight: 1 } : null;
    }
    let total = 0;
    for (const it of list) total += it.weight;
    let r = Math.random() * total;
    for (const it of list) { if ((r -= it.weight) <= 0) return it; }
    return list[list.length - 1];
  }

  // 在指定区里取一个生成点（全区随机；不落在玩家 180px 内，避免刷脸）
  // 尝试次数刻意压小：取不到点说明这个区全是墙（地图里确实有这样的区），
  // 由 _spawnInZone 记冷却，避免每 0.1s 重试几万次采样。
  _zoneSpawnPoint(zone) {
    const p = this.player;
    let first = null;
    for (let i = 0; i < 8; i++) {
      const pos = this.map.randomPointInZone
        ? this.map.randomPointInZone(zone)
        : null;
      if (!pos) continue;
      // 减速瓦片是生物的禁区：不在这里生成（玩家能进，生物不能进/不能站）
      if (this.map.mobBlockedAt && this.map.mobBlockedAt(pos[0], pos[1], 24)) continue;
      if (!first) first = pos;
      if (!p || dist(pos[0], pos[1], p.x, p.y) > 180) return pos;
    }
    // 退而求其次的那个点也必须是"生物站得住"的
    if (first && this.map.mobBlockedAt && this.map.mobBlockedAt(first[0], first[1], 24)) return null;
    // 8 次都落在玩家 180px 内（人就站在这个区的中间）：退而求其次也要生成，
    // 否则这个区会白白进入 5s 冷却，越打越空。
    return first;
  }

  // 玩家当前的幸运加成：所有【活着】的 Clover 花瓣实体各给一份（可叠加）。
  // 只在生成生物时读一次，不进每帧循环。
  _playerLuck() {
    const p = this.player;
    if (!p || !p.petals) return 0;
    let sum = 0;
    for (const b of p.petals) {
      if (!b || b.dead || !b.card) continue;
      const st = petalStatsFor(b.card.type, b.card.rarity);
      if (st.luck) sum += st.luck;
    }
    return sum;
  }

  // 某点的环境幸运值 = 基准 LUCK_BASE，玩家 CLOVER_LUCK_R 内叠加 Clover 加成，上限 LUCK_MAX。
  _ambientLuck(x, y) {
    const p = this.player;
    let luck = LUCK_BASE;
    if (p && !p.dead) {
      const dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy <= CLOVER_LUCK_R * CLOVER_LUCK_R) luck += this._playerLuck();
    }
    return Math.min(luck, LUCK_MAX);
  }

  // 自然生成的稀有度：难度掷骰 -> 按环境幸运值升/降级 -> 封顶 super（Eternal 永不自然生成）
  _rollSpawnRarity(x, y, diff) {
    return applyLuckToRarity(rollMobRarityByDifficulty(diff), this._ambientLuck(x, y));
  }

  // "这个点放得下这只生物吗" —— 【自然生成贴墙判定的唯一入口】（与移动同一口径）：
  //   · mobBlockedAt：减速瓦片对生物来说就是墙；
  //   · canStandAt：点本身及其半径内不压墙（含瓦片碰撞多边形），比只看一个点准确。
  // 半径用 min(r, 1 格行走上限)：轮廓没建好时 r 是视觉外接半径，会大出一大截。
  _canSpawnAt(x, y, r) {
    const map = this.map;
    if (!map) return true;
    const rad = Math.max(2, Math.min(r || 24, MOB_WALK_LIMIT_R));
    if (map.mobBlockedAt && map.mobBlockedAt(x, y, rad)) return false;
    if (typeof map.canStandAt === 'function') return map.canStandAt(x, y, rad);
    if (map.solidAtPoint && map.solidAtPoint(x, y)) return false;
    return true;
  }

  // 在某个区里生成一只（内部用）。forcedType = 结构型保底时强制指定物种。
  _spawnInZone(zone, forcedType) {
    const pick = forcedType ? { type: forcedType, weight: 1 } : this._pickSpawnType(zone);
    if (!pick || !pick.type) return false;
    const pos = this._zoneSpawnPoint(zone);
    if (!pos) {
      // 该区取不到可站立点（整块是墙）：冷却 5s，别在这儿空转
      if (zone) zone.nextTry = (this.t || 0) + 5;
      return false;
    }
    const rarity = this._rollSpawnRarity(pos[0], pos[1], zone ? zone.difficulty : 0);
    // 多节生物（蜈蚣）：一次生成【一整条】，而不是一只（尾部压墙会就地截断）
    if (isSegmentMob(pick.type)) {
      return this._spawnChain(pick.type, pos[0], pos[1], rarity, zone) > 0;
    }
    const m = new Mob(pick.type, pos[0], pos[1], 1, rarity);
    m.x = pos[0]; m.y = pos[1];
    // 轮廓先建：贴墙判定要用【真实碰撞半径】（walkR），不能拿视觉外接半径去判。
    m._ensureShape();
    if (!this._canSpawnAt(pos[0], pos[1], m.r)) {
      // 这个落点站不住（墙 / 减速瓦片压住了半个身子）：不给这个区记长冷却，
      // 2s 后换一个点再试 —— 记 5s 会让整片区域越来越少怪。
      if (zone) zone.nextTry = (this.t || 0) + 2;
      return false;
    }
    m.spawnZone = zone || null;
    m.netId = this.nextEntityId();
    this._addEnt(m);
    this._announceBossSpawn(m);          // super / eternal 才真的播（内部判）
    return true;
  }

  // 多节生物（蜈蚣）：一次生成【一整条】——
  //   · 节数按稀有度【递减】（数据表 MOB_TRAITS.centipede.segCount）：
  //     common 8~15 -> … -> super / eternal 3~5（越高等级越短）
  //   · 【自然生成】只有 common 才有 0.3% 概率长成超长个体（45~60 节）
  //   · /summon 可以显式指定 mode：'long'（强制超长，任意稀有度）/ 'normal'（强制普通）
  //   · 只有【头节】带触角（12_h.svg），其余节是身体（12_b.svg）
  //   · 每一节都是【独立实体】：各自血量、各自结算碰撞与伤害（像多个生物黏在一起）
  //   · 链只决定"谁跟着谁"：_lead 为 null 的那节就是【头】，跑自己的 AI 驱动它后面那整段；
  //     前节一死，后节的 _lead 自动置空 -> 分裂成多段，每段由自己最前一节的 AI 控制
  //     （不管那节有没有触角）。
  //   · 超长个体（chainLong）的每一节额外带一套【隐藏掉落】，不写进掉落表、不显示在生物信息栏。
  //   · 【绝不生成在墙体内】：某一节要落的位置压墙，就在那里直接截断（后面的节不再生成）；
  //     头节本身就在墙里则整条不生成（返回 0）。
  _spawnChain(type, x, y, rarity, zone, mode) {
    const huge = (mode === 'long')
      || (mode !== 'normal' && rarity === 'common' && Math.random() < 0.003);
    // 节数按稀有度递减：区间闭合，均匀过渡（common 平均 11.5 -> super/eternal 平均 4）。
    const sc = (type.segCount && type.segCount[rarity]) || null;
    const nBase = sc
      ? (sc[0] + Math.floor(Math.random() * (sc[1] - sc[0] + 1)))
      : (8 + Math.floor(Math.random() * 8));
    const n = huge ? (45 + Math.floor(Math.random() * 16)) : nBase;
    const a = Math.random() * TAU;                        // 头的朝向（前进方向）
    const rs = type.rarityStats && type.rarityStats[rarity];
    let prev = null;
    const segs = [];                                     // 本链全部节（用于预置轨迹）
    // 出生摆位：带一点【随机弯曲】—— 每条链随机一个总弯曲角（±23°~±69°），
    // 再按节数均摊到每一节，所以有的个体几乎笔直、有的明显盘着。
    // 弯曲量是总角度而不是每节固定角：后者会让长链的总弯曲随节数线性放大。
    const bendTotal = rand(0.4, 1.2) * (Math.random() < 0.5 ? -1 : 1);
    const CURVE = (n > 1) ? bendTotal / (n - 1) : 0;     // 相邻两节之间的转角(rad)
    let px = x, py = y, dir = a + Math.PI;               // dir = 由头指向尾的方向
    for (let i = 0; i < n; i++) {
      const m = new Mob(type, x, y, 1, rarity);
      m.netId = this.nextEntityId();
      m.spawnZone = zone || null;
      m.segIdx = i;
      m.chainLong = huge;                                // 超长个体：每节都带隐藏掉落
      m.isHeadSeg = (i === 0);                           // 只有头节带触角
      m.artSvg = m.isHeadSeg ? '12_h' : '12_b';
      // 名牌模式【生成时定死】：只有最初那个带触角的头节用经典名牌，其余节一律主角血条模式。
      // 之后即使某一节因被打断而升为一段的头，也保持它出生时的模式（不再变回经典名牌）。
      m.plateStyle = m.isHeadSeg ? 'classic' : 'player';
      // 经验在链生成完之后按【实际节数】均分（见下方 segs 循环）——
      // 贴墙截断会少几节，按设计节数分会让整条的经验对不上表。
      // 碰撞轮廓先建（能建就建）：节间距用的是轮廓的 rMean，
      // 不能让出生摆位继续拿"视觉半径的一半"当间距（那比真实半径大 20%+，一节一节全散开）。
      m._ensureShape();
      // 沿弧推进到本节的位置：间距与 _solveChains【同一口径】（_chainRad 之和，GLUE = 1.0）。
      // 必须"先按 gap(prev, m) 走一步，再落位"，否则第二节会落在头的位置上。
      if (prev) {
        const sp = this._chainGap(prev, m);
        px += Math.cos(dir) * sp;
        py += Math.sin(dir) * sp;
        dir += CURVE;
      }
      // 【压墙就截断】：这一节要落的位置站不住（墙 / 减速瓦片），就此收尾 ——
      // 后面的体节不再生成，链保持"头到尾完整"，不会有一条尾巴插在墙里。
      if (!this._canSpawnAt(px, py, m.r)) break;
      m.x = px; m.y = py;
      // 【朝向必须显式给】：Mob 构造里是随机 facing。不设的话头会"歪着"长在身体上
      // （身体沿固定方向铺开、头却朝任意方向）—— 这就是看起来"头部分离"的原因。
      // 朝向 = 朝向前方（头），即 dir 的反方向。
      m.facing = dir + Math.PI;
      m._lead = prev;                                    // 前一节（null = 自己是头）
      // 链锚点：醒/睡按【整条链】判定（见 _isAwake），所有节都指向同一个头。
      m._head = prev ? prev._head : m;
      // 被粘合的节不跑自己的 AI/移动：位置与朝向只由 _solveChains 刚性解算。
      m._chainLocked = !!prev;
      if (prev) prev._next = m;                          // 后一节（用于刚性粘合解算）
      this._addEnt(m);
      segs.push(m);
      prev = m;
    }
    // 头节就落在墙里：整条不生成（一个实体都不留）
    if (!segs.length) return 0;
    // 经验按【实际生成的节数】均分：打完整条合计 = 表里给的 XP Reward
    // （不做均分的话 8~60 节会翻好几倍；按设计节数分则在截断后偏低）。
    if (rs && rs.exp) {
      const each = Math.max(1, Math.round(rs.exp / segs.length));
      for (const sm of segs) sm.exp = each;
    }
    // 生成播报：整条链只播一次，且只认【头节】（其余节在 _announceBossSpawn 里也会被挡掉）
    this._announceBossSpawn(segs[0]);

    // 【预置轨迹】：_solveChains 是按"沿头走过的弧长倒退"摆放每一节的。
    // 若轨迹从空开始，尾节需要的弧长远大于头在最初几秒内走过的距离 ->
    // _trailAt 只能一路外推 -> 所有节落在同一条直线上 -> 看起来就是【整条平移】。
    // 这里先按各节的真实（弧形）位置铺一遍，再沿同一弧度继续延长，
    // 保证第一帧起所有节的弧长都有解；之后随头的移动逐步被真实路径替换。
    const head = segs[0];
    if (head) {
      const tr = [];
      for (const sm of segs) tr.push({ x: sm.x, y: sm.y });   // tr[0] = 头
      let ex = tr.length ? tr[tr.length - 1].x : x;
      let ey = tr.length ? tr[tr.length - 1].y : y;
      let ed = dir;                                       // 接着最后一节的切线继续
      for (let k = 0; k < 120; k++) {                     // 约 960px，足够覆盖整链
        ex += Math.cos(ed) * 8;
        ey += Math.sin(ed) * 8;
        ed += CURVE * 0.6;
        tr.push({ x: ex, y: ey });
      }
      head._trail = tr;
      // 整条链的总长：醒/睡判定的唤醒余量（链尾进视野时，链头也要醒过来驱动解算）。
      head._chainLen = this._chainLenOf(head);
      // 【首次摆位】：出生时素材可能还没加载（rMean 算不出来），间距只能按视觉半径估，
      // 于是远处的链会一直"一节一节散着"，直到玩家走近、链头进入视野才被一次性收拢。
      // 这里把它挂进待摆位表：素材一就绪就按 _solveChain 的同一套口径重新摆一次（见 _settleChains）。
      head._chainSettled = false;
      (this._chainSettle || (this._chainSettle = [])).push(head);
    }
    return segs.length;
  }

  // /init <map>：按生成表把全图一次性补到目标数量。
  // 返回 { ok, spawned, total } 供指令回显；不 ok 时附原因键。
  initMap(mapName) {
    if (!this.map) return { ok: false, err: 'Chat/Command/init/NoMap' };
    const name = String(this.map.name || '').toLowerCase();
    if (mapName && name && String(mapName).toLowerCase() !== name) {
      return { ok: false, err: 'Chat/Command/init/BadMap', cur: this.map.name };
    }
    const { map: targets, total } = this.zoneTargets();
    // 一次性统计各区现存数量，后面用计数器推进 —— 否则 550 只 × 41 区 × 每轮回查会非常慢
    const counts = new Map();
    for (const zone of targets.keys()) counts.set(zone, this._zoneCount(zone));
    let alive = this.aliveMobs();
    let spawned = 0, guard = 0;
    // 按缺口从大到小补，避免小区域的最后几只被上限挡住
    const order = [...targets.entries()].sort((a, b) => (b[1] - counts.get(b[0])) - (a[1] - counts.get(a[0])));
    let progress = true;
    const now = this.t || 0;
    while (progress && guard++ < 400) {
      progress = false;
      for (const [zone, want] of order) {
        if (alive >= GLOBAL_MAX_MOBS) break;
        if (counts.get(zone) >= want) continue;
        if (zone.nextTry && zone.nextTry > now) continue;    // 整块是墙的区：冷却中
        if (this._spawnInZone(zone)) {
          spawned++; alive++; progress = true;
          counts.set(zone, counts.get(zone) + 1);
        }
      }
    }
    // 结构型物种的【全图保底】（蚁穴）：正常路径已经按权重随机过一轮，
    // 这里只兜住"一整局一个都没随机到"的极小概率。
    this._ensureStructureSpawns();
    this.spawnT = 0;
    this._inited = true;
    console.info('[spawn] init ' + (this.map.name || 'map') + ': spawned ' + spawned +
      ' (target ' + total + '), alive=' + alive);
    // 物种构成快照（只打一次）：一眼能看出"生成表里有的物种是不是真的都刷出来了"。
    // 以前跳过的物种是完全静默的，只能靠人去地图里找。
    const byType = new Map();
    for (const m of this.ents) {
      if (m.dead || m.isSubEntity || !m.type) continue;
      const slug = m.type.slug || '?';
      byType.set(slug, (byType.get(slug) || 0) + 1);
    }
    const parts = [...byType.entries()].sort((a, b) => b[1] - a[1])
      .map(([slug, n]) => slug + '=' + n);
    console.info('[spawn] population: ' + parts.join(', '));
    return { ok: true, spawned, total };
  }

  // 结构型物种的全图保底：数据表里的 spawnMin（蚁穴 = 1）表示【整张地图】至少要有几只。
  // 注意不是"每个生成区一只" —— 蚁穴平时和其它生物一样参与各区权重轮盘，
  // 这里只在"随机结果为空"时补一只，且只在生成表里确实列了它的区里补。
  _ensureStructureSpawns() {
    if (!this.map) return;
    const zones = this.map.spawnZones || [];
    for (const type of MOB_TYPES) {
      const min = (type && type.spawnMin) || 0;
      if (min <= 0) continue;
      let alive = 0;
      for (const m of this.ents) {
        if (!m.dead && !m.isSubEntity && m.type === type) alive++;
      }
      if (alive >= min) continue;
      for (const zone of zones) {
        if (!parseSpawnMobs(zone.mobs).some((it) => it.type === type)) continue;
        for (let t = 0; t < 4 && alive < min; t++) {
          if (this._spawnInZone(zone, type)) alive++;
        }
        if (alive >= min) break;
      }
    }
  }

  // 维持：每秒若干次，挑"缺口最大"的区补 1 只（全图轮转，不偏袒玩家附近）
  spawnOne() {
    if (!this.map || !this.player) return false;
    if (this.aliveMobs() >= GLOBAL_MAX_MOBS) return false;
    const { map: targets } = this.zoneTargets();
    // 单趟统计各区现存数量（避免 "每区都扫一遍 ents" 的 O(区×生物)）
    const counts = new Map();
    for (const m of this.ents) {
      if (m.dead || !m.spawnZone) continue;
      counts.set(m.spawnZone, (counts.get(m.spawnZone) || 0) + 1);
    }
    let bestZone = null, bestGap = 0;
    for (const [zone, want] of targets) {
      if (zone.nextTry && zone.nextTry > (this.t || 0)) continue;   // 冷却中的区（整块是墙）
      const gap = want - (counts.get(zone) || 0);
      if (gap > bestGap) { bestGap = gap; bestZone = zone; }
    }
    if (bestZone) return this._spawnInZone(bestZone);
    // 所有区都达标：不再额外补（★ 不能"玩家附近兜底"，那就是偏袒玩家、会持续超量）。
    // 只有地图本身没有生成区（如简易圆形地图）时，才在玩家周围保底生成。
    if (targets.size > 0) return false;
    const p = this.player;
    const a = Math.random() * TAU;
    const d = 420 + Math.random() * 480;
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (this.map.solidAtPoint && this.map.solidAtPoint(x, y)) return false;
    const pick = this._pickSpawnType(null);
    if (!pick || !pick.type) return false;
    const m = new Mob(pick.type, x, y, 1, this._rollSpawnRarity(x, y, 0));
    m.x = x; m.y = y;
    m._ensureShape();
    // 与区生成同一口径：半径内压墙就不生成（下一帧换个角度再来）。
    if (!this._canSpawnAt(x, y, m.r)) return false;
    m.spawnZone = null;
    m.netId = this.nextEntityId();
    this._addEnt(m);
    return true;
  }

  addEnt(kind, typeId, rarity, level, x, y) {
    const type = MOB_BY_ID[typeId];
    if (!type) return null;
    const m = new Mob(type, x, y, level || 1, rarity);
    m.netId = this.nextEntityId();
    this._addEnt(m);
    this._announceBossSpawn(m);            // /summon 等走通用工厂的生成同样播报
    return m;
  }

  // 节半径的【唯一口径】：出生摆位 / 链解算 / 整链唤醒余量都读它。
  // 用【顶点平均半径 rMean】（轮廓在任意方向的典型半径，见 Mob._ensureShape），
  // 不是等面积半径（偏小 1~2%）也不是外接半径（被尖角与触角撑大）。
  // 素材还没就绪时退回等面积半径 r —— 注意这时摆位偏大，由 _settleChains 在素材就绪后重摆。
  _chainRad(e) {
    if (!e) return 12;
    if (e.rMean > 0) return e.rMean;
    if (e.r > 0) return e.r;
    if (e.shape && e.shape.r) return e.shape.r * e.drawSize;
    return (e.drawSize || 24) * 0.35;
  }

  // 相邻两节的标称间距 = 两节半径之和（GLUE = 1.0：刚好相接，不留缝也不重叠）
  _chainGap(a, b) { return this._chainRad(a) + this._chainRad(b); }

  // 一条链从链头到尾节的总长（= 各相邻节标称间距之和）：
  // 醒/睡判定拿它当余量 —— 链尾进视野时链头也必须醒，否则 _solveChains 没有头可解。
  _chainLenOf(head) {
    let len = 0;
    for (let c = head; c && c._next && !c._next.dead; c = c._next) len += this._chainGap(c, c._next);
    return len;
  }

  // 多节生物【刚性粘合】：不是"跟随/追赶"（那会有延迟、拉开缝），
  // 而是每帧末按节间距【直接解算】：前一节定位后，后面每一节被强制放在
  // "距前一节恰好 gap"的位置上 —— 整条无缝连成一串，中间不会脱开。
  // 断裂处理：某一节死亡后，_lead 被置空，它后面那一节自动成为新一段的起点，
  // 于是整条被切成多段，每段各自独立解算（配合各自的 AI 驱动）。
  // 醒着的链每步解算一次（this._awake 由 sysMobs 每步重建）。
  _solveChains() {
    const src = this._awake || this.ents;
    for (const m of src) {
      if (m.segIdx == null || m.dead) continue;
      if (m._lead && !m._lead.dead) continue;   // 只从每段的最前一节出发
      // 休眠的链不解算：全图几十条链 × 每链上百点是无谓开销。
      // 休眠判定与 AI 完全一致（step 里按 activeR 置 m.sleeping）。
      if (m.sleeping) continue;
      this._solveChain(m);
    }
    this._settleChains();
  }

  // 【首次摆位】：新生成的链在素材就绪后、按与上面完全相同的解算摆一次，
  // 然后才允许"休眠就跳过"。没有这一步：出生间距只能按视觉半径估（偏大 20%+），
  // 远处的链会一直一节一节散着，等玩家走近、链头进入视野才啪一下合拢。
  // 每步最多摆 6 条：开局可能同时有 200+ 条链等着，不能一帧全解算。
  _settleChains() {
    const list = this._chainSettle;
    if (!list || !list.length) return;
    let n = 0, budget = 6;
    for (let i = 0; i < list.length; i++) {
      const head = list[i];
      if (!head || head.dead || head._chainSettled) continue;
      if (budget <= 0) { list[n++] = head; continue; }
      // 轮廓还没算出来（素材未就绪）时 rMean 恒为 0：这次摆位依旧不可靠，留到下一帧。
      let ready = true;
      for (let c = head; c && !c.dead; c = c._next) {
        if (!c.shape) c._ensureShape();
        if (!(c.rMean > 0)) { ready = false; break; }
      }
      if (!ready) { list[n++] = head; continue; }
      budget--;
      this._solveChain(head);
      // 重摆之后间距才变成 rMean 口径，唤醒余量跟着更新一次（出生时按视觉半径估的偏大）。
      head._chainLen = this._chainLenOf(head);
      head._chainSettled = true;
    }
    list.length = n;
  }

  // 单条链的刚性解算：头节位置 + 历史轨迹 -> 逐节摆位 / 挤压松弛 / 裁剪。
  // 只有这一份实现：醒着的链每步走它，首次摆位（_settleChains）也走它。
  _solveChain(m) {
    // 相邻两节的标称间距系数：1.0 => 两节【刚好相接】（不留缝、也不重叠）。
    // 之前是 1.002（留 0.2% 的缝）配合"等面积半径"，两者都偏小一点点，
    // 叠起来就是一道随体型放大的细缝 —— 高等级蜈蚣一眼能看出来。
    // 现在半径改用 rMean（顶点平均半径，见 Mob._ensureShape），系数取 1.0。
    const GLUE = 1.0;
    // 轨迹采样间距(px)：4px 已经足够平滑，点数只有 1px 时的四分之一。
    // 1px 采样在 45~60 节的超长个体上会产生上千个采样点，再叠加"每节从头查找"
    // 的 O(节数 × 点数) —— 这是帧率被打爆的主因之一。
    const TRAIL_MIN = 4;
    const MAX_PTS = 400;                       // 轨迹点数硬上限（兜底）

    // 节半径口径只有一份（见 _chainRad）：出生摆位与这里必须读同一个数，
    // 否则出生时摆出的间距与解算出来的不一致 —— 就是"体节分开、靠近才合拢"。
    const radOf = (e) => this._chainRad(e);

      // ---- 1) 段头记录自己的【行进轨迹】----
      // 距离必须与【最后一个已记录的样本】比较：若拿 trail[0] 当基准并逐帧改写，
      // 距离恒为 0，轨迹不会增长，整条会退化成刚性直杆。
      if (!m._trail) m._trail = [];
      // 【断链不瞬移】原段的头被打死后，后一节升为新头且没有轨迹。
      // 若用"沿 -facing 的直线"补轨迹，后续各节第一帧会被摆到那条直线上，整段瞬移。
      // 这里用【各节当前的真实位置】直接种一条轨迹：第一帧位置完全不变，
      // 之后随新头移动被逐步替换，和新生成时 _spawnChain 的做法一致。
      if (!m._trail.length) {
        m._trail.unshift({ x: m.x, y: m.y, s: 0 });   // 先放头，再按顺序往后放
        let cc = m._next;
        while (cc && !cc.dead) {
          m._trail.push({ x: cc.x, y: cc.y, s: 0 });
          cc = cc._next;
        }
      }
      // 【被顶回来就回退轨迹】
      // 段首被蜜 / 墙 / 玩家推回原位时，若还照常记新点，轨迹会多出一段"前进又倒退"的锯齿；
      // 后面每一节都沿这条锯齿摆放，整条会挤成一团并高频抖动。
      // 规则：本帧位移与最后一段轨迹方向相反，就弹出该样本，直到方向一致（最多 8 个，防死循环）。
      if (m._trail.length >= 2) {
        for (let guard = 0; guard < 8 && m._trail.length >= 2; guard++) {
          const a = m._trail[0], b = m._trail[1];
          const ux = a.x - b.x, uy = a.y - b.y;
          const dd = Math.sqrt(ux * ux + uy * uy) || 1;
          if ((ux * (m.x - a.x) + uy * (m.y - a.y)) / dd >= 0) break;
          m._trail.shift();
        }
      }
      {
        const s0 = m._trail[0];
        if (!s0 || Math.hypot(m.x - s0.x, m.y - s0.y) >= TRAIL_MIN) {
          m._trail.unshift({ x: m.x, y: m.y, s: 0 });
          if (m._trail.length > MAX_PTS) m._trail.length = MAX_PTS;
        }
      }

      // ---- 2) 一次遍历建【累积弧长表】（直接存在采样点上），顺带得到总长 ----
      // Math.hypot 在热点里比 sqrt(dx*dx+dy*dy) 慢一个数量级（它要做溢出保护），
      // 这里轨迹点数 × 链数 × 60Hz，必须用 sqrt。
      let total = 0;
      {
        let ax = m.x, ay = m.y;
        for (let i = 0; i < m._trail.length; i++) {
          const p = m._trail[i];
          const ddx = p.x - ax, ddy = p.y - ay;
          total += Math.sqrt(ddx * ddx + ddy * ddy);
          p.s = total;
          ax = p.x; ay = p.y;
        }
      }
      // 整条链需要的弧长
      let need = 0;
      {
        let c2 = m._next, p2 = m;
        while (c2 && !c2.dead) {
          need += (radOf(p2) + radOf(c2)) * GLUE;
          p2 = c2; c2 = c2._next;
        }
      }
      // 轨迹不足时沿最后一段切线逐点延长（s 一起补上，供下一趟直接用）
      const want = need + 40;
      if (!m._trail.length) {
        const L = want + 40;
        m._trail.push({
          x: m.x - Math.cos(m.facing) * L,
          y: m.y - Math.sin(m.facing) * L,
          s: L,
        });
        total = L;
      } else if (total < want) {
        let tail = m._trail[m._trail.length - 1];
        const prev = (m._trail.length >= 2) ? m._trail[m._trail.length - 2]
          : { x: m.x - Math.cos(m.facing), y: m.y - Math.sin(m.facing) };
        let ux = tail.x - prev.x, uy = tail.y - prev.y;
        const d = Math.sqrt(ux * ux + uy * uy) || 1;
        ux /= d; uy /= d;
        let remain = want - total;
        while (remain > 1e-3 && m._trail.length < MAX_PTS) {
          const step = Math.min(8, remain);
          total += step;
          tail = { x: tail.x + ux * step, y: tail.y + uy * step, s: total };
          m._trail.push(tail);
          remain -= step;
        }
      }

      // ---- 3) 单趟摆放：弧长单调递增，光标只前进不回头 -> O(点数 + 节数) ----
      let acc = 0;                 // 本节需要的累积弧长
      let k = 0;                   // 光标：trail[k].s = 累计到 trail[k] 的弧长
      let px = m.x, py = m.y;      // trail[k-1] 的位置（k=0 时就是头）
      let prevS = 0;
      let cur = m._next, prevSeg = m;
      const chain = [m];           // 本链（含头），供下面的硬挤压松弛使用
      while (cur && !cur.dead) {
        acc += (radOf(prevSeg) + radOf(cur)) * GLUE;
        while (k < m._trail.length && m._trail[k].s < acc) {
          px = m._trail[k].x; py = m._trail[k].y;
          prevS = m._trail[k].s;
          k++;
        }
        let hx, hy;
        if (k < m._trail.length) {
          const b = m._trail[k];
          const segLen = b.s - prevS;
          const t = segLen > 1e-6 ? (acc - prevS) / segLen : 0;
          hx = px + (b.x - px) * t;
          hy = py + (b.y - py) * t;
        } else {
          // 理论上已被第 2 步补足；兜底沿最后一段外推，保证间距恒定
          const b = m._trail[m._trail.length - 1];
          let ux = b.x - px, uy = b.y - py;
          let d = Math.sqrt(ux * ux + uy * uy);
          if (d < 1e-6) { ux = Math.cos(m.facing); uy = Math.sin(m.facing); d = 1; }
          const extra = Math.max(0, acc - prevS);
          hx = b.x + ux / d * extra;
          hy = b.y + uy / d * extra;
        }
        // 位置【完全】取自轨迹，不叠加任何左右摆动：
        // 弯曲必须全部来自"头真正走过的路径"。
        cur.x = hx;
        cur.y = hy;
        // 朝向取【本段到前一节的弦方向】（= 画面上的连杆方向），
        // 弯道处逐节递变，不会几节同角度、看着像刚性直杆被整体拖着转。
        cur.facing = Math.atan2(prevSeg.y - hy, prevSeg.x - hx);
        chain.push(cur);
        prevSeg = cur; cur = cur._next;
      }

      // ---- 3b) 击退偏移 + 沿链扩散 ----
      // 体节被冲量顶开时，位置不能就这么被轨迹覆盖掉（那就是"打中段没反应"）。
      // 每节带一个 pushX/pushY 局部偏移（见 sim/mob.js 的 _chainLocked 分支），这里：
      //   ① 先沿链做一次 [1,2,1]/4 平滑 —— 体节之间有物理连接，打中间会带弯两侧；
      //   ② 再把偏移叠加到轨迹槽位上。段首不叠加（它自己跑 AI，位置是权威的）。
      // 偏移本身在 Mob.update 里按弹性速率回位，所以是"被顶开 -> 抖一下 -> 归位"。
      const cn0 = chain.length;
      if (cn0 > 2) {
        const bx = this._chainBX || (this._chainBX = []);
        const by = this._chainBY || (this._chainBY = []);
        bx.length = cn0; by.length = cn0;
        let any = false;
        for (let i = 0; i < cn0; i++) {
          const s = chain[i];
          bx[i] = s.pushX || 0; by[i] = s.pushY || 0;
          if (bx[i] || by[i]) any = true;
        }
        if (any) {
          for (let i = 1; i < cn0; i++) {
            const l = i - 1, r = (i + 1 < cn0) ? i + 1 : i;
            chain[i].pushX = (bx[l] + bx[i] * 2 + bx[r]) * 0.25;
            chain[i].pushY = (by[l] + by[i] * 2 + by[r]) * 0.25;
          }
          for (let i = 1; i < cn0; i++) {
            const s = chain[i];
            if (s.pushX || s.pushY) { s.x += s.pushX; s.y += s.pushY; }
          }
        }
      }

      // ---- 4) 硬挤压：非相邻的两节【不允许重叠】----
      // 弧长摆放只保证"沿路径的间距"，当头折返或急转时，内弯一侧的节会在
      // 空间上挤到一起（看起来像被压扁、互相穿模）。
      // 这里做两轮位置松弛：
      //   · 非相邻节：低于最小间距就沿连线各推一半（头钉住不动，避免整条被顶离路径）
      //   · 推完再把相邻节严格复位到标称间距 —— 所以永远是"连着的一条"，不会散开
      // 正常爬行时两节距离远大于阈值，一次都不会触发，等于没有开销。
      const cn = chain.length;
      if (cn > 2) {
        // 半径预算一次：逐对调用 radOf 在 60 节的链上是 3600 次 × 4 轮。
        const rad = this._chainR || (this._chainR = []);
        rad.length = cn;
        for (let i = 0; i < cn; i++) rad[i] = radOf(chain[i]);
        // 只检查【沿链相隔不超过 12 节】的配对：弧长摆放本来就保证前后节沿路径分开，
        // 真正会"挤在一起"的只有折返/急转处相邻的那十几节；隔得再远还重叠说明整条盘成
        // 一团，那种情况松不松弛都看不出来。这一条把 O(n²) 从 3600 对压到 ~600 对。
        const WINDOW = 12;
        for (let it = 0; it < 4; it++) {
          let moved = false;
          for (let i = 0; i < cn; i++) {
            const mi = chain[i];
            const ri = rad[i];
            const jEnd = Math.min(cn, i + WINDOW + 1);
            for (let j = i + 2; j < jEnd; j++) {
              const mj = chain[j];
              // 严格相切：非相邻节之间保留 0.2% 间隙，不允许重叠
              const minD = (ri + rad[j]) * 1.002;
              let dx = mj.x - mi.x, dy = mj.y - mi.y;
              const d2 = dx * dx + dy * dy;
              if (d2 >= minD * minD || d2 < 1e-12) continue;
              const d = Math.sqrt(d2);
              const ux = dx / d, uy = dy / d;
              const over = minD - d;
              if (i === 0) {
                mj.x += ux * over; mj.y += uy * over;      // 头不动
              } else {
                mi.x -= ux * over * 0.5; mi.y -= uy * over * 0.5;
                mj.x += ux * over * 0.5; mj.y += uy * over * 0.5;
              }
              moved = true;
            }
          }
          if (!moved) break;
          // 相邻复位：从头往外逐节钉回标称间距，保证不脱节
          for (let i = 1; i < cn; i++) {
            const a = chain[i - 1], b = chain[i];
            const gap = (rad[i - 1] + rad[i]) * GLUE;
            let dx = b.x - a.x, dy = b.y - a.y;
            let d = Math.sqrt(dx * dx + dy * dy);
            if (d < 1e-6) { dx = Math.cos(a.facing + Math.PI); dy = Math.sin(a.facing + Math.PI); d = 1; }
            b.x = a.x + (dx / d) * gap;
            b.y = a.y + (dy / d) * gap;
          }
        }
        // 松弛后朝向按新的连杆方向重算
        for (let i = 1; i < cn; i++) {
          const a = chain[i - 1], b = chain[i];
          b.facing = Math.atan2(a.y - b.y, a.x - b.x);
        }
      }

      // ---- 5) 裁剪：只保留"整条链长度 + 余量"（复用第 2 步的 s，不再重复求距离）----
      const maxLen = acc + 320;
      let keep = m._trail.length;
      for (let i = 0; i < m._trail.length; i++) {
        if (m._trail[i].s > maxLen) { keep = i + 1; break; }
      }
      if (keep < m._trail.length) m._trail.length = keep;
  }

  // 链体 vs 玩家：_solveChains 是每步最后一步，会把前面推开的节按轨迹重新摆好 ——
  // 于是玩家站在身体前方时，节会被摆回到玩家身上，看起来就是整条蜈蚣【直接从花朵身上穿过去】。
  // 这里补一趟"只推玩家、不推节"的分离：节是刚体节点，推它只会脱节（下一帧又被摆回来）；
  // 玩家是自由实体，被身体扫到就该被顶开，与"头节撞到玩家"是同一观感。
  _pushPlayerOutOfChains() {
    const p = this.player;
    const src = this._awake;
    if (!p || p.dead || !src) return;
    // 遁地（Shovel）：玩家没有碰撞箱，链体直接从"地下"扫过去
    if (p.burrowT > 0) return;
    const pr = p.r || 0;
    for (let i = 0; i < src.length; i++) {
      const m = src[i];
      if (m.dead || m.sleeping || !m._chainLocked) continue;
      const dx = m.x - p.x, dy = m.y - p.y;
      const rr = (m.r || 0) + pr + 4;
      if (dx * dx + dy * dy > rr * rr) continue;
      const hit = mobHitTest(m, p.x, p.y, pr);
      if (!hit || hit.depth <= 0) continue;
      p.x += hit.nx * hit.depth;
      p.y += hit.ny * hit.depth;
    }
  }

  // ---------------- 步进系统表 ----------------
  // 每一步按【固定顺序】跑这些系统；加/删一步只改这张表 + 加/删一个 sys* 方法，
  // 不再往一个 300 行的 step() 里插代码。前后依赖写在各方法的注释里。
  step(dt) {
    this.t += dt;
    if (!this.player || !this.map) return;
    for (let i = 0; i < STEP_SYSTEMS.length; i++) this[STEP_SYSTEMS[i]](dt);
  }

  // 1) 玩家权威副本 + 检查点 + 召唤物跟随 + 多实体卡重装填
  sysPlayer(dt) {
    const p = this.player;
    p.mode = this._input.mode || 'normal';
    // 特效输出临时静音：治疗飘字等表现由客户端预测副本负责，
    // 否则同一帧服务端与客户端各弹一次（会看到两个数字）。
    const _sup = PetalFX._suppress;
    PetalFX._suppress = true;
    try {
      // 只把"醒着的"生物交给玩家：花瓣能碰到的生物一定在 activeR()（视野 + 余量）内，
      // 而全量 ents（4000+）每帧扫一遍纯属浪费（这一项曾占 1.5ms/步）。
      const near = this._act || this.ents;
      if (!p.dead) p.update(dt, { x: this._input.dx, y: this._input.dy }, this.map, near);
      else p.update(dt, { x: 0, y: 0 }, this.map, near);
    } finally { PetalFX._suppress = _sup; }

    // 复活区域解锁：站在某个 checkpoints 区域里即解锁（0.2s 查一次足够）
    this.cpAcc = (this.cpAcc || 0) + dt;
    if (this.cpAcc >= 0.2) { this.cpAcc = 0; this._checkCheckpoints(); }

    // 召唤物跟随卡槽：主人把 Ant Egg 换下去，它的召唤物一起退场。
    // 之前卸下卡片只移除了花瓣实体，召唤物会一直留在场上。
    if (p.slots) {
      for (const m of this.ents) {
        if (!m || !m.isSummon || !m.summonFrom || m.dead) continue;
        const sc = m.summonFrom;
        const c = p.slots[sc.slotIndex];
        if (!c || (c.type && c.type.slug) !== sc.slug) {
          m.dead = true;
          EntityFX.despawn(m);
        }
      }
    }

    // 多实体卡（Light）的独立重装填：到点各自满血复活（卡片不进入 reload）
    // 【必须把坐标拉回花朵中心】：死亡实体就地冻结，复活时沿用旧坐标,
    // 会在贴身位置凭空出现并立刻判定命中。
    for (const b of p.petals) {
      if (!b.dead || !(b.respawnT > 0)) continue;
      // 内容物还活着：这个蛋的重装填被挂起（召唤物死亡时才解除）
      if (b.holdRespawn) {
        const u = b.summonUnit;
        const gone = !u || u.dead || this.ents.indexOf(u) < 0;
        if (gone) {
          b.holdRespawn = false;
          b.summonUnit = null;
          b.respawnT = petalReloadOf(b.card) || 60;
        } else {
          continue;
        }
      }
      b.respawnT -= dt;
      if (b.respawnT <= 0) {
        b.respawnT = 0;
        b.dead = false;
        b.hp = b.maxHp;
        // 复活 = 重新入场：清掉上一次的退场标记与红闪（否则 exiting 恒真、永远不再受击闪红）
        EntityFX.spawn(b, 'petal');
        b.x = p.x; b.y = p.y;      // 回到花朵中心，再从花瓣轨道飞出去
        b.vx = 0; b.vy = 0;
      }
    }
  }

  // 2) 生物：AI + 移动 + 退场回收。顺带建好 this._awake（后面推挤/战斗/链解算都读它）
  sysMobs(dt) {
    const p = this.player;
    //    远处生物【休眠】：全图人口按生成表铺开，但只有玩家视野范围内的才跑 AI/物理，
    //    所以"全图 1000+ 只"不会拖垮帧率（服务端人口 ≠ 服务端负载）。
    //
    //    【醒/睡分区】把 this.ents 拆成 _act（跑 AI/物理）与 _rest（休眠）。
    //    每步只遍历 _act；_rest 每 0.2s 扫一次，把进入 activeR() 的个体叫醒。
    //    醒/睡边界最多 0.2s 延迟（边界远在屏幕外，玩家 0.2s 走不到），不影响体感。
    const R = this.activeR();
    const act = this._act || (this._act = []);
    const rest = this._rest || (this._rest = []);
    // 【醒着的个体收进一个复用数组】：下面"玩家推挤 / 两两推挤 / 战斗"三步直接遍历它，
    // 数组本体复用（length = 0），不产生垃圾。
    const awake = this._awake || (this._awake = []);
    awake.length = 0;
    // 分区自愈：外部代码（/summon、生成器）若直接往 this.ents 塞了个体，分区会缺人 ——
    // 数量对不上就重建一次（否则新个体永远不跑 AI，看起来像"召唤出来是木桩"）。
    if (act.length + rest.length !== this.ents.length) this._rebuildPartition();
    // 周期性唤醒：玩家会走动，睡着的个体里够近的要叫醒。
    this._sleepAcc = (this._sleepAcc || 0) + dt;
    if (this._sleepAcc >= 0.2) { this._sleepAcc = 0; this._wakeNearby(); }
    let needCompact = false;
    let actN = 0;
    for (let i = 0; i < act.length; i++) {
      const m = act[i];
      if (m.dead) {
        // 退场播完（EntityFX.done）才回收：实体离场必须先播完通用退场动画，
        // 不允许在这里直接 splice —— 那会让生物"凭空消失"。
        if (EntityFX.done(m)) { needCompact = true; continue; }
      } else if (!this._isAwake(m, p, R)) {
        // 走出视野 -> 转休眠（进 _rest，本步不再更新；它仍然留在 this.ents 里参与快照/小地图）
        m.sleeping = true;
        rest.push(m);
        continue;
      }
      m.sleeping = false;
      // 多节生物：前节已死 -> 本节升为"头"（重新跑自己的 AI 驱动它后面那整段）
      // —— 这就是【中间被打断分裂成多段】：每段由自己最前一节的 AI 控制，与有没有触角无关。
      if (m._lead && m._lead.dead) {
        // 断链：本节立刻成为新段首，并继承旧段首的仇恨表，
        // 使两段都继续追打原来的目标。
        m.inheritThreat(m._lead);
        // 继承仇恨后不立刻转向：新段首沿打断那一刻的航向继续直行一小段时间。
        m.keepCourse = 0.9;   // 保持航向的时长（秒）
        m.keepDir = { x: Math.cos(m.facing || 0), y: Math.sin(m.facing || 0) };
        m._lead = null;
        // 新段首：整段的"链锚点"改指向它自己（醒/睡按整段链判定，见 _isAwake），
        // 链长也按断口之后剩下的节数重算 —— 否则这一段的唤醒余量还是旧整条的长度。
        m._head = m;
        m._chainSettled = true;      // 位置本来就是连续的，不需要再"首次摆位"
        for (let cc = m._next; cc && !cc.dead; cc = cc._next) cc._head = m;
        m._chainLen = this._chainLenOf(m);
      }
      // 段首（没有前一节）必须解除粘合标记，否则它会跳过 AI 与位移。
      m._chainLocked = !!m._lead;
      // 位置一律由 _solveChains 沿头的实际路径解算。
      m._followPt = null;
      // 传入本帧醒着的个体：AI 的目标按【阵营】从"玩家 + 其它实体"里选最近的，
      // 而不是固定盯着玩家（召唤物要打敌对生物，敌对生物也会打召唤物）。
      m.update(dt, p, this.map, this._awake);
      if (m.hornet && m.hornet.projectiles && m.hornet.projectiles.length) {
        for (const projectile of m.hornet.projectiles) {
          projectile.owner = m;
          projectile.parentId = m.netId;
          this.hornetProjectiles.set(projectile.id, projectile);
        }
        m.hornet.projectiles.length = 0;
      }
      if (!m.dead) awake.push(m);
      act[actN++] = m;
    }
    act.length = actN;
    // 只在真有"退场播完"的个体时才重建数组（filter 会分配 4000+ 元素的新数组，
    // 每步都做就是纯 GC 压力）。
    // 【回收口径】只摘"退场动画已播完"的个体（EntityFX.done）—— 退场没播完就还在场。
    if (needCompact) this.ents = this.ents.filter((m) => !EntityFX.done(m));
    this._tickHornetProjectiles(dt);
  }

  // 按 SPAWN_INTERVAL 从缺口最大的生成区补一个体；保留余量以维持真实生成频率。
  sysSpawn(dt) {
    this.spawnT = (this.spawnT || 0) + dt;
    if (this.spawnT + 1e-9 < SPAWN_INTERVAL) return;
    this.spawnT = Math.max(0, this.spawnT - SPAWN_INTERVAL);
    this.spawnOne();
  }

  // 推挤与硬碰撞：玩家↔生物、生物↔生物、Wax 落位块、召唤物。
  sysPush(dt) {
    const p = this.player;
    const awake = this._awake || this.ents;
    // 3) 玩家 vs 生物：按重量 + 动能推挤（physicsPush）。重的一方几乎不动、轻的被推飞；
    //    很快的玩家能推动"更大一点"重量的生物；小生物再也推不动大生物。
    //    遁地（Shovel）期间玩家没有碰撞箱：整段跳过。
    if (!p.dead && p.burrowT <= 0) {
      for (let i = 0; i < awake.length; i++) {
        const m = awake[i];
        if (m.dead) continue;                    // 休眠生物离玩家很远，不可能接触
        // 大招期间"定在原地"的生物（蜘蛛自转）：不参与推挤 —— 推了它也推不动，
        // 反过来还会把它的锚点拉偏（它必须严格原地自转）。
        if (m.ultHold) continue;
        // 与伤害结算 / F3 碰撞箱同一套几何：生物的 SVG 轮廓（physicsPushMob 内部按轮廓推挤）。
        // 被粘合的链节【只推玩家】：节的位置每帧末由轨迹刚性解算，推它会被覆盖并撕开整条。
        if (m.noPush) continue;                  // 原地放置的实体（Pollen）不参与推动
        if (m._chainLocked) physicsPushPlayerOnly(p, m);
        else physicsPushMob(p, m);
      }
    }

    // 4) 生物之间：同样按重量 + 动能推挤（替代原来"各半"的等权推开）
    //    只算"醒着"的（远处休眠的既不动也不该参与）。
    //    【宽相位用均匀网格】：醒着的往往上千只（蜈蚣一条就几十节），
    //    两两配对是 O(k²) ≈ 50 万次/帧，即使每次只是一次距离判断也会打爆帧率。
    //    这里按格子分桶，只比较同格与相邻格（格距按最大半径自动扩）——
    //    实际配对数量降到"每只周围真正贴着的几只"。
    const ms = awake;
    const CELL = 192;
    const grid = this._pushGrid || (this._pushGrid = new Map());
    grid.clear();
    let maxR = 0, seq = 0;
    for (const m of ms) {
      if (m.dead) continue;
      if (m.r > maxR) maxR = m.r;
      m._pseq = seq++;                       // 本帧唯一序号：保证每对只处理一次
      const gx = Math.floor(m.x / CELL), gy = Math.floor(m.y / CELL);
      const k = (gx + 4096) * 8192 + (gy + 4096);
      let arr = grid.get(k);
      if (!arr) { arr = []; grid.set(k, arr); }
      arr.push(m);
    }
    // 两个半径之和可能超过一格 -> 按最大半径决定要看几圈相邻格
    const ring = Math.max(1, Math.ceil((maxR * 2) / CELL));
    for (const a of ms) {
      if (a.dead) continue;
      const gx = Math.floor(a.x / CELL), gy = Math.floor(a.y / CELL);
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          const arr = grid.get((gx + dx + 4096) * 8192 + (gy + dy + 4096));
          if (!arr) continue;
          for (let i = 0; i < arr.length; i++) {
            const b = arr[i];
            if (b._pseq <= a._pseq) continue;         // 同一对只算一次
            // 大招期间定在原地的生物不参与推挤（见上面玩家 vs 生物那段）
            if (a.ultHold || b.ultHold) continue;
            // 多节生物【直接相连的两节】之间不做推挤：
            // 它们本来就是故意重叠的（见 _solveChains 的 GLUE），
            // 推挤会把链硬生生推开 -> 错位、拉伸、尾节脱节、并给速度顶出巨大冲量。
            if (a._next === b || b._next === a) continue;
            // 原地放置的实体（Bumble Bee 的 Pollen）：不被推着滑走
            if (a.noPush || b.noPush) continue;
            // 数据声明的可穿透配对（蚁穴）：蚂蚁家族在洞上没有碰撞
            if (this._passThrough(a, b)) continue;
            // 统一引擎：这里只做位置分离（物理）。接触伤害在 _combatTick 结算。
            physicsPush(a, b);
          }
        }
      }
    }

    // 4b) 带 shape 的花瓣实体（Wax）：同一个 physicsPush，按【推者阵营】只改两个输入：
    //   · 玩家阵营推：w.static=false, w.weight≈0 —— 蜡块几乎无质量，一碰就被推走，
    //     玩家几乎不被顶开。weight 取极小正数，因为 physicsPush 的 `weight || 1`
    //     会把 0 当成缺省值 1。
    //   · 生物推：w.static=true —— inv=0，生物吃下【全部】重叠修正，蜡块纹丝不动，
    //     于是生物被硬阻挡，不可能从蜡块底下穿过去。
    //   · 蜡块 ↔ 蜡块：双方 static=false、按 weight 反质量分配，正常互相挤压。
    // 全部走同一个 physicsPush；没有第二套碰撞函数。
    if (p && !p.dead && p.petals) {
      const waxes = p.petals.filter((w) => w && !w.dead && w.shape);
      const map = this.map;
      for (const w of waxes) {
        // 玩家的推力必须【过地形】：physicsPushOnMap 会先算实体重叠，再用地形解算重走位移，
        // 于是蜡块只会被推到墙边停住，不会被推进墙里。
        w.static = false; w.weight = 1e-4;
        physicsPushOnMap(p, w, map);
        w.static = true;
        for (let i = 0; i < awake.length; i++) {
          const m = awake[i];
          if (!m || m.dead) continue;
          physicsPush(m, w);
        }
      }
      for (let i = 0; i < waxes.length; i++) {
        for (let j = i + 1; j < waxes.length; j++) {
          const a = waxes[i], b = waxes[j];
          a.static = false; b.static = false;
          a.weight = b.weight = rarityWeight(a.card && a.card.rarity) || 1;
          // 蜡块互相挤压同样要过地形：互推不能把对方顶进墙。
          // physicsPush 本身就是双向分配（a、b 各动一份），只调一次。
          physicsPushOnMap(a, b, map);
        }
      }
      for (const w of waxes) w.static = true;
    }

    // 玩家阵营的召唤物没有任何单独的一段：它就是普通生物，位置分离完全由上面两个
    // 循环负责（玩家 ↔ 它用 physicsPushMob、它与生物用网格里的 physicsPush），
    // 接触伤害则在 _combatTick 里与花瓣/花朵本体同一处按阵营结算。
  }

  // 5) 战斗结算：固定 25 tick/s（SNAP_DT）
  sysCombat(dt) {
    this._combatAcc += dt;
    while (this._combatAcc >= SNAP_DT) {
      this._combatAcc -= SNAP_DT;
      this._combatTick();
    }
  }

  // 6) 多节生物【刚性粘合】—— 必须放在所有改坐标的步骤之后。
  // 前面所有会改坐标的步骤（AI 移动、玩家推挤、生物两两推挤、战斗击退）都跑完之后
  // 再统一解算，否则链会在同一帧里被后续逻辑推开（这就是"怎么改都没改善"的原因）。
  sysChains() {
    this._solveChains();
    // 解算完再补一次链体与玩家的分离（只推玩家）—— 否则身体会从花朵身上穿过去。
    this._pushPlayerOutOfChains();
  }

  // 7) 场地型实体（玩家的 Web 网 / Legend+ 蜘蛛自铺网）：状态施加 + 网的寿命推进。
  // 放在坐标全部定稿之后 —— 否则算出来的是"上一步的位置"。
  sysFields(dt) { this._fieldTick(dt); }

  // 8) 生物特性（Bumble Bee 每 0.6s 在尾部生一颗同等级 Pollen）。
  // 放在【最后】：前面任何一步早退（玩家死亡等）都不该让它停产；
  // 而且生成位置要用本步定稿后的坐标。
  sysMobTraits(dt) { this._bumbleTick(dt); this._queenAntTick(dt); this._antHoleTick(dt); }

  // 场地实体产出用的"原语"：MobFX 认识要什么（蛛网 / 倍率），服务器只管怎么造。
  // 建一次复用（每帧 new 对象是纯浪费）。
  _fieldCtx() {
    if (!this._fctx) {
      const self = this;
      this._fctx = {
        webType() {
          self._webType = self._webType
            || ((typeof PETAL_TYPES !== 'undefined') ? PETAL_TYPES.find((t) => t && t.slug === 'web') : null);
          return self._webType;
        },
        webDur() { return SPIDER_WEB_DUR; },
        addWeb(ent) {
          ent.owner = 'mob';          // 敌方蛛网：只给【玩家】挂减速，不给生物
          self.fields.add(ent);       // 容器负责分配全局单调 netId
        },
      };
    }
    return this._fctx;
  }

  // Bumble Bee：尾部定时产 Pollen。
  // Pollen 走【通用实体链路】—— 生成一个静止的敌对 Mob（hp/dmg 取该稀有度 Pollen 的数值），
  // 于是花瓣能打碎它、它会咬玩家、快照/绘制全部复用现成管线，不需要新的网络字段。
  _bumbleTick(dt) {
    const src = this._awake || this.ents;
    const pollen = (typeof PETAL_TYPES !== 'undefined')
      ? PETAL_TYPES.find((t) => t && t.slug === 'pollen') : null;
    if (!pollen || !pollen.svg) return;
    for (const m of src) {
      // 已生成的 Pollen 是有寿命的（10s），否则一波怪能在地上堆几百颗
      if (m.pollenShot && !m.dead) {
        m.life = (m.life || 0) + dt;
        if (m.life >= 10) { m.dead = true; EntityFX.despawn(m); }
        continue;
      }
      if (m.dead || !m.type || !m.type.pollenEvery) continue;
      m.pollenT = (m.pollenT || 0) + dt;
      if (m.pollenT < m.type.pollenEvery) continue;
      m.pollenT = 0;
      // 尾部位置：本体朝向的反方向
      const a = (m.facing || 0) + Math.PI;
      const off = (m.drawSize || 30) * 0.45;
      const x = m.x + Math.cos(a) * off;
      const y = m.y + Math.sin(a) * off;
      const st = petalStatsFor(pollen, m.rarity);
      // 临时类型：与 Mob 的接口一致，但数值来自 Pollen 花瓣表
      // 必须用正式登记的类型（data.js 的 POLLEN_SHOT_TYPE）：客户端按 typeId 建视图，
      // 临时对象没有 id 的话快照里 typeId=undefined，客户端直接 continue -> 永远看不见。
      // 尺寸口径：common 的 Pollen 与玩家放出来的 Pollen 【视觉上】一样大（PETAL_ENT_SIZE），
      // 之后按【生物体型比例】MOB_DIAM[rarity] 递增 —— 由 sizeScale 一次性给出。
      // 除以内容占比：生物贴图走固定裁剪框、图形只占画布约 30%，
      // 花瓣管线 artCanvas 按内容包围盒裁满，两者坐标系不同，需换算。
      const type = Object.assign({}, POLLEN_SHOT_TYPE, {
        sizeScale: PETAL_ENT_SIZE / (PLAYER_VISUAL_D * MOB_DIAM_BASE * MOB_ART_FILL),
        rarityStats: { [m.rarity]: { hp: st.hp || 1, dmg: st.dmg || 0, armor: 0, exp: 0 } }
      });
      const shot = new Mob(type, x, y, 1, m.rarity);
      shot.netId = this.nextEntityId();          // 没有 netId 就进不了快照，客户端看不到它
      shot.artSvg = 'pollen';             // 快照下发，客户端据此画 mobpollen 贴图
      shot.hostility = 'hostile';
      shot.wanderSpeed = 0; shot.chaseSpeed = 0; shot.speed = 0;   // 停在原地
      shot.pollenShot = true;
      shot.noPush = true;                 // 放在原地，不被推挤滑走
      shot.vx = 0; shot.vy = 0;
      shot.life = 0;
      this.ents.push(shot);
    }
  }

  // Queen Ant 蚁后：消费 AI 写的产卵请求，并在 1 秒后把无敌蚁卵替换成同级兵蚁。
  // 蚁卵/兵蚁都归入 queen.brood，存活个数就是"自己生成的子代"计数。
  _queenAntTick(dt) {
    const src = this._awake || this.ents;
    for (const m of src) {
      if (!m || m.dead) continue;
      // 临时蚁卵：倒计时结束 -> 强制移除 + 原地生成同级兵蚁（个数不变）
      if (m.eggHatchT > 0) {
        m.eggHatchT -= dt;
        if (m.eggHatchT <= 0) this._hatchQueenEgg(m);
        continue;
      }
      if (!m.queenEggReq) continue;
      const req = m.queenEggReq;
      m.queenEggReq = null;
      this._spawnQueenEgg(m, req.rarity);
    }
  }

  // 在蚁后尾部生成一枚无敌蚁卵（走通用 Mob / EntityFX 接口，入场动画一致）。
  _spawnQueenEgg(queen, rarity) {
    const type = MOB_TYPES.find((t) => t && t.slug === 'ant_egg');
    if (!type) return null;
    const a = (queen.facing || 0) + Math.PI;
    const off = (queen.r || 20) * 0.95;
    let x = queen.x + Math.cos(a) * off;
    let y = queen.y + Math.sin(a) * off;
    if (this.map && this.map.solidAtPoint && this.map.solidAtPoint(x, y)) { x = queen.x; y = queen.y; }
    const m = new Mob(type, x, y, queen.level || 1, rarity);
    m.netId = this.nextEntityId();
    m.invincible = true;
    m.queenEgg = true;
    m.eggOwner = queen;
    m.eggHatchT = (queen.queen && queen.queen.hatch) || 1.0;
    m.hostility = 'passive';              // 不追人；1 秒后就会被移除
    m._ensureShape();                     // 与普通生物同一口径：首帧就有碰撞箱
    this._addEnt(m);
    (queen.brood || (queen.brood = [])).push(m);
    return m;
  }

  // 蚁卵孵化：移除蚁卵 -> 原地放一只同级兵蚁（都走通用实体/生成链路）。
  _hatchQueenEgg(egg) {
    if (!egg || egg.dead) return null;
    const type = MOB_TYPES.find((t) => t && t.slug === 'soldier_ant');
    const owner = egg.eggOwner;
    egg.eggHatchT = 0;
    egg.dead = true;
    EntityFX.despawn(egg);
    if (!type) return null;
    const m = new Mob(type, egg.x, egg.y, egg.level || 1, egg.rarity);
    m.netId = this.nextEntityId();
    m._ensureShape();
    this._addEnt(m);
    if (owner) (owner.brood || (owner.brood = [])).push(m);
    return m;
  }

  // Ant Egg 被击碎：50% 原地生成一只【同级】幼蚁，死追击碎它的玩家。
  // 复仇目标只是一个属性（mob.avenger），追击行为在 ai.js 的通用 chase 里。
  _spawnEggAvenger(egg) {
    const p = this.player;
    if (!p || p.dead) return null;
    if (Math.random() >= 0.5) return null;
    const type = MOB_TYPES.find((t) => t && t.slug === 'baby_ant');
    if (!type) return null;
    const m = new Mob(type, egg.x, egg.y, egg.level || 1, egg.rarity);
    m.netId = this.nextEntityId();
    m.avenger = p;                        // 无视距离死追；玩家死亡后自动变回正常被动
    m._ensureShape();
    this._addEnt(m);
    return m;
  }

  // Ant Hole 蚁穴：第一次跑到时（任何生成路径）按数据表把开局 6 只铺上。
  _antHoleTick(dt) {
    const src = this._awake || this.ents;
    for (const m of src) {
      if (!m || m.dead || !m.type || m.type.slug !== 'ant_hole') continue;
      if (!m.holeInit) this._initAntHole(m);
    }
  }

  _initAntHole(hole) {
    const cfg = hole.hole || {};
    hole.holeInit = true;
    // 池子 = 整局 40 只的构成（蚁后单列）：抽到就扣，抽干即停。
    hole.holePool = Object.assign({}, (cfg.pool || {}));
    delete hole.holePool.queen_ant;
    hole.holeQueenPending = true;
    hole.holeBatches = 0;
    hole.holeNextDrop = cfg.step || 0.07;    // 下一次补员的血量阈值：1 - step×k
    hole.holeAngry = false;
    for (const pair of (cfg.init || [])) this._antHoleSpawn(hole, pair[0], pair[1], false);
  }

  // 从池子里取 n 只（计数同步扣减）；onHole=true 时出现在蚁穴上（蚂蚁与蚁穴没有碰撞）。
  _antHoleSpawn(hole, slug, n, onHole) {
    const pool = hole.holePool || {};
    const cnt = Math.min(n, pool[slug] || 0);
    if (cnt <= 0) return 0;
    const type = MOB_TYPES.find((t) => t && t.slug === slug);
    if (!type) return 0;
    pool[slug] -= cnt;
    const baseR = hole.r || 20;
    for (let i = 0; i < cnt; i++) {
      const a = rand(0, TAU);
      const rr = onHole
        ? baseR * Math.sqrt(rand(0, 1))
        : baseR + (type.size || 20) * 0.6 + 6;
      const m = new Mob(type, hole.x + Math.cos(a) * rr, hole.y + Math.sin(a) * rr,
        hole.level || 1, hole.rarity);
      m.netId = this.nextEntityId();
      m.holeOwner = hole;
      // 蚁穴已经挨过打：新爬出来的工蚁同样具有攻击性（与兵蚁一致）
      if (slug === 'worker_ant' && hole.holeAngry) m.hostility = 'hostile';
      m._ensureShape();
      this._addEnt(m);
    }
    return cnt;
  }

  // 蚁穴挨打：所有属于它的工蚁立刻转敌对；每掉 step 比例生命补 3 只，
  // 蚁后在生命低于 queenAt 时随某一批额外出现（整局一次）。
  _antHoleHurt(hole) {
    if (!hole.holeInit) this._initAntHole(hole);
    if (!hole.holeAngry) {
      hole.holeAngry = true;
      for (const m of this.ents) {
        if (!m || m.dead || m.holeOwner !== hole) continue;
        if (!m.type || m.type.slug !== 'worker_ant') continue;
        m.hostility = 'hostile';
        m.wanderRange = [120 * 1.5, 280 * 1.5];   // 与兵蚁同一游走幅度
      }
    }
    const maxHp = hole.maxHp || 0;
    if (maxHp <= 0) return;
    const frac = hole.hp / maxHp;
    const pool = hole.holePool;
    while (hole.holeNextDrop <= 1 && frac < 1 - hole.holeNextDrop
      && (pool.baby_ant + pool.worker_ant + pool.soldier_ant) > 0) {
      hole.holeNextDrop += hole.hole.step || 0.07;
      this._antHoleBatch(hole, frac);
    }
  }

  // 一批 3 只：按剩余池子权重抽（前期幼蚁/工蚁更容易先出，兵蚁后置），
  // 最终构成仍由池子决定，只是顺序不同。
  _antHoleBatch(hole, frac) {
    for (let i = 0; i < 3; i++) {
      const slug = this._antHolePick(hole);
      if (!slug) break;
      this._antHoleSpawn(hole, slug, 1, true);
    }
    const cfg = hole.hole || {};
    if (hole.holeQueenPending && frac < (cfg.queenAt || 0.4)) {
      hole.holeQueenPending = false;
      const type = MOB_TYPES.find((t) => t && t.slug === 'queen_ant');
      if (type) {
        const m = new Mob(type, hole.x, hole.y, hole.level || 1, hole.rarity);
        m.netId = this.nextEntityId();
        m.holeOwner = hole;
        m._ensureShape();
        this._addEnt(m);
      }
    }
    hole.holeBatches = (hole.holeBatches || 0) + 1;
  }

  // 剩余池子计数 × 前期加权：k=0（开局）时幼蚁/工蚁权重 ×3、兵蚁 ×0.4；
  // k=1（末尾）回到计数本身。
  _antHolePick(hole) {
    const pool = hole.holePool;
    const k = Math.min(1, (hole.holeBatches || 0) / 11);
    const early = 1 - k;
    const w = [
      ['baby_ant', (pool.baby_ant || 0) * (1 + 2 * early)],
      ['worker_ant', (pool.worker_ant || 0) * (1 + 2 * early)],
      ['soldier_ant', (pool.soldier_ant || 0) * (1 - 0.6 * early)]
    ];
    let total = 0;
    for (const e of w) total += e[1];
    if (total <= 0) return null;
    let r = rand(0, total);
    for (const e of w) {
      if (e[1] <= 0) continue;
      r -= e[1];
      if (r <= 0) return e[0];
    }
    return w[2][1] > 0 ? 'soldier_ant' : null;
  }

  // 数据声明的"可穿透"关系（蚁穴）：两边谁的 passWith 含对方物种就跳过推挤。
  _passThrough(a, b) {
    const pa = a.passWith, pb = b.passWith;
    if (!pa && !pb) return false;
    const sa = a.type && a.type.slug, sb = b.type && b.type.slug;
    return !!((pa && sa && pa.indexOf(sb) >= 0) || (pb && sb && pb.indexOf(sa) >= 0));
  }

  // 场地型实体的判定：与放置者敌对的生物进入半径 -> 获得对应状态效果。
  // 效果的【数值】不在这里（那是 StatusFX 注册项的事），这里只负责"谁站在网上"。
  _fieldTick(dt) {
    const p = this.player;
    if (!p) return;
    const src = this._awake || this.ents;
    const fields = this.fields;
    const fieldsLen = fields.length;

    // ---- 场地型实体（网）计时 + 退场：一张表，统一推进；退场播完由 sweep 回收 ----
    for (let i = 0; i < fieldsLen; i++) {
      const w = fields.get(i);
      if (!w || w.exiting) continue;
      w.t = (w.t || 0) + dt;
      if (w.t >= w.dur) EntityFX.despawn(w);
    }
    fields.sweep(dt);

    // ---- 玩家的网（Web 花瓣）：给站在上面的【生物】挂减速 ----
    if (fieldsLen) {
      for (const m of src) {
        if (m.dead || m.sleeping) continue;
        for (let i = 0; i < fieldsLen; i++) {
          const w = fields.get(i);
          if (!w || w.exiting || w.owner === 'mob') continue;  // 只处理玩家网（owner !== 'mob'）
          const r = w.r || 0;
          if (!(r > 0)) continue;
          const dx = m.x - w.x, dy = m.y - w.y;
          if (dx * dx + dy * dy > r * r) continue;
          StatusFX.add(m, 'web', { dur: STATUS_FIELD_REFRESH });
          break;
        }
      }
    }

    // ---- 敌方蛛网（Legend+ 蜘蛛原地自铺 + 蜘蛛大招产出的超大网）：给【玩家】挂减速 ----
    if (fieldsLen && !p.dead) {
      for (let i = 0; i < fieldsLen; i++) {
        const w = fields.get(i);
        if (!w || w.exiting || w.owner !== 'mob') continue;  // 只处理敌方网
        const dx = p.x - w.x, dy = p.y - w.y;
        if (dx * dx + dy * dy <= w.r * w.r) {
          StatusFX.add(p, 'web', { dur: STATUS_FIELD_REFRESH });
          break;
        }
      }
    }

    // ---- 常规自铺网（Legend+ 蜘蛛）+ 大招产出：走 produceField -> ctx.addWeb -> this.fields ----
    for (const m of src) {
      if (m.dead || m.sleeping) continue;
      // 大招产出（引擎驱动）：MobFX 认识"蜘蛛要一张 2 倍半径的蛛网"，
      // 服务器只提供"怎么造一张网"的原语（ctx），物种知识留在 MobFX 里。
      if (m.ultFieldReq) {
        const req = m.ultFieldReq; m.ultFieldReq = null;
        MobFX.produceField(m, req, this._fieldCtx());
      }
      // 常规自铺网（Legend+ 蜘蛛）
      if (!m.gaitSprite) continue;
      if (RARITY_ORDER.indexOf(m.rarity) < RARITY_ORDER.indexOf('legendary')) continue;
      if (m.ultActive) continue;                // 大招期间不铺普通网（正在放大招）
      m.webT = (m.webT || 0) + dt;
      if (m.webT >= SPIDER_WEB_EVERY) {
        m.webT = 0;
        // 网的大小 = 该蜘蛛稀有度对应的 Web 花瓣半径（数据表，不硬编码）
        MobFX.produceField(m, { kind: 'web', mul: 1 }, this._fieldCtx());
      }
    }
  }

  // 战斗结算：只负责"谁掉多少血/谁该被弹开"，并把结果写成事件交给客户端表现。
  // 反弹总量恒定，按稀有度查表分配；玩家份额由事件带回客户端，叠加到它的预测位置上。
  _combatTick() {
    const p = this.player;
    if (!p) return;
    // 接触的两种"节奏"，口径完全不同，别混：
    //   kbT = 传能冷却：击退是【离散事件】，一次接触只传一次动能（PetalFX 自己判）；
    //   伤害 = 【每 tick 结算一次，一次就是完整面板值】，没有冷却、没有摊平系数。
    const TICK_DT = SNAP_DT;
    for (const b of p.petals) {
      if (b.kbT > 0) b.kbT = Math.max(0, b.kbT - TICK_DT);
      // Interval 冷却（Glass）：与 kbT 一样是每 tick 递减的实体计时
      if (b.intervalT > 0) b.intervalT = Math.max(0, b.intervalT - TICK_DT);
    }
    for (const projectile of this.hornetProjectiles.values()) {
      if (projectile.dead || projectile.exiting) continue;
      const owner = projectile.owner;
      const radius = projectile.radius || 8;
      for (const b of p.petals) {
        if (b.dead || b.fxNoCombat) continue;
        // 【统一实体接口】没有血量的花瓣（Basil / Glass / Shovel）不参与任何实体结算：
        // 连"被尾针扫到"都不该发生 —— 它们本来就没有碰撞箱。
        if (!PetalFX.canBeHit(b)) continue;
        const dx = b.x - projectile.x, dy = b.y - projectile.y;
        const rr = PETAL_R + radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        const stats = petalStatsFor(b.card.type, b.card.rarity);
        if (b.hp == null) { b.hp = b.maxHp = (stats.hp || 30); }
        const incoming = this._dmg(PetalFX.damageOf(b, owner, p, stats.dmg), projectile.armor || 0);
        const toPetal = this._dmg(projectile.dmg || 0, b.armor);
        if (toPetal > 0) { b.hp -= toPetal; EntityFX.hurt(b); }
        if (incoming > 0) {
          const applied = Math.min(incoming, projectile.hp);
          projectile.hp -= applied;
          EntityFX.hurt(projectile);
          this._events.push({ kind: 'dmg', x: projectile.x, y: projectile.y,
            r: radius, text: String(Math.round(applied)), color: DAMAGE_TEXT_COLOR });
          if (projectile.hp <= 0) {
            projectile.hp = 0; projectile.dead = true;
            EntityFX.despawn(projectile);
            break;
          }
        }
        b.hp -= b.maxHp * PETAL_ATTACK_DUR;
        if (b.hp <= 0) { this._destroyPetal(b); continue; }
      }
      if (projectile.dead || projectile.exiting) continue;
      // 遁地：玩家没有碰撞箱，尾针直接穿过去
      if (p.burrowT > 0) continue;
      const dx = p.x - projectile.x, dy = p.y - projectile.y;
      if (dx * dx + dy * dy > ((projectile.radius || 8) + p.r) ** 2) continue;
      const damage = this._dmg(projectile.dmg, p.armor);
      if (damage > 0 && p.hurt(damage, owner)) {
        const d = Math.hypot(dx, dy) || 1;
        const share = (KNOCKBACK_SHARE[(owner && owner.rarity) || 'common'] || KNOCKBACK_SHARE.common)[0];
        const total = FLOWER_KNOCKBACK * p.r * 2 * share;
        applyKnockback(p, dx / d, dy / d, total);
        this._events.push({ kind: 'hurt', ux: dx / d, uy: dy / d, total, shake: true });
      }
      projectile.dead = true;
      EntityFX.despawn(projectile);
    }
    // ---- 持续回血（Leaf）已迁入 PetalFX 的 passive 效果 ----
    // 规则：只要实体加载好且未死亡就每帧回 heal×dt（封顶 maxHp、不弹字）。
    // 放在 PetalFX.tick 里而不是这里，理由：
    //   · 它属于"花瓣种类的能力"，不该在战斗循环里按 slug 特判；
    //   · PetalFX.tick 在 Player.update 中逐花瓣推进，天然在命中判定之外；
    //   · 战斗 tick 是 25Hz，回血写在这里会被节流成阶梯状。
    // 只见"醒着"的个体（this._awake 由 sysMobs 每步重建）：
    // 休眠生物距玩家 > activeR()（视野 + 余量），而花瓣射程远小于它，不可能接触 ——
    // 跳过它们等于省掉全图 4500+ 只 × 花瓣数 × 25Hz 的轮廓判定。
    const awake = this._awake || this.ents;
    // 玩家阵营的召唤物（Ant Egg 的内容物）：它们就是普通 Mob，只是阵营不同。
    // 位置分离已经在 sysPush 里交给 physicsPush 了，这里只收拢一份名单，
    // 供下面的敌对生物循环按【阵营】结算接触伤害。
    const summons = this._summonList || (this._summonList = []);
    summons.length = 0;
    for (let i = 0; i < awake.length; i++) {
      const m = awake[i];
      if (!m.dead && m.faction === 'player') summons.push(m);
    }
    // 尾针是"可被花瓣伤害的实体"，和生物一样走【同一套结算链路】：
    //   · 碰撞判定用实体自己的 shape（11_missile.crb）
    //   · 伤害 = 花瓣 dmg - 目标 armor（this._dmg）
    //   · 扣血 / 红闪 / 飘字 / 退场 全部交给 MobFX.hurtStinger + EntityFX
    // 发射前（st.missile）和发射后（st.projectiles）都算 —— 它们是同一个实体。
    const stingerCrb = (typeof CRB !== 'undefined') ? CRB.get('11_missile') : null;
    for (const m of awake) {
      if (m.dead) continue;
      // —— 召唤物 vs 这只敌对生物 ——
      // 与花瓣/花朵本体同一个战斗 tick、同一个 _dmg/_hitMob：
      // 阵营相同不结算，阵营不同就双向掉血。
      if (summons.length && (m.faction || 'enemy') !== 'player') {
        for (let si = 0; si < summons.length; si++) {
          const s = summons[si];
          if (s.dead || s === m) continue;
          // 接触判定只有这一个入口（与花瓣命中、玩家↔生物全部同源）。
          // 不要在调用方另写半径/皮厚——那就是第二套碰撞判定。
          if (!_pairHit(s, m)) continue;
          const toEnemy = this._dmg(s.dmg || 0, m.armor || 0);
          const toSummon = this._dmg(m.dmg || 0, s.armor || 0);
          if (toEnemy > 0) this._hitMob(m, toEnemy, s);
          if (toSummon > 0 && !s.dead) this._hitMob(s, toSummon, m);
          if (m.dead) break;
        }
      }
      const st = m.hornet;
      const stingers = [];
      if (st && st.missile) stingers.push(st.missile);
      if (st && st.projectiles) for (const pr of st.projectiles) stingers.push(pr);
      for (const stinger of stingers) {
        if (!stinger || stinger.dead || stinger.exiting) continue;
        const radius = stinger.radius || 8;
        const sc = stinger.shape || stingerCrb;
        // CRB 的归一化坐标是【素材坐标系】（未旋转）：判定必须套用与贴图相同的旋转，
        // 否则 F3 画的（旋转后）与实际判定（未旋转）不是一个形状。
        const sRot = (stinger.facing || 0) - MISSILE_TIP_ANGLE;
        const sC = Math.cos(sRot), sS = Math.sin(sRot);
        const sPts = (sc && sc.pts) ? sc.pts.map(([vx, vy]) => [
          vx * sC - vy * sS, vx * sS + vy * sC,
        ]) : null;
        for (const b of p.petals) {
          if (b.dead || b.fxNoCombat) continue;
          // 【统一实体接口】没有血量的花瓣（Basil / Glass / Shovel）不参与任何实体结算
          if (!PetalFX.canBeHit(b)) continue;
          const dx = b.x - stinger.x, dy = b.y - stinger.y;
          const rr = PETAL_R + radius;
          if (dx * dx + dy * dy > rr * rr * 4) continue;      // 粗判
          if (sPts && typeof polyVsCircle === 'function') {
            const h = polyVsCircle(sPts, stinger.x, stinger.y,
              stinger.collSize || radius, b.x, b.y, PETAL_R);
            if (!h) continue;
          } else if (dx * dx + dy * dy > rr * rr) continue;
          const stats = petalStatsFor(b.card.type, b.card.rarity);
          // 【血量必须在这里初始化】：与"花瓣 vs 生物"段同一口径。
          // 少了这一行，b.hp 为 undefined -> b.hp -= dmg 变成 NaN -> 永远 > 0
          // -> 花瓣既不显示掉血也不会碎（Peas 脱轨后"掉完血还继续飞"就是这个）。
          if (b.hp == null) { b.hp = b.maxHp = (stats.hp || 30); }
          // 【双向结算】与"花瓣 vs 生物"完全同一个公式：伤害方 dmg − 受击方 armor，
          // 钳到 0、全额扣、不做削峰；两侧永远成对出现。
          const attack = PetalFX.damageOf(b, m, p, stats.dmg);
          const toStinger = this._dmg(attack, stinger.armor || 0);
          const toPetal = this._dmg(stinger.dmg || 0, b.armor);
          if (toPetal > 0) { b.hp -= toPetal; EntityFX.hurt(b); }
          if (toStinger > 0) {
            const dealt = MobFX.hurtStinger(m, stinger, toStinger);
            if (dealt > 0) {
              this._events.push({ kind: 'dmg', x: stinger.x, y: stinger.y,
                r: radius, text: String(Math.round(dealt)), color: DAMAGE_TEXT_COLOR });
            }
          }
          // 攻击磨损：与撞生物同一口径（按最大耐久的固定比例，每 tick 一次）
          b.hp -= b.maxHp * PETAL_ATTACK_DUR;
          if (b.hp <= 0) { this._destroyPetal(b); continue; }
        }
        // 尾针 → 玩家：与生物撞玩家同一套（this._dmg 减护甲、p.hurt 带无敌、
        // 统一击退份额、统一退场）。飞行中才接触伤害。
        const pdx = p.x - stinger.x, pdy = p.y - stinger.y;
        // 遁地：玩家没有碰撞箱，尾针直接穿过去
        const hitPlayer = p.burrowT <= 0
          && pdx * pdx + pdy * pdy <= (radius + p.r) * (radius + p.r);
        if (stinger.flight && hitPlayer) {
          const damage = this._dmg(stinger.dmg, p.armor);
          if (damage > 0) {
            const hurt = p.hurt(damage, m);
            if (hurt) {
              const d = Math.hypot(pdx, pdy) || 1;
              const total = FLOWER_KNOCKBACK * p.r * 2;
              const share = (KNOCKBACK_SHARE[m.rarity] || KNOCKBACK_SHARE.common)[0];
              applyKnockback(p, pdx / d, pdy / d, total * share);
              this._events.push({ kind: 'hurt', ux: pdx / d, uy: pdy / d, total: total * share, shake: true });
            }
            stinger.exiting = true;
            stinger.dead = true;
            EntityFX.despawn(stinger);
          }
        }
      }
      // —— 花瓣 vs 昆虫（严格按 SVG 轮廓多边形判定，不再用外接圆）——
      // 玩家阵营的召唤物不与玩家、玩家的花瓣交战（同阵营）。
      if (m.faction === 'player') continue;
      for (const b of p.petals) {
        if (b.dead || b.fxNoCombat) continue;
        // Peas 喷射中的实体【照常参与伤害结算】：它此刻只是 stationary + 有自己的速度，
        // 仍是一个正常实体，血量/命中/伤害全部走下面这条通用链路。
        // 2s 后的移除由 Player._syncPetals 负责（服务端副本同样跑那套，因此两侧一致）。
        const hit = entityHitMob(m, b);          // Wax 用自己的六边形，其余用圆
        if (!hit) continue;
        const st = petalStatsFor(b.card.type, b.card.rarity);
        const pt = b.card.type || {};
        // 没有血量的花瓣（Glass）：不初始化 hp，也不挨打/磨损（它本来就打不碎）
        if (!pt.noHealth && b.hp == null) { b.hp = b.maxHp = (st.hp || 30); }
        //（Leaf 的持续回血不在这里 —— 见下方独立循环，它不该依赖"是否命中生物"）
        // ---- 花瓣 vs 生物（nx/ny = 接触法线，由生物表面指向花瓣）----
        // 这里只算公共量（质量 / 反质量份额 / 接近速度），传能规则由 PetalFX.onHit 决定。
        // 实体分离由本方法 + Player._separatePetalFromMobs 共同完成（两边各推一半）。
        // 【所有花瓣一视同仁】：不再有"有的花瓣穿过生物、有的会被挡住"的分叉，
        // 那套 solid 分派正是"花瓣和生物根本不结算碰撞"的来源。
        const nx = hit.nx, ny = hit.ny;
        const approach = Math.max(0, -((b.vx || 0) * nx + (b.vy || 0) * ny));
        // 相对法向速度：生物自己撞上来也算一次接触（花瓣停在原地被撞同样要传动能）。
        // 只用花瓣自身速度的话，"站着不动让怪撞"永远传不出力，两种花瓣都不弹。
        const relN = Math.abs(((b.vx || 0) - (m.vx || 0)) * nx + ((b.vy || 0) - (m.vy || 0)) * ny);
        // 撞击质量 = Legendary 档常量：花瓣自身的稀有度/血量/等级/速度不参与击退强度
        //（旧口径按 b.maxHp 算，导致"好花瓣撞得更狠"，已按用户口径统一）。
        const jmass = PETAL_KB_MASS_LEGENDARY;
        const jshare = (KNOCKBACK_SHARE[m.rarity] || KNOCKBACK_SHARE.common)[1];
        // wP = 花瓣在【击退引擎】里的重量（不是实体分离用的 weight）：
        //   同稀有度生物重量 × 递减份额（common ×0.5 → eternal ×0.05，见 sim/constants.js）。
        // 花瓣比同等级生物轻得多，动量传递就小得多 —— 这是"花瓣击退别太猛"的唯一调参入口。
        const wP = petalWeight(b), wM = m.weight || 1;
        const invP = 1 / wP, invM = 1 / wM, invSum = (invP + invM) || 1;
        const shareP = invP / invSum, shareM = invM / invSum;   // 各自的"可动份额"（反质量分配）
        // 质量悬殊系数：等重（=同等级实体之间）恒为 1，悬殊时按重量比开方缩放。
        // 【仅】作用于生物击退，钳在 [KB_DISPARITY_MIN, KB_DISPARITY_MAX]；
        // 实体之间的推动 / 位移分离不走这里，按反质量自然分配，【不设上限】。
        const kbBoost = clamp(Math.sqrt(wP / wM), KB_DISPARITY_MIN, KB_DISPARITY_MAX);
        // ---- ① 物理分离（"生物一侧"）：生物被推出花瓣轮廓 ----
        // 花瓣一侧的分离在 Player._separatePetalFromMobs 里做（两端同源），
        // 这里只动生物（生物只有服务端能动）。两边加起来 = 完整的一对多体碰撞。
        // 带 shape 的花瓣（Wax）的碰撞统一由 physicsTick 的物理段处理，
        // 这里只分离普通花瓣（战斗系统的接触分离）—— 一个实体只进一套体系。
        // 没有碰撞箱的花瓣（Glass）：穿透生物，不做位置分离
        if (!pt.noPush && !b.shape) this._separateMobFromPetal(m, b, hit);
        // ---- ② 接触传能（撞上去那一下的击退 / 揉搓），所有花瓣同一套 ----
        // 不传递击退的花瓣（Glass）：跳过传能
        if (!pt.noKnockback) {
          PetalFX.onHit(b, p, {
            dt: TICK_DT, mob: m, hit, approach, relN, jmass, jshare,
            wP, wM, shareP, shareM, kbBoost
          });
        }
        // ---- ③ 伤害：每 tick 结算一次，一次就是完整面板值 ----
        // 两侧永远成对出现，只有"这一侧没有攻击力"（数值为 0）才是 0，不存在单向掉血。
        // 双向走【同一个公式】：伤害方 dmg - 受击方 armor，钳到 0，全额扣，不做任何削峰。
        // 所以"伤害 ≥ 耐久"就是当 tick 直接碎（common 瓢虫 10 vs common basic 10、
        // rare 瓢虫 90 vs 任何低稀有度花瓣，都是一下没），不会出现"贴着磨一会才碎"。
        // Interval 冷却（Glass）：本次接触不结算伤害，等冷却结束才允许下一次。
        // 与 reload 是两件事：reload 管"这张卡什么时候重新长出一片"，
        // Interval 管"同一片实体两次伤害之间至少隔多久"。
        const interval = st.interval || 0;
        if (interval > 0 && (b.intervalT || 0) > 0) { if (m.dead) break; continue; }
        const attack = PetalFX.damageOf(b, m, p, st.dmg);
        const toMob = this._dmg(attack, m.armor);
        // 【统一实体接口】能不能挨打只问 PetalFX.canBeHit（noHealth = 不参与实体结算）
        const canBeHit = PetalFX.canBeHit(b);
        if (canBeHit) {
          const toPetal = this._dmg(m.dmg, b.armor);
          if (toPetal > 0) {
            b.hp -= toPetal; EntityFX.hurt(b);
          }
        }
        if (toMob > 0) this._hitMob(m, toMob);
        if (interval > 0) b.intervalT = interval;    // 结算完立刻进入 Interval 冷却
        if (canBeHit) {
          // 攻击磨损：按最大耐久比例、每 tick 磨损（PETAL_ATTACK_DUR 本来就是按 25Hz 定的）
          b.hp -= b.maxHp * PETAL_ATTACK_DUR;
          if (b.hp <= 0) this._destroyPetal(b);
        }
        if (m.dead) break;
      }
      if (m.dead || p.dead) continue;
      // —— 花朵本体 vs 昆虫（体伤）——
      // 遁地：玩家在地下，既没有碰撞箱也不该输出体伤 —— 整段跳过。
      if (p.burrowT > 0) continue;
      // 同样用 SVG 轮廓多边形判定；+0.5 余量保证"贴着"也能结算体伤。
      // 花朵本体作为实体：把体伤视为本体的 Damage(bodyDmg)、血量视为本体 Health(hp)，与怪一视同仁双向结算。
      const phit = mobHitTest(m, p.x, p.y, p.r + 0.5);
      if (phit) {
        // 体伤（出手）：与花瓣同口径 —— 每 tick 结算一次完整面板值。
        const toMob = this._dmg(p.bodyDmg, m.armor);
        // 体伤（挨打）：同样给面板值；真正的节流在花朵自己身上
        //（Player.hurt → hurtInvuln 受伤无敌帧），全项目唯一带无敌帧的实体。
        const toFlower = this._dmg(m.dmg, p.armor);
        if (toMob > 0) this._hitMob(m, toMob);
        if (toFlower > 0) {
          const hurt = p.hurt(toFlower, m);
          // 中毒（蜘蛛等）：命中花朵就把该稀有度的中毒总量施加给玩家。
          // 总量 / 每秒速率 = 本次中毒的持续时长；扣血由 Player._tickPoison 每帧均摊。
          // 只在【真的造成了伤害】时施加（被无敌帧挡掉的那一下不应挂毒）。
          const poison = (m.poison > 0 && m.poisonRate > 0)
            ? { dur: m.poison / m.poisonRate, rate: m.poisonRate } : null;
          if (hurt && !p.dead && poison && typeof StatusFX !== 'undefined') {
            // 服务端权威副本先挂上（生物/血量就在这里算）
            StatusFX.add(p, 'poison', { dur: poison.dur, value: poison.rate });
          }
          if (hurt && !p.dead) {
            const ux = phit.nx, uy = phit.ny;
            // 击退总位移 = FLOWER_KNOCKBACK × 主角直径，按稀有度份额在双方之间分配。
            const total = FLOWER_KNOCKBACK * p.r * 2;
            const sh = KNOCKBACK_SHARE[m.rarity] || KNOCKBACK_SHARE.common;
            const playerKb = total * sh[0];
            if (!m.dead) applyKnockback(m, -ux, -uy, total * sh[1]);
            applyKnockback(p, ux, uy, playerKb);
            // poison 一并带给客户端：状态效果不进快照，客户端靠这条事件给自己挂毒
            //（否则只有服务端那份玩家会掉血、会变紫，本地看到的永远是正常脸）。
            this._events.push({
              kind: 'hurt', ux, uy, total: playerKb, shake: true, poison
            });
          }
        }
      }
    }
    // —— Honey 的仇恨吸引 ——
    // 蜜不造成伤害（st.dmg = 0，上面的花瓣循环里自然不结算），只负责"挨打"；
    // 这里把它写进周围生物的仇恨表，让它们转火来啃蜜而不是玩家。
    // 限制条件：只在 HONEY_PULL_R 内、且稀有度不超过该蜜的 Max Mob Rarity。
    const TICK = SNAP_DT;
    // 先挑出静止在地上、可能吸引仇恨的花瓣；通常一朵都没有，整段可直接跳过。
    const attr = this._attr || (this._attr = []);
    attr.length = 0;
    for (const b of p.petals) {
      if (b.dead || !b.stationary || !b.card) continue;
      attr.push(b);
    }
    if (attr.length) for (const m of this.ents) {
      if (m.dead || m.honeyImmune || m.sleeping) continue;
      let hit = null;                       // 本 tick 范围内能吸引它的一坨蜜
      for (const b of attr) {
        // 能否吸引：能力字段（attractMobs / maxMobRarity）+ 范围，统一由 PetalFX 判定。
        // 该稀有度【没登记上限】（如 common 蜜）-> 什么都吸引不了，而不是"什么都不限"。
        if (!PetalFX.canAttract(b, p, m)) continue;
        // 仇恨值取"远高于任何伤害"，且 topThreat() 里蜜强制首位 —— 双重保证优先啃蜜
        if (!m.threat.some((t) => t.ent === b)) m.threat.push({ ent: b, dmg: 1e9 });
        if (!hit) hit = b;
      }
      if (!hit) continue;
      // 被蜜影响累计满 40s -> 永久免疫所有蜜（之后无论再放多少蜜都不理）
      m.honeyT = (m.honeyT || 0) + TICK;
      if (m.honeyT >= HONEY_IMMUNE_T) {
        m.honeyImmune = true;
        m.threat = m.threat.filter((t) => !(t.ent && t.ent.honey));
      }
    }

    // 伤害飘字聚合窗口结算：只遍历"这一窗内有未结算伤害"的那几只（_hitMob 里挂进来），
    // 不再每 tick 扫全图 4000+ 只。
    const dl = this._dmgList;
    if (dl && dl.length) {
      let w = 0;
      for (let i = 0; i < dl.length; i++) {
        const m = dl[i];
        if (!(m.dmgTextT > 0)) continue;          // 已结算 / 已击杀刷新过
        m.dmgTextT -= SNAP_DT;
        if (m.dmgTextT <= 0) this._flushDmg(m);
        else dl[w++] = m;
      }
      dl.length = w;
    }
  }

  // 全服唯一的伤害口径：伤害方 dmg - 受击方 armor（钳到 0）。
  // 花瓣 / 花朵本体 / 生物 三个方向都必须走它 —— 否则"同阵营的实体挨打却两套算法"。
  _dmg(fromStat, toArmor) {
    return Math.max((fromStat || 0) - (toArmor || 0), 0);
  }

  // 花瓣 vs 生物【实体分离】的"生物一侧"：生物被推出花瓣轮廓。
  //   · 反质量份额：花瓣越重，生物让得越多（与实体推挤 physicsPush 同一套权重）；
  //   · 保留 PETAL_CONTACT_SKIN 的穿透量：推成"刚好相切"下一 tick 判不到接触，
  //     表现就是"卡在轮廓外沿、既打不到也不再受伤"；
  //   · 单帧位移封顶 16px：一发把巨型生物"弹开半张屏"是错的，其余的下一帧继续；
  //   · 被刚性粘合的链节不动：它们的位置每步末尾由 _solveChains 按轨迹重摆，
  //     推了会被立刻覆盖，只会产生"被推开又拉回"的高频抖动。
  _separateMobFromPetal(m, b, hit) {
    if (!m || !hit || hit.depth <= PETAL_CONTACT_SKIN) return;
    // 没有碰撞箱的花瓣（Glass）：生物不被它推开（花瓣一侧同样跳过，见 Player._separatePetalFromMobs）
    if (b.card && b.card.type && b.card.type.noPush) return;
    if (m._chainLocked) return;
    const invP = 1 / (b.weight || 1);
    const invM = 1 / (m.weight || 1);
    const shareM = invM / ((invP + invM) || 1);
    // 落位型实体（Wax）是不可推动的障碍：单帧分离上限提高到 40px，
    // 低于生物单帧位移时会靠持续挤压穿过去。
    const cap = b.anchor ? 40 : 16;
    const push = Math.min((hit.depth - PETAL_CONTACT_SKIN) * PETAL_SEP_K * shareM, cap);
    if (push > 0) { m.x -= hit.nx * push; m.y -= hit.ny * push; }
  }

  // src = 伤害来源（缺省 = 玩家）。仇恨是按"谁打的"记账的：花瓣/花朵本体的伤害就是玩家，
  // 但召唤物打敌人时来源是那只召唤物、敌人打召唤物时来源是那只敌人 ——
  // 一律记在玩家头上会让召唤物把自己的主人当成最恨的目标（真正的"莫名丢仇恨"）。
  _hitMob(m, toMob, src) {
    if (toMob <= 0) return false;
    const from = src || this.player;
    const r = m.hurt(toMob, from);
    if (r.applied > 0) {
      // 蚁穴挨打：工蚁转敌对 + 按血量批次补员（40 只的总量与占比由池子保证）
      if (m.type && m.type.slug === 'ant_hole') this._antHoleHurt(m);
      // 伤害榜 / 掉落归属只统计玩家本人造成的伤害
      if (Number.isFinite(toMob) && from && from === this.player && m.lastHitByPlayer) {
        m.lastHitByPlayer.set(from, r.applied);
      }
      m.pendDmg = (m.pendDmg || 0) + r.applied;
      if (!(m.dmgTextT > 0)) {
        // 飘字聚合窗口：每 tick 结算一次，若逐 tick 弹字会被刷屏（25 条/秒），
        // 这里聚合成 0.12s 一条 —— 数值是该窗口内【真实累计】的伤害。
        m.dmgTextT = 0.12;
        (this._dmgList || (this._dmgList = [])).push(m);   // 见 _combatTick 末尾
      }
    }
    if (r.killed) {
      // 击杀：立刻把累计真实伤害作为一条飘字弹出（不等聚合窗口），再发击杀事件
      this._flushDmg(m);
      // Super 及以上：全服系统公告（伤害榜榜首 + 稀有度配色）
      this._announceBossKill(m);
      // Ant Egg（生物）被击碎：50% 原地召出复仇幼蚁（蚁后产的无敌卵不算）
      if (m.type && m.type.slug === 'ant_egg' && !m.queenEgg) this._spawnEggAvenger(m);
      this._events.push({
        kind: 'kill', id: m.netId, mobId: (m.type.id != null ? m.type.id : m.name),
        level: m.level, rarity: m.rarity,
        chain: !!m.chainLong,                // 超长蜈蚣的节：客户端据此追加【隐藏掉落】
        // 玩家阵营的生物（Ant Egg 召唤物）不产生任何掉落物
        noDrop: (m.faction === 'player'),
        x: m.x, y: m.y                       // 掉落物出现在生物死亡位置
      });
    }
    return !!(r.killed);
  }

  // Super / Eternal 生物被击杀 -> 全服系统公告：
  //   "A(An) <Rarity> <MobName> was destroyed by <PlayerName>"
  //   · 稀有度、生物名与正文一样取自被击杀生物；
  //   · 玩家名 = 伤害榜榜首（threat 里累计真实伤害最高者；蜜是拉仇恨的假数据，排除）；
  //   · 文字颜色 = 被击杀生物的稀有度色（客户端 Chat 用 ev.color）。
  _announceBossKill(m) {
    if (!m) return;
    const ri = RARITY_ORDER.indexOf(m.rarity);
    if (ri < RARITY_ORDER.indexOf('super')) return;      // 只播报 super / eternal
    if (m.segIdx != null && !m.isHeadSeg) return;        // 多节生物只有头节播报
    let top = null, best = -1;
    for (const t of m.threat || []) {
      if (!t.ent || t.ent.honey) continue;               // 蜜不是伤害来源
      if (t.dmg > best) { best = t.dmg; top = t.ent; }
    }
    const p = this.player;
    const killer = (top && top.name) ? top.name : ((p && p.name) || 'Guest');
    const rarName = I18N.t('Rarities/' + m.rarity + '/Name', m.rarity);
    const mobName = m.name || (m.type && m.type.name) || 'Mob';
    const art = /^[aeiou]/i.test(rarName) ? 'An' : 'A';
    const color = (typeof RARITIES !== 'undefined' && RARITIES[m.rarity])
      ? RARITIES[m.rarity].color : '#fff';
    this._events.push({
      kind: 'sys', channel: 'global', color,
      text: I18N.tf('Chat/Sys/BossDestroyed',
        { 0: art, 1: rarName, 2: mobName, 3: killer },
        art + ' ' + rarName + ' ' + mobName + ' was destroyed by ' + killer)
    });
  }

  // 生成播报：与击杀播报同规格 —— 只播 super / eternal、颜色 = 稀有度色、多节生物只有头节播。
  // 文案一律走本项目自己的键（js/i18n-extra.js）：
  //   · 有专属台词的物种（MOB_SPAWN_LINES）整句替换，颜色仍按稀有度；
  //   · 其余走默认模板 "A <rarity> <mobname> has been spawned!"。
  // 刻意不读官方 Chat/MobSpawned* 模板，也不用 registry 里每只生物的 spawn 文本。
  _announceBossSpawn(m) {
    if (!m) return;
    const ri = RARITY_ORDER.indexOf(m.rarity);
    if (ri < RARITY_ORDER.indexOf('super')) return;      // 只播报 super / eternal
    if (m.segIdx != null && !m.isHeadSeg) return;        // 多节生物只有头节播报
    const rarName = I18N.t('Rarities/' + m.rarity + '/Name', m.rarity);
    const mobName = m.name || (m.type && m.type.name) || 'Mob';
    const slug = m.type && m.type.slug;
    const lineKey = slug ? MOB_SPAWN_LINES[slug] : null;
    const special = lineKey ? I18N.t(lineKey, '') : '';
    const art = /^[aeiou]/i.test(rarName) ? 'An' : 'A';
    const color = (typeof RARITIES !== 'undefined' && RARITIES[m.rarity])
      ? RARITIES[m.rarity].color : '#fff';
    this._events.push({
      kind: 'sys', channel: 'global', color,
      text: special || I18N.tf('Chat/Sys/Spawn/Default',
        { 0: art, 1: rarName, 2: mobName },
        art + ' ' + rarName + ' ' + mobName + ' has been spawned!')
    });
  }

  // 把某个怪在聚合窗口内累计的真实伤害作为一条飘字事件发出（普通命中也要有伤害反馈，
  // 之前只在击杀分支 push -> 所以"只有死亡才显示那一击"）。
  _flushDmg(m) {
    if (!(m.pendDmg > 0)) { m.dmgTextT = 0; return; }
    this._events.push({
      kind: 'dmg', x: m.x, y: m.y - m.r * 0.5, r: m.r,
      text: String(Math.round(m.pendDmg)), color: DAMAGE_TEXT_COLOR
    });
    m.pendDmg = 0; m.dmgTextT = 0;
  }

  // 花瓣实体被打碎：
  //   · 单体卡（一张卡 = 一个实体）-> 整槽进入 reload（卡面扇形阴影）；
  //   · 多体卡（Light 等：一张卡 = N 个实体）-> 只让【这一个实体】进入自己的重装填
  //     （respawnT），卡片本身【不】进入 reload —— 其余实体继续正常飞舞。
  // 从花瓣实体召唤内容物（Ant Egg -> Soldier Ant）。
  // 数值：同稀有度该物种 × summon.scale；大小（长度）同样 × scale。
  // 数值表缺失时返回 null（调用方退回普通重装填），绝不编造数值让怪 hp=0。
  _spawnSummon(src, card, def) {
    const type = MOB_TYPES.find((t) => t && t.slug === def.slug);
    if (!type) {
      if (!this._warnedSummon) { this._warnedSummon = {}; console.warn('[summon] 未知物种', def.slug); this._warnedSummon[def.slug] = 1; }
      return null;
    }
    const base = (type.rarityStats && type.rarityStats[card.rarity]) || null;
    if (!base || !(base.hp > 0)) {
      if (!this._warnedSummon) { this._warnedSummon = {}; }
      const key = def.slug + ':' + card.rarity;
      if (!this._warnedSummon[key]) {
        this._warnedSummon[key] = 1;
        console.warn('[summon] 缺少数值表：', def.slug, card.rarity, '（需补 MOB_RARITY_OVERRIDES）');
      }
      return null;
    }
    const k = def.scale || 1;
    const st = Object.assign({}, base, {
      hp: base.hp * k, dmg: (base.dmg || 0) * k, exp: 0
    });
    const type2 = Object.assign({}, type, {
      rarityStats: Object.assign({}, type.rarityStats, { [card.rarity]: st }),
      sizeScale: (type.sizeScale || 1) * k
    });
    const mob = new Mob(type2, src.x, src.y, 1, card.rarity);
    mob.netId = this.nextEntityId();
    // 玩家阵营：与玩家、其它召唤物同阵营；敌对一切非本方阵营实体
    mob.faction = 'player';
    mob.isSummon = true;
    mob.summonFrom = { slotIndex: src.slotIndex, rarity: card.rarity, slug: card.type.slug };
    // 血条永久显示 + 血条下方的 "Summon" 标签（Unusual 颜色、左对齐）
    mob.permanentHpBar = true;
    mob.hpBarTag = 'Summon';
    // 跟随数据（属性，不是专属 AI）：follow 阀值来自 MOB_TRAITS，行为在通用 wander 里。
    mob.followEnt = this.player;
    // 【碰撞与其它生物同一口径】：普通生物在第一次 update 里建轮廓（Mob._ensureShape），
    // 召唤物是在 sysCombat 中途生成的，否则要等下一步 sysMobs 才建 —— 那一帧里它只有
    // "外接圆"半径、F3 也没有碰撞箱，看起来就是"召唤物没有碰撞"。
    mob._ensureShape();
    this._addEnt(mob);
    return mob;
  }

  _destroyPetal(b) {
    const p = this.player;
    // 先问引擎：某些实体"碎了"要留下东西（Web 在飞行途中被打碎 -> 原地立刻张网）。
    // 注意顺序：必须在 b.dead = true 之前（钩子要读它的位置/状态）。
    if (p && b && !b.dead && typeof PetalFX !== 'undefined' && PetalFX.onPop) {
      PetalFX.onPop(b, p);
    }
    b.dead = true;
    EntityFX.despawn(b);          // 权威侧也走同一条离场通道（复活时由 spawn 重新入场）
    const c = b.card;
    const dur = petalReloadOf(c);
    if (!p) return;
    // 放在地上的实体（Pollen / Honey 脱轨后）：打碎就是打碎，不会"复活"——
    // 它不属于当前这一批，卡槽在脱轨那一刻就已经进入冷却（Honey 的冷却暂停
    // 由 _tickReload 按"是否还有存活滞留实体"自动解除）。
    if (b.stationary) return;
    const cnt = (typeof CardRenderer !== 'undefined' && CardRenderer.lightSubCount)
      ? CardRenderer.lightSubCount(c.type, c.rarity) : 1;
    // 内容物型花瓣（Ant Egg）：死亡 -> 原地召唤一只召唤物，
    // 并且【这一个蛋】的重装填被挂起，直到它的召唤物死亡（见 1.5) 段与 _onSummonDead）。
    const summon = c.type && c.type.summon;
    if (summon) {
      const unit = this._spawnSummon(b, c, summon);
      if (unit) {
        b.holdRespawn = true;
        b.respawnT = dur;
        b.summonUnit = unit;
        return;
      }
      // 召唤失败（物种数值表缺失等）：退回普通重装填，避免卡片永久卡死
    }
    if (cnt > 1) { b.respawnT = dur; return; }
    p.reload[b.slotIndex] = { card: c, age: 0, dur };
  }

  // ---- 聊天：服务器全局设定。按频道路由；Local 只投给半径内的接收者。 ----
  // 半径内没有其他接收者 -> 以系统名义私信发送者一条红字（Chat/Alone）。
  sendChat(channel, text) {
    const p = this.player;
    const name = p ? p.name : 'Guest';
    // 指令：以 / 开头视为指令，不进入普通聊天（类型不匹配等一律走 i18n 系统提示）
    if (text && typeof text === 'string' && text[0] === '/') { this._handleCommand(text, channel); return; }
    // 本地实现只有一个玩家，因此 Local 永远"周围没人" -> 必定收到系统红字私信。
    const heard = this._recipients(channel, p).length;
    this._events.push({ kind: 'chat', channel, from: name, text });
    if (heard === 0) {
      this._events.push({ kind: 'sys', channel, text: 'Chat/Alone' });
    }
  }
  // 返回该频道能收到消息的实体（本地只有玩家自己一个"他人"之外的接收者）
  _recipients(channel, from) { return []; }

  // 匹配玩家：全名 / 忽略大小写，以及 "#0333" -> "Guest #0333"（客人玩家）
  _matchPlayer(input) {
    if (!input) return null;
    const cands = [];
    if (this.player) cands.push(this.player);
    if (Array.isArray(this.players)) for (const pl of this.players) cands.push(pl);
    const q = String(input).trim(), ql = q.toLowerCase();
    for (const pl of cands) {
      const pn = pl && pl.name;
      if (!pn) continue;
      if (pn === q || pn.toLowerCase() === ql) return pl;
      if (q[0] === '#' && pn.toLowerCase() === 'guest ' + ql) return pl;
    }
    return null;
  }

  // 服务端处理的指令：/init、/summon、/kill、/kill-mob、/resphere。
  // 其余指令均已在客户端 chat.js 本地实现；走到这里的一律按未知指令处理。
  _handleCommand(raw, channel) {
    const p = this.player;
    if (!p) return;
    const parts = String(raw).trim().split(/\s+/).filter(Boolean);
    const cmd = (parts[0] || '').toLowerCase();
    if (cmd === '/init') {
      // /init <map>：按地图生成表把全图一次性铺满，之后由 tick 维持
      const res = this.initMap(parts[1]);
      if (!res.ok) {
        if (res.cur) {
          this._events.push({
            kind: 'sys', channel,
            text: I18N.tf('Chat/Command/init/BadMap', { 0: res.cur }, 'Invalid map. Current map: ' + res.cur)
          });
        } else {
          this._events.push({ kind: 'sys', channel, text: res.err || 'Chat/CommandError/InternalError' });
        }
        return;
      }
      this._events.push({
        kind: 'sys', channel,
        text: I18N.tf('Chat/Command/init/Done',
          { 0: (this.map && this.map.name) || 'map', 1: res.spawned, 2: res.total },
          'Initialized ' + ((this.map && this.map.name) || 'map') + ': spawned ' + res.spawned + ' mob(s) (target ' + res.total + ').')
      });
    } else if (cmd === '/summon') {
      // /summon <mob_id> <rarity>[<k=v,...>] <count>
      //   参数用方括号追加在稀有度后面，例如：/summon 3 common[type=long] 1
      //   目前只有多节生物（蜈蚣）支持 type，有效值 normal / long
      const mobId = parseInt(parts[1], 10);
      const rareArg = parts[2] || '';
      const count = parseInt(parts[3], 10);
      if (!Number.isFinite(mobId) || mobId < 0 || !MOB_BY_ID[mobId]) {
        this._events.push({ kind: 'sys', channel, text: 'Chat/Command/summon/BadMobId' }); return;
      }
      const rm = /^([A-Za-z_]+)(?:\[([^\]]*)\])?$/.exec(rareArg);
      const rarity = rm ? rm[1].toLowerCase() : '';
      const opts = {};
      if (rm && rm[2]) {
        for (const seg of rm[2].split(',')) {
          const kv = seg.split('=');
          if (kv.length !== 2 || !kv[0].trim()) {
            this._events.push({ kind: 'sys', channel, text: 'Chat/Command/summon/BadParam' }); return;
          }
          opts[kv[0].trim().toLowerCase()] = kv[1].trim().toLowerCase();
        }
      }
      if (!rarity || RARITY_ORDER.indexOf(rarity) < 0) {
        this._events.push({ kind: 'sys', channel, text: 'Chat/Command/summon/BadRarity' }); return;
      }
      if (!Number.isFinite(count) || count < 1) {
        this._events.push({ kind: 'sys', channel, text: 'Chat/Command/summon/BadCount' }); return;
      }
      const type = MOB_BY_ID[mobId];
      const chain = isSegmentMob(type);
      // 参数校验：只认多节生物的 type；其余组合一律报错，避免"写了参数却没生效"
      for (const k of Object.keys(opts)) {
        if (k !== 'type' || !chain || (opts[k] !== 'normal' && opts[k] !== 'long')) {
          this._events.push({ kind: 'sys', channel, text: 'Chat/Command/summon/BadParam' }); return;
        }
      }
      const n = Math.max(1, Math.min(count, 50));   // 上限保护，避免一次刷太多
      const px = p.x, py = p.y;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const r = n > 1 ? 20 + Math.random() * 25 : 0;
        if (chain) {
          // 多节生物：一次生成整条。type=long 强制超长、type=normal 强制短版，
          // 不写参数则走自然规则（只有 common 有 0.3% 概率长成超长个体）。
          this._spawnChain(type, px + Math.cos(a) * r, py + Math.sin(a) * r, rarity, null, opts.type);
        } else {
          this.addEnt('mob', mobId, rarity, 1, px + Math.cos(a) * r, py + Math.sin(a) * r);
        }
      }
      InvulnFX.add(p, 'summon', 4);
      this._events.push({ kind: 'sys', channel, text: 'Chat/Command/summon/Done' });
    } else if (cmd === '/kill') {
      // /kill <player>：杀死对应玩家（#0333 匹配 Guest #0333）；找不到报错
      const target = this._matchPlayer(parts[1]);
      if (!target) { this._events.push({ kind: 'sys', channel, text: 'Chat/CommandError/TargetNotFound' }); return; }
      target.hp = 0;
      if (typeof target.die === 'function') target.die();
      this._events.push({ kind: 'sys', channel, text: I18N.tf('Chat/Command/kill/Done', { 0: target.name }, 'Killed ' + target.name + '.') });
    } else if (cmd === '/kill-mob') {
      // /kill-mob <mob_id> <rarity|all> <near|all> [count]：count 仅 near 时必填
      const mobId = parseInt(parts[1], 10);
      const rarity = (parts[2] || '').toLowerCase();
      const scope = (parts[3] || '').toLowerCase();
      const countArg = parts[4];
      if (!Number.isFinite(mobId) || mobId < 0 || !MOB_BY_ID[mobId]) { this._events.push({ kind: 'sys', channel, text: 'Chat/Command/kill-mob/BadMobId' }); return; }
      if (rarity !== 'all' && RARITY_ORDER.indexOf(rarity) < 0) { this._events.push({ kind: 'sys', channel, text: 'Chat/Command/kill-mob/BadRarity' }); return; }
      if (scope !== 'near' && scope !== 'all') { this._events.push({ kind: 'sys', channel, text: 'Chat/Command/kill-mob/BadScope' }); return; }
      let count = Infinity;
      if (scope === 'near') {
        count = parseInt(countArg, 10);
        if (!Number.isFinite(count) || count < 1) { this._events.push({ kind: 'sys', channel, text: 'Chat/Command/kill-mob/BadCount' }); return; }
      } else if (countArg != null) {
        this._events.push({ kind: 'sys', channel, text: 'Chat/Command/kill-mob/BadCount' }); return;   // all 不接受 count
      }
      const NEAR_R = 900, px = p.x, py = p.y;
      let killed = 0;
      for (const m of this.ents) {
        if (m.dead) continue;
        if (m.type.id !== mobId) continue;
        if (rarity !== 'all' && m.rarity !== rarity) continue;
        if (scope === 'near' && (m.x - px) * (m.x - px) + (m.y - py) * (m.y - py) > NEAR_R * NEAR_R) continue;
        // 伤害给【无穷大】：1e9 打不动 eternal（血量 9.18e8 只是蜜蜂一例，
        // 其它物种的 eternal 血量会超过它），于是"指令说杀了但怪还在"。
        // Infinity 会经过 hurt() 的 Math.min(dmg, hp) 截断成"本击实际伤害"，不会溢出。
        if (this._hitMob(m, Infinity)) killed++;   // 只在真正死亡时计入，避免假报成功
        if (killed >= count) break;
      }
      this._events.push({ kind: 'sys', channel, text: I18N.tf('Chat/Command/kill-mob/Done', { 0: killed }, 'Killed ' + killed + ' mob(s).') });
    } else if (cmd === '/resphere') {
      if (!p.dead) return;            // 活着直接忽略，不报错
      this._respawnInPlace();
      this._events.push({ kind: 'sys', channel, text: 'Chat/Command/resphere/Done' });
    } else {
      this._events.push({ kind: 'sys', channel, text: 'Chat/Command/Unknown' });
    }
  }

  // 原地复活：保留死亡地点 (x,y)，只恢复状态/无敌/仇恨豁免
  _respawnInPlace() {
    const p = this.player;
    if (!p) return;
    // 统一重置入口（pos = null 表示不改坐标）：清花瓣实体/世代号/装填，与其它复活路径一致。
    p.resetForSpawn(null);
    for (const m of this.ents) if (m.threat) m.threat.length = 0;
    // 通知客户端同步重置自己的预测副本（否则客户端不知道这次重生，世代号照样会漂）
    this._events.push({ kind: 'respawned', x: p.x, y: p.y, cp: -1 });
  }

  drainEvents() { const e = this._events; this._events = []; return e; }

  // ---------------- 背包权威 ----------------
  // 客户端只能发 op，不能自带数量：所有增减在这里算完，回传【整份】新背包让客户端覆盖镜像。
  _invSnapshot() {
    const o = {};
    for (const k in this.inventory) o[k] = this.inventory[k];
    return o;
  }
  _invCount(key) { return this._debugInv ? Infinity : (this.inventory[key] || 0); }
  _invSet(key, n) { if (!this._debugInv) this.inventory[key] = Math.max(0, n); }

  invRequest(a) {
    const op = a.op;
    const snap = () => ({ inventory: this._invSnapshot() });
    if (op === 'get') return snap();
    // 卸下全部装载材料：不需要 key，只认服务端记录的 pending。
    if (op === 'unload') {
      const prev = this.pendingCraft;
      if (prev) {
        this._invSet(prev.key, this._invCount(prev.key) + prev.n);
        this.pendingCraft = null;
      }
      return snap();
    }
    // 领取结果：同样不需要 key，必须放在下面的 key 校验之前
    if (op === 'takeResult') {
      const r = this.pendingResult;
      if (r) {
        this._invSet(r.key, this._invCount(r.key) + r.count);
        this.pendingResult = null;
      }
      return Object.assign({ taken: r ? r.count : 0 }, snap());
    }
    const key = a.key;
    if (typeof key !== 'string' || !key) return Object.assign({ error: 'bad key' }, snap());
    const n = Math.max(1, Math.floor(Number(a.n) || 1));
    const fail = (err) => Object.assign({ error: err }, snap());

    if (op === 'take') {
      if (this._invCount(key) < n) return fail('not enough');
      this._invSet(key, this._invCount(key) - n);
    } else if (op === 'return' || op === 'add') {
      this._invSet(key, this._invCount(key) + n);
    } else if (op === 'load') {
      // 装载合成材料：点击时就扣（库存立刻减少）；换卡/叠加先返还上一批。
      if (this._invCount(key) < n) return fail('not enough');
      const prev = this.pendingCraft;
      if (prev) this._invSet(prev.key, this._invCount(prev.key) + prev.n);
      this._invSet(key, this._invCount(key) - n);
      this.pendingCraft = { key, n };
    } else if (op === 'craft') {
      // 只消费服务端已扣的材料：客户端传来的 n / target 一律不采信。
      const pc = this.pendingCraft;
      if (!pc) return fail('no pending craft');
      if (pc.key !== key) return fail('key mismatch');
      const m = pc.n;
      this.pendingCraft = null;
      const bar = pc.key.indexOf('|');
      const typeKey = bar >= 0 ? pc.key.slice(0, bar) : pc.key;
      const rarity = bar >= 0 ? pc.key.slice(bar + 1) : '';
      const target = (typeof craftTargetOf === 'function') ? craftTargetOf(rarity) : null;
      if (!target) return fail('bad rarity');
      const p = (typeof CRAFT_CHANCE !== 'undefined' && CRAFT_CHANCE[target] != null)
        ? CRAFT_CHANCE[target] : 0;
      let left = m, wins = 0, losses = 0;
      while (left >= 5) {   // 失败剩余继续复用，直到不足 5 张
        if (Math.random() < p) { wins++; left -= 5; }
        else { const lose = 1 + Math.floor(Math.random() * 4); losses += lose; left -= lose; }
      }
      // 剩余 1~4 张继续【留在装载槽】（已扣状态），不返还背包：
      // 客户端 st.count = left，卸下时才由 unload 返还，两边始终一致。
      if (left > 0) this.pendingCraft = { key: pc.key, n: left };
      const tk = typeKey + '|' + target;
      // 旧结果若还没拿下：被替下这一刻才真正入包（用户口径）。
      if (this.pendingResult) {
        const old = this.pendingResult;
        this._invSet(old.key, this._invCount(old.key) + old.count);
      }
      // 新结果先挂在服务端，等玩家点结果卡 / 被下一拨替下才计入 inventory。
      this.pendingResult = wins > 0 ? { key: tk, count: wins } : null;
      return Object.assign({ wins, losses, left, target }, snap());
    } else {
      return fail('unknown op');
    }
    return snap();
  }

  // 请求/应答入口：本地实现与远端传输层共用同一份分发，避免两处 if/else 分叉。
  // 返回值必须是纯数据（可 JSON 序列化）；字符串表示 i18n 错误键。
  handleRequest(kind, payload) {
    const a = payload || {};
    switch (kind) {
      case 'respawn':
        return this.requestRespawn();
      case 'teleport':
        return this.teleport(a.x, a.y) || null;    // null = 成功
      case 'init':
        this.initMap(a.map);
        return true;
      case 'player': {
        const p = this.player;
        if (!p) return null;
        return {
          name: p.name, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, level: p.level
        };
      }
      case 'players':
        return this.player ? [{ name: this.player.name }] : [];
      case 'inv':
        return this.invRequest(a);
      default:
        return { error: 'unknown request: ' + kind };
    }
  }

  // ---- 快照：纯数据，可 JSON 序列化 ----
  // dt = 本快照覆盖的模拟时长。客户端用它算插值步长，
  // 高刷新率屏幕（144Hz）下才不会被固定 1/25 拖成"永远追不上"。
  snapshot(dt) {
    const p = this.player;
    return {
      t: this.t,
      dt: dt || SNAP_DT,
      player: p ? {
        x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, dead: p.dead,
        invuln: p.invuln, killedBy: p.killedBy, bodyDmg: p.bodyDmg,
        // 表现层状态：受伤红闪由服务端置位，必须下发，否则客户端永远不会红闪。
        // deathRot 也在服务端 die() 里随机生成，不下发客户端尸体就不会旋转。
        hurtT: p.hurtT || 0, deathRot: p.deathRot || 0
      } : null,
      // 花瓣战斗状态：客户端不跑战斗，只按这里的 hp/hurtT/dead 做表现。
      // 一张卡可能对应多个独立实体（Light 的每个光点）：用 (slot, sub, gen) 唯一定位。
      // gen = 世代号：滞留型花瓣（Pollen / Honey）脱轨后重新装填，同一槽会同时存在多批实体。
      // 滞留实体的位置与速度也由服务端下发：它们会被生物硬碰撞推挤。
      petals: this._snapPetals(p),
      // 场级实体（网）：玩家的网 + 蜘蛛自铺/大招的网，全部下发。
      // 客户端只渲染这里下发的网；玩家网与蜘蛛网共用同一套生成 / 到期 / 退场流程。
      webs: this._snapWebs(),
      // 全量下发：小地图要能看到全图人口（远处生物的 AI 仍由 activeR() 休眠省算力）
      ents: this._fillEnts(),
      projectiles: this._fillHornetProjectiles()
    };
  }

  // 快照里的花瓣状态：必须覆盖"有卡但此刻没有实体"的槽位。
  // 花瓣打碎后 _destroyPetal 只打 dead 标记并进入 reload，实体要到下一帧才移出 p.petals；
  // 若不补齐 dead 记录，客户端按 (slot, sub, gen) 找不到条目，就会留下一片
  // 既不碎裂也不进入装填、且不参与伤害结算的幽灵花瓣。
  _snapPetals(p) {
    // 与 _fillEnts 同一套对象复用：25Hz 下每帧 new 一个数组 + 十几个对象是纯 GC 负担。
    // 快照是同步消费的（客户端在本次 step 里读完），没有人会把数组留到下一帧。
    const out = this._petalBuf || (this._petalBuf = []);
    let n = 0;
    if (!p) { out.length = 0; return out; }
    // 一趟扫完：下发实体的同时记下"哪些槽已有实体记录"，
    // 省掉后面"每槽再扫一遍 p.petals"的 O(槽×花瓣)。
    const slots = p.slots || [];
    let hasSlot = this._petalHas;
    if (!hasSlot || hasSlot.length < slots.length) {
      hasSlot = this._petalHas = new Uint8Array(Math.max(32, slots.length));
    }
    hasSlot.fill(0);
    for (const b of p.petals) {
      const o = out[n] || (out[n] = {});
      o.slot = b.slotIndex; o.sub = b.sub || 0; o.gen = b.gen || 0;
      o.hp = b.hp; o.maxHp = b.maxHp;
      o.hurtT = b.hurtT || 0; o.dead = !!b.dead;
      // 所有花瓣都下发位置与速度：客户端不自行模拟花瓣运动，
      // 否则脱轨飞行段会与服务端物理不一致（表现为飞出后闪现回轨道）。
      o.x = b.x; o.y = b.y; o.vx = b.vx || 0; o.vy = b.vy || 0;
      if (b.slotIndex >= 0 && b.slotIndex < hasSlot.length) hasSlot[b.slotIndex] = 1;
      n++;
    }
    for (let i = 0; i < slots.length; i++) {
      const c = slots[i];
      if (!c) continue;
      if (hasSlot[i]) continue;   // 该槽已有实体记录（含"已碎但还没被移除"的多体子体）
      // 一卡多体（Light 等）按实体数补齐，否则客户端只杀得掉 sub 0，其余照旧是幽灵。
      const cnt = (typeof CardRenderer !== 'undefined' && CardRenderer.lightSubCount)
        ? CardRenderer.lightSubCount(c.type, c.rarity) : 1;
      const gen = ((p._petalGen && p._petalGen[i]) | 0);
      for (let sub = 0; sub < Math.max(1, cnt); sub++) {
        const o = out[n] || (out[n] = {});
        o.slot = i; o.sub = sub; o.gen = gen;
        o.hp = 0; o.maxHp = 0; o.hurtT = 0; o.dead = true;
        o.x = 0; o.y = 0; o.vx = 0; o.vy = 0;
        n++;
      }
    }
    out.length = n;
    return out;
  }

  // 快照里的【场级实体】（网）：单一来源 this.fields（玩家网 + 蜘蛛自铺/大招的网合并）。
  // id 全部来自 nextEntityId()（单调），客户端按 id 对齐，不会下标漂移。
  // 只下发"是什么状态"，入场/退场的动画进度由客户端 EntityFX 按 exitT 对齐。
  _snapWebs() {
    const out = this._webBuf || (this._webBuf = []);
    const fields = this.fields;
    const len = fields.length;
    let n = 0;
    for (let i = 0; i < len; i++) {
      const f = fields.get(i);
      if (!f) continue;
      const o = out[n] || (out[n] = {});
      o.id = f.netId;
      o.x = f.x; o.y = f.y; o.r = f.r;
      o.exiting = !!f.exiting; o.exitT = f.exitT || 0;
      o.owner = f.owner || null;   // 'mob' = 敌方蛛网（只减速玩家），其它 = 玩家网（只减速生物）
      n++;
    }
    out.length = n;
    return out;
  }

  // ---- 快照里的生物数组 ----
  // 复用同一批对象，避免每次快照创建数千个新对象。
  // 快照在本步内被同步消费；远端实现会先序列化，都不会保留到下一个快照。
  _fillEnts() {
    const src = this.ents;
    const buf = this._entBuf || (this._entBuf = []);
    let n = 0;
    for (let i = 0; i < src.length; i++) {
      const m = src[i];
      let o = buf[n];
      if (!o) o = buf[n] = {};
      o.id = m.netId; o.typeId = m.type.id; o.rarity = m.rarity; o.level = m.level;
      o.x = m.x; o.y = m.y; o.facing = m.facing; o.hp = m.hp; o.maxHp = m.maxHp; o.dead = m.dead;
      // 速度：客户端 physicsPush 的"接近速度"项需要生物真实速度。
      // 不下发时客户端把生物冲过来的动能整段丢掉，玩家预测位置会持续偏离权威位置。
      o.vx = m.vx || 0; o.vy = m.vy || 0;
      // 多节生物：头节(12_h 带触角) / 身体节(12_b) 用不同贴图，必须下发否则客户端画不出区分
      o.artSvg = m.artSvg || null;
      o.pollenShot = !!m.pollenShot;      // Bumble Bee 产出的 Pollen，客户端据此标记视图
      // 多节生物的节序号：客户端据此不做逐节插值（见 game.js），保证整条刚性对齐、顺序不错
      o.segIdx = (m.segIdx != null) ? m.segIdx : null;
      // 名牌显示模式（'classic' 经典 / 'player' 主角血条式），见 sim/mob.js Mob.draw
      o.plateStyle = m.plateStyle || null;
      // 血条下方额外标签（召唤物 = 'Summon'）与阵营：客户端只负责画/选目标，不做玩法判断
      o.hpBarTag = m.hpBarTag || null;
      o.faction = m.faction || 'enemy';
      o.isSummon = !!m.isSummon;
      // 表现层状态【表驱动】：字段清单只在 net/protocol.js 的 FX_FIELDS 里声明一次，
      // 这里按表写值，客户端 _applySnap 按同一张表回填 —— 不可能只改一半。
      const fxo = m._snapFx || (m._snapFx = {});
      for (const k in FX_FIELDS) fxo[k] = FX_FIELDS[k].get(m);
      o.fx = fxo;
      const hm = m.hornet && m.hornet.missile;
      // 弹体与导弹同样按母体复用一套对象（每条母体自己的池），避免 25Hz 下持续造对象。
      const mo = hm ? (m._snapMissile || (m._snapMissile = {})) : null;
      if (mo) {
        mo.id = hm.id; mo.x = hm.x; mo.y = hm.y; mo.facing = hm.facing;
        mo.vx = hm.vx; mo.vy = hm.vy; mo.flight = !!hm.flight;
        mo.hp = hm.hp; mo.maxHp = hm.maxHp;
        mo.hurtT = hm.hurtT || 0; mo.age = hm.age || 0;
        mo.exiting = !!hm.exiting; mo.exitT = hm.exitT || 0;
        mo.dead = !!hm.dead; mo.radius = hm.radius || 0; mo.drawSize = hm.drawSize || 0;
      }
      o.hornetMissile = mo;
      n++;
    }
    buf.length = n;
    return buf;
  }

  _fillHornetProjectiles() {
    const src = this.hornetProjectiles || new Map();
    const out = this._projectileBuf || (this._projectileBuf = []);
    let i = 0;
    for (const p of src.values()) {
      const o = out[i] || (out[i] = {});
      o.id = p.id; o.parentId = p.parentId;
      o.x = p.x; o.y = p.y; o.facing = p.facing;
      o.hp = p.hp; o.maxHp = p.maxHp; o.hurtT = p.hurtT || 0;
      o.age = p.age || 0; o.exiting = !!p.exiting; o.exitT = p.exitT || 0;
      o.dead = !!p.dead; o.radius = p.radius || 0; o.drawSize = p.drawSize || 0;
      i++;
    }
    out.length = i;
    return out;
  }
}
