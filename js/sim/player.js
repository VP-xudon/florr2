// sim/player.js — 玩家实体：移动/装填/花瓣轨道/无敌/死亡状态
'use strict';

class Player {
  constructor() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.r = 22 * 0.6;   // 主角半径 = 原来的 0.6 倍 (≈13.2)
    this.facing = 0;
    this.baseSpeed = PLAYER_BASE_SPEED; this.speed = this.baseSpeed;  // 人物移速 = 当前(0.4倍)再放慢一半 = 0.5 倍于当前
    this.weight = rarityWeight('unusual');   // 花朵本体视为 unusual 生物的重量（玩家也是实体，参与重量推挤）
    this.maxHp = 100; this.hp = 100;
    this.xp = 0; this.level = 1; this.xpNext = 24;
    this.damage = 0;
    this.slots = emptySlots();      // 花朵花瓣（主槽，已装备）
    this.subSlots = emptySlots();   // 副槽（临时存储，不参与装备）
    this.invBar = [];                              // 即时物品栏（底部常驻淡灰卡槽）
    this.backpack = [];                            // 背包库存（仅在背包面板可见）
    this.maxInvBar = 8;
    this.maxBackpack = 24;
    this.invuln = 0; this.flash = 0;
    this.clock = 0;             // 单调递增计时器：InvulnFX 的时间基准（绝对到期时间）
    this.invulnSrc = {};        // 无敌来源表：{ 'spawn'|'hurt'|'petal:xxx': 到期时刻 }
    this.invulnTotal = 0;       // 本段无敌总时长（供光晕/血条做淡入淡出包络）
    this.invulnA = 0;           // 无敌视觉强度（平滑 0..1：光晕亮度、血条金白程度）
    this.hurtInvuln = 0;        // 受伤无敌帧计时（只免伤、不出任何无敌特效）
    this.armor = 0;             // 花朵护甲：受击结算 = max(攻-甲, 0)
    this.bodyDmg = FLOWER_BODY_DMG;  // 花朵本体攻击（体伤）；recompute() 会再次同步
    this.hurtT = 0;             // 受伤红色滤镜剩余时间（0.1s）
    this.kbX = 0; this.kbY = 0; // 反弹冲量速度（px/s，指数衰减到 0）
    this.hpBarA = 0;            // 血条显示透明度（非满血渐显 0.3s / 满血渐隐 0.3s）
    this.deathRot = 0;          // 死亡时本体固定的随机旋转角
    this.dead = false; this.deathTimer = 0;
    this.breath = 0; this.moving = false;
    this.spin = 0;              // 花瓣环绕角度
    this.petals = [];           // 花瓣实体（各自有实际坐标与速度）
    this.petalGhosts = [];      // 已卸下/被移除的花瓣：原地放大渐隐
    this.petalWorld = [];
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
    this.age = 0;                // 出场计时：脸部 spawnPop Q 弹（重生时归零重播）
    this.killedBy = null;        // 死因（生物名称），死亡界面显示用
  }

  recompute() {
    // 花瓣血量独立于人物血量：装备花瓣【不再】增加 maxHp（hp 是花瓣自己的"水缸"）。
    let spd = 0, dmg = 0;
    for (const p of this.slots) {
      if (p) {
        const st = petalStatsFor(p.type, p.rarity);   // 按稀有度取值（倍率/整表）
        dmg += st.dmg; spd += p.type.spd;
      }
    }
    // 注意：maxHp 不在这里重置——它由构造函数给默认值 100，调试参数 ?hp=N 在之外覆盖。
    // 若在此硬编码写回 FLOWER_BASE_HP，则每次换装 recompute() 都会把 ?hp 覆盖回 100，
    // 表现为"一碰就死 / ?hp 无效"。speed / damage 等依赖装填的字段照常重算。
    this.speed = Math.max(60, this.baseSpeed + spd);
    this.damage = dmg;
    this.bodyDmg = FLOWER_BODY_DMG;   // 体伤：与 maxHp 同源，重算后稳定为 20
  }

  // 受击结算：返回【本击是否真正扣到了血】（护甲已在调用方扣减）。
  // 注意语义：返回 true 表示"掉血了"，不等于"死了"—— 是否致死看 this.dead / this.hp。
  // （旧实现返回的是"是否致死"，导致非致命受伤时反弹/屏幕抖动全部不触发。）
  // src = 伤害来源（Mob）：致死时记录其名称，死亡界面显示"你死于 XX"。
  // invuln > 0 时完全免伤（不扣血、不触发红闪）——出生无敌/受伤无敌帧/未来的无敌花瓣都走这里。
  hurt(dmg, src) {
    if (this.dead || dmg <= 0) return false;
    if (this.invuln > 0 || this.hurtInvuln > 0) return false;
    this.hp -= dmg;
    this.hurtT = 0.3;                   // 0.3s 红色滤镜（全体实体通用时长，唯一受击反馈，不再叠加白闪）
    this.hurtInvuln = FLOWER_HURT_INVULN;   // 受伤无敌帧：独立计时，只挡连续扣血，不产生任何无敌特效
    if (this.hp <= 0) {
      this.hp = 0;
      this.killedBy = (src && src.name) ? src.name : null;
      this.die();
    }
    return true;
  }

  // 花朵死亡：花瓣原地快速渐隐消失，本体随机旋转一个角度后保持不动（叉叉眼 + 哭脸）
  die() {
    this.dead = true; this.deathTimer = 0;
    this.deathRot = rand(0, TAU);
    // 每个花瓣实体各自转幽灵（多体花瓣本就是 N 个实体，无需特殊处理）
    for (const b of this.petals) this.petalGhosts.push({ card: b.card, x: b.x, y: b.y, age: 0 });
    this.petals = []; this.petalWorld = [];
    this.vx = 0; this.vy = 0;
  }

  // 出生 / 重生的【唯一】重置入口：客户端预测副本与服务端权威副本都必须走这里。
  // 历史上两端各维护一份字段清单，服务端清了 _petalGen 而客户端没清：
  // 花瓣实体的世代号只增不减，于是快照键 "槽|子序|世代" 永远匹配不上 ——
  // 表现为「死过一次之后，那一槽花瓣再也不掉血、不红闪、不会碎」（伤害仍在服务端照算）。
  // 同理，reloadHold 若残留 true，重生后该槽会一直卡在"换卡动画暂停"状态。
  resetForSpawn(pos) {
    if (pos) { this.x = pos.x; this.y = pos.y; }
    this.vx = 0; this.vy = 0;
    this.hp = this.maxHp;
    this.dead = false; this.deathTimer = 0; this.deathRot = 0;
    this.hurtT = 0; this.flash = 0; this.killedBy = null;
    this.hurtInvuln = 0;
    this.invuln = 0; this.invulnSrc = {}; this.invulnTotal = 0; this.invulnA = 0;
    this.age = 0;
    this.dispHp = this.hp; this.ghostHp = this.hp; this.ghostV = 0;
    // 花瓣实体、世代号、退场幽灵是同一份状态，必须一起清
    this.petals = []; this.petalWorld = []; this._petalGen = []; this.petalGhosts = [];
    this.netPetals = null;                 // 旧快照键映射作废，避免重生瞬间串状态
    this.reload = this.slots.map((c) => c ? {
      card: c, age: 0,
      dur: (c.type.reload != null) ? c.type.reload : Math.max(0, c.type.spd || 0)
    } : null);
    this.reloadHold = this.slots.map(() => false);
    InvulnFX.add(this, 'spawn', FLOWER_SPAWN_INVULN);
    return this;
  }

  update(dt, dir, map, mobs) {
    if (this.dead) {
      this.deathTimer += dt;
      // 死亡瞬间放出的花瓣退场幽灵继续播完渐隐（0.2s）
      for (const g of this.petalGhosts) g.age += dt;
      this.petalGhosts = this.petalGhosts.filter((g) => g.age < PETAL_GHOST_T);
      return;
    }
    // 地形减速：站在 foliage / seaweed / vine 这类瓦片上时——
    //   · 移动速度 = 默认值的 40%
    //   · 所有花瓣强制回到"待加载"状态（装填进度清零、不生成实体），离开后重新装填
    this.slowTile = !!(map && map.slowAt && map.slowAt(this.x, this.y));
    this.hurtT = Math.max(0, this.hurtT - dt);
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
      // 减速瓦片：×0.4；/speed 的倍率再整体乘上来（客户端/服务端共用同一个 MOVE_MULT）
      const spd = this.speed * MOVE_MULT * (this.slowTile ? SLOW_TILE_SPEED : 1);
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
      this.facing = lerpAngle(this.facing, ta, clamp(dt * 12, 0, 1));
    }
    this.breath += dt;
    this.age += dt;                  // 出场 Q 弹推进
    InvulnFX.tick(this, dt);            // 无敌时间推进（多来源，取最晚到期）
    // 无敌视觉强度平滑跟随：进入/退出都是渐变，绝不硬切换（光晕亮度与血条金白共用它）。
    // 只跟随 invuln（出生/召唤/花瓣类）；受伤无敌帧走独立的 hurtInvuln，不产生任何视觉。
    this.invulnA = damp(this.invulnA, this.invuln > 0 ? 1 : 0, 8, dt);
    this.hurtInvuln = Math.max(0, this.hurtInvuln - dt);   // 受伤无敌帧衰减
    this.flash = Math.max(0, this.flash - dt);

    this.spin += PETAL_SPIN * ROT_SCALE * dt;
    // 装填计时必须在 _syncPetals 之前：新换上来的卡要先有 reload 状态（age=0 -> 未完成），
    // 这一步之后花瓣实体才会被放出来
    this._tickReload(dt);
    // 模式过渡动画：0.15s平滑过渡
    const targetT = (this.mode === 'normal') ? 0 : 1;
    const modeRate = 1 / 0.15;  // 0.15秒完成过渡
    this.modeT = damp(this.modeT, targetT, modeRate, dt);
    this._syncPetals(dt, map, mobs);
  }

  // 滞留型花瓣（Pollen / Honey）的脱轨条件：
  // 只要处在 reach / detect 模式就立刻生效 —— 按下按键那一刻模式就已经切换，
  // 不能等花瓣飞到扩展轨道的位置（那是"外观过渡"，与机制无关）。
  // normal 模式下一律跟随轨道。
  _detachReady() {
    if (this.dead) return false;
    return this.mode === 'reach' || this.mode === 'detect';
  }

  // 客户端侧销毁一朵花瓣实体：转退场幽灵（由 _syncPetals 的差分完成）+
  // 该槽重新结算装填。与服务端 _destroyPetal 语义一致，但这里只做表现。
  _killPetalBody(b) {
    if (b.dead) return;
    b.dead = true;
    // 与服务端 _destroyPetal 同一规则：放在地上的滞留实体（Pollen / Honey）碎了就是碎了，
    // 不触发卡片重装。少了这一条，客户端会把该槽冷却重置一遍 -> 之后每次装填都比服务端慢一拍。
    if (b.stationary) return;
    const c = b.card;
    const dur = (c.type.reload != null) ? c.type.reload : Math.max(0, c.type.spd || 0);
    const cnt = (CardRenderer.lightSubCount) ? CardRenderer.lightSubCount(c.type, c.rarity) : 1;
    if (cnt > 1) {
      // 多实体卡：只有这一个实体进入自己的重装填（服务端权威计时），卡片【不】进入
      // reload —— 所以卡面不会出现扇形阴影；同槽其它实体照常飞舞。
      // 死亡视觉：原地放大渐隐（此实体不会像单体卡那样从实体表里消失）。
      this.petalGhosts.push({ card: c, x: b.x, y: b.y, age: 0 });
      return;
    }
    this.reload[b.slotIndex] = { card: c, age: 0, dur };
  }

  // 把服务端下发的花瓣战斗状态（hp / 受伤红闪 / 是否已碎）应用到当前花瓣实体上。
  // 由 _syncPetals 每帧调用；快照到达时也由 Game._applySnap 立即调一次，
  // 保证同帧就能看到掉血/碎裂，不用等下一帧。
  _applyNetPetalStates() {
    if (!this.netPetals) return;
    for (const b of this.petals) {
      // 按 (槽位, 子序号, 世代号) 匹配：一张卡可能对应多个独立实体（Light 的每个光点），
      // 滞留型花瓣（Pollen/Honey）还会同时存在多批 -> 必须带世代号，否则会串血。
      const ns = this.netPetals[b.slotIndex + '|' + (b.sub || 0) + '|' + (b.gen || 0)]
        || (typeof this.netPetals.find === 'function'
          ? this.netPetals.find((x) => x.slot === b.slotIndex && (x.sub || 0) === (b.sub || 0)
            && (x.gen || 0) === (b.gen || 0))
          : null);
      if (!ns) continue;
      b.hp = ns.hp; b.maxHp = ns.maxHp;
      // 滞留实体（Pollen / Honey）位置与速度取服务端权威值：它们会被生物硬碰撞推挤，
      // 客户端必须跟随，否则服务端已经把蜜推开、客户端仍留在原地 ->
      // 表现为"生物与蜜重合"（看起来像根本没有实体碰撞）。
      if (b.stationary && ns.x != null) {
        // 不把坐标硬赋值过去：那样它会跟着 25Hz 的快照台阶跳 —— 被连续推挤时
        // 就是明显的"一卡一卡 / 很粘"。改为记录起终点，由每帧插值还原平滑位移。
        if (b.nToX == null || Math.abs(ns.x - b.nToX) > 0.01 || Math.abs(ns.y - b.nToY) > 0.01) {
          b.nFromX = b.x; b.nFromY = b.y;
          b.nToX = ns.x; b.nToY = ns.y;
          b.nBlend = 0;
        }
        b.vx = ns.vx || 0; b.vy = ns.vy || 0;
      }
      // 受伤红闪取"更亮"的那个，避免本地已衰减到一半时被覆盖掉
      if (ns.hurtT > (b.hurtT || 0)) b.hurtT = ns.hurtT;
      if (ns.dead && !b.dead) {
        this._killPetalBody(b);
      } else if (!ns.dead && b.dead) {
        // 多实体卡的单个实体装填完成 -> 复活：Q 弹重生（age 归零）。
        // 坐标同样拉回花朵中心：否则它会从"死亡处"（可能正贴着生物）原地冒出，
        // 看起来就像从生物身上突然出现、而不是从花瓣中心飞出去。
        b.dead = false;
        b.age = 0;
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
        // 冷却时长：优先 type.reload（显式字段）；否则回退 type.spd（历史约定）
        const dur = (c.type && c.type.reload != null)
          ? c.type.reload : Math.max(0, (c.type && c.type.spd) || 0);
        this.reload[i] = { card: c, age: 0, dur };
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
    const r = this.reload[i];
    return !!r && r.age >= r.dur;
  }

  // 花瓣运动：自由跟随主角。与生物【没有物理碰撞】——花瓣穿过生物本体，
  // 敌对接触只走战斗结算（25 tick/s 双向扣血，见 game.js _combatTick）。
  _resolvePetal(b, mx, my) {
    b.x += mx; b.y += my;
  }

  // 花瓣 = 实体：每片都有"此刻应在的位置"(target) 与 "实际位置"，平滑吸附过去。
  //   · 按「当前装备数量」平分一圈：2 片 180° 相对、3 片三角、5 片五角……（空槽不占位）
  //   · 刚上场的花瓣初始位置就在人物中心，再慢慢"冒"到应在位置
  //   · 人物跑起来时目标点跟着跑，花瓣会被甩在后面一小段距离，再平滑吸附（故意保留的缓冲感）
  //   · 装备数量变化引起间距重排时，同样走这套吸附过程，绝不瞬移
  _syncPetals(dt, map, mobs) {
    // 【装上就算数】：所有已装备的主槽都参与排列（n = 装备总数），
    // 装填中/被打碎重冷的槽位照样占一个位置 —— 其它花瓣自动给它留出空位。
    const equipped = [];
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i]) equipped.push(i);
    }
    const n = equipped.length;

    // Light 多体：一个槽由 N 个独立光点组成（等同装了 N 个单体 Light），
    // 每个光点各占一个轨道位 —— 所以轨道总数 = Σ 各槽光点数。
    const cntOf = (card) => (card && CardRenderer.lightSubCount)
      ? CardRenderer.lightSubCount(card.type, card.rarity) : 1;
    // 【阵型多体】（Stinger 起）：整坨【共用一个轨道位】（像加载一个花瓣那样分配位置）；
    // 其余一卡多体（Light / Pollen）仍然是每个实体各占一个轨道位、各自独立飞。
    const spotOf = (card) => (card && card.type && card.type.formation) ? 1 : cntOf(card);
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
      // 已碎的滞留实体直接丢掉：它不属于任何一批，也不会"重装填复活"，
      // 留着只会在 petals 里越积越多（退场幽灵在下死手那一刻已经生成）。
      if (b.dead) continue;
      // 卡片 ↔ 实体严格对应：这张卡被切下/换掉，地上的实体立刻消失。
      // （否则切下 Honey 再切回来会凭空多出一批实体，越切越多。）
      if (this.slots[b.slotIndex] !== b.card) {
        b.dead = true;
        this.petalGhosts.push({ card: b.card, x: b.x, y: b.y, age: 0 });
        continue;
      }
      b.age += dt;
      b.hurtT = Math.max(0, (b.hurtT || 0) - dt);
      b.life = (b.life || 0) + dt;
      // 存活上限：Pollen 有；Honey 靠血量撑（Infinity）
      const lim = (b.card && b.card.type && b.card.type.holdReloadUntilDeath)
        ? Infinity : PETAL_DETACH_TTL;
      if (b.life >= lim) {
        b.dead = true;
        this.petalGhosts.push({ card: b.card, x: b.x, y: b.y, age: 0 });
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
      // （如 Peas 单球 5 血、卡面也显示 5），否则会被除以 N 变成 1.25，完全失真。
      const cardHp = st.hp || 30;
      const maxHp = (cnt > 1 && !card.type.formation) ? cardHp / cnt : cardHp;
      const gen = this._petalGen[slotIndex] | 0;
      for (let sub = 0; sub < cnt; sub++) {
        let body = null;
        for (const b of this.petals) {
          // 匹配"本世代"的实体：脱轨后世代号 +1，旧实体不再被这里复用
          if (!b.stationary && (b.gen | 0) === gen
            && b.slotIndex === slotIndex && b.card === card && b.sub === sub) { body = b; break; }
        }
        if (!body) {
          // 花瓣实体重量 = 其稀有度对应的实体重量（与 Mob / Player 共用 rarityWeight 模型，
          // 随稀有度递增：common=1 …… rare≈4 …… eternal≈249）。
          // 注释原话就是"花瓣 = 对应稀有度重量"，但此前实体对象上根本没有这个字段，
          // 导致所有花瓣在推挤/击退中一律视为"没有重量"——连 Eternal 蜜都被 rare 生物推着跑。
          body = { slotIndex, sub, gen, card, x: this.x, y: this.y, age: 0, hp: maxHp, maxHp, hurtT: 0,
            weight: rarityWeight(card.rarity) };
        }
        body.age += dt;
        body.hurtT = Math.max(0, (body.hurtT || 0) - dt);
        body.ord = k; body.n = n;
        body.cnt = cnt;
        body.spot = (nSpot === 1) ? myBase : myBase + sub;   // 阵型型：整坨共用同一个轨道位
        // ---- 阵型多体（Stinger 起）：子实体按【卡面同款布局】锁定偏移 + 各自朝向 ----
        // 每个子实体仍是完全独立的个体（各自结算碰撞、各自有血量），
        // 只是位置/朝向常年被布局锁定成卡面那一坨的形状。
        if (nSpot === 1 && cnt > 1) {
          const lay = (typeof CardRenderer !== 'undefined' && CardRenderer.multiLayout)
            ? CardRenderer.multiLayout(card.type.svg, card.rarity) : null;
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
            body.formOff = { x: s.x * entD, y: s.y * entD };
            body.formRot = s.rot || 0;
            // （与 Stinger 完全一致：不再有任何"单球索引 / 二次缩放"的特例）
          }
        }
        // 标记"会吸引仇恨的花瓣"：AI 据此判断"被吸引"的生物连被动型也会主动过来啃
        body.honey = !!card.type.attractMobs;
        // ---- 滞留型花瓣（Pollen / Honey）：reach / detect 模式加载完成后 0.5s 脱轨 ----
        // 只有这两种模式才会"甩出去留在原地"（normal 模式永远跟着轨道）。
        const detachAt = card.type.detachAfter || 0;
        if (detachAt > 0 && !body.dead && body.age >= detachAt && this._detachReady()) {
          body.stationary = true;                   // 脱离轨道：不再跟随
          body.life = 0;
          const launch = card.type.launch;
          if (launch) {
            // 喷射型花瓣（Peas）：朝 N 个方向直直飞出去，速度 = speedK × 主角默认最高移速
            //（其它滞留花瓣是"原地惯性滑行"，喷射型是"射出去"，所以这里单独给速度）
            const dirs = launch.count || 4;
            const dir = (sub || 0) * (TAU / dirs) + (body.selfRot || 0);   // 基于【自身绝对朝向】
            // 速度基准必须是 PLAYER_BASE_SPEED（默认最高移速）。
            // 绝不能用 this.speed —— 它含 SPEED_SCALE(5×) 与 /speed 倍率，
            // 会让豌豆一出膛就飞出屏幕（表现为"炸开一瞬间就没了、看不见在飞"）。
            const sp = (launch.speedK || 1.3) * PLAYER_BASE_SPEED;
            body.vx = Math.cos(dir) * sp;
            body.vy = Math.sin(dir) * sp;
          } else {
            body.vx = (body.vx || 0) * PETAL_DETACH_KICK;
            body.vy = (body.vy || 0) * PETAL_DETACH_KICK;
          }
          bodies.push(body);                        // 仍然是实体，只是换了运动规则
          this._petalGen[slotIndex] = gen + 1;      // 本槽换代：下一批实体用新世代号
          // 卡面进入冷却：Pollen 立刻重新装填；Honey 等实体死亡（r.hold，见 _tickReload）
          const dur = (card.type.reload != null) ? card.type.reload : 0;
          const r = { card, age: 0, dur };
          if (card.type.holdReloadUntilDeath) r.hold = true;
          this.reload[slotIndex] = r;
          continue;
        }
        bodies.push(body);
      }
    }
    // 本次已不在装备栏里的实体 -> 转为"退场幽灵"（卸下/删除 = 放大 + 渐隐）
    for (const b of this.petals) {
      if (b.stationary) continue;                  // 滞留实体由 ① 保留
      let kept = false;
      for (const nb of bodies) {
        if (nb.slotIndex === b.slotIndex && nb.card === b.card && nb.sub === b.sub && !nb.stationary) { kept = true; break; }
      }
      // 多体卡的已碎实体：死亡瞬间已经单独生成过幽灵，这里不重复
      if (!kept && !(b.dead && (b.cnt || 1) > 1)) {
        this.petalGhosts.push({ card: b.card, x: b.x, y: b.y, age: 0 });
      }
    }
    this.petals = bodies;

    // ---- 服务端花瓣战斗状态回填 ----
    // 客户端不跑战斗（战斗在服务端），所以花瓣的 hp / 受伤红闪 / 是否已碎
    // 全部由快照下发到这里。缺了这一步，服务端花瓣掉血碎掉而客户端毫无反应，
    // 外观上就是"花瓣永远不受伤、永远不会碎"。
    this._applyNetPetalStates();
    // 幽灵推进，超时即真正移除
    for (const g of this.petalGhosts) g.age += dt;
    this.petalGhosts = this.petalGhosts.filter((g) => g.age < PETAL_GHOST_T);

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
    const baseReach = this.r * (1 + PETAL_REACH) * 1.105;
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
      b.selfRot = (b.selfRot || 0) + PETAL_SELF_SPIN * dtc;

      // 滞留实体（Pollen / Honey）：脱离轨道后只用惯性滑行 -> 阻尼停住，
      // 不再跟随轨道、也不参与生物吸附（它就"放在地上"）。
      if (b.stationary) {
        // Peas 喷射中：保持【匀速直飞】，不做阻尼衰减、也不采信服务端位置插值
        //（服务端不跑这套飞行，采信插值会被拉回原地 = "一按空格就消失"）。
        // 飞行期间实体照常存在，因此碰撞/受伤/结算伤害都走正常链路，2s 后强制移除。
        const flight = b.card && b.card.type.launch;
        if (flight) {
          // 注意：b.life 已在上面的"滞留实体"循环（_syncPetals 开头）每帧 +dt，
          // 这里再加一次会让存活时长减半 —— 绝不重复累加。
          if (b.life >= (flight.life || PEAS_FLIGHT_T)) {
            // 【必须走公用移除接口】。直接 b.dead = true 只会让它在下一帧被静默剔除，
            // 没有任何退场表现；_killPetalBody 会生成 petalGhosts 幽灵（原地放大渐隐），
            // 与"花瓣被打碎"走的是同一条退场管线。
            this._killPetalBody(b);
            continue;
          }
          if (b.vx || b.vy) this._resolvePetal(b, (b.vx || 0) * dtc, (b.vy || 0) * dtc);
          continue;
        }
        // 服务端权威位置插值（25Hz 快照 -> 每帧）：这是"推动时一卡一卡"的主因，
        // 直接采信快照坐标就会按 25Hz 台阶跳。改为帧间线性插值，位移连续平滑。
        // 有权威位置时不再叠加本地惯性 —— 两者同时跑会互相打架，观感发"粘"。
        if (b.nToX != null) {
          b.nBlend = Math.min(1, (b.nBlend || 0) + dtc / PETAL_NET_SYNC);
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
      // 逐个花瓣取倍率：标了 noReach 的花瓣（如 Rose）【不计算 reach 的延长】，
      // 保持基础轨道距离（detect 的收拢仍然生效，因为它 ≤ 1）。
      const noReach = !!(b.card && b.card.type && b.card.type.noReach);
      const mult = noReach ? Math.min(1, reachMult) : reachMult;
      const reach = baseReach * mult;
      const ang = this.spin + (b.spot || 0) * spotStep;
      let tx = this.x + Math.cos(ang) * reach;
      let ty = this.y + Math.sin(ang) * reach;
      // 阵型偏移：整坨跟着同一个轨道位走，各子体再叠加【旋转到本瓣朝向】的布局偏移 ——
      // 于是它们恒保持卡面那一坨的形状（"被神秘力量锁定排列在一起"）。
      // 旋转基准取 R = ang + π/2，与单片花瓣自身的绘制朝向同一帧：
      // 这样世界里的排布 = 卡面排布整体旋转 R，与卡面严格同构。
      if (b.formOff) {
        const R = ang + Math.PI / 2;
        // 绘制朝向也要【由阵型基准统一给出】：否则每个子体各自按自身位置算朝向，
        // Ultra Stinger 的"尖端朝向中心"会被各子体自己那点偏移带偏而失真。
        b.drawRot = R + (b.formRot || 0);
        const cR = Math.cos(R), sR = Math.sin(R);
        tx += b.formOff.x * cR - b.formOff.y * sR;
        ty += b.formOff.x * sR + b.formOff.y * cR;
      }

      // ---- 花瓣吸附（果冻感）----
      // 生物边缘离花瓣 ≤ 1 倍花瓣直径时被强力吸过去；一旦吸住就贴在生物表面
      //（目标点 = 生物表面沿当前方向的接触点），于是被轨道拖着在生物身上"揉搓"。
      // 只有轨道应在位置相对吸住时被拉开 2.5 倍直径（人跑远了）才松手回轨道。
      let gx = tx, gy = ty, K = PETAL_SPRING_K;
      let mob = b.pullMob;
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
      if (!mob && !(b.pullCd > 0) && nearMobs && nearMobs.length) {
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
      b.vx += (K * (gx - b.x) - PETAL_SPRING_D * b.vx) * dtc;
      b.vy += (K * (gy - b.y) - PETAL_SPRING_D * b.vy) * dtc;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > PETAL_MAX_SPEED) { const s = PETAL_MAX_SPEED / sp; b.vx *= s; b.vy *= s; }
      // 自由运动（花瓣不是硬碰撞体；对生物的"果冻碰撞"由战斗 tick 结算击退）
      this._resolvePetal(b, b.vx * dtc, b.vy * dtc);
    }

    // 供绘制与碰撞使用（hurtT：花瓣受伤红滤镜；fxActive：特效驱动中，图层在主角之上；
    // dead：该实体已碎、正在独立重装填 —— 不绘制）
    this.petalWorld = this.petals.map((b) => ({
      x: b.x, y: b.y, r: PETAL_R, index: b.slotIndex, age: b.age,
      hurtT: b.hurtT || 0, fxActive: !!b.fxActive, dead: !!b.dead,
      stationary: !!b.stationary,
      // 阵型型子实体：整体朝向由更新阶段算好（基准 + 布局朝向，如 Ultra Stinger 尖端向心）
      drawRot: (b.drawRot != null) ? b.drawRot : null,
      // 阵型子体的相对尺寸（与卡面同一个 k），null = 满尺寸
      formK: (b.formK != null) ? b.formK : null,
      // 自转（独立于公转），从加载好那一刻起持续转动
      selfRot: b.selfRot || 0,
      // 自带贴图键：滞留实体可能在卡片被卸下之后还存在，不能再依赖 slots[index]
      svg: (b.card && b.card.type) ? b.card.type.svg : null,
      hp: b.hp, maxHp: b.maxHp
    }));
  }

  draw(ctx) {
    // 死亡：先播完花瓣退场幽灵（渐隐），再画死亡本体（随机角度 + 叉叉眼 + 哭脸）
    if (this.dead) {
      for (const g of this.petalGhosts) {
        const size = PETAL_ENT_SIZE;
        const d = deathFade(clamp(g.age / PETAL_GHOST_T, 0, 1));
        const rot = Math.atan2(g.y - this.y, g.x - this.x) + Math.PI / 2;
        const cv = CardRenderer.artCanvas(g.card.type.svg, 128);
        if (cv) drawPetalArt(ctx, cv, size, g.x, g.y, rot, d.scale, d.alpha);
        // 未就绪不画（同在场花瓣：回退 drawSprite 会得到极小尺寸）
      }
      this._drawDeadBody(ctx);
      return;
    }
    // 花瓣实体：出场渐显（大小不变）。特效驱动中的花瓣（如玫瑰飞向主角）
    // 延后到主角本体之后再画 —— 图层比人物高，"飞到脸上"的观感。
    for (const pp of this.petalWorld) {
      if (pp.fxActive || pp.dead) continue;         // 已碎实体不绘制（等独立重装填）
      const p = this.slots[pp.index];
      const size = PETAL_ENT_SIZE;                        // 13.5：花瓣视觉缩至原 0.9
      // 朝向 = 由花心指向花瓣：被甩在后面时姿态也会自然跟着偏
      // 滞留实体（放在地上的 Pollen/Honey）固定正向、不做出场渐显
      const svgKey = pp.svg || (p && p.type && p.type.svg);
      // 朝向 = 【自转】为主；阵型型子实体再叠加阵型基准（drawRot）。
      // 自转独立于公转：普通花瓣不再由"相对主角的位置"反推朝向。
      const rot = ((pp.stationary ? 0 : (pp.drawRot != null ? pp.drawRot : 0)) + (pp.selfRot || 0));
      const a = pp.stationary ? 1 : spawnFade(pp.age);
      // 与其它花瓣（Stinger）同一条管线：svg 已经指向正确素材，直接用
      const cv = svgKey ? CardRenderer.artCanvas(svgKey, 128) : null;
      // 子体尺寸同样乘 k（与卡面一致，k 一处修改两边同时生效）
      if (cv) drawPetalArt(ctx, cv, size * (pp.formK != null ? pp.formK : 1), pp.x, pp.y, rot, spawnPop(pp.age), a);
      // 未就绪【不画】也不能回退 drawSprite：那按原始 viewBox contain 绘制，
      // 图形会缩得极小（"错误加载的大小"），就绪后由 artCanvas 统一管线补上。
      // 花瓣受伤红色滤镜（0.3s，全体实体通用时长）
      if (pp.hurtT > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(pp.hurtT / 0.3, 0, 1) * 0.4;
        ctx.fillStyle = '#ff4040';
        ctx.beginPath(); ctx.arc(pp.x, pp.y, size / 2, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    // 被卸下/移除的花瓣：留在原地平滑放大并渐隐（0.2s 快速消失）
    // 放大到 1.5 倍不会盖住主角：轨道半径约 43px、主角半径 15.6px，
    // 花瓣放大后半宽 10.1px，内缘仍在 33px 处，离主角边缘还有 17px 余量。
    for (const g of this.petalGhosts) {
      const size = PETAL_ENT_SIZE;                         // 与在场花瓣同尺寸
      const d = deathFade(clamp(g.age / PETAL_GHOST_T, 0, 1));
      const rot = Math.atan2(g.y - this.y, g.x - this.x) + Math.PI / 2;
      const cv = CardRenderer.artCanvas(g.card.type.svg, 128);
      if (cv) drawPetalArt(ctx, cv, size, g.x, g.y, rot, d.scale, d.alpha);
      // 未就绪不画（同在场花瓣：回退 drawSprite 会得到极小尺寸）
    }

    // 主角：黄色笑脸（整体固定正放，不随朝向旋转；只有眼睛里的白色随移动方向偏移）。
    // 半径乘 spawnPop：出生/重生时 Q 弹弹出（过冲回落），五官全按 R 缩放同步跟随。
    const R = this.r * 1.2 * spawnPop(this.age);   // 脸部半径
    ctx.save();
    // 脸
    ctx.fillStyle = '#fae26a';            // 介于改前(#f7db45)与改后(#fce98e)之间
    ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.fill();
    ctx.lineWidth = R * 0.085;   // 等比缩放（去下限，保证描边随脸同步缩小）
    ctx.strokeStyle = '#dfbc4e';          // 描边：能看清，又不过分跳
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
        ctx.fillStyle = '#fae26a';
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
    const bulge = R * 0.1133 * (1 - 2 * this.modeT);   // 正=向下鼓(笑)，0=直线，负=向上鼓(哭)
    ctx.beginPath();
    ctx.moveTo(this.x - mHw, mY);
    ctx.quadraticCurveTo(this.x, mY + 2 * bulge, this.x + mHw, mY);
    ctx.stroke();
    ctx.restore();

    // 受伤红色滤镜（0.3s）：红色覆盖脸部，随剩余时间渐隐。受击只红闪，不再叠加白闪。
    if (this.hurtT > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.hurtT / 0.3, 0, 1) * 0.4;
      ctx.fillStyle = '#ff4040';
      ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.fill();
      ctx.restore();
    }
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
    for (const pp of this.petalWorld) {
      if (!pp.fxActive || pp.dead) continue;
      const p = this.slots[pp.index];
      const size = PETAL_ENT_SIZE;
      const rot = Math.atan2(pp.y - this.y, pp.x - this.x) + Math.PI / 2;
      const a = spawnFade(pp.age);
      const cv = CardRenderer.artCanvas(p.type.svg, 128);
      if (cv) drawPetalArt(ctx, cv, size, pp.x, pp.y, rot, spawnPop(pp.age), a);
      // 未就绪不画（同在场花瓣：回退 drawSprite 会得到极小尺寸）
      if (pp.hurtT > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(pp.hurtT / 0.3, 0, 1) * 0.4;
        ctx.fillStyle = '#ff4040';
        ctx.beginPath(); ctx.arc(pp.x, pp.y, size / 2, 0, TAU); ctx.fill();
        ctx.restore();
      }
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
    const rk = Math.min(1, this.deathTimer / 0.35);
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
// 主角绘制半径 = r×1.2 = 13.2×1.2 = 15.84 -> 视觉直径 31.68。
// 校准（用户实测）：common = 0.65×旧值；且上一版 super 的尺寸其实是 mythic 应有的尺寸。
// 即 mythic = 旧 ultra 倍率 = 1.9 × step_old^6，common→mythic 共 5 级均匀变化：
// step = (mythic倍率 / common倍率)^(1/5) ≈ 1.4118，ultra/super/eternal/unique 顺势等比。
