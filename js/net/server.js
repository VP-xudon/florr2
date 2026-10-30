// net/server.js — LocalServer：权威模拟世界（无 DOM / Canvas 依赖）
'use strict';

class LocalServer {
  constructor() {
    this.t = 0;                 // 服务端累计时间（秒）
    this.nextId = 1;
    this.ents = [];             // 权威 Mob 实体（只增不减由 cull 负责）
    this.player = null;         // 玩家权威副本（跑同一套物理，供战斗定位）
    this.map = null;            // 碰撞地图（与客户端同一份）
    this._input = { dx: 0, dy: 0, mode: 'normal' };
    this._events = [];          // 待投递事件（聊天、系统私信）
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
  // 注意：调用方必须已经把 ?hp=N 等调试参数应用到 playerTemplate 上，
  // 否则服务端副本会停留在 new Player() 的默认 100 血，
  // 而客户端每帧都用快照的 hp 覆盖自己 -> 表现为"?hp 无效、一碰就死"。
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
    p.recompute();
    // 出生状态统一走 Player.resetForSpawn：出生无敌 + 花瓣实体/世代号/装填 与客户端同源。
    // 少了出生无敌时，服务端副本从第 0 帧起就能被打 -> 客户端被快照置为 dead -> 一碰就死。
    p.resetForSpawn(playerTemplate);
    this._slotSig = '';
    // 地图/玩家就位后立刻按生成表把全图铺满（等价于 /init <map>），避免开局空场
    this.spawnT = 0;
    this._autoInit();
  }

