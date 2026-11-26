# -*- coding: utf-8 -*-
# 一次性重构脚本：把 LocalServer 的聊天 / 指令 / 背包 / 快照改成按会话（多玩家）。
import io, sys

p = 'js/net/server.js'
s = io.open(p, encoding='utf-8', newline='').read().replace('\r\n', '\n')


def cut(start_marker, end_marker, new):
    global s
    i = s.find(start_marker)
    assert i >= 0, start_marker[:60]
    j = s.find(end_marker, i + len(start_marker))
    assert j > i, end_marker[:60]
    s = s[:i] + new + s[j:]


R1 = '''  sendChat(channel, text, sessId) {
    const sess = this.session(sessId);
    const p = sess && sess.player;
    const name = p ? p.name : 'Guest';
    // 指令：以 / 开头视为指令，不进入普通聊天（类型不匹配等一律走 i18n 系统提示）
    if (text && typeof text === 'string' && text[0] === '/') { this._handleCommand(text, channel, sess); return; }
    // 全局频道：所有人都能收到；Local 频道只按“周围有没有人”判定是否提示无人应答。
    const heard = this._recipients(channel, p).length;
    this._broadcast({ kind: 'chat', channel, from: name, text });
    if (heard === 0) {
      this._event(sess, { kind: 'sys', channel, text: 'Chat/Alone' });
    }
  }
  // 该频道里除发送者以外的接收者（多人会话 = 其它玩家）。
  _recipients(channel, from) {
    const out = [];
    for (const s of this.sessions.values()) {
      const p = s.player;
      if (p && p !== from) out.push(p);
    }
    return out;
  }

'''
cut("  sendChat(channel, text) {", "  // 匹配玩家：全名", R1)

# _handleCommand：签名 + 定向回执
i = s.find("  _handleCommand(raw, channel) {")
assert i >= 0
j = s.find("\n  // 原地复活", i)
assert j > i
block = s[i:j]
block = block.replace("  _handleCommand(raw, channel) {", "  _handleCommand(raw, channel, sess) {")
block = block.replace("    const p = this.player;", "    const p = sess && sess.player;")
block = block.replace("this._events.push(", "this._event(sess, ")
s = s[:i] + block + s[j:]

R3 = '''  _respawnInPlace(sessId) {
    const sess = this.session(sessId);
    const p = sess && sess.player;
    if (!p) return;
    // 统一重置入口（pos = null 表示不改坐标）：清花瓣实体/世代号/装填，与其它复活路径一致。
    p.resetForSpawn(null);
    for (const m of this.ents) if (m.threat) m.threat.length = 0;
    // 通知客户端同步重置自己的预测副本（否则客户端不知道这次重生，世代号照样会漂）
    this._event(sess, { kind: 'respawned', x: p.x, y: p.y, cp: -1 });
  }

  // 取走某个会话的待投递事件（含广播扇出）；不传 sessId 时退回旧的全局队列（LocalNet 兼容）。
'''
cut("  _respawnInPlace() {", "  drainEvents(", R3)
s = s.replace("      this._respawnInPlace();", "      this._respawnInPlace(sess);")

R4 = '''  _invSnapshot(sess) {
    const o = {};
    const inv = sess ? sess.inventory : this.inventory;
    for (const k in inv) o[k] = inv[k];
    return o;
  }
  // 调试开关是【用户设置】，运行中随时可能切换，所以这里必须实时读 window.__debug：
  // 缓存成字段的话“开过调试再关掉”会让此后所有扣料/损耗都变成空操作（合成失败看不到消耗）。
  _invDebug() { return !!(typeof window !== 'undefined' && window.__debug); }
  _invCount(sess, key) { return this._invDebug() ? Infinity : ((sess && sess.inventory[key]) || 0); }
  _invSet(sess, key, n) { if (!this._invDebug() && sess) sess.inventory[key] = Math.max(0, n); }

  // 背包权威入口：所有 op 都作用在【指定会话】的库存与待合成状态上。
  invRequest(a, sessId) {
    const sess = this.session(sessId);
    const op = a.op;
    const snap = () => ({ inventory: this._invSnapshot(sess) });
    if (!sess) return Object.assign({ error: 'no session' }, snap());
    const cnt = (key) => this._invCount(sess, key);
    const set = (key, n) => this._invSet(sess, key, n);
    if (op === 'get') return snap();
    // 卸下全部装载材料：不需要 key，只认服务端记录的 pending。
    if (op === 'unload') {
      const prev = sess.pendingCraft;
      if (prev) {
        set(prev.key, cnt(prev.key) + prev.n);
        sess.pendingCraft = null;
      }
      return snap();
    }
    // 领取结果：同样不需要 key，必须放在下面的 key 校验之前
    if (op === 'takeResult') {
      const r = sess.pendingResult;
      if (r) {
        set(r.key, cnt(r.key) + r.count);
        sess.pendingResult = null;
      }
      return Object.assign({ taken: r ? r.count : 0 }, snap());
    }
    const key = a.key;
    if (typeof key !== 'string' || !key) return Object.assign({ error: 'bad key' }, snap());
    const n = Math.max(1, Math.floor(Number(a.n) || 1));
    const fail = (err) => Object.assign({ error: err }, snap());
    // 数量必须是有限正整数：Infinity（调试模式下 Shift 装全部）会让 craft 的
    // `while (left >= 5)` 永远退不出去，必须在入口就拒掉。
    if (!Number.isFinite(n)) return fail('bad n');

    if (op === 'take') {
      if (cnt(key) < n) return fail('not enough');
      set(key, cnt(key) - n);
    } else if (op === 'return' || op === 'add') {
      set(key, cnt(key) + n);
    } else if (op === 'load') {
      // 装载合成材料：点击时就扣（库存立刻减少）；换卡/叠加先返还上一批。
      // 同种补齐时上一批会被先返还：可用量必须算上它，否则“装载 3 张 + 库存 2 张”
      // 要装 5 张会被误判 not enough（客户端却按补齐显示，表现为点了不扣料、可无限刷）。
      const prev = sess.pendingCraft;
      const refund = (prev && prev.key === key) ? prev.n : 0;
      if (cnt(key) + refund < n) return fail('not enough');
      if (prev) set(prev.key, cnt(prev.key) + prev.n);
      set(key, cnt(key) - n);
      sess.pendingCraft = { key, n };
    } else if (op === 'craft') {
      // 只消费服务端已扣的材料：客户端传来的 n / target 一律不采信。
      const pc = sess.pendingCraft;
      if (!pc) return fail('no pending craft');
      if (pc.key !== key) return fail('key mismatch');
      const m = pc.n;
      sess.pendingCraft = null;
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
      if (left > 0) sess.pendingCraft = { key: pc.key, n: left };
      const tk = typeKey + '|' + target;
      // 旧结果若还没拿下：被替下这一刻才真正入包（用户口径）。
      if (sess.pendingResult) {
        const old = sess.pendingResult;
        set(old.key, cnt(old.key) + old.count);
      }
      // 新结果先挂在服务端，等玩家点结果卡 / 被下一拨替下才计入 inventory。
      sess.pendingResult = wins > 0 ? { key: tk, count: wins } : null;
      return Object.assign({ wins, losses, left, target }, snap());
    } else {
      return fail('unknown op');
    }
    return snap();
  }

'''
cut("  _invSnapshot() {", "  // 请求/应答入口", R4)

