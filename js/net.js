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
    this._slotSig = '';
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
    this.spawnStarterMobs();
  }

  applyInput(input) { this._input = input; }

  requestRespawn() {
    const p = this.player;
    if (!p) return;
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0;
    p.hp = p.maxHp; p.dead = false; p.deathTimer = 0;
    InvulnFX.add(p, 'spawn', FLOWER_SPAWN_INVULN);
    p.hurtT = 0; p.killedBy = null;
    p.reload = p.slots.map((c) => c
      ? { card: c, age: 0, dur: (c.type.reload != null) ? c.type.reload : Math.max(0, c.type.spd || 0) }
      : null);
    for (const m of this.ents) if (m.threat) m.threat.length = 0;   // 重生后仇恨豁免
  }

  // 生物生成：由服务端驱动（客户端只在快照里看到"多了一个 id"再镜像）
  spawnStarterMobs() {
    const type = MOB_BY_ID[STARTER_MOB_ID] || null;
    if (!type) return;
    for (let i = 0; i < STARTER_MOB_RARITIES.length; i++) {
      const rarity = STARTER_MOB_RARITIES[i];
      const m = new Mob(type, 0, 0, 1, rarity);
      // 距离按体型加成：高稀有度直径可能是主角的 4~8 倍，放太近会直接盖住出生点
      const d = STARTER_MOB_RADIUS + m.r * 0.9;
      const a = (i / STARTER_MOB_RARITIES.length) * TAU + rand(-0.35, 0.35);
      m.x = (this.player ? this.player.x : 0) + Math.cos(a) * d;
      m.y = (this.player ? this.player.y : 0) + Math.sin(a) * d;
      m.netId = this.nextId++;
      this.ents.push(m);
    }
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

    // 2) 生物：AI + 移动 + 退场回收
    for (const m of this.ents) m.update(dt, p, this.map);
    this.ents = this.ents.filter((m) => !(m.dead && m.deathTimer > FADE_T));

    // 3) 玩家 vs 生物：纯几何圆形碰撞推出（半径 m.r，已含贴图描边），彻底弃用贴图轮廓提取。
    // 轮廓提取会丢描边，且首帧贴图未光栅化时会缓存残缺多边形 -> "碰撞不对 / 出生挤不出 / 乱飞" 的根源。
    if (!p.dead) {
      for (const m of this.ents) {
        if (m.dead) continue;
        const reach = m.r + p.r;
        const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
        if (d >= reach) continue;
        if (d < 1e-3) { p.x = m.x + reach + 0.02; }   // 正好叠在怪中心：任取方向推出，避免 0 向量方向卡死
        else { p.x = m.x + dx / d * (reach + 0.02); p.y = m.y + dy / d * (reach + 0.02); }
      }
    }

    // 4) 生物之间的互斥（圆形，成对推开各半）
    const ms = this.ents;
    for (let i = 0; i < ms.length; i++) {
      const a = ms[i]; if (a.dead) continue;
      for (let j = i + 1; j < ms.length; j++) {
        const b = ms[j]; if (b.dead) continue;
        const rr = a.r + b.r;
        const dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy;
        if (dd >= rr * rr || dd <= 0) continue;
        const d = Math.sqrt(dd), push = (rr - d) / 2;
        const ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
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
    for (const m of this.ents) {
      if (m.dead) continue;
      const reach = m.r;   // 纯几何半径（含描边），与推出用同一套圆碰撞，弃用贴图轮廓
      // —— 花瓣 vs 昆虫 ——
      for (const b of p.petals) {
        if (b.dead || b.fxNoCombat) continue;
        const rr = reach + PETAL_R;
        const touch = dist2(b.x, b.y, m.x, m.y) < rr * rr;
        if (!touch) continue;
        const st = petalStatsFor(b.card.type, b.card.rarity);
        if (b.hp == null) { b.hp = b.maxHp = (st.hp || 30); }
        const toPetal = Math.max((m.dmg || 0) - 0, 0);
        const toMob = Math.max((st.dmg || 0) - (m.armor || 0), 0);
        if (toPetal > 0) { b.hp -= toPetal; b.hurtT = 0.3; }
        if (toMob > 0) this._hitMob(m, toMob);
        if (b.hp <= 0) this._destroyPetal(b);
        if (m.dead) break;
      }
      if (m.dead || p.dead) continue;
      // —— 花朵本体 vs 昆虫（体伤）——
      // +0.5 余量：推出把玩家正好放到碰撞边界(=reach+p.r)，若按严格 < 判定则"贴着却判定不到接触"，
      // 体伤几乎永不结算（只有浮点抖动偶尔漏过 -> "有时候不能结算"）。包容边界即可正常结算。
      // 花朵本体作为实体：把体伤视为本体的 Damage(bodyDmg)、血量视为本体 Health(hp)，与怪一视同仁双向结算。
      const rr2 = reach + p.r + 0.5;
      const touch = dist2(p.x, p.y, m.x, m.y) < rr2 * rr2;
      if (touch) {
        const toMob = Math.max((p.bodyDmg || 0) - (m.armor || 0), 0);
        const toFlower = Math.max((m.dmg || 0) - (p.armor || 0), 0);
        if (toMob > 0) this._hitMob(m, toMob);
        if (toFlower > 0) {
          const hurt = p.hurt(toFlower, m);
          if (hurt && !p.dead) {
            const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1;
            const ux = dx / d, uy = dy / d;
            const kb = FLOWER_KNOCKBACK * p.r * 2;              // 双方总位移之和（恒定）
            const sh = KNOCKBACK_SHARE[m.rarity] || KNOCKBACK_SHARE.common;
            // 生物份额：给权威实体一个速度冲量（随后指数衰减 -> 平滑滑出去再停住）。
            // 位置变化本身会随快照下发，客户端插值后同样是平滑的。
            if (!m.dead) applyKnockback(m, -ux, -uy, kb * sh[1]);
            // 玩家份额：只下发「冲量」，客户端叠加到它的预测实体上（同样平滑衰减），
            // 不再直接改坐标 —— 否则会看到人物位置瞬移一下。
            applyKnockback(p, ux, uy, kb * sh[0]);
            this._events.push({
              kind: 'hurt', ux, uy, total: kb * sh[0], shake: true
            });
          }
        }
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
    if (toMob <= 0) return;
    const r = m.hurt(toMob, this.player);
    if (r.applied > 0) {
      m.pendDmg = (m.pendDmg || 0) + r.applied;
      if (!(m.dmgTextT > 0)) m.dmgTextT = 0.12;
    }
    if (r.killed) {
      // 击杀：立刻把累计真实伤害作为一条飘字弹出（不等聚合窗口），再发击杀事件
      this._flushDmg(m);
      this._events.push({ kind: 'kill', id: m.netId, mobId: (m.type.id != null ? m.type.id : m.name), level: m.level });
    }
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

  _destroyPetal(b) {
    b.dead = true;
    const c = b.card;
    const dur = (c.type.reload != null) ? c.type.reload : Math.max(0, c.type.spd || 0);
    const p = this.player;
    if (p) p.reload[b.slotIndex] = { card: c, age: 0, dur };
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

  // /summon <mob_id(number)> <rarity(valid_rarity_string)> <count(number)>
  //   在当前位置召唤对应生物；类型不匹配/缺失均走 i18n 系统提示；召唤者获 4s 无敌。
  _handleCommand(raw, channel) {
    const p = this.player;
    if (!p) return;
    const parts = String(raw).trim().split(/\s+/).filter(Boolean);
    const cmd = (parts[0] || '').toLowerCase();
    if (cmd === '/summon') {
      const mobId = parseInt(parts[1], 10);
      const rarity = parts[2];
      const count = parseInt(parts[3], 10);
      if (!Number.isFinite(mobId) || mobId < 0 || !MOB_BY_ID[mobId]) {
        this._events.push({ kind: 'sys', channel, text: 'Chat/Command/summon/BadMobId' });
        return;
      }
      if (!rarity || RARITY_ORDER.indexOf(rarity) < 0) {
        this._events.push({ kind: 'sys', channel, text: 'Chat/Command/summon/BadRarity' });
        return;
      }
      if (!Number.isFinite(count) || count < 1) {
        this._events.push({ kind: 'sys', channel, text: 'Chat/Command/summon/BadCount' });
        return;
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
      petals: p ? p.petals.map((b) => ({
        slot: b.slotIndex, hp: b.hp, maxHp: b.maxHp,
        hurtT: b.hurtT || 0, dead: !!b.dead
      })) : [],
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