  // 客户端装备发生变化时把最新 slots 同步给权威副本（按签名去重，避免每帧 recompute）
  syncLoadout(slots, hold) {
    const p = this.player;
    if (!p || !slots) return;
    // 换卡动画期间的"装填暂停"是客户端表现层状态，必须上行同步给权威副本；
    // 否则服务端按真实时间继续装填、客户端还在扇形阴影里 —— 表现为"卡没转好怪就已经开始掉血"。
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

  applyInput(input) { this._input = input; }

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

  // ---------------- 生物生成（按地图生成表，服务端全局管理） ----------------
  // 生成表是【地图/服务端数据】，不围绕玩家转：
  //   · 每个 spawn_mobs 区有自己的目标数量 = 面积(格) × density × SPAWN_PER_TILE（单区封顶）
  //   · 全图总和超过 GLOBAL_MAX_MOBS 时按比例缩减（保持各区相对比例）
  //   · /init <map> 一次性把全图补到目标；之后每 SPAWN_INTERVAL 秒补最缺的那一只
  //   · 稀有度由该区 difficulty 决定；位置在区多边形内随机（不挑玩家附近）
  //   · 远处生物休眠（只保留位置，不跑 AI），所以全图人口不等于全图负载
  aliveMobs() {
    let n = 0;
    for (const m of this.ents) if (!m.dead) n++;
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

  // 在某个区里生成一只（内部用）
  _spawnInZone(zone) {
    const pick = this._pickSpawnType(zone);
    if (!pick || !pick.type) return false;
    const pos = this._zoneSpawnPoint(zone);
    if (!pos) {
      // 该区取不到可站立点（整块是墙）：冷却 5s，别在这儿空转
      if (zone) zone.nextTry = (this.t || 0) + 5;
      return false;
    }
    const rarity = rollMobRarityByDifficulty(zone ? zone.difficulty : 0);
    // 多节生物（蜈蚣）：一次生成【一整条】，而不是一只
    if (isSegmentMob(pick.type)) {
      this._spawnChain(pick.type, pos[0], pos[1], rarity, zone);
    } else {
      const m = new Mob(pick.type, pos[0], pos[1], 1, rarity);
      m.x = pos[0]; m.y = pos[1];
      m.spawnZone = zone || null;
      m.netId = this.nextId++;
      this.ents.push(m);
      this._announceBossSpawn(m);          // super / eternal 才真的播（内部判）
    }
    return true;
  }

  // 多节生物（蜈蚣）：一次生成【一整条】——
  //   · 节数 8~15；超长个体 45~60 节（约 50 节）
  //   · 【自然生成】只有 common 才有 0.3% 概率长成超长个体；其他稀有度一律普通长度
  //   · /summon 可以显式指定 mode：'long'（强制超长，任意稀有度）/ 'normal'（强制普通）
  //   · 只有【头节】带触角（12_h.svg），其余节是身体（12_b.svg）
  //   · 每一节都是【独立实体】：各自血量、各自结算碰撞与伤害（像多个生物黏在一起）
  //   · 链只决定"谁跟着谁"：_lead 为 null 的那节就是【头】，跑自己的 AI 驱动它后面那整段；
  //     前节一死，后节的 _lead 自动置空 -> 分裂成多段，每段由自己最前一节的 AI 控制
  //     （不管那节有没有触角）。
  //   · 超长个体（chainLong）的每一节额外带一套【隐藏掉落】，不写进掉落表、不显示在生物信息栏。
  _spawnChain(type, x, y, rarity, zone, mode) {
    const huge = (mode === 'long')
      || (mode !== 'normal' && rarity === 'common' && Math.random() < 0.003);
    const n = huge ? (45 + Math.floor(Math.random() * 16)) : (8 + Math.floor(Math.random() * 8));
    const a = Math.random() * TAU;                        // 头的朝向（前进方向）
    const rs = type.rarityStats && type.rarityStats[rarity];
    let prev = null;
    const segs = [];                                     // 本链全部节（用于预置轨迹）
    // 出生摆位：沿【直线】排开（CURVE = 0）。
    // 早期为了"看起来软"曾用 0.11 rad/节（整条 76° 的弧），但头部规则改成
    // "每趟走直线 + 换趟弧线转弯"之后，出生时那条弧会一直挂在身体上直到被走完，
    // 视觉上就是一条无中生有的 S —— 这正是"行进还有蜜蜂一样的 S 型"的来源。
    // 出生必须是直线，形状只能来自头真正走过的路径。
    const CURVE = 0;                                     // 相邻两节之间的转角(rad)
    let px = x, py = y, dir = a + Math.PI;               // dir = 由头指向尾的方向
    for (let i = 0; i < n; i++) {
      const m = new Mob(type, x, y, 1, rarity);
      m.netId = this.nextId++;
      m.spawnZone = zone || null;
      m.segIdx = i;
      m.chainLong = huge;                                // 超长个体：每节都带隐藏掉落
      m.isHeadSeg = (i === 0);                           // 只有头节带触角
      m.artSvg = m.isHeadSeg ? '12_h' : '12_b';
      // 名牌模式【生成时定死】：只有最初那个带触角的头节用经典名牌，其余节一律主角血条模式。
      // 之后即使某一节因被打断而升为一段的头，也保持它出生时的模式（不再变回经典名牌）。
      m.plateStyle = m.isHeadSeg ? 'classic' : 'player';
      // 经验按节数均分：打完整条合计 = 表里给的 XP Reward（否则 8~60 节会翻好几倍）
      if (rs && rs.exp) m.exp = Math.max(1, Math.round(rs.exp / n));
      const sp = (m.r || 12) * 1.4;                      // 相邻两节的出生间距
      m.x = px; m.y = py;
      // 【朝向必须显式给】：Mob 构造里是随机 facing。不设的话头会"歪着"长在身体上
      // （身体沿固定方向铺开、头却朝任意方向）—— 这就是看起来"头部分离"的原因。
      // 朝向 = 朝向前方（头），即 dir 的反方向。
      m.facing = dir + Math.PI;
      m._lead = prev;                                    // 前一节（null = 自己是头）
      // 被粘合的节完全不跑自己的 AI/移动 —— 位置与朝向由 _solveChains 刚性解算。
      // 否则"跟随"和"刚性解算"两套逻辑会互相打架（表现为原地打转、左右抽搐）。
      m._chainLocked = !!prev;
      if (prev) prev._next = m;                          // 后一节（用于刚性粘合解算）
      this.ents.push(m);
      segs.push(m);
      prev = m;
      // 沿弧推进到下一节的位置
      px += Math.cos(dir) * sp;
      py += Math.sin(dir) * sp;
      dir += CURVE;
    }
    // 生成播报：整条链只播一次，且只认【头节】（其余节在 _announceBossSpawn 里也会被挡掉）
    if (segs.length) this._announceBossSpawn(segs[0]);

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
    }
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
    this.spawnT = 0;
    this._inited = true;
    console.info('[spawn] init ' + (this.map.name || 'map') + ': spawned ' + spawned +
      ' (target ' + total + '), alive=' + alive);
    return { ok: true, spawned, total };
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
    const m = new Mob(pick.type, x, y, 1, rollMobRarityByDifficulty(0));
    m.x = x; m.y = y;
    m.spawnZone = null;
    m.netId = this.nextId++;
    this.ents.push(m);
    return true;
  }

  addEnt(kind, typeId, rarity, level, x, y) {
    const type = MOB_BY_ID[typeId];
    if (!type) return null;
    const m = new Mob(type, x, y, level || 1, rarity);
    m.netId = this.nextId++;
    this.ents.push(m);
    this._announceBossSpawn(m);            // /summon 等走通用工厂的生成同样播报
    return m;
  }

  // 多节生物【刚性粘合】：不是"跟随/追赶"（那会有延迟、拉开缝），
  // 而是每帧末按节间距【直接解算】：前一节定位后，后面每一节被强制放在
  // "距前一节恰好 gap"的位置上 —— 整条无缝连成一串，中间不会脱开。
  // gap 略小于两节半径之和 => 轻微重叠，看不出接缝。
  // 断裂处理：某一节死亡后，_lead 被置空，它后面那一节自动成为新一段的起点，
  // 于是整条被切成多段，每段各自独立解算（配合各自的 AI 驱动）。
  _solveChains() {
    // 相邻两节的标称间距系数：1.002 => 两圆【刚好相切】、留 0.2% 的缝。
    // 旧值是 0.92（故意重叠 8% 假装"软身体"），用户要求体节一律不许重合，故取消。
    // 代价是整条链变成"刚性相切链"，弯道时内弯侧必须由下面的硬挤压把非相邻节也推开。
    const GLUE = 1.002;
    // 轨迹采样间距(px)：4px 已经足够平滑，点数只有 1px 时的四分之一。
    // 1px 采样在 45~60 节的超长个体上会产生上千个采样点，再叠加"每节从头查找"
    // 的 O(节数 × 点数) —— 这是帧率被打爆的主因之一。
    const TRAIL_MIN = 4;
    const MAX_PTS = 400;                       // 轨迹点数硬上限（兜底）

    // 节半径只跟 drawSize/shape.r 有关，提到循环外算一次，避免每条链重建闭包
    const radOf = (e) => (e.shape && e.shape.r)
      ? e.shape.r * e.drawSize
      : (e.drawSize || 24) * 0.35;

    // 只遍历【醒着】的个体（this._awake 由 step() 建好）：全图 4000+ 只里绝大多数是休眠的，
    // 以前每步都要为它们整表扫一遍再 continue，纯属白扫。
    const src = this._awake || this.ents;
    for (const m of src) {
      if (m.segIdx == null || m.dead) continue;
      if (m._lead && !m._lead.dead) continue;   // 只从每段的最前一节出发
      // 休眠的链不解算：全图几十条链 × 每链上百点是无谓开销。
      // 休眠判定与 AI 完全一致（step 里按 MOB_ACTIVE_R 置 m.sleeping）。
      if (m.sleeping) continue;

      // ---- 1) 段头记录自己的【行进轨迹】----
      // 距离必须与【最后一个已记录的样本】比较。旧写法拿 trail[0] 当基准、
      // 又每帧把它改写成头的位置，于是距离恒为 0 -> 轨迹永不增长 -> 整条变刚性直杆。
      if (!m._trail) m._trail = [];
      // 【断链不瞬移】原来那条的头被打死后，它的后一节会升为新头 —— 这个新头
      // 没有轨迹。若直接往下走，第 2 步会用"沿 -facing 的一条直线"兜底补轨迹，
      // 于是它后面所有节在第一帧被摆到那条直线上 -> 整段瞬移一下（用户看到的断裂瞬移）。
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
      // 后面每一节都沿这条锯齿摆放 -> 整条挤成一团并高频抖动（用户看到的"撞蜜时身体错位"）。
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
      // 旧写法对【每一节】都从头遍历一遍轨迹（O(节数 × 点数)），长个体会直接卡死。
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

      // ---- 4) 硬挤压：非相邻的两节【不允许重叠】----
      // 弧长摆放只保证"沿路径的间距"，当头折返或急转时，内弯一侧的节会在
      // 空间上挤到一起（看起来像被压扁、互相穿模）。
      // 这里做两轮位置松弛：
      //   · 非相邻节：低于最小间距就沿连线各推一半（头钉住不动，避免整条被顶离路径）
      //   · 推完再把相邻节严格复位到标称间距 —— 所以永远是"连着的一条"，不会散开
      // 正常爬行时两节距离远大于阈值，一次都不会触发，等于没有开销。
      const cn = chain.length;
      if (cn > 2) {
        // 半径/间距预算一次：以前每对 (i,j) 都调两次 radOf（读 shape.r、drawSize），
        // 60 节的链一轮就是 3600 次调用 × 4 轮。
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
              // 严格相切：不允许任何一对非相邻节重叠（旧值 0.98 允许 2% 重叠）
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
  }

  // 链体 vs 玩家：_solveChains 是每步最后一步，会把前面推开的节按轨迹重新摆好 ——
  // 于是玩家站在身体前方时，节会被摆回到玩家身上，看起来就是整条蜈蚣【直接从花朵身上穿过去】。
  // 这里补一趟"只推玩家、不推节"的分离：节是刚体节点，推它只会脱节（下一帧又被摆回来）；
  // 玩家是自由实体，被身体扫到就该被顶开，与"头节撞到玩家"是同一观感。
  _pushPlayerOutOfChains() {
    const p = this.player;
    const src = this._awake;
    if (!p || p.dead || !src) return;
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

  // 权威推进：玩家副本移动 -> 生物 AI/移动 -> 互斥 -> 战斗（固定 25Hz）
  step(dt) {
    this.t += dt;
    const p = this.player;
    if (!p || !this.map) return;

    // 1) 玩家权威副本：按上行输入意图移动（与客户端同一套 damp + moveEntity）
    p.mode = this._input.mode || 'normal';
    // 特效输出临时静音：治疗飘字等表现由客户端预测副本负责，
    // 否则同一帧服务端与客户端各弹一次（会看到两个数字）。
    const _sup = PetalFX._suppress;
    PetalFX._suppress = true;
    try {
      if (!p.dead) p.update(dt, { x: this._input.dx, y: this._input.dy }, this.map, this.ents);
      else p.update(dt, { x: 0, y: 0 }, this.map, this.ents);
    } finally { PetalFX._suppress = _sup; }

    // 1.2) 复活区域解锁：站在某个 checkpoints 区域里即解锁（0.2s 查一次足够）
    this.cpAcc = (this.cpAcc || 0) + dt;
    if (this.cpAcc >= 0.2) { this.cpAcc = 0; this._checkCheckpoints(); }

    // 1.5) 多实体卡（Light）的独立重装填：到点各自满血复活（卡片不进入 reload）
    // 【必须把坐标拉回花朵中心】：实体死亡时就地冻结，若复活时沿用旧坐标，
    // 它会在"死掉的那个位置"（往往正贴着生物）凭空出现并立刻判定命中 ——
    // 表现为"新装填的 light 从生物身上/背后冒出，玩家拉开距离也照样打得到"。
    for (const b of p.petals) {
      if (!b.dead || !(b.respawnT > 0)) continue;
      b.respawnT -= dt;
      if (b.respawnT <= 0) {
        b.respawnT = 0;
        b.dead = false;
        b.hp = b.maxHp;
        b.hurtT = 0;
        b.x = p.x; b.y = p.y;      // 回到花朵中心，再从花瓣轨道飞出去
        b.vx = 0; b.vy = 0;
      }
    }

    // 2) 生物：AI + 移动 + 退场回收
    //    远处生物【休眠】：全图人口按生成表铺开，但只有近距离的才跑 AI/物理，
    //    所以"全图 100+ 只"不会拖垮帧率（服务端人口 ≠ 服务端负载）。
    const actR2 = MOB_ACTIVE_R * MOB_ACTIVE_R;
    // 【醒着的个体收进一个复用数组】：下面"玩家推挤 / 两两推挤 / 战斗"三步直接遍历它，
    // 不再每步把全图 4000+ 只各扫一遍（每一步 4 次全量扫描是 17ms/步里最大的一块）。
    // 数组本体复用（length = 0），不产生垃圾。
    const awake = this._awake || (this._awake = []);
    awake.length = 0;
    let needCompact = false;
    for (const m of this.ents) {
      if (m.dead) {
        if (m.deathTimer > FADE_T) needCompact = true;   // 退场播完：本步末尾才真正移除
      } else if (dist2(m.x, m.y, p.x, p.y) > actR2) {
        m.sleeping = true; continue;
      }
      m.sleeping = false;
      // 多节生物：前节已死 -> 本节升为"头"（重新跑自己的 AI 驱动它后面那整段）
      // —— 这就是【中间被打断分裂成多段】：每段由自己最前一节的 AI 控制，与有没有触角无关。
      if (m._lead && m._lead.dead) m._lead = null;
      // 段首（没有前一节）= 这一段的新头：必须解除"被粘合"标记，否则它会一直
      // 跳过自己的 AI/位移，整段就此冻结（表现为被打断后剩下的半条再也不动）。
      m._chainLocked = !!m._lead;
      // 位置一律由 _solveChains 沿头的【实际路径】解算，不再使用"跟随前一节"那套
      // （跟随=被头拽着走，与轨迹法冲突，已彻底移除）。
      m._followPt = null;
      m.update(dt, p, this.map);
      if (!m.dead) awake.push(m);
    }
    // 只在真有"退场播完"的个体时才重建数组（filter 会分配 4000+ 元素的新数组，
    // 每步都做就是纯 GC 压力）。
    if (needCompact) this.ents = this.ents.filter((m) => !(m.dead && m.deathTimer > FADE_T));

    // 2.2) 按生成表维持人口（每 SPAWN_INTERVAL 秒补"最缺"的那只）
    this.spawnT = (this.spawnT || 0) + dt;
    if (this.spawnT >= SPAWN_INTERVAL) {
      this.spawnT -= SPAWN_INTERVAL;
      this.spawnOne();
    }

    // 3) 玩家 vs 生物：按重量 + 动能推挤（physicsPush）。重的一方几乎不动、轻的被推飞；
    //    很快的玩家能推动"更大一点"重量的生物；小生物再也推不动大生物。
    if (!p.dead) {
      for (let i = 0; i < awake.length; i++) {
        const m = awake[i];
        if (m.dead) continue;                    // 休眠生物离玩家很远，不可能接触
        // 与伤害结算 / F3 碰撞箱同一套几何：生物的 SVG 轮廓（physicsPushMob 内部按轮廓推挤）。
        // 被粘合的链节【只推玩家】：节的位置每帧末由轨迹刚性解算，推它会被覆盖并撕开整条。
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
            // 多节生物【直接相连的两节】之间不做推挤：
            // 它们本来就是故意重叠的（见 _solveChains 的 GLUE），
            // 推挤会把链硬生生推开 -> 错位、拉伸、尾节脱节、并给速度顶出巨大冲量。
            if (a._next === b || b._next === a) continue;
            physicsPush(a, b);
          }
        }
      }
    }

    // 5) 战斗结算：25 tick/s 固定步长
    this._combatAcc += dt;
    while (this._combatAcc >= 1 / 25) {
      this._combatAcc -= 1 / 25;
      this._combatTick();
    }

    // 6) 多节生物【刚性粘合】—— 必须放在【最后】。
    // 前面所有会改坐标的步骤（AI 移动、玩家推挤、生物两两推挤、战斗击退）都跑完之后
    // 再统一解算，否则链会在同一帧里被后续逻辑推开（这就是"怎么改都没改善"的原因）。
    this._solveChains();
    // 解算完再补一次链体与玩家的分离（只推玩家）—— 否则身体会从花朵身上穿过去。
    this._pushPlayerOutOfChains();
  }

  // 战斗结算：只负责"谁掉多少血/谁该被弹开"，并把结果写成事件交给客户端表现。
  // 反弹总量恒定，按稀有度查表分配；玩家份额由事件带回客户端，叠加到它的预测位置上。
  _combatTick() {
    const p = this.player;
    if (!p) return;
    // 接触的两种"节奏"，口径完全不同，别混：
    //   kbT = 传能冷却：击退是【离散事件】，一次接触只传一次动能（PetalFX 自己判）；
    //   伤害 = 【每 tick 结算一次，一次就是完整面板值】，没有冷却、没有摊平系数。
    const TICK_DT = 1 / 25;
    for (const b of p.petals) {
      if (b.kbT > 0) b.kbT = Math.max(0, b.kbT - TICK_DT);
    }
    // ---- 持续回血（Leaf）已迁入 PetalFX 的 passive 效果 ----
    // 规则：只要实体加载好且未死亡就每帧回 heal×dt（封顶 maxHp、不弹字）。
    // 放在 PetalFX.tick 里而不是这里，理由：
    //   · 它属于"花瓣种类的能力"，不该在战斗循环里按 slug 特判；
    //   · PetalFX.tick 在 Player.update 中逐花瓣推进，天然在命中判定之外；
    //   · 战斗 tick 是 25Hz，回血写在这里会被节流成阶梯状。
    // 只见"醒着"的个体（this._awake 由 step() 每步重建）：
    // 休眠生物距玩家 > MOB_ACTIVE_R(2200)，而花瓣射程远小于它，不可能接触 ——
    // 跳过它们等于省掉全图 4500+ 只 × 花瓣数 × 25Hz 的轮廓判定。
    const awake = this._awake || this.ents;
    for (const m of awake) {
      if (m.dead) continue;
      // —— 花瓣 vs 昆虫（严格按 SVG 轮廓多边形判定，不再用外接圆）——
      for (const b of p.petals) {
        if (b.dead || b.fxNoCombat) continue;
        // Peas 喷射中的实体【照常参与伤害结算】：它此刻只是 stationary + 有自己的速度，
        // 仍是一个正常实体，血量/命中/伤害全部走下面这条通用链路。
        // 2s 后的移除由 Player._syncPetals 负责（服务端副本同样跑那套，因此两侧一致）。
        const hit = mobHitTest(m, b.x, b.y, PETAL_R);
        if (!hit) continue;
        const st = petalStatsFor(b.card.type, b.card.rarity);
        if (b.hp == null) { b.hp = b.maxHp = (st.hp || 30); }
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
        const jmass = clamp(Math.sqrt((b.maxHp || 30) / 30), 0.8, 1.8);
        const jshare = (KNOCKBACK_SHARE[m.rarity] || KNOCKBACK_SHARE.common)[1];
        // 花瓣重量 = 其稀有度对应的实体重量（与 Mob / Player 共用 rarityWeight，随稀有度递增）。
        // 花瓣实体长期缺失 weight，正是"连 Eternal 蜜都被 rare 生物随便推着跑"的根因。
        const wP = petalWeight(b), wM = m.weight || 1;
        const invP = 1 / wP, invM = 1 / wM, invSum = (invP + invM) || 1;
        const shareP = invP / invSum, shareM = invM / invSum;   // 各自的"可动份额"（反质量分配）
        // 质量悬殊系数：等重（=同等级实体之间）恒为 1，悬殊时放大传递效果。
        // 【仅】作用于生物击退时封顶 1.5×（用户要求：最大动能传递 = 同等级实体间击退的 1.5 倍）；
        // 实体之间的推动 / 位移分离不走这里，按反质量自然分配，【不设上限】。
        const kbBoost = clamp(Math.sqrt(wP / wM), 2 / 3, KB_DISPARITY_MAX);
        // ---- ① 物理分离（"生物一侧"）：生物被推出花瓣轮廓 ----
        // 花瓣一侧的分离在 Player._separatePetalFromMobs 里做（两端同源），
        // 这里只动生物（生物只有服务端能动）。两边加起来 = 完整的一对多体碰撞。
        this._separateMobFromPetal(m, b, hit);
        // ---- ② 接触传能（撞上去那一下的击退 / 揉搓），所有花瓣同一套 ----
        PetalFX.onHit(b, p, {
          dt: TICK_DT, mob: m, hit, approach, relN, jmass, jshare,
          wP, wM, shareP, shareM, kbBoost
        });
        // ---- ③ 伤害：每 tick 结算一次，一次就是完整面板值 ----
        // 两侧永远成对出现，只有"这一侧没有攻击力"（数值为 0）才是 0，不存在单向掉血。
        // 双向走【同一个公式】：伤害方 dmg - 受击方 armor，钳到 0，全额扣，不做任何削峰。
        // 所以"伤害 ≥ 耐久"就是当 tick 直接碎（common 瓢虫 10 vs common basic 10、
        // rare 瓢虫 90 vs 任何低稀有度花瓣，都是一下没），不会出现"贴着磨一会才碎"。
        const toMob = this._dmg(st.dmg, m.armor);
        const toPetal = this._dmg(m.dmg, b.armor);
        if (toPetal > 0) {
          b.hp -= toPetal; b.hurtT = 0.3;
        }
        if (toMob > 0) this._hitMob(m, toMob);
        // 攻击磨损：按最大耐久比例、每 tick 磨损（PETAL_ATTACK_DUR 本来就是按 25Hz 定的）
        b.hp -= b.maxHp * PETAL_ATTACK_DUR;
        if (b.hp <= 0) this._destroyPetal(b);
        if (m.dead) break;
      }
      if (m.dead || p.dead) continue;
      // —— 花朵本体 vs 昆虫（体伤）——
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
          if (hurt && !p.dead) {
            const ux = phit.nx, uy = phit.ny;
            // 击退总位移 = 设计值 FLOWER_KNOCKBACK × 主角直径，按稀有度在双方之间分配。
            // 旧实现给玩家的是"随机 1/3~1/2 直径"且没乘 sh[0]：总位移是设计值的 2~2.5 倍，
            // 同一只怪每次弹开距离还都不一样（KNOCKBACK_SHARE 的玩家一列从未被使用）。
            const total = FLOWER_KNOCKBACK * p.r * 2;
            const sh = KNOCKBACK_SHARE[m.rarity] || KNOCKBACK_SHARE.common;
            const playerKb = total * sh[0];
            if (!m.dead) applyKnockback(m, -ux, -uy, total * sh[1]);
            applyKnockback(p, ux, uy, playerKb);
            this._events.push({
              kind: 'hurt', ux, uy, total: playerKb, shake: true
            });
          }
        }
      }
    }
    // —— Honey 的仇恨吸引 ——
    // 蜜不造成伤害（st.dmg = 0，上面的花瓣循环里自然不结算），只负责"挨打"；
    // 这里把它写进周围生物的仇恨表，让它们转火来啃蜜而不是玩家。
    // 限制条件：只在 HONEY_PULL_R 内、且稀有度不超过该蜜的 Max Mob Rarity。
    const TICK = 1 / 25;
    // 先挑出"可能吸引仇恨的花瓣"（静止摆在地上那种）。绝大多数时候一朵都没有，
    // 那就整段跳过 —— 旧写法对全图 4000+ 只 × 每片花瓣调一次 canAttract，
    // 25Hz 下是战斗 tick 的主要开销（实测 7ms/tick 里的大头）。
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
        m.dmgTextT -= 1 / 25;
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
    if (m._chainLocked) return;
    const invP = 1 / (b.weight || 1);
    const invM = 1 / (m.weight || 1);
    const shareM = invM / ((invP + invM) || 1);
    const push = Math.min((hit.depth - PETAL_CONTACT_SKIN) * PETAL_SEP_K * shareM, 16);
    if (push > 0) { m.x -= hit.nx * push; m.y -= hit.ny * push; }
  }

