// game.js — 核心循环与系统编排
'use strict';

const WORLD_R = 1500 * 0.75;  // 1125：地图/世界缩至原 0.75（主角不变）
// 真实受伤时的屏幕抖动峰值（像素）。按反馈放大到 2.3 倍（原 2.6 -> 5.98），更明显。
// 衰减沿用既有的 shake -= dt*30。
const HURT_SHAKE = 5.98;

// 客户端预测位置向服务端权威位置收敛的速率（每秒）与硬吸附阈值（像素）。
// 客户端只预测"自主移动 + 击退"，接触推挤由服务端计算，所以每帧会有几像素偏差：
// 用速率收敛代替"攒到 90px 再瞬移"，避免贴怪行走时的橡皮筋。
const RECONCILE_RATE = 14;    // ≈70ms 时间常数，几乎不可感知
const RECONCILE_SNAP = 120;   // 传送/长时间卡顿等极端偏差才直接吸附

// 物理键位 -> 逻辑动作。用 e.code 而非 e.key：e.key 会被输入法吞成 'Process'、
// 且受键盘布局影响；这里每个物理键各占一个标记，方向键之间互不干扰，
// 按住空格/Shift 时四个方向（含右方向）依然能任意组合。
const KEY_ACTION = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'mode1',                        // reach
  ShiftLeft: 'sLeft', ShiftRight: 'sRight' // detect（左右 Shift 分开记，避免同时按下一个松开即整体取消）
};
// 兜底：个别环境 e.code 缺失时，用 e.key 反查【物理键位】。
// 注意这里必须映射成 e.code 的形式（KeyW / ArrowRight …），而不是直接的逻辑动作：
// 方向由"按住的物理键位集合"推导，任何中间映射层都可能丢键（历史上右方向键就在这层丢失）。
const KEY_CODE_FALLBACK = {
  w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD',
  arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight',
  ' ': 'Space', shift: 'ShiftLeft'
};

