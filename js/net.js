// net.js — 网络抽象层 + 进程内本地服务端（服务端结构雏形）
// 'use strict';
//
// 目标：把「生物生成 / 玩家实体 / 战斗结算」这些权威状态搬到服务端，客户端只做两件事：
//   上行：输入意图（input intent）
//   下行：实体快照（snapshot）+ 事件（events）
// 之后要接真服务器时，只需新增一个 WebSocketNet 实现同一组接口，客户端代码不用改。
//
// 职责划分
//   服务端（LocalServer）：权威。持有 Mob 实体、玩家权威副本，跑 AI/移动/碰撞/战斗/反弹，
//                         以固定 25Hz 产出快照；聊天按半径路由。
//   客户端（Game）      ：预测。本地玩家继续按现有物理预测（手感零变化），
//                         生物按 id 差分镜像成视图实体，并用 rx/ry 在前后两个快照间插值。
//
// 为什么本地玩家可以"预测"而生物要"插值"：
//   本地玩家的输入是自己刚产生的，立刻生效才有手感；生物是别人的状态，只能等快照。
//   真实网络下预测会与服务端有偏差，需要回滚/校正（本文件已留 reconcile 钩子）；
//   本地实现零延迟，两边跑同一套物理，偏差约为 0，所以视觉上与现在完全一致。

const SNAP_HZ = 25;                 // 快照频率：与既有 combatAcc（25 tick/s）保持一致
const SNAP_DT = 1 / SNAP_HZ;

// ---- 生物生成参数（按地图生成表，服务端全局管理） ----
// 【密度口径】所有数值都是"生物总只数"，与物种种类数无关：
// 一个区先算出总目标，再按权重【挑】物种（每次生成只出一条），
// 所以以后往 mobs 串里加多少物种，总密度都不变 —— 只会改变构成比例。
const DENSITY_SCALE = 15.0;         // 整体密度倍率（唯一调参入口：下面三个上限都按它缩放）
const PER_ZONE_MAX = Math.round(6 * DENSITY_SCALE);              // 90：单区目标上限
const SPAWN_PER_TILE = 0.012 * DENSITY_SCALE;                    // 0.18：每格面积贡献的目标数量
const GLOBAL_MAX_MOBS = Math.round(110 * DENSITY_SCALE);         // 1650：全图存活上限
const SPAWN_INTERVAL = 0.1;         // 每 0.1s 补 1 只（总量变大，补缺口也要更快）
const MOB_ACTIVE_R = 2200;          // 与玩家距离超过它 -> 生物休眠（不跑 AI、不参与推挤）
const CP_RESPAWN_STAYS = 3;         // 每个复活点的保底复活次数
const HONEY_PULL_R = 700;           // Honey 吸引仇恨的半径（px）：范围要足够大，否则"只吸引到一只"
const HONEY_IMMUNE_T = 40;          // 被蜜影响累计满 40s -> 该生物永久免疫所有蜜
const PETAL_ATTACK_DUR = 0.004;     // 花瓣每次命中(25Hz)按最大耐久比例磨损：攻击也耗耐久，与其它花瓣一视同仁
const HONEY_PUSH = 40;              // 蜜硬碰撞时被生物顶开的冲量(px/s)：配合位置强制分离，使蜜被生物推着走
// 花瓣实体的重量：优先取实体自带的 weight（entities.js 按稀有度写入）；
// 缺失时按卡片稀有度即时换算 —— 保证任何来源的花瓣实体都走同一套重量口径。
function petalWeight(b) {
  if (b && b.weight) return b.weight;
  const r = (b && b.card && b.card.rarity) || 'common';
  return (typeof rarityWeight === 'function') ? rarityWeight(r) : 1;
}
// 质量悬殊带来的传递增益【上限】：以"同等级实体之间的击退"为基准 1，最大只允许 1.5 倍。
// 仅作用于【生物击退】；实体之间的推动 / 位移分离不设上限，按反质量自然分配。
const KB_DISPARITY_MAX = 1.5;