  _hitMob(m, toMob) {
    if (toMob <= 0) return false;
    const r = m.hurt(toMob, this.player);
    if (r.applied > 0) {
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
      this._events.push({
        kind: 'kill', id: m.netId, mobId: (m.type.id != null ? m.type.id : m.name),
        level: m.level, rarity: m.rarity,
        chain: !!m.chainLong,                // 超长蜈蚣的节：客户端据此追加【隐藏掉落】
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
  _destroyPetal(b) {
    b.dead = true;
    const c = b.card;
    const dur = (c.type.reload != null) ? c.type.reload : Math.max(0, c.type.spd || 0);
    const p = this.player;
    if (!p) return;
    // 放在地上的实体（Pollen / Honey 脱轨后）：打碎就是打碎，不会"复活"——
    // 它不属于当前这一批，卡槽在脱轨那一刻就已经进入冷却（Honey 的冷却暂停
    // 由 _tickReload 按"是否还有存活滞留实体"自动解除）。
    if (b.stationary) return;
    const cnt = (typeof CardRenderer !== 'undefined' && CardRenderer.lightSubCount)
      ? CardRenderer.lightSubCount(c.type, c.rarity) : 1;
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
        if (this._hitMob(m, 1e9)) killed++;   // 只在真正死亡时计入，避免假报成功
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
    // 旧实现漏清 _petalGen -> /resphere 之后该槽花瓣的世代号与客户端失配。
    p.resetForSpawn(null);
    for (const m of this.ents) if (m.threat) m.threat.length = 0;
    // 通知客户端同步重置自己的预测副本（否则客户端不知道这次重生，世代号照样会漂）
    this._events.push({ kind: 'respawned', x: p.x, y: p.y, cp: -1 });
  }

  drainEvents() { const e = this._events; this._events = []; return e; }

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
        hurtT: p.hurtT || 0, flash: p.flash || 0, deathRot: p.deathRot || 0,
        deathTimer: p.deathTimer || 0
      } : null,
      // 花瓣战斗状态：客户端不跑战斗，只按这里的 hp/hurtT/dead 做表现。
      // 少了这一段，服务端花瓣掉血甚至碎掉，客户端都看不到（表现为"花瓣不受伤"）。
      // 一张卡可能对应多个独立实体（Light 的每个光点）：用 (slot, sub, gen) 唯一定位。
      // gen = 世代号：滞留型花瓣（Pollen / Honey）脱轨后重新装填，同一槽会同时存在多批实体。
      // 滞留实体（放在地上的 Pollen / Honey）的【位置与速度】必须由服务端权威下发：
      // 它们会被生物硬碰撞推挤，客户端若只按自己算的就永远停在原地 ——
      // 表现为"生物与蜜重合"（服务端其实已经分开了，客户端看不见）。
      petals: this._snapPetals(p),
      // 全量下发：小地图要能看到全图人口（远处生物的 AI 仍由 MOB_ACTIVE_R 休眠省算力）
      ents: this._fillEnts()
    };
  }

  // 快照里的花瓣状态。
  // 【必须覆盖"有卡、但此刻没有实体"的槽位】——花瓣被打碎后 _destroyPetal 只打 dead 标记
  // 并把该槽放进 reload，实体则在【下一帧】的 _syncPetals 里被移出 p.petals。
  // 旧实现直接下发 p.petals，于是"这一槽已经没有了"这件事只能靠"打碎那一帧刚好发了快照"
  // 才传得到客户端（快照 25Hz、模拟 60Hz，命中率约 40%）。
  // 漏掉的那一次：客户端按 (slot, sub, gen) 永远找不到条目 -> 既不碎也不进装填，
  // 变成一片绕圈飞的【幽灵花瓣】：画面上从生物身上直接飘过去，服务端却没有这片花瓣，
  // 一点伤害都结算不到（"花瓣飘过去、和瓢虫不发生任何交互"的根因）。
  // 所以这里为"槽位有卡、却没有对应实体记录"的槽位补一条 dead 记录。
  _snapPetals(p) {
    const out = [];
    if (!p) return out;
    for (const b of p.petals) {
      const o = {
        slot: b.slotIndex, sub: b.sub || 0, gen: b.gen || 0, hp: b.hp, maxHp: b.maxHp,
        hurtT: b.hurtT || 0, dead: !!b.dead
      };
      if (b.stationary) { o.x = b.x; o.y = b.y; o.vx = b.vx || 0; o.vy = b.vy || 0; }
      out.push(o);
    }
    const slots = p.slots || [];
    for (let i = 0; i < slots.length; i++) {
      const c = slots[i];
      if (!c) continue;
      let has = false;
      for (const b of p.petals) { if (b.slotIndex === i) { has = true; break; } }
      if (has) continue;                       // 该槽已有实体记录（含"已碎但还没被移除"的多体子体）
      // 一卡多体（Light 等）按实体数补齐，否则客户端只杀得掉 sub 0，其余照旧是幽灵。
      const cnt = (typeof CardRenderer !== 'undefined' && CardRenderer.lightSubCount)
        ? CardRenderer.lightSubCount(c.type, c.rarity) : 1;
      const gen = ((p._petalGen && p._petalGen[i]) | 0);
      for (let sub = 0; sub < Math.max(1, cnt); sub++) {
        out.push({ slot: i, sub, gen, hp: 0, maxHp: 0, hurtT: 0, dead: true });
      }
    }
    return out;
  }

  // ---- 快照里的生物数组 ----
  // 【复用同一批对象】而不是每次 map() 造 4000+ 个新对象（25Hz 下 = 10 万+ 对象/秒，GC 拉满）。
  // 快照是同步消费的：本地实现由客户端在本次 step 里立刻读走，远端实现会先 JSON 序列化，
  // 两种情况下都不会有人把这份数组留到下一个快照。
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
      // 多节生物的节序号：客户端据此不做逐节插值（见 game.js），保证整条刚性对齐、顺序不错
      o.segIdx = (m.segIdx != null) ? m.segIdx : null;
      // 名牌显示模式（'classic' 经典 / 'player' 主角血条式），见 entities.js Mob.draw
      o.plateStyle = m.plateStyle || null;
      // 表现层状态全部由服务端权威置位，必须下发，否则客户端视图实体这些字段恒为 0：
      //   hurtT  = 受伤红闪（0.3s 渐隐）
      //   flash  = 白闪（0.14s 白色剪影）
      //   squash = 受击挤压（Q 弹一下）
      //   deathTimer / deathRot = 死亡放大渐隐 / 尸体旋转角
      o.hurtT = m.hurtT || 0; o.flash = m.flash || 0; o.squash = m.squash || 0;
      o.deathTimer = m.deathTimer || 0; o.deathRot = m.deathRot || 0;
      n++;
    }
    buf.length = n;
    return buf;
  }
}