// 背包堆叠：同类（类型+稀有度）合并为 { type, rarity, count }；种类槽上限 max
function addStack(arr, card, max) {
  for (const s of arr) if (s.type === card.type && s.rarity === card.rarity) { s.count++; return true; }
  if (arr.length >= max) return false;
  arr.push({ type: card.type, rarity: card.rarity, count: 1 });
  return true;
}
// 从堆叠取一张：数量-1，归零则移除该堆叠（UI 端 FLIP 平滑补位）
function takeOne(arr, i) {
  const s = arr[i]; if (!s) return false;
  if (--s.count <= 0) arr.splice(i, 1);
  return true;
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = 0; this.H = 0;
    this.keys = {};
    this.camera = { x: 0, y: 0 };
    this.shake = 0;
    this.tpTarget = null;    // /tp 标出的待传送点（世界 + 小地图红点）
    this.showCoord = false;  // /show-coord：左上角坐标读数开关
    this.showHitbox = false; // /pending crash 1：碰撞箱显示开关（默认关闭）
    this.last = 0;
    this.selectedSlot = 0;
    this._netPos = null;     // 服务端下发的权威位置（预测软校正的目标）
    this._snapDt = SNAP_DT;  // 最近一次快照覆盖的模拟时长（插值步长基准）

    this.player = null;
    this.mobs = [];          // 【视图层】生物：由服务端快照按 id 镜像而来（含插值坐标）
    this.mobViews = new Map();   // netId -> 视图 Mob（快照差分创建/销毁用）
    this.cards = [];
    this.drops = [];         // 生物死亡掉落的地面卡（可被玩家拾取）

    this.dropFx = [];        // 掉落物粒子（正方形小块）
    this.particles = [];
    this.dmgTexts = [];
    this.dex = {};   // 图鉴：mobId -> Set(已击败的稀有度)

    this.gardenData = window.GARDEN_DATA || null;
    this.map = (this.gardenData && this.gardenData.layers.length)
      ? createGardenMap(this.gardenData) : createMap(WORLD_R);
    this.bg = null;
    this.bgHalf = WORLD_R;
  }

  init() {
    this._resize();
    window.addEventListener('resize', () => this._resize());

    // 输入：把"当前按住的物理键位"记进 _down 集合，方向直接由集合推导（见 _readDir）。
    // 用集合而不是"逻辑动作布尔值"：任意多个方向键可以同时按住且互不覆盖，
    // 与 Shift/空格等修饰键组合也不会互相干扰（右方向键曾经在别名映射层被吃掉）。
    this._down = new Set();
    const codeOf = (e) => e.code || KEY_CODE_FALLBACK[(e.key || '').toLowerCase()] || '';
    window.addEventListener('keydown', (e) => {
      const code = codeOf(e);
      if (!code) return;
      const act = KEY_ACTION[code];
      if (act) {
        if (act === 'up' || act === 'down' || act === 'left' || act === 'right') {
          this._down.add(code);
          e.preventDefault();          // 方向键默认会滚动/移动焦点，一律拦掉
        } else {
          this.keys[act] = true;       // mode1(reach) / mode2(detect)
        }
      }
      if (e.repeat) return;            // 长按不重复触发开关类热键
      const k = (e.key || '').toLowerCase();
      // 背包热键：Z（B / Tab 已移除）；生物图鉴没有热键，只能点左下角按钮。
      if (k === 'z') { e.preventDefault(); this.toggleBag(); }
      if (k === 'r') { e.preventDefault(); this.swapSlotRows(); }
      if (k === 'm') { e.preventDefault(); if (UI.cycleMinimapMode) UI.cycleMinimapMode(); }
      const d = '1234567890'.indexOf(e.key);   // 1-9 -> 第1~9槽，0 -> 第10槽
      if (d >= 0) { e.preventDefault(); this.swapSlotColumn(d); }
    });
    window.addEventListener('keyup', (e) => {
      const code = codeOf(e);
      if (!code) return;
      this._down.delete(code);
      const act = KEY_ACTION[code];
      if (act === 'mode1' || act === 'sLeft' || act === 'sRight') this.keys[act] = false;
    });
    // 失焦时清空按键：避免切窗后"松手了仍在移动 / 模式卡住"
    window.addEventListener('blur', () => { this._down.clear(); this.keys = {}; });

    // —— 鼠标：① 左右键切换模式（左=reach / 右=detect，长按保持）；
    //     ② 移动方式：默认【鼠标移动】，设置窗口里勾选"键盘移动"才切成 WASD/方向键 ——
    this.moveMode = (typeof Settings !== 'undefined' && Settings.get('keyboardMove')) ? 'keyboard' : 'mouse';
    this.mouse = null;                       // 画布坐标指针位置（鼠标移动模式用）
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());   // 右键不弹系统菜单
    this.canvas.addEventListener('mousemove', (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.keys['mouse1'] = true;        // 左键按住 -> reach
      else if (e.button === 2) this.keys['mouse2'] = true;   // 右键按住 -> detect
    });
    // mouseup 挂 window：拖到画布外松手也能正确取消模式
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.keys['mouse1'] = false;
      else if (e.button === 2) this.keys['mouse2'] = false;
    });

    // 游戏是一个统一的"窗口"：屏蔽 Ctrl+滚轮 触发的浏览器整页缩放（避免不同元素被单独放大）
    window.addEventListener('wheel', (e) => {
      if (e.ctrlKey) e.preventDefault();
    }, { passive: false });

    // UI 由 ui.js 动态生成；绑定回调
    UI.onBagToggle = () => this.toggleBag();
    UI.onDexToggle = () => this.toggleDex();
    UI.onSettingsToggle = () => this.toggleSettings();
    // 设置项即时生效（Cookie 的写入在 UI 侧完成，这里只负责应用到运行时）
    UI.onSettingChange = (key, value) => {
      if (key === 'keyboardMove') this.moveMode = value ? 'keyboard' : 'mouse';
      else if (key === 'debug') window.__debug = !!value;
    };
    UI.onSlotClick = (i) => this.swapSlotColumn(i);         // 点击主槽卡 -> 与副槽同列互换（不再飞回背包）
    UI.onInvBarClick = (i) => this.equipFirstEmptyFromInv(i); // 点击物品栏卡 -> 装备到花朵
    UI.onSubClick = (i) => this.swapSlotColumn(i);          // 点击副槽卡 -> 与主槽同列互换
    UI.onBagCardClick = (i) => this.moveBagToInv(i);        // 点击背包卡 -> 进物品栏（无空槽则无反应）
    UI.onGalleryCardClick = (card, target) => {            // 点击画廊卡 -> 装备到空槽（含副槽）；满槽无反应
      // target 由 UI 的飞行动画预先确定并回传（保证"飞向哪格就装进哪格"）；
      // 没有回传时才现场检索：主槽优先、从左到右，主槽满则副槽。
      const t = target || this.firstEmptyAny();
      if (!t) return false;
      // 注意字段名：firstEmptyAny() 给的是 {row,index}，而 addGalleryCard/dispatchDrop 认的是
      // {type,index}。不归一化的话 target.type 为 undefined，会穿过所有分支返回 false ——
      // 表现就是"卡飞进空槽后消失被吞、槽位却仍然空着，还能继续放、继续吞"。
      return this.addGalleryCard(card.type, card.rarity, t.type ? t : { type: t.row, index: t.index });
    };
    UI.onCloseAll = () => this.closeAllWindows();
    UI.onDrop = (drag, target) => this.dispatchDrop(drag, target);
    UI.onRespawn = () => this.respawn();   // 死亡界面 Continue 按钮 -> 重生

    // 花瓣特效（如玫瑰回血）的文字输出口：统一走 spawnText，样式与攻击飘字一致
    PetalFX.textSink = (x, y, text, color) => this.spawnText(x, y, text, color);

    // ---- 网络层：客户端只通过 Net 与"服务端"往来（上行输入 / 下行快照+事件） ----
    this.net = new LocalNet();
    this.net.onMessage((msg) => {
      if (msg.t === 'snap') this._applySnap(msg.snap);
      else if (msg.t === 'evt') this._applyEvt(msg.ev);
    });
    // 真正的连接（含世界初始化）放在玩家构造完成之后，见下方 connect({ map, playerTemplate })

    // 聊天走同一条网络通道（服务器全局设定）：上行发送、下行收事件
    if (typeof Chat !== 'undefined') {
      Chat.bindNet(this.net);
      // /tp -> 先标点（世界 + 小地图红点）；/sure -> 交服务端校验后真正传送
      Chat.onTpTarget = (x, y) => { this.tpTarget = { x, y }; };
      Chat.onTpCancel = () => { this.tpTarget = null; };
      Chat.onTpConfirm = (x, y) => {
        const err = (this.net && typeof this.net.requestSync === 'function')
          ? this.net.requestSync('teleport', { x, y })
          : 'Chat/CommandError/InternalError';
        if (err) return err;                 // 墙体/不可行走 -> 返回错误键，人不动
        this.tpTarget = null;
        this.camera.x = x; this.camera.y = y;   // 相机直接到位，避免长距离滑行
        return null;
      };
    }

    // 玩家与初始装备
    this.player = new Player();
    this.player.net = this.net;   // 供花瓣系统（如 Peas 炸开）上行 RPC
    this.player.magician = !!(window.__queryParams && window.__queryParams.magician);  // 调试：?magician 开启魔法变种掉落 用
    this._resetPlayer(true);
    // 调试参数 ?hp=N（可与 mode/lang 逗号混搭）：直接设定人物血量上限与当前血量。
    // 【必须在 attach 之前应用】服务端副本要从这里继承 maxHp/hp，
    // 否则服务端停留在默认 100 血，而客户端每帧被快照的 hp 覆盖 -> "?hp 无效、一碰就死"。
    // 非法值（非正数）忽略。
    const hpParam = parseFloat(window.__queryParams && window.__queryParams.hp);
    if (hpParam > 0) {
      this.player.maxHp = hpParam;
      this.player.hp = hpParam;
      this.player.dispHp = hpParam; this.player.ghostHp = hpParam; this.player.ghostV = 0;
    }
    // 游客名：本地实现没有账号系统，按官方游客样式给一个随机编号（聊天里显示）
    this.player.name = 'Guest #' + (1000 + Math.floor(Math.random() * 9000));
    // 把地图与玩家初始状态交给服务端（此后权威状态归它管）。
    // 走 connect(opts) 而不是直连 net.server：远端实现（WebSocketNet）没有本地世界，
    // 客户端代码不该知道自己连的是进程内服务端还是真服务器。
    this.net.connect({ map: this.map, playerTemplate: this.player });
    this.camera.x = this.player.x; this.camera.y = this.player.y;
    // 注意：生物一律由服务端按【地图自带的生成区】生成（tmj 的 mobs/mobs2 对象层），
    // 客户端只在快照里按 id 镜像出视图实体（见 _applySnap）。

    this.buildBackground();

  }


  _resetPlayer(full) {
    const p = this.player;
    // 出生点 = 地图里【等级最低的那个复活区域】（不是世界原点 0,0）。
    // 地图没有复活区（简易圆形地图）时才退回原点。
    const sp = (this.map && this.map.spawnCheckpointPoint)
      ? this.map.spawnCheckpointPoint(p.r || 22) : { x: 0, y: 0 };
    p.maxHp = FLOWER_BASE_HP;
    p.xp = 0; p.level = 1; p.xpNext = 24;
    p.slots = emptySlots();
    p.subSlots = emptySlots();
    p.invBar = full ? [] : p.invBar;
    p.backpack = full ? [] : p.backpack;
    // 初始花瓣（非调试模式）：4 张 common Basic + 1 张 common Rose，全部装在主槽。
    // 调试模式仍给同样的起手（想看全量卡牌请用 /give 或背包调试开关）。
    const nBasic = Math.min(4, p.slots.length);
    for (let i = 0; i < nBasic; i++) p.slots[i] = makePetal(STARTER_BASIC_KEY, 'common');
    if (STARTER_ROSE_KEY && nBasic < p.slots.length) {
      p.slots[nBasic] = makePetal(STARTER_ROSE_KEY, 'common');
    }
    p.recompute();
    // 状态重置统一走 Player.resetForSpawn（出生无敌 / 花瓣实体 / 世代号 / 装填）
    p.resetForSpawn(sp);
  }

  // 重生：死亡界面 Continue 按钮触发。与 _resetPlayer 的关键区别：
  // 【死亡不会导致花瓣消失】—— slots/subSlots/invBar/backpack/xp/level 全保留，
  // 只重置生命状态并让所有花瓣重新装填（reload 从头结算，出场自带渐显+Q 弹）。
  respawn() {
    const p = this.player;
    // 复活位置由【服务端】按地图复活区域结算（见 net.js _respawnPos）：
    // 本地模拟服务端可以直接拿返回值，避免先跳到原点再被拽回来那一帧抖动。
    let pos = null;
    const canSync = this.net && typeof this.net.requestSync === 'function';
    if (canSync) pos = this.net.requestSync('respawn');
    // 统一重置：客户端与服务端走同一个 Player.resetForSpawn，
    // 不再各维护一份字段清单（客户端此前漏清 petals/_petalGen，导致重生后花瓣世代号失配）。
    p.resetForSpawn(pos);
    if (!canSync && this.net) {
      // 远端实现没有本地世界：先本地重置（位置稍后对齐），回执到了再搬到服务端指定的复活点
      this.net.request('respawn').then((r) => {
        p.resetForSpawn(r);
        this.camera.x = p.x; this.camera.y = p.y;
      }).catch(() => {});
    }
    this._netPos = null;                           // 旧权威坐标作废，避免复活当帧被拉回死亡点
    this._deathShown = false;
    this._aggroCleared = false;      // 复位一次性标志：下次死亡要再清一次仇恨
    this.camera.x = p.x; this.camera.y = p.y;
    // 非本地服务端（真实网络）：走消息让服务端结算并广播。
    // 本地模拟服务端上面已经直接结算过，再发一次会多消耗一次保底次数。
    if (!pos && this.net) this.net.send({ t: 'respawn' });
    // 仇恨豁免（兜底）：复活后再清一次，确保没有生物带着旧仇恨追杀过来
    this._clearAggro();

  }

  // 清空全场生物的仇恨表（threat）。用 length = 0 原地复用数组，避免每帧 GC。
  _clearAggro() {
    for (const m of this.mobs) if (m.threat && m.threat.length) m.threat.length = 0;
  }

  // 预测位置 -> 权威位置的软校正。
  // 客户端预测"自主移动 + 击退"（零延迟手感），接触推挤由服务端权威结算，
  // 两者每帧相差几像素；按速率收敛把这个偏差吃掉，只有极端偏差才直接吸附。
  _reconcile(dt) {
    const p = this.player, t = this._netPos;
    if (!t || p.dead) return;
    const dx = t.x - p.x, dy = t.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > RECONCILE_SNAP * RECONCILE_SNAP) { p.x = t.x; p.y = t.y; return; }
    if (d2 < 0.0025) return;                       // <0.05px：视为重合，省掉无意义的写入
    const k = 1 - Math.exp(-RECONCILE_RATE * dt);
    p.x += dx * k; p.y += dy * k;
  }

  // ---------------- 快照 / 事件：客户端与"服务端"的唯一下行入口 ----------------
  // 快照里是纯数据；这里负责：
  //   ① 生物按 netId 差分镜像（新增 -> 建视图 Mob；消失 -> 标记退场后回收）
  //   ② 回填战斗结果（hp / dead / 死因 / 无敌），本地玩家位置仍用预测值
  //   ③ 维护插值缓冲（prev/next + blend），低频服务器时自动抹平
  _applySnap(snap) {
    const p = this.player;
    if (!snap) return;
    // 记录本快照覆盖的模拟时长：插值步长按它算，而不是硬编码 1/25
    if (snap.dt > 0) this._snapDt = snap.dt;

    // ---- 本地玩家对账：只取服务端权威的"结果类"字段，位置仍信自己的预测 ----
    if (snap.player) {
      const sp = snap.player;
      const wasDead = p.dead;
      p.hp = sp.hp; p.maxHp = sp.maxHp; p.dead = sp.dead; p.killedBy = sp.killedBy;
      // 客户端不跑 hurt()/die()，死亡这一刻要在这里补一次：花瓣转退场幽灵 + 尸体旋转。
      // 少了它花瓣会"啪一下消失"，且 _petalGen 只有在 die() 里才会与实体一起清空。
      if (p.dead && !wasDead) p.die();
      // 无敌状态以服务端为准（花瓣/技能给的无敌必须能立刻反映到光晕与白血条上）
      if (sp.invuln > p.invuln) InvulnFX.add(p, 'server', sp.invuln);
      else if (sp.invuln <= 0 && p.invulnSrc && p.invulnSrc.server != null) {
        InvulnFX.remove(p, 'server');
      }
      // 受伤红闪/白闪：服务端权威置位，客户端只负责按时间渐隐（见 Player.update）。
      // 取"更亮"的那个，避免本地已衰减到一半时被快照覆盖成更暗的值。
      if (sp.hurtT > (p.hurtT || 0)) p.hurtT = sp.hurtT;
      if (sp.flash > (p.flash || 0)) p.flash = sp.flash;
      // 死亡旋转角：服务端 die() 里随机生成，必须回填，否则客户端尸体不旋转
      if (sp.dead) { p.deathRot = sp.deathRot; p.deathTimer = Math.max(p.deathTimer || 0, sp.deathTimer || 0); }
      // 只记录权威位置，由 _reconcile 每帧按速率收敛（不再在这里硬拉，避免攒到阈值瞬移）
      this._netPos = { x: sp.x, y: sp.y };
    }

    // ---- 花瓣战斗状态：转成 slot -> 状态 的表，交给 _syncPetals 回填 ----
    // （客户端不跑战斗，必须靠这个才能看到花瓣掉血/红闪/碎掉重装）
    // 这里立即应用一次，不用等下一帧的 _syncPetals —— 否则掉血/碎裂会慢一帧才看到。
    if (snap.petals) {
      // 一张卡可能对应多个独立实体：用 "槽位|子序号|世代号" 做键。
      // 世代号是滞留型花瓣（Pollen / Honey）的：同一槽脱轨后还会再来一批新实体，
      // 少了它两批实体会互相串血/串碎裂状态。
      const map = {};
      for (const q of snap.petals) map[q.slot + '|' + (q.sub || 0) + '|' + (q.gen || 0)] = q;
      p.netPetals = map;
      p._applyNetPetalStates();
    }

    // ---- 生物差分镜像 ----
    const seen = new Set();
    for (const e of snap.ents) {
      seen.add(e.id);
      let v = this.mobViews.get(e.id);
      if (!v) {
        // 新增：用快照里的 type/rarity/level 建一个"视图 Mob"（只负责外观与碰撞外形）
        const type = MOB_BY_ID[e.typeId];
        if (!type) continue;
        v = new Mob(type, e.x, e.y, e.level, e.rarity);
        v.netId = e.id;
        v.px = e.x; v.py = e.y; v.tx = e.x; v.ty = e.y; v.blend = 1;
        v.gone = false;
        this.mobViews.set(e.id, v);
        this.mobs.push(v);
      }
      // 最新权威状态 -> 插值目标
      v.px = v.x; v.py = v.y;          // 从"当前显示位置"起步，避免跳变
      v.tx = e.x; v.ty = e.y;
      v.blend = 0;
      v.hp = e.hp; v.maxHp = e.maxHp; v.dead = e.dead;
      v.vx = e.vx || 0; v.vy = e.vy || 0;   // 只用于推挤的动能项（视图实体不积分位置）
      if (e.artSvg) v.artSvg = e.artSvg;   // 多节生物：头节/身体节贴图区分
      if (e.segIdx != null) v.segIdx = e.segIdx;   // 节序号：多节链不做逐节插值
      if (e.plateStyle) v.plateStyle = e.plateStyle;   // 名牌显示模式（头节经典 / 其余主角血条式）
      // 表现层状态全部由服务端权威置位，取较大值回填（本地同时在按时间衰减）
      if (e.hurtT > (v.hurtT || 0)) v.hurtT = e.hurtT;
      if (e.flash > (v.flash || 0)) v.flash = e.flash;
      if (e.squash > (v.squash || 0)) v.squash = e.squash;
      // 死亡：旋转角 + 计时（服务端生成随机角，客户端只演绎）
      if (e.dead) {
        if (e.deathRot != null) v.deathRot = e.deathRot;
        v.deathTimer = Math.max(v.deathTimer || 0, e.deathTimer || 0);
      }
      // 朝向平滑跟随（服务端每帧给值，这里做一次短插值，转向更顺）
      if (e.facing != null) v.facing = lerpAngle(v.facing, e.facing, 0.35);
    }
    // 消失：服务端已回收的个体 -> 播放完退场渐隐再移除
    for (const v of this.mobs) {
      if (!v.gone && !seen.has(v.netId)) v.gone = true;
    }
  }

  // 服务端事件 -> 客户端表现（飘字 / 图鉴 / 反弹 / 抖动 / 聊天）
  _applyEvt(ev) {
    if (!ev) return;
    if (ev.kind === 'dmg') {
      this.spawnText(ev.x + rand(-ev.r * 0.2, ev.r * 0.2), ev.y, ev.text, ev.color);
    } else if (ev.kind === 'kill') {
      this.recordDefeat(ev.mobId, ev.rarity);
      // 掉落：在生物死亡位置按【该生物稀有度】的掉落表逐种掷骰（可能与不掉落）
      this.spawnMobDrops(ev.mobId, ev.rarity, ev.x, ev.y, !!(this.player && this.player.magician));
  
    } else if (ev.kind === 'hurt') {
      // 玩家份额的反弹：以【速度冲量】施加到预测实体上（随后指数衰减 -> 平滑滑出去），
      // 不再是直接改坐标（那样会看到人物瞬移一下）。无敌免伤时服务端不会发这个事件。
      const p = this.player;
      if (!p.dead) applyKnockback(p, ev.ux, ev.uy, ev.total);
      this.shake = Math.max(this.shake, HURT_SHAKE);   // 很轻微地抖一下
    } else if (ev.kind === 'chat' || ev.kind === 'sys') {
      if (typeof Chat !== 'undefined') Chat.push(ev);
    } else if (ev.kind === 'respawned') {
      // 服务端复活（含 /resphere 原地复活）：客户端走同一个 resetForSpawn，
      // 保证花瓣实体、世代号、装填状态与服务端一致。
      const p = this.player;
      if (!p) return;
      p.resetForSpawn(ev);
      this._netPos = null;
      this.camera.x = p.x; this.camera.y = p.y;
    } else if (ev.kind === 'teleported') {
      // 传送：位置直接搬过去，相机直接到位（避免长距离滑行）
      const p = this.player;
      if (!p) return;
      p.x = ev.x; p.y = ev.y; p.vx = 0; p.vy = 0;
      this._netPos = null;
      this.camera.x = ev.x; this.camera.y = ev.y;
      this.tpTarget = null;
    }
  }

  // 视图生物每帧推进：插值坐标 + 自身动画计时（AI/移动/战斗都在服务端）
  _tickMobViews(dt) {
    // 用【实际】快照间隔而不是常量 1/25：本地实现每帧都发快照，
    // 固定 1/25 会让插值每帧只走 41.7%，60Hz 下永远落后 4.7 帧、144Hz 落后 10 帧。
    const k = dt / (this._snapDt || SNAP_DT);
    for (const m of this.mobs) {
      if (m.blend < 1) m.blend = Math.min(1, m.blend + k);
      const b = m.blend;
      // 统一插值：服务端已把整条链【刚体解算】好，各节位移量一致，
      // 25Hz -> 60fps 插值后整条平滑移动（不做逐帧硬贴，避免 25Hz 台阶抖动）。
      m.x = m.px + (m.tx - m.px) * b;
      m.y = m.py + (m.ty - m.py) * b;
      // 主角血条模式（多节生物的非头节）：血条满血渐隐 / 掉血渐显 —— 视图不走 Mob.update，
      // 所以这个淡入淡出必须在这里推进，否则 hpBarA 永远是 0，血条根本不出现。
      if (m.plateStyle === 'player') m._tickHpBarA(dt);
      // 动画计时：出生渐显 / 受伤红闪 / 死亡放大渐隐
      m.age += dt;
      m.hurtT = Math.max(0, m.hurtT - dt);
      // 白闪本地衰减：之前漏了这行 -> 服务端 flash 正常衰减，但客户端视图 forever 不衰减，
      // 而 _applySnap 是"取较大值回填"，服务端值一旦低于它就不再更新 -> 生物永久变白。
      m.flash = Math.max(0, m.flash - dt);
      m.squash = damp(m.squash, 0, 10, dt);
      m._tickHpSmooth(dt);          // 血条双层平滑（主条 + 缓冲条），与花朵血条同款
      if (m.dead) m.deathTimer += dt;
      // 碰撞外形贴图就绪后提取一次（与绘制同源）
      // 必须走 Mob._ensureShape：它会按【本节实际贴图】(artSvg) 取轮廓。
      // 早期这里手写了一份 'mob' + m.svg，多节生物（蜈蚣）就变成了整条 12.svg 的轮廓，
      // 套在单节上又长又大（还会把触角算进碰撞）—— 与服务端的判定完全不是一回事。
      if (!m.shape && !m.gone) m._ensureShape();
    }
    // 退场播完的个体才真正移除（保持与其它实体一致的渐隐观感）
    this.mobs = this.mobs.filter((m) => !(m.gone && m.deathTimer > FADE_T));
  }

  buildBackground() {
    // 花园瓦片改为在 render() 中实时绘制（见 drawGardenTiles），无需预渲染整张大图。
    const data = this.gardenData;
    if (data && data.layers && data.layers.length) {
      this.bgHalf = (data.width * GARDEN_TILE) / 2;
    } else {
      this.bgHalf = WORLD_R;
    }
    this.bg = null;
  }

  _resize() {
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
  }

  toggleBag() {
    UI.setDexVisible(false);            // 同一时刻只允许一个窗口
    UI.setSettingsVisible(false);
    UI.setBagVisible(!UI.isBagVisible());
    if (UI.isBagVisible()) this.renderInventory();
  }

  // ---------- 主循环 ----------
  start() {
    // 固定步长累加器：真实经过多少时间就模拟多少（低帧率不再"减速"）。
    // 单帧最多补 MAX_STEPS 步并丢弃剩余，避免卡顿后"螺旋补偿"越积越多。
    const STEP = 1 / 60, MAX_STEPS = 8;
    this._running = true;
    const loop = (ts) => {
      if (!this._running) return;               // stop() 之后不再自调度（自测/回放会接管推进）
      const now = ts / 1000;
      let dt = now - (this.last || now);
      this.last = now;
      if (dt > 0.25) dt = 0.25;                 // 极端掉帧/切后台封顶，防止一次性补几千步
      this.acc = (this.acc || 0) + dt;
      let n = 0;
      while (this.acc >= STEP && n < MAX_STEPS) { this.update(STEP); this.acc -= STEP; n++; }
      // 只保留不超过一步的余量：既避免卡顿后"螺旋补偿"，也不再把这帧剩下的时间整段丢掉
      if (n >= MAX_STEPS) this.acc = Math.min(this.acc, STEP);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // 停止 rAF 主循环。世界状态不变，可随时用 stepFrames 继续推进（自测/回放用）。
  stop() { this._running = false; }

  // 以固定步长推进 n 帧，不自调度。render=true 时最后渲染一次。
  stepFrames(n, dt = 1 / 60, render = false) {
    for (let i = 0; i < n; i++) this.update(dt);
    if (render) this.render();
  }

  update(dt) {
    const p = this.player;
    const dir = this._readDir();
    // 模式控制：空格 = mode1 -> reach（花瓣距离×2 + 生气眼），Shift = mode2 -> detect（距离×0.3 + 伤心眼）
    p.mode = (this.keys['mode1'] || this.keys['mouse1']) ? 'reach'
           : (this.keys['sLeft'] || this.keys['sRight'] || this.keys['mouse2']) ? 'detect' : 'normal';

    // 鼠标移动模式：平滑地把朝向转向指针。停住/开窗口时 Player.update 不再更新朝向，
    // 这里补上——做到"眼睛跟随鼠标但不走动"（玩家 facing 不在快照里，纯客户端表现）。
    if (this.moveMode === 'mouse' && this.mouse) {
      const mx = this.mouse.x + this.camera.x - this.W / 2;
      const my = this.mouse.y + this.camera.y - this.H / 2;
      p.facing = lerpAngle(p.facing, Math.atan2(my - p.y, mx - p.x), clamp(dt * 12, 0, 1));
    }

    // —— 本地玩家：客户端预测（沿用原有 damp + moveEntity，手感与视觉零变化）——
    p.update(dt, dir, this.map, this.mobs);   // 传入生物视图：花瓣会与生物碰撞

    // —— 上行：把输入意图与最新装备交给服务端；随后推进服务端并收取快照/事件 ——
    this.net.send({ t: 'loadout', slots: p.slots, hold: p.reloadHold });
    this.net.sendInput({ dx: dir.x, dy: dir.y, mode: p.mode });
    this.net.step(dt);

    // —— 视图层生物：插值坐标推进 + 自身动画计时（AI/移动已归服务端）——
    this._tickMobViews(dt);

    // 玩家 vs 昆虫：同一套 physicsPush（反质量 + 动能）。生物速度来自快照（vx/vy），
    // 因此"生物冲过来"的动能与服务端同源；视图实体不积分位置，冲量写入后下一帧即被覆盖，
    // 不会像旧实现那样在视图对象上留下永不衰减的幽灵速度。
    if (!p.dead) {
      for (const m of this.mobs) {
        if (m.dead) continue;
        physicsPush(p, m);
      }
    }
    // 残余偏差（快照滞后 / 插值位置不同）按速率收敛，避免攒到阈值再瞬移
    this._reconcile(dt);

    // 死亡检测：弹出死亡界面（只弹一次，重生时复位）
    if (p.dead && !this._deathShown) {
      this._deathShown = true;
      UI.showDeathScreen(p.killedBy);
    }
    // 复活复位：角色复活后清掉死亡界面与残留标志（/resphere 走另一条复活路径，
    // 不会触发按钮复活的复位分支，这里做镜像处理保证一致）
    if (!p.dead && this._deathShown) {
      this._deathShown = false;
      this._aggroCleared = false;
      UI.hideDeathScreen();
    }

    // 仇恨豁免：死亡当帧立即把玩家从所有生物的仇恨表里移除。
    // 用独立的一次性标志 _aggroCleared 而不是复用 _deathShown：后者属于死亡界面，
    // 可能因"这一局已经弹过一次"等原因早已是 true，那样仇恨就漏清了。
    if (p.dead && !this._aggroCleared) {
      this._aggroCleared = true;
      this._clearAggro();
    }

    // 卡片（拾取 / 入栏）——无战斗时已不掉落，但保留拖拽到世界时的回收
    for (const c of this.cards) {
      c.update(dt, p);
      if (!c.picked && dist2(c.x, c.y, p.x, p.y) < (p.r + 16) * (p.r + 16)) {
        if (this.pickupCard(c.type, c.rarity)) {
          c.picked = true;
          this.syncInventory();
        }
      }
    }
    this.cards = this.cards.filter(c => !c.done);

    // 掉落物：拾取范围 = 2 × 玩家直径；进入范围后缩小并飞向玩家中心，飞完才真正入包。
    // Ultra 及以上在停留期间持续冒正方形粒子（Mythic 及以下只在落地时炸一次）。
    const pickR = (p.r * 2) * DROP_PICK_R;
    for (const d of this.drops) {
      d.update(dt, p);
      if (!d.fly && d.popT >= 1 && !p.dead && dist2(d.x, d.y, p.x, p.y) < pickR * pickR) d.pick();
      if (d.done) {
        // 只有"被捡走"的才进背包；到期渐隐消失的不给（d.picked 由 DropCard.pick 置位）
        if (d.picked) {
          const type = (typeof getPetal === 'function') ? getPetal(d.svg) : null;
          if (type) for (let i = 0; i < d.count; i++) this.pickupCard(type, d.rarity);
          this.syncInventory();
        }
        continue;
      }
      if (!d.fly && DROP_FX_CONT.has(d.rarity)) {
        d.sparkT -= dt;
        if (d.sparkT <= 0) { d.sparkT = 0.07; this.dropSpark(d.x, d.y, d.rarity, 'rise', d.size * 0.5); }
      }
    }
    this.drops = this.drops.filter((d) => !d.done);

    // 掉落物粒子 / 普通粒子 / 伤害数字
    for (const s of this.dropFx) s.update(dt);
    this.dropFx = this.dropFx.filter((s) => s.life > 0);
    for (const pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter(pt => pt.life > 0);
    for (const d of this.dmgTexts) d.update(dt);
    this.dmgTexts = this.dmgTexts.filter(d => d.life > 0);

    // 相机：默认锁定玩家（主角固定在屏幕中心）。
    // 但走到地图边缘时【不再让视角越界】，而是把相机夹住 —— 环境停住、人物继续走动，
    // 这样屏幕上永远不会出现地图之外的部分（与一档小地图贴边时的行为一致）。
    // 视图比整张地图还大时（窗口很大 / 地图很小）夹紧区间退化为一个点，相机停在地图中心。
    const half = this.map.R || (this.map.width * (this.map.tile || 1)) / 2;
    const hw = Math.min(this.W / 2, half), hh = Math.min(this.H / 2, half);
    this.camera.x = clamp(p.x, -half + hw, half - hw);
    this.camera.y = clamp(p.y, -half + hh, half - hh);
    this.shake = Math.max(0, this.shake - dt * 30);


  }

  // ---------------- 战斗结算（25 tick/s 固定步长） ----------------
  // 阵营：花朵本体 + 花瓣 vs 全部昆虫/生物。
  // 每 tick：两个敌对实体接触时，双方【同时】各扣 max(对方攻击 - 己方护甲, 0) 点血。
  // 接触判定一律用生物 SVG 轮廓多边形（圆 vs 多边形）；多边形未就绪时退回圆形。

  // 对生物造成一次伤害：只累计【真实造成的伤害】，被这一击秒杀时立刻把累计值弹出
  // （不等 0.12s 聚合窗口）——否则秒杀只剩一口气的怪时会感觉"没有伤害反馈"。
  // 数值规则：applied = min(伤害, 剩余血量)，所以打 80000 秒 300 血的怪只弹 300。

  // 花瓣被打碎：卡片保持装备，该槽【重新结算装填冷却】——装填完成后花瓣带着
  // 满血重新生成（渐显）。本体不在这里移除：只打 dead 标记，下一帧 _syncPetals
  // 的差分会把它转成退场幽灵（原地放大渐隐），保证消失渐隐与全体实体统一。

  // 昆虫死亡落地：记入图鉴（退场放大渐隐动画由 Mob.draw 负责）
  _onMobKilled(m) {
    this.recordDefeat(m.type.id != null ? m.type.id : m.name, m.rarity);

  }

  _readDir() {
    if (this.moveMode === 'mouse') return this._readMouseDir();
    // 方向 = 当前按住的所有方向键的组合（WASD 与方向键等价、可混按）。
    // 逐个物理键独立判断：多个键同时按住就是对角移动，绝不互相覆盖。
    const s = this._down || (this._down = new Set());
    let dx = 0, dy = 0;
    if (s.has('ArrowUp') || s.has('KeyW')) dy -= 1;
    if (s.has('ArrowDown') || s.has('KeyS')) dy += 1;
    if (s.has('ArrowLeft') || s.has('KeyA')) dx -= 1;
    if (s.has('ArrowRight') || s.has('KeyD')) dx += 1;
    return { x: dx, y: dy };
  }

  // 鼠标移动模式（默认；设置窗口里勾选"键盘移动"可切换）：花朵朝指针方向移动，实现精确角度；
  // 指针与人物的距离 -> 目标速度占比(0..1)，距离达 3×主角直径(=6r)即达到键盘最大速度，再远封顶。
  // 返回 dir 的模长 = 速度占比，由 Player.update 的 min(len,1) 缩放目标速度，
  // 并复用键盘同款 rate 9/4 平滑加减速；指针距人物极近时归零（平滑停下）。
  // 有窗口打开（背包/图鉴）时【不传递移动欲望】(返回 0)，让人物按自然减速率渐停（不卡顿）；
  // 朝向由 update() 单独平滑跟踪鼠标（眼睛跟随但不走动）。
  _readMouseDir() {
    const p = this.player;
    if (!this.mouse || !p) return { x: 0, y: 0 };
    // 屏幕 -> 世界（渲染 translate(W/2-camX, H/2-camY) 的逆变换）
    const mx = this.mouse.x + this.camera.x - this.W / 2;
    const my = this.mouse.y + this.camera.y - this.H / 2;
    const dx = mx - p.x, dy = my - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-3) return { x: 0, y: 0 };
    // 只要【任意窗口】开着就停止鼠标驱动的移动（统一走 UI.isAnyWindowOpen，
    // 以后新增窗口不必再逐个补判断 —— 之前漏了设置窗口就是这个问题）。
    if (typeof UI !== 'undefined' && UI.isAnyWindowOpen && UI.isAnyWindowOpen()) {
      return { x: 0, y: 0 };
    }
    const frac = Math.min(dist / (3 * (2 * p.r)), 1);   // 3 倍主角直径封顶
    return { x: dx / dist * frac, y: dy / dist * frac };
  }



  spawnText(x, y, text, color) { this.dmgTexts.push(new DamageText(x, y, text, color)); }
  spawnParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) this.particles.push(new Particle(x, y, color));
  }

  // ---------- 地面掉落物 ----------
  // 生物死亡：按 (生物 id, 稀有度) 的掉落表逐种掷骰 -> 在死亡位置生成掉落卡。
  //   · 1 件：正中央；2 件：水平并排；3~6 件：环形（比 Light 排布更松散）
  //   · 与附近已有的【完全相同卡牌】堆叠到同一张卡上（数量角标 +1）
  //   · 每张新卡落地时炸一次正方形粒子；Ultra+ 之后持续冒（见 update）
  spawnMobDrops(mobId, rarity, x, y, magician) {
    if (typeof rollMobDrops !== 'function') return;
    if (x == null || y == null) return;
    const got = rollMobDrops(mobId, rarity) || [];
    if (!got.length) return;
    const fresh = [];
    for (const it of got) {
      let merged = false;
      for (const d of this.drops) {
        if (d.fly || d.done) continue;
        if (d.slug === it.slug && d.rarity === it.rarity && dist(d.x, d.y, x, y) < 120) {
          d.count++;
          merged = true;
          break;
        }
      }
      if (!merged) fresh.push(it);
    }
    const n = fresh.length;
    const gap = DROP_SIZE * 2.0;              // 卡与卡之间的间距（多张时进一步拉开，避免视觉粘连）
    for (let i = 0; i < n; i++) {
      const off = dropLayoutOffset(i, n, gap);
      // 出生在死亡点，由 DropCard 自己"弹"到目标位置（见 DROP_POP_T）
      const d = new DropCard(fresh[i].slug, fresh[i].svg, fresh[i].rarity, fresh[i].name,
        x, y, off);
      this.drops.push(d);
      this.dropSpark(x, y, d.rarity, 'burst', d.size * 0.5);   // 落地烟花在死亡点炸开
    }
  }

  // 生成掉落物粒子：burst = 一次炸开若干颗；rise = 单颗上冒（持续档每次调用一颗）
  // half = 卡片半边长：粒子从卡面【四周边缘】冒出（不是从中心点冒出）
  dropSpark(x, y, rarity, mode, half) {
    const col = (typeof RARITIES !== 'undefined' && RARITIES[rarity]) ? RARITIES[rarity].color : '#fff';
    const n = mode === 'burst' ? 14 : 1;
    for (let i = 0; i < n; i++) this.dropFx.push(new DropSpark(x, y, col, mode, half));
  }

  // /tp 目标标记：实心红点 + 一圈脉冲 + 四向短线（长距离也一眼能定位）
  _drawTpMarker(ctx) {
    const t = this.tpTarget;
    if (!t) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    const pulse = (now * 1.4) % 1;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.globalAlpha = 0.55 * (1 - pulse);
    ctx.strokeStyle = '#ff2b2b';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 10 + pulse * 26, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff2b2b';
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,43,43,.85)';
    ctx.beginPath();
    ctx.moveTo(-16, 0); ctx.lineTo(-9, 0);
    ctx.moveTo(9, 0); ctx.lineTo(16, 0);
    ctx.moveTo(0, -16); ctx.lineTo(0, -9);
    ctx.moveTo(0, 9); ctx.lineTo(0, 16);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- 渲染 ----------
  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);

    const camX = this.camera.x, camY = this.camera.y;
    let shx = 0, shy = 0;
    if (this.shake > 0) { shx = rand(-this.shake, this.shake); shy = rand(-this.shake, this.shake); }

    // 背景：先铺一层草地绿（屏幕空间），瓦片就绪后会在世界空间叠加其上。
    ctx.fillStyle = '#1ea761';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.save();
    ctx.translate(this.W / 2 - camX + shx, this.H / 2 - camY + shy);

    // 真实花园瓦片（实时、仅可见区域）
    if (this.gardenData && this.gardenData.layers.length) {
      try { drawGardenTiles(ctx, this.gardenData, camX, camY, this.W, this.H); }
      catch (e) { console.error('[drawGardenTiles]', e); }
    }

    // 地面层：世界卡片 -> 掉落物粒子 -> 生物掉落物
    // （粒子在掉落卡【之下】，掉落卡整体又在实体与玩家尸体之下）
    for (const c of this.cards) c.draw(ctx);
    for (const s of this.dropFx) s.draw(ctx);
    for (const d of this.drops) { try { d.draw(ctx); } catch (e) { console.error('[draw drop]', e); } }

    // /tp 的目标标记（地面红点 + 脉冲圈，在实体之下，不影响读图）
    if (this.tpTarget) this._drawTpMarker(ctx);
    // 层级定数：尸体固定在最底层，生物彼此按 y 排序，活玩家固定在最上层（不再忽上忽下）
    const me = this.player;
    if (me && me.dead) { try { me.draw(ctx); } catch (e) { console.error('[draw corpse]', e); } }
    // 视口裁剪：先筛出可见集合，再只对可见集合按 y 排序。
    // 旧实现每次 render 都对全图（4600+ 只）切片排序（约百万次比较/秒），
    // 而真正在屏内的只有个位数到十几只 —— 排序成本全花在屏幕外。
    // 余量取半屏：足够覆盖一帧最大位移（约 4px）与最大生物半径（约 105px），
    // 又不至于像旧的 2 屏余量那样把 95% 的绘制留在屏幕外白做。
    // 判定用「圆心 ± 半径」而不是只测圆心：大生物贴边时必须照常绘制。
    const padX = this.W * 0.5, padY = this.H * 0.5;
    const mx0 = camX - this.W / 2 - padX, mx1 = camX + this.W / 2 + padX;
    const my0 = camY - this.H / 2 - padY, my1 = camY + this.H / 2 + padY;
    const visible = this._visibleMobs || (this._visibleMobs = []);
    visible.length = 0;
    for (const m of this.mobs) {
      const mr = (m.r || 0) + 4;
      if (m.x + mr < mx0 || m.x - mr > mx1 || m.y + mr < my0 || m.y - mr > my1) continue;
      visible.push(m);
    }
    visible.sort((a, b) => a.y - b.y);
    for (const m of visible) {
      try { m.draw(ctx); } catch (e) { console.error('[draw entity]', e); }
    }
    if (me && !me.dead) { try { me.draw(ctx); } catch (e) { console.error('[draw entity]', e); } }

    for (const pt of this.particles) pt.draw(ctx);
    for (const d of this.dmgTexts) d.draw(ctx);

    // /pending crash 1：碰撞箱叠加层（世界坐标系，画在实体之上，不影响任何判定）
    this._drawHitboxes(ctx, this._visibleMobs);

    ctx.restore();

    // /show-coord 的坐标读数（屏幕空间，不受相机抖动影响）
    this._drawCoord(ctx);
    // /tp 目标在屏幕外时，在屏幕边缘画一个红点指向它（保证"一定看得见"）
    this._drawTpEdge(ctx, camX, camY);
    this._drawMinimap();
  }

  // /pending crash <0|1>：碰撞箱叠加层。
  // 与判定完全同源：生物画的是 m.shape（SVG 轮廓多边形，随 facing + artRot 旋转），
  // 没有轮廓时才退化成外接圆（画成橙红色以示"当前不是精确形状"）。
  // 花朵本体 / 花瓣是圆形碰撞体，按实际半径画。纯调试绘制，不参与任何逻辑。
  _drawHitboxes(ctx, mobs) {
    if (!this.showHitbox) return;
    const p = this.player;
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';

    // ① 生物轮廓
    ctx.strokeStyle = '#39ff14';
    ctx.beginPath();
    let fallback = false;
    const camX = this.camera.x, camY = this.camera.y;
    const _px = this.W * 2, _py = this.H * 2;
    const _x0 = camX - this.W / 2 - _px, _x1 = camX + this.W / 2 + _px;
    const _y0 = camY - this.H / 2 - _py, _y1 = camY + this.H / 2 + _py;
    for (const m of mobs || []) {
      if (m.dead && m.deathTimer > 0.2) continue;
      const mr = (m.r || 0) + 4;
      if (m.x + mr < _x0 || m.x - mr > _x1 || m.y + mr < _y0 || m.y - mr > _y1) continue;  // 视口剔除：与实体渲染同源
      const sh = m.shape;
      if (!sh || !sh.pts || sh.pts.length < 3) {
        ctx.moveTo(m.x + (m.r || 0), m.y);
        ctx.arc(m.x, m.y, m.r || 0, 0, TAU);
        fallback = true;
        continue;
      }
      const rot = m.facing + (m.artRot || 0);
      const c = Math.cos(rot), s = Math.sin(rot);
      const D = m.drawSize;
      for (let i = 0; i < sh.pts.length; i++) {
        const q = sh.pts[i];
        const lx = q[0] * D, ly = q[1] * D;
        const wx = m.x + lx * c - ly * s;
        const wy = m.y + lx * s + ly * c;
        if (i === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.closePath();
    }
    ctx.stroke();
    if (fallback) ctx.strokeStyle = '#ff7a1a';   // 需要提示"这是圆的兜底"时再补一层

    // ② 花朵本体 + 花瓣
    if (p && !p.dead) {
      ctx.strokeStyle = '#33e0ff';
      ctx.beginPath();
      ctx.moveTo(p.x + p.r, p.y);
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.stroke();

      ctx.strokeStyle = '#ffe14d';
      ctx.beginPath();
      for (const b of p.petals || []) {
        if (b.dead) continue;
        const r = PETAL_R;
        ctx.moveTo(b.x + r, b.y);
        ctx.arc(b.x, b.y, r, 0, TAU);
      }
      ctx.stroke();

      // 吸附连线：当前贴住哪只生物（便于确认吸附/松手是否符合预期）
      ctx.strokeStyle = 'rgba(255,225,77,.45)';
      ctx.beginPath();
      for (const b of p.petals || []) {
        const m = b.pullMob;
        if (!m || b.dead) continue;
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(m.x, m.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // 左上角坐标读数：/show-coord 打开后每帧刷新（与按钮组同字体风格：白字黑描边）
  _drawCoord(ctx) {
    const p = this.player;
    if (!this.showCoord || !p) return;
    const txt = 'X ' + Math.round(p.x) + '   Y ' + Math.round(p.y);
    ctx.save();
    ctx.font = '800 14px ' + ((typeof CardRenderer !== 'undefined' && CardRenderer.FONT) ? CardRenderer.FONT : 'Ubuntu, sans-serif');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000';
    ctx.strokeText(txt, 18, 66);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(txt, 18, 66);
    ctx.restore();
  }

  // 屏幕边缘的传送指示点（只在目标离开视野时绘制）
  _drawTpEdge(ctx, camX, camY) {
    const t = this.tpTarget;
    if (!t) return;
    const dx = t.x - camX, dy = t.y - camY;
    const hw = this.W / 2 - 20, hh = this.H / 2 - 20;
    if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) return;   // 屏幕内：世界里的红点已经画了
    const k = Math.min(hw / Math.max(1, Math.abs(dx)), hh / Math.max(1, Math.abs(dy)));
    const px = this.W / 2 + dx * k, py = this.H / 2 + dy * k;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, TAU);
    ctx.fillStyle = '#ff2b2b';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000';
    ctx.stroke();
    ctx.restore();
  }

  _blitBG(left, top) {
    const ctx = this.ctx, half = this.bgHalf, full = this.bg.width;
    let sx = left + half, sy = top + half, sw = this.W, sh = this.H;
    let dx = left, dy = top;
    if (sx < 0) { dx -= sx; sw += sx; sx = 0; }
    if (sy < 0) { dy -= sy; sh += sy; sy = 0; }
    if (sx + sw > full) sw = full - sx;
    if (sy + sh > full) sh = full - sy;
    if (sw > 0 && sh > 0) ctx.drawImage(this.bg, sx, sy, sw, sh, dx, dy, sw, sh);
  }

  _drawMinimap() {
    // 把 /tp 标记一起传进去（小地图是独立绘制的，不能靠全局变量取）
    UI.drawMinimap(this.ctx, this.W, this.H, this.map, this.player, this.mobs, this.tpTarget);
  }

  // ---------- 图鉴 ----------
  // 记录"打过的生物"：dex[生物 id] = 已击败的【稀有度】集合。
  // 图鉴按"一行一种生物、9 格对应 9 个稀有度"展示，所以这里必须按稀有度记，
  // 而不是按等级（等级只影响强度，不决定格子位置）。
  recordDefeat(mobId, rarity) {
    if (!rarity) return;
    if (!this.dex[mobId]) this.dex[mobId] = new Set();
    this.dex[mobId].add(rarity);
    // 图鉴开着时即时刷新（关着则下次打开时自然重新构建）
    if (typeof UI !== 'undefined' && UI.isDexVisible && UI.isDexVisible()) UI.renderDex(this);
  }
  isDefeated(mobId, rarity) { return !!(this.dex[mobId] && this.dex[mobId].has(rarity)); }

  toggleDex() {
    UI.setBagVisible(false);            // 同一时刻只允许一个窗口
    UI.setSettingsVisible(false);
    UI.setDexVisible(!UI.isDexVisible());
    if (UI.isDexVisible()) UI.renderDex(this);
  }

  // 设置窗口：同样与背包/图鉴互斥
  toggleSettings() {
    UI.setBagVisible(false);
    UI.setDexVisible(false);
    UI.setSettingsVisible(!UI.isSettingsVisible());
  }

  // 拖拽开始时关闭所有小窗口（背包/图鉴/设置）
  closeAllWindows() {
    UI.setBagVisible(false);
    UI.setDexVisible(false);
    UI.setSettingsVisible(false);
  }

  // ---------- 物品栏模型 ----------
  firstEmptySlot() { return this.player.slots.findIndex(s => !s); }
  // 空槽计算包含副槽：主槽满则落到副槽（临时存储）
  firstEmptyAny() {
    const p = this.player;
    const s = p.slots.findIndex(x => !x);
    if (s >= 0) return { row: 'slot', index: s };
    const t = p.subSlots.findIndex(x => !x);
    if (t >= 0) return { row: 'subslot', index: t };
    return null;
  }

  // R 键：整排互换主槽 / 副槽（显式垂直交换动画，只动被交换的卡）
  swapSlotRows() {
    const p = this.player;
    const t = p.slots; p.slots = p.subSlots; p.subSlots = t;
    p.recompute(); this.renderInventory();
    if (typeof UI !== 'undefined' && UI.animateRowSwap) UI.animateRowSwap(null);
    return true;
  }
  // 数字键 / 点击副槽：单列互换（主槽 i <-> 副槽 i）
  swapSlotColumn(i) {
    const p = this.player;
    if (i < 0 || i >= p.slots.length) return false;
    const t = p.slots[i]; p.slots[i] = p.subSlots[i]; p.subSlots[i] = t;
    p.recompute(); this.renderInventory();
    if (typeof UI !== 'undefined' && UI.animateRowSwap) UI.animateRowSwap([i]);
    return true;
  }
  // 任意主槽/副槽位置互换（拖拽跨行）
  moveSlotCard(mainIndex, subIndex) {
    const p = this.player;
    if (mainIndex < 0 || mainIndex >= p.slots.length) return false;
    if (subIndex < 0 || subIndex >= p.subSlots.length) return false;
    const t = p.slots[mainIndex]; p.slots[mainIndex] = p.subSlots[subIndex]; p.subSlots[subIndex] = t;
    p.recompute(); this.renderInventory(); return true;
  }
  moveInvToSub(invIndex, subIndex) {
    const p = this.player;
    if (invIndex < 0 || invIndex >= p.invBar.length) return false;
    if (subIndex < 0 || subIndex >= p.subSlots.length) return false;
    const card = p.invBar[invIndex];
    const old = p.subSlots[subIndex];
    p.subSlots[subIndex] = card;
    p.invBar.splice(invIndex, 1);
    if (old) this._slotCardToBag(subIndex, old, false, 'sub');
    this.renderInventory(); return true;
  }
  moveBagToSub(bagIndex, subIndex) {
    const p = this.player;
    if (subIndex < 0 || subIndex >= p.subSlots.length) return false;
    const stack = p.backpack[bagIndex];
    if (!stack) return false;
    const card = { type: stack.type, rarity: stack.rarity };
    takeOne(p.backpack, bagIndex);
    const old = p.subSlots[subIndex];
    p.subSlots[subIndex] = card;
    if (old) this._slotCardToBag(subIndex, old, false, 'sub');
    this.renderInventory(); return true;
  }
  moveSubToSub(from, to) {
    const p = this.player;
    if (from === to) { this.renderInventory(); return true; }
    if (from < 0 || from >= p.subSlots.length || to < 0 || to >= p.subSlots.length) return false;
    const a = p.subSlots[from], b = p.subSlots[to];
    p.subSlots[from] = b; p.subSlots[to] = a;
    this.renderInventory(); return true;
  }
  moveSubToBag(subIndex) {
    const p = this.player;
    if (subIndex < 0 || subIndex >= p.subSlots.length) return false;
    const card = p.subSlots[subIndex];
    if (!card) return false;
    p.subSlots[subIndex] = null;
    this._slotCardToBag(subIndex, card, false);
    this.renderInventory(); return true;
  }

  // 管理员画廊：把一张「新的」花瓣卡放入目标（物品栏 / 卡槽 / 背包 / 花朵）
  addGalleryCard(type, rarity, target) {
    const p = this.player;
    if (!target) return false;
    const card = { type, rarity, lunge: 0 };
    if (target.type === 'slot') {
      const old = p.slots[target.index];
      p.slots[target.index] = card;
      // 旧卡不吞掉：回背包画廊（数量 +1）并从卡槽位置播放飞回背包动画
      if (old) this._slotCardToBag(target.index, old, true);
      p.recompute(); this.renderInventory(); return true;
    }
    if (target.type === 'subslot') {
      const old = p.subSlots[target.index];
      p.subSlots[target.index] = card;
      // 旧卡不吞掉：回背包画廊（数量 +1）；副槽替换不播飞回动画（避免误导性的"飞回去"）
      if (old) this._slotCardToBag(target.index, old, false, 'sub');
      this.renderInventory(); return true;   // 副槽不参与装备，无需 recompute
    }
    if (target.type === 'inv') {
      if (p.invBar.length < p.maxInvBar) { p.invBar.push(card); this.renderInventory(); return true; }
      return false;
    }
    if (target.type === 'bag') {
      if (addStack(p.backpack, card, p.maxBackpack)) { this.renderInventory(); return true; }
      return false;
    }
    if (target.type === 'flower') {
      const s = this.firstEmptySlot();
      if (s < 0) return false;
      p.slots[s] = card; p.recompute(); this.renderInventory(); return true;
    }
    return false;
  }
  // 卡槽里被替换下来的卡统一处理：回「背包画廊」(数量 +1)
  // animate=true 时额外从卡槽位置播放飞回背包动画（替换场景；点击卸下时幽灵已在飞，不重复播放）
  _slotCardToBag(slotIndex, card, animate, row) {
    if (typeof UI !== 'undefined' && UI.addGalleryCount) UI.addGalleryCount(card.type, card.rarity);
    if (animate && typeof UI !== 'undefined' && UI.flySlotCardToBag) UI.flySlotCardToBag(slotIndex, card, row);
    this.renderInventory();
  }

  // 拾取掉落：卡牌进入「背包」（=全部花瓣画廊 all petals），数量 +1；调试模式恒为 ∞
  // 背包就是 inventory 的 all-petals 部分，后续掉落直接累计到这里
  pickupCard(type, rarity) {
    if (typeof UI !== 'undefined' && UI.addGalleryCount) UI.addGalleryCount(type, rarity);
    return true;
  }

  moveInvToSlot(invIndex, slotIndex) {
    const p = this.player;
    if (invIndex < 0 || invIndex >= p.invBar.length) return false;
    const card = p.invBar[invIndex];
    const old = p.slots[slotIndex];
    p.slots[slotIndex] = card;
    p.invBar.splice(invIndex, 1);
    // 旧卡飞回背包（数量 +1），不被吞掉
    if (old) this._slotCardToBag(slotIndex, old, true);
    p.recompute(); this.renderInventory(); return true;
  }
  moveBagToSlot(bagIndex, slotIndex) {
    const p = this.player;
    const stack = p.backpack[bagIndex];
    if (!stack) return false;
    const card = { type: stack.type, rarity: stack.rarity };
    takeOne(p.backpack, bagIndex);              // 消耗一张，归零移除并补位
    const old = p.slots[slotIndex];
    p.slots[slotIndex] = card;
    // 旧卡飞回背包（数量 +1），不被吞掉
    if (old) this._slotCardToBag(slotIndex, old, true);
    p.recompute(); this.renderInventory(); return true;
  }
  moveBagToInv(bagIndex) {
    const p = this.player;
    if (p.invBar.length >= p.maxInvBar) return false;   // 物品栏无空槽 -> 无反应
    const stack = p.backpack[bagIndex];
    if (!stack) return false;
    p.invBar.push({ type: stack.type, rarity: stack.rarity });
    takeOne(p.backpack, bagIndex);
    this.renderInventory(); return true;
  }
  moveInvToInv(from, to) {
    const p = this.player;
    if (from === to) return false;
    if (from < 0 || from >= p.invBar.length) return false;
    const card = p.invBar.splice(from, 1)[0];
    let idx = (to < 0) ? p.invBar.length : Math.max(0, Math.min(to, p.invBar.length));
    p.invBar.splice(idx, 0, card);
    this.renderInventory(); return true;
  }
  moveInvToBag(invIndex) {
    const p = this.player;
    if (invIndex < 0 || invIndex >= p.invBar.length) return false;
    const card = p.invBar.splice(invIndex, 1)[0];
    if (!addStack(p.backpack, card, p.maxBackpack)) { p.invBar.push(card); return false; }
    this.renderInventory(); return true;
  }
  moveSlotToInv(slotIndex) {
    const p = this.player;
    const card = p.slots[slotIndex];
    if (!card) return false;
    p.slots[slotIndex] = null;
    p.recompute();
    // 卸下回"背包画廊"（_gc）：该卡会在背包窗口重新出现，而不是丢进未渲染的物品栏被吞掉
    // 点击卸下时拖拽幽灵已在飞回背包，故 animate=false 避免重复播放动画
    this._slotCardToBag(slotIndex, card, false);
    this.renderInventory(); return true;
  }
  moveSlotToSlot(from, to) {
    const p = this.player;
    // 拖回原卡槽：数据本来就没变，但卡面在按下时被 visibility:hidden 了，
    // 必须重渲染让卡面重新出现，否则看起来"卡消失了"（要等下一次刷新才显示）。
    if (from === to) { this.renderInventory(); return true; }
    const a = p.slots[from], b = p.slots[to];
    p.slots[from] = b; p.slots[to] = a;
    p.recompute(); this.renderInventory(); return true;
  }
  equipFirstEmptyFromInv(invIndex) {
    const t = this.firstEmptyAny();
    if (!t) return false;
    return (t.row === 'slot') ? this.moveInvToSlot(invIndex, t.index)
                              : this.moveInvToSub(invIndex, t.index);
  }
  equipFirstEmptyFromBag(bagIndex) {
    const t = this.firstEmptyAny();
    if (!t) return false;
    return (t.row === 'slot') ? this.moveBagToSlot(bagIndex, t.index)
                              : this.moveBagToSub(bagIndex, t.index);
  }

  // 拖拽落点分发
  dispatchDrop(drag, target) {
    const from = drag.from;
    if (!from) return false;
    if (!target) {
      // 拖到空白处：卡槽卡 / 副槽卡都卸下回背包画廊；背包卡留在背包（回退）
      // 早先这里漏了 subslot 分支 -> 副槽卡拖到空白处毫无反应，表现为"无法从副槽拖出花瓣"
      if (from.type === 'slot') return this.moveSlotToInv(from.index);
      if (from.type === 'subslot') return this.moveSubToBag(from.index);
      return false;
    }
    if (from.type === 'gallery') return this.addGalleryCard(drag.card.type, drag.card.rarity, target);
    if (target.type === 'slot') {
      if (from.type === 'inv') return this.moveInvToSlot(from.index, target.index);
      if (from.type === 'bag') return this.moveBagToSlot(from.index, target.index);
      if (from.type === 'slot') return this.moveSlotToSlot(from.index, target.index);
      if (from.type === 'subslot') return this.moveSlotCard(target.index, from.index);
    }
    if (target.type === 'subslot') {
      if (from.type === 'inv') return this.moveInvToSub(from.index, target.index);
      if (from.type === 'bag') return this.moveBagToSub(from.index, target.index);
      if (from.type === 'slot') return this.moveSlotCard(from.index, target.index);
      if (from.type === 'subslot') return this.moveSubToSub(from.index, target.index);
    }
    if (target.type === 'inv') {
      if (from.type === 'inv') return this.moveInvToInv(from.index, target.index);
      if (from.type === 'bag') return this.moveBagToInv(from.index);
      if (from.type === 'slot') return this.moveSlotToInv(from.index);
    }
    if (target.type === 'bag') {
      if (from.type === 'inv') return this.moveInvToBag(from.index);
      if (from.type === 'slot') return this.moveSlotToInv(from.index);
      if (from.type === 'subslot') return this.moveSubToBag(from.index);   // 副槽也能拖回背包
    }
    if (target.type === 'flower') {
      if (from.type === 'inv') return this.equipFirstEmptyFromInv(from.index);
      if (from.type === 'bag') return this.equipFirstEmptyFromBag(from.index);
      if (from.type === 'slot') return this.moveSlotToInv(from.index);
    }
    return false;
  }

  // ---------- HUD / 背包 ----------
  // （注意：这里【不能】再定义第二个 updateHUD —— 类内后定义的会覆盖前面的，
  //  曾导致带 updatePetalShadows 的版本被顶掉、卡槽水缸阴影永远 0% 看不见。）

  syncInventory() {
    UI.renderInvBar(this.player);
    if (UI.isBagVisible()) this.renderInventory();
    if (UI.isDexVisible && UI.isDexVisible()) UI.renderDex(this);
  }

  renderInventory() {
    UI.renderInvBar(this.player);
    UI.renderInventory(this.player);
  }
}

function makePetal(typeKey, rarity) {
  const type = PETAL_TYPES.find(t => t.key === typeKey) || PETAL_TYPES[0];
  // 应用稀有度倍率（仅Basic有rarityMultipliers表）
  let dmg = type.dmg, hp = type.hp;
  if (type.rarityMultipliers && type.rarityMultipliers[rarity]) {
    const mult = type.rarityMultipliers[rarity];
    dmg = type.dmg * (mult.dmg || 1);
    hp = type.hp * (mult.hp || 1);
  }
  return { type, rarity, lunge: 0, dmg, hp };
}