// ---------------- 传输层抽象 ----------------
// 只约定「消息」这一种形态：上行 send()、下行 onMessage()。
// 快照是消息的一种（t:'snap'），事件也是（t:'evt'），聊天同样（t:'chat'）。
// 这样换成 WebSocket 时只需替换 _deliver 的实现。
class Net {
  constructor() {
    this._msgCbs = [];        // 下行消息监听
    this._connected = false;
  }
  onMessage(cb) { this._msgCbs.push(cb); }
  // 由具体实现调用：把一条服务端消息投递给所有监听者
  _deliver(msg) { for (const cb of this._msgCbs) cb(msg); }
  // ---- 以下由子类实现 ----
  connect() { this._connected = true; }
  send(msg) { throw new Error('Net.send 未实现'); }
  step(dt) { throw new Error('Net.step 未实现'); }
}

// ---------------- 进程内本地实现 ----------------
// 特点：服务端与客户端在同页、同步执行，因此"网络延迟"为 0；
// 但依旧严格走上行/下行两条路，边界与真服务器一致。
class LocalNet extends Net {
  constructor() {
    super();
    this.server = new LocalServer();
  }
  connect() { super.connect(); this.server.start(); }

  // 上行：输入意图（每帧调用，内容为纯数据，可 JSON 序列化）
  // 装备变化也走这条路（消息类型 'loadout'）：客户端从不直接改服务端的 slots
  send(msg) {
    if (!this._connected) return;
    if (msg && msg.t === 'input') this.server.applyInput(msg.input);
    else if (msg && msg.t === 'loadout') this.server.syncLoadout(msg.slots);
    else if (msg && msg.t === 'chat') this.server.sendChat(msg.channel, msg.text);
    else if (msg && msg.t === 'respawn') this.server.requestRespawn();
  }
  // 便捷封装：输入意图（等价于 send({ t:'input', input })）
  sendInput(input) { this.send({ t: 'input', input }); }

  // 由客户端主循环驱动：本地实现零延迟，因此每帧都推进并投递一份快照
  // （生物移动仍是帧率级，手感与现在完全一致；战斗在服务端内部按 25Hz 固定步长结算）。
  // 若换成低频真服务器，客户端侧的插值缓冲会自动生效（见 Game._applySnap）。
  step(dt) {
    if (!this._connected) return;
    this.server.step(dt);
    this._deliver({ t: 'snap', snap: this.server.snapshot() });
    // 服务端在 step 中产生的事件（聊天/系统私信）此时才投递，保证顺序在快照之后
    for (const ev of this.server.drainEvents()) this._deliver({ t: 'evt', ev });
  }
}