R5 = '''  handleRequest(kind, payload, sessId) {
    const a = payload || {};
    switch (kind) {
      case 'respawn':
        return this.requestRespawn(sessId);
      case 'teleport':
        return this.teleport(a.x, a.y, sessId) || null;    // null = 成功
      case 'init':
        this.initMap(a.map);
        return true;
      case 'player': {
        const p = this._playerOf(sessId);
        if (!p) return null;
        return {
          name: p.name, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, level: p.level
        };
      }
      case 'players':
        return this.players.map((p) => ({ id: p.sess ? p.sess.id : null, name: p.name }));
      case 'inv':
        return this.invRequest(a, sessId);
      default:
        return { error: 'unknown request: ' + kind };
    }
  }

'''
cut("  handleRequest(kind, payload) {", "  // ---- 快照：纯数据", R5)

old = "  drainEvents() { const e = this._events; this._events = []; return e; }"
assert old in s
s = s.replace(old, '''  drainEvents(sessId) {
    const sess = this.session(sessId);
    if (sess) { const e = sess.events; sess.events = []; return e; }
    const e = this._events; this._events = []; return e;
  }''')

R7 = '''  snapshot(dt, sessId) {
    const sess = this.session(sessId);
    const p = sess ? sess.player : null;
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
      // 其它玩家（多人）：只带表现必需字段 + 他们的花瓣，客户端用轻量视图对象绘制。
      players: this._snapOtherPlayers(sess),
      // 场级实体（网）：玩家的网 + 蜘蛛自铺/大招的网，全部下发。
      // 客户端只渲染这里下发的网；玩家网与蜘蛛网共用同一套生成 / 到期 / 退场流程。
      webs: this._snapWebs(),
      // 全量下发：小地图要能看到全图人口（远处生物的 AI 仍由 activeR() 休眠省算力）
      ents: this._fillEnts(),
      projectiles: this._fillHornetProjectiles()
    };
  }

  // 除“我”以外的所有会话玩家：位置 / 血量 / 装备 / 花瓣状态。
  // 每个会话有自己的花瓣缓冲（_petalBuf 是共享的，多个玩家同时打包会互相覆盖）。
  _snapOtherPlayers(sess) {
    const out = this._playerBuf || (this._playerBuf = []);
    let n = 0;
    for (const s of this.sessions.values()) {
      if (s === sess) continue;
      const p = s.player;
      if (!p) continue;
      const o = out[n] || (out[n] = {});
      o.id = s.id;
      o.name = p.name;
      o.x = p.x; o.y = p.y;
      o.hp = p.hp; o.maxHp = p.maxHp;
      o.dead = !!p.dead;
      o.facing = p.facing || 0;
      o.hurtT = p.hurtT || 0;
      o.deathRot = p.deathRot || 0;
      o.invuln = p.invuln || 0;
      o.slots = (p.slots || []).map((c) => (c && c.type) ? { key: c.type.key, rarity: c.rarity } : null);
      o.petals = this._snapPetals(p,
        s._petalBuf || (s._petalBuf = []),
        s._petalHas || (s._petalHas = new Uint8Array(32)));
      n++;
    }
    out.length = n;
    return out;
  }

'''
cut("  snapshot(dt) {", "  // 快照里的花瓣状态", R7)

s = s.replace("  _snapPetals(p) {", "  _snapPetals(p, buf, has) {")
s = s.replace("    const out = this._petalBuf || (this._petalBuf = []);\n    let n = 0;",
              "    const out = buf || (this._petalBuf || (this._petalBuf = []));\n    let n = 0;")
old = '''    const slots = p.slots || [];
    let hasSlot = this._petalHas;
    if (!hasSlot || hasSlot.length < slots.length) {
      hasSlot = this._petalHas = new Uint8Array(Math.max(32, slots.length));
    }'''
assert old in s
s = s.replace(old, '''    const slots = p.slots || [];
    let hasSlot = has;
    if (!hasSlot || hasSlot.length < slots.length) {
      hasSlot = new Uint8Array(Math.max(32, slots.length));
    }''')

io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n'))
print('ok', len(s))