// ---------------- 本地服务端（权威模拟） ----------------
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
    p.x = playerTemplate.x; p.y = playerTemplate.y;
    p.slots = playerTemplate.slots;
    p.name = playerTemplate.name;
    // 血量相关全部从模板继承（maxHp/hp 与血条平滑值）
    p.maxHp = playerTemplate.maxHp;
    p.hp = playerTemplate.hp;
    p.dispHp = playerTemplate.dispHp; p.ghostHp = playerTemplate.ghostHp; p.ghostV = 0;
    p.recompute();
    // 出生无敌：必须与客户端同源。少了这一条，服务端副本从第 0 帧起就能被打，
    // 于是立刻掉血/死亡 -> 客户端被快照置为 dead -> 推送与渲染全部跳过，
    // 外观上就是"无敌期内没有碰撞箱、一碰就死"。
    InvulnFX.add(p, 'spawn', FLOWER_SPAWN_INVULN);
    p.petals = []; p.petalWorld = [];
    p._petalGen = [];                // 一卡多批（Pollen / Honey）的世代号，换人/换图清零
    this._slotSig = '';
    // 地图/玩家就位后立刻按生成表把全图铺满（等价于 /init <map>），避免开局空场
    this.spawnT = 0;
    this._autoInit();
  }

  // 客户端装备发生变化时把最新 slots 同步给权威副本（按签名去重，避免每帧 recompute）
  syncLoadout(slots) {
    const p = this.player;
    if (!p || !slots) return;
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
    p.x = pos.x; p.y = pos.y; p.vx = 0; p.vy = 0;
    p.hp = p.maxHp; p.dead = false; p.deathTimer = 0;
    InvulnFX.add(p, 'spawn', FLOWER_SPAWN_INVULN);
    p.hurtT = 0; p.killedBy = null;
    p.reload = p.slots.map((c) => c
      ? { card: c, age: 0, dur: (c.type.reload != null) ? c.type.reload : Math.max(0, c.type.spd || 0) }
      : null);
    // 死亡即清空所有花瓣实体（含放在地上的 Pollen / Honey）与世代号
    p.petals = []; p._petalGen = [];
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
    if (this.cpMax < 0) {
      // 还没走到过任何检查点：就在【等级最低的那个复活区域】复活（不固定回原点 0,0）
      const base = this.map.checkpointSpawnPoint ? this.map.checkpointSpawnPoint(cps[0]) : { x: 0, y: 0 };
      return { x: base.x, y: base.y, idx: 0 };
    }
    if (this.cpStays <= 0) {                // 保底用完 -> 重新结算复活点
      this.cpIdx = Math.min(this.cpIdx + 1, this.cpMax);
      this.cpStays = CP_RESPAWN_STAYS;
    }
    this.cpStays--;
    const cp = cps[Math.min(this.cpIdx, cps.length - 1)];
    const pos = this.map.checkpointSpawnPoint ? this.map.checkpointSpawnPoint(cp) : { x: 0, y: 0 };
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
    if (this.map.collide) {
      const r = p.r || 22;
      const c = this.map.collide(fx, fy, r);
      if (Math.hypot(c.x - fx, c.y - fy) > 0.5) return 'Chat/Command/tp/Blocked';
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
      if (!first) first = pos;
      if (!p || dist(pos[0], pos[1], p.x, p.y) > 180) return pos;
    }
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
    const m = new Mob(pick.type, pos[0], pos[1], 1, rarity);
    m.x = pos[0]; m.y = pos[1];
    m.spawnZone = zone || null;
    m.netId = this.nextId++;
    this.ents.push(m);
    return true;
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
    return m;
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
    for (const m of this.ents) {
      if (!m.dead && dist2(m.x, m.y, p.x, p.y) > actR2) { m.sleeping = true; continue; }
      m.sleeping = false;
      m.update(dt, p, this.map);
    }
    this.ents = this.ents.filter((m) => !(m.dead && m.deathTimer > FADE_T));

    // 2.2) 按生成表维持人口（每 SPAWN_INTERVAL 秒补"最缺"的那只）
    this.spawnT = (this.spawnT || 0) + dt;
    if (this.spawnT >= SPAWN_INTERVAL) {
      this.spawnT -= SPAWN_INTERVAL;
      this.spawnOne();
    }

    // 3) 玩家 vs 生物：按重量 + 动能推挤（physicsPush）。重的一方几乎不动、轻的被推飞；
    //    很快的玩家能推动"更大一点"重量的生物；小生物再也推不动大生物。
    if (!p.dead) {
      for (const m of this.ents) {
        if (m.dead || m.sleeping) continue;      // 休眠生物离玩家很远，不可能接触
        physicsPush(p, m);
      }
    }

    // 4) 生物之间：同样按重量 + 动能推挤（替代原来"各半"的等权推开）
    //    只算"醒着"的：远处休眠的既不动也不该参与，顺带把 O(n²) 压到近处规模。
    const ms = this.ents;
    for (let i = 0; i < ms.length; i++) {
      const a = ms[i]; if (a.dead || a.sleeping) continue;
      for (let j = i + 1; j < ms.length; j++) {
        const b = ms[j]; if (b.dead || b.sleeping) continue;
        physicsPush(a, b);
      }
    }

    // 5) 战斗结算：25 tick/s 固定步长
    this._combatAcc += dt;
    while (this._combatAcc >= 1 / 25) {
      this._combatAcc -= 1 / 25;
      this._combatTick();
    }
  }

  // 战斗结算：只负责"谁掉多少血/谁该被弹开"，并把结果写成事件交给客户端表现。
  // 反弹总量恒定，按稀有度查表分配；玩家份额由事件带回客户端，叠加到它的预测位置上。
  _combatTick() {
    const p = this.player;
    if (!p) return;
    // 花瓣"传能冷却"：同一次接触只传一次动能（接触是离散事件，不是持续推力）
    const TICK_DT = 1 / 25;
    for (const b of p.petals) if (b.kbT > 0) b.kbT = Math.max(0, b.kbT - TICK_DT);
    for (const m of this.ents) {
      if (m.dead) continue;
      // —— 花瓣 vs 昆虫（严格按 SVG 轮廓多边形判定，不再用外接圆）——
      for (const b of p.petals) {
        if (b.dead || b.fxNoCombat) continue;
        const hit = mobHitTest(m, b.x, b.y, PETAL_R);
        if (!hit) continue;
        const st = petalStatsFor(b.card.type, b.card.rarity);
        if (b.hp == null) { b.hp = b.maxHp = (st.hp || 30); }
        // ---- 花瓣 vs 生物的接触性质：按花瓣种类分派（nx/ny = 接触法线，由生物表面指向花瓣）----
        //   · 普通花瓣 =【软碰撞】：本身不构成阻挡，只在接近时传一次动能把生物弹开，
        //     大小 = 基础位移 × 稀有度份额(重量) × 花瓣质量 × 接近速度系数，0.28s 内只传一次。
        //   · Honey    =【硬碰撞】：是有质量的实体【��】，与生物重叠即按穿透深度强制分离（绝不重合），
        //     因此会被持续推进的生物顶着往前走。注意：这里的分离判定【不看接近速度】，
        //     放在地上的蜜自身速度≈0，若挂在"接近速度够大"之后会永远不执行，
        //     结果就退化成"只结算伤害、没有实体碰撞"。
        const nx = hit.nx, ny = hit.ny;
        const approach = Math.max(0, -((b.vx || 0) * nx + (b.vy || 0) * ny));
        const jmass = clamp(Math.sqrt((b.maxHp || 30) / 30), 0.8, 1.8);
        const jshare = (KNOCKBACK_SHARE[m.rarity] || KNOCKBACK_SHARE.common)[1];
        const isHoney = !!(b.card && b.card.type && b.card.type.slug === 'honey');
        // 花瓣重量 = 其稀有度对应的实体重量（与 Mob / Player 共用 rarityWeight，随稀有度递增）。
        // 花瓣实体长期缺失 weight，正是"连 Eternal 蜜都被 rare 生物随便推着跑"的根因。
        const wP = petalWeight(b), wM = m.weight || 1;
        const invP = 1 / wP, invM = 1 / wM, invSum = (invP + invM) || 1;
        const shareP = invP / invSum, shareM = invM / invSum;   // 各自的"可动份额"（反质量分配）
        // 质量悬殊系数：等重（=同等级实体之间）恒为 1，悬殊时放大传递效果。
        // 【仅】作用于生物击退时封顶 1.5×（用户要求：最大动能传递 = 同等级实体间击退的 1.5 倍）；
        // 实体之间的推动 / 位移分离不走这里，按反质量自然分配，【不设上限】。
        const kbBoost = clamp(Math.sqrt(wP / wM), 2 / 3, KB_DISPARITY_MAX);
        if (isHoney) {
          // 蜜 =【硬碰撞】实体：只要重叠就每 tick 强制分离，且分离量按【反质量分配】
          // （与 physicsPush 完全同一套模型）—— 重的一方几乎不动：
          // Eternal 蜜（≈249）面对 rare 生物（≈4）几乎不位移，反而把撞上来的轻生物顶开。
          const depth = hit.depth || 0;
          if (depth > 0) {
            b.x += nx * depth * shareP; b.y += ny * depth * shareP;
            m.x -= nx * depth * shareM; m.y -= ny * depth * shareM;
          }
          // 顺势给一点沿法线向外的惯性滑行（0.28s 节流，避免每 tick 叠加把蜜弹飞）；
          // 推动量同样按反质量衰减：越重的蜜越推不动。
          if (!(b.kbT > 0)) {
            const mobIn = (m.vx || 0) * nx + (m.vy || 0) * ny;   // 生物朝蜜这一侧的接近速度
            const k = clamp(Math.max(approach, mobIn) / PETAL_KB_REF, 0.35, 2.2);
            const push = HONEY_PUSH * k * shareP;
            b.vx = (b.vx || 0) + nx * push;
            b.vy = (b.vy || 0) + ny * push;
            b.kbT = PETAL_KB_CD;
          }
        } else if (approach >= PETAL_KB_MIN_APPROACH && !(b.kbT > 0)) {
          // 普通花瓣 =【软碰撞】：只在撞上去那一下传一次动能把生物弹开，自身不硬抗。
          // 传递量含质量悬殊系数 kbBoost，但已封顶 1.5× 一般值（同等级实体间击退）。
          const impact = clamp(approach / PETAL_KB_REF, 0.35, 2.2);
          applyKnockback(m, -nx, -ny, PETAL_KB_BASE * jshare * jmass * impact * kbBoost);
          b.kbT = PETAL_KB_CD;
        }
        const toPetal = Math.max((m.dmg || 0) - 0, 0);
        const toMob = Math.max((st.dmg || 0) - (m.armor || 0), 0);
        if (toPetal > 0) { b.hp -= toPetal; b.hurtT = 0.3; }
        if (toMob > 0) {
          this._hitMob(m, toMob);
          b.hp -= b.maxHp * PETAL_ATTACK_DUR;   // 攻击也磨损耐久，与其它花瓣一视同仁
        }
        if (b.hp <= 0) this._destroyPetal(b);
        if (m.dead) break;
      }
      if (m.dead || p.dead) continue;
      // —— 花朵本体 vs 昆虫（体伤）——
      // 同样用 SVG 轮廓多边形判定；+0.5 余量保证"贴着"也能结算体伤。
      // 花朵本体作为实体：把体伤视为本体的 Damage(bodyDmg)、血量视为本体 Health(hp)，与怪一视同仁双向结算。
      const phit = mobHitTest(m, p.x, p.y, p.r + 0.5);
      if (phit) {
        const toMob = Math.max((p.bodyDmg || 0) - (m.armor || 0), 0);
        const toFlower = Math.max((m.dmg || 0) - (p.armor || 0), 0);
        if (toMob > 0) this._hitMob(m, toMob);
        if (toFlower > 0) {
          const hurt = p.hurt(toFlower, m);
          if (hurt && !p.dead) {
            const ux = phit.nx, uy = phit.ny;
            // 玩家被咬的弹开：沿"远离生物"方向（背后被追咬=向前窜；撞障碍=向后弹），
            // 距离 = 随机 1/3~1/2 个主角直径 —— 像屁股被咬、窜出去一小截。
            const playerKb = (1 / 3 + Math.random() * (1 / 6)) * p.r * 2;
            // 生物份额：保留对生物的冲量（按稀有度查表），轻生物被撞开、重生物基本不动
            const kb = FLOWER_KNOCKBACK * p.r * 2;
            const sh = KNOCKBACK_SHARE[m.rarity] || KNOCKBACK_SHARE.common;
            if (!m.dead) applyKnockback(m, -ux, -uy, kb * sh[1]);
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
    for (const m of this.ents) {
      if (m.dead || m.honeyImmune) continue;
      const mIdx = RARITY_ORDER.indexOf(m.rarity);
      let hit = null;                       // 本 tick 范围内、够稀有度的一坨蜜
      for (const b of p.petals) {
        if (b.dead || !b.stationary || !b.card) continue;
        const bt = b.card.type;
        if (!bt || bt.slug !== 'honey') continue;
        const maxR = (typeof petalMaxMobRarity === 'function') ? petalMaxMobRarity(bt, b.card.rarity) : null;
        // 该稀有度的蜜【没登记上限】（如 common 蜜）-> 什么都吸引不了，而不是"什么都不限"。
        // 之前写成 `if (maxR && ...)`，缺失时直接放行，导致 common 蜜也能吸引全场 —— 这是错的。
        if (!maxR) continue;
        if (mIdx > RARITY_ORDER.indexOf(maxR)) continue;
        if (dist2(b.x, b.y, m.x, m.y) > HONEY_PULL_R * HONEY_PULL_R) continue;
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

    // 伤害飘字聚合窗口结算：窗口(0.12s)结束后把该怪累计的真实伤害作为一条飘字发出
    for (const m of this.ents) {
      if (m.dmgTextT > 0) {
        m.dmgTextT -= 1 / 25;
        if (m.dmgTextT <= 0) this._flushDmg(m);
      }
    }
  }

  _hitMob(m, toMob) {
    if (toMob <= 0) return false;
    const r = m.hurt(toMob, this.player);
    if (r.applied > 0) {
      m.pendDmg = (m.pendDmg || 0) + r.applied;
      if (!(m.dmgTextT > 0)) m.dmgTextT = 0.12;
    }
    if (r.killed) {
      // 击杀：立刻把累计真实伤害作为一条飘字弹出（不等聚合窗口），再发击杀事件
      this._flushDmg(m);
      this._events.push({
        kind: 'kill', id: m.netId, mobId: (m.type.id != null ? m.type.id : m.name),
        level: m.level, rarity: m.rarity,
        x: m.x, y: m.y                       // 掉落物出现在生物死亡位置
      });
    }
    return !!(r.killed);
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
      const mobId = parseInt(parts[1], 10);
      const rarity = parts[2];
      const count = parseInt(parts[3], 10);
      if (!Number.isFinite(mobId) || mobId < 0 || !MOB_BY_ID[mobId]) {
        this._events.push({ kind: 'sys', channel, text: 'Chat/Command/summon/BadMobId' }); return;
      }
      if (!rarity || RARITY_ORDER.indexOf(rarity) < 0) {
        this._events.push({ kind: 'sys', channel, text: 'Chat/Command/summon/BadRarity' }); return;
      }
      if (!Number.isFinite(count) || count < 1) {
        this._events.push({ kind: 'sys', channel, text: 'Chat/Command/summon/BadCount' }); return;
      }
      const n = Math.max(1, Math.min(count, 50));   // 上限保护，避免一次刷太多
      const px = p.x, py = p.y;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const r = n > 1 ? 20 + Math.random() * 25 : 0;
        this.addEnt('mob', mobId, rarity, 1, px + Math.cos(a) * r, py + Math.sin(a) * r);
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
    p.hp = p.maxHp; p.dead = false; p.deathTimer = 0;
    p.vx = 0; p.vy = 0;
    InvulnFX.add(p, 'spawn', FLOWER_SPAWN_INVULN);
    p.hurtT = 0; p.killedBy = null;
    p.reload = p.slots.map((c) => c
      ? { card: c, age: 0, dur: (c.type.reload != null) ? c.type.reload : Math.max(0, c.type.spd || 0) }
      : null);
    for (const m of this.ents) if (m.threat) m.threat.length = 0;
  }

  drainEvents() { const e = this._events; this._events = []; return e; }

  // ---- 快照：纯数据，可 JSON 序列化 ----
  snapshot() {
    const p = this.player;
    return {
      t: this.t,
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
      petals: p ? p.petals.map((b) => {
        const o = {
          slot: b.slotIndex, sub: b.sub || 0, gen: b.gen || 0, hp: b.hp, maxHp: b.maxHp,
          hurtT: b.hurtT || 0, dead: !!b.dead
        };
        if (b.stationary) { o.x = b.x; o.y = b.y; o.vx = b.vx || 0; o.vy = b.vy || 0; }
        return o;
      }) : [],
      // 全量下发：小地图要能看到全图人口（远处生物的 AI 仍由 MOB_ACTIVE_R 休眠省算力）
      ents: this.ents.map((m) => ({
        id: m.netId, typeId: m.type.id, rarity: m.rarity, level: m.level,
        x: m.x, y: m.y, facing: m.facing, hp: m.hp, maxHp: m.maxHp, dead: m.dead,
        // 表现层状态全部由服务端权威置位，必须下发，否则客户端视图实体这些字段恒为 0：
        //   hurtT  = 受伤红闪（0.3s 渐隐）
        //   flash  = 白闪（0.14s 白色剪影）
        //   squash = 受击挤压（Q 弹一下）
        //   deathTimer / deathRot = 死亡放大渐隐 / 尸体旋转角
        hurtT: m.hurtT || 0, flash: m.flash || 0, squash: m.squash || 0,
        deathTimer: m.deathTimer || 0, deathRot: m.deathRot || 0
      }))
    };
  }
}
