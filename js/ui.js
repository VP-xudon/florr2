// ui.js — 全部 HUD/面板由 JS 动态生成（无静态 HTML 元素，便于后续动效）
// 卡牌统一走 CardRenderer（稀有度背景板 + 透明花瓣拼接）。
// 本版：
//   1) 背包改为「矢量窗口」（淡蓝底 + 红叉，和游戏素材风格统一），居中弹出，非右侧蒙版；
//   2) 窗口内陈列「所有花瓣 × 全部稀有度」：每个稀有度一组，组内按名称字典序、像桌面图标一样自动换行；
//      每组前有分割线，标对应颜色的稀有度名称；组间按稀有度依次向下；
//   3) 底部常驻快捷栏：独立灰框、无大框，可放任意稀有度卡牌；
//   4) 左下角淡蓝图标按钮（背包/图鉴），点按有明暗变化，悬浮显示官方名称；
//   5) 卡牌悬浮显示基本信息（像生物 nametag）；
//   6) 清理右键残留：卡牌只响应鼠标左键。
'use strict';

// 同色偏深（与 cards.js 内部 darken 同算法；cards.js 将其包在 IIFE 内不可全局引用，这里本地补一份供 _rarGroup 使用）
function darken(color, amt) {
  const hex = (color || '#888888').replace('#', '');
  const h = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.round(v * (1 - amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// 圆角矩形路径（canvas 绘制窗口/悬浮框用；cards.js 内部有一份同算法副本）
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 卡牌数据悬浮框整体缩放（相对 info.png 基准尺寸）
const TIP_SCALE = 0.6;
// 拖拽幽灵尺寸（卡槽卡 54px × 1.3 × 0.6 × 1.2）与"飞入卡槽"时的目标缩放
const GHOST_SIZE = 54 * 1.3 * 0.6 * 1.2;   // 50.54
const GHOST_TO_SLOT = 54 / GHOST_SIZE;      // 飞进卡槽时放大回 54px
// 跟随速率(1/s)：指数逼近系数 = 1-exp(-DRAG_FOLLOW*dt)，越大越紧跟指针（55 ≈ 每帧补上 60% 差距）
const DRAG_FOLLOW = 55;
const DRAG_PICK_MS = 200;                   // 拿起时"长出"的放大时长
const SWAP_DUR = '0.5s';                    // 主/副槽行互换动画时长

// 属性标签：取官方 i18N 键（自带本地化）。官方值形如
//   "<c val=\"{#Colors/health}\">Health:</c> {0:tooltip}"
// 悬浮框里标签与数值是分开绘制的（标签彩色、数值白色），用不到那个占位符，
// 所以要把末尾的 {0:tooltip} / {0} 之类的占位去掉，只留纯文本标签。
function statLabel(key, fallback) {
  const s = String(I18N.t(key, fallback) || '');
  // 官方值形如 "Max Mob Rarity: {#Rarities/{0}/NameColored}"（占位符里还有嵌套花括号），
  // 旧的 /\{[^{}]*\}$/ 匹配不到嵌套结构，会把 "Max Mob Rarity: {#Rarities/{0}/NameColored}"
  // 原样画出来（就是"只显示半个标签名"）。
  // 标签部分一定在第一个 { 之前，直接截断最稳。
  const i = s.indexOf('{');
  return (i >= 0 ? s.slice(0, i) : s).trim();
}

// 掉落概率文本：0.598 -> "59.8%"（官方维基口径，统一一位小数）
function fmtChance(v) {
  const p = (Number(v) || 0) * 100;
  return (p >= 100 ? '100' : p.toFixed(1)) + '%';
}

// ================= 通用补间动画播放器 =================
// 所有 UI 动画（卡槽互换、幽灵飞入、飞回背包…）都走这里：
//   · 多个动画可在不同元素上【同时】播放，互不打断（同一元素上新动画会替换旧的）；
//   · 单一 rAF 循环驱动全部活跃动画，帧率无关；
//   · from/to 可以是任意含数值字段的对象，按字段逐个插值；
//   · apply(el, state) 由调用方给出；默认实现把元素按「中心点 + 视觉尺寸」精确落位
//     （左上角 = 中心 - 尺寸/2，缩放用 transform-origin:0 0 的 scale，基准尺寸 base），
//     因此起点/终点都与目标严格同心，不会出现"到位后还斜一点"的残留偏移。
const Anim = {
  _acts: [],
  _raf: 0,
  ease: {
    linear: (t) => t,
    out: (t) => 1 - Math.pow(1 - t, 3),
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
  },
  // 精确落位：把元素中心摆到 (s.x, s.y)、视觉尺寸放到 (s.w, s.h)
  place(el, s, base) {
    const b = base || el._animBase || el.offsetWidth || 50.54;
    el.style.transformOrigin = '0 0';
    el.style.left = (s.x - s.w / 2) + 'px';
    el.style.top = (s.y - s.h / 2) + 'px';
    el.style.transform = 'scale(' + (s.w / b).toFixed(4) + ')';
    if (s.a != null) el.style.opacity = String(s.a);
  },
  play(el, o) {
    if (!el || !o) return null;
    Anim.stop(el);
    const a = {
      el, from: o.from, to: o.to, dur: Math.max(0.001, o.dur || 0.3),
      ease: o.ease || Anim.ease.inOut, apply: o.apply, onDone: o.onDone,
      base: o.base, t: 0, aborted: false
    };
    el._anim = a;
    Anim._acts.push(a);
    Anim._start();
    return a;
  },
  stop(el) {
    if (!el) return;
    const i = Anim._acts.findIndex((x) => x.el === el);
    if (i >= 0) Anim._acts.splice(i, 1);
    if (el._anim) { el._anim.aborted = true; el._anim = null; }
  },
  _start() {
    if (Anim._raf) return;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (let i = Anim._acts.length - 1; i >= 0; i--) {
        const a = Anim._acts[i];
        a.t += dt;
        const k = Math.min(1, a.t / a.dur);
        const e = a.ease(k);
        const st = {};
        for (const key in a.to) {
          const f = (a.from && a.from[key] != null) ? a.from[key] : a.to[key];
          st[key] = f + (a.to[key] - f) * e;
        }
        if (a.apply) a.apply(a.el, st);
        else Anim.place(a.el, st, a.base);
        if (k >= 1) {
          Anim._acts.splice(i, 1);
          a.el._anim = null;
          if (a.onDone && !a.aborted) a.onDone(a.el);
        }
      }
      Anim._raf = Anim._acts.length ? requestAnimationFrame(step) : 0;
    };
    Anim._raf = requestAnimationFrame(step);
  }
};


const UI = {
  root: null,
  refs: {},
  onBagToggle: null,
  onDexToggle: null,
  onSlotClick: null,
  onInvBarClick: null,
  onGalleryCardClick: null,
  onDrop: null,
  _drag: null,
  _invBuilt: false,   // 画廊内容静态：只构建一次（现已改为每次重建以反映数量）
  _dexBuilt: false,
  _gc: null,          // 画廊卡数量（key = type.key|rarity）
  _rowsVer: 0,        // 卡槽行版本号：renderInvBar 重建 / 窗口尺寸变化时 +1（失效矩形缓存）
  _tip: null,         // 当前悬浮框数据（canvas 绘制）
  _tipOn: false,
  _tipAlpha: 0,
  onCloseAll: null,   // 拖拽开始时关闭所有窗口

  init() {
    const root = document.createElement('div');
    root.id = 'ui';
    root.innerHTML = `
      <div id="hud"></div>

      <!-- 左下角图标列：背包（真实矢量化按钮图） -->
      <div id="dockBtns">
        <button id="bagBtn" class="dockbtn">
          <img src="assets/ui/btn-bag.svg?v=2" alt="">
        </button>
      </div>
      <!-- 左上角按钮组：设置（最左）+ 生物图鉴（排在第二、整体右移） -->
      <div id="topBtns">
        <!-- 设置按钮：内联 SVG（而非 <img>），这样才能只让中间那个白色齿轮旋转 -->
        <button id="setBtn" class="dockbtn">
          <svg class="setbtn-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill="#8c8c8c" fill-rule="evenodd" d="M9.50 2.00 5.44 3.56 2.94 6.38 2.00 9.19 2.00 54.81 3.56 58.56 7.00 61.38 9.50 62.00 54.19 62.00 58.56 60.44 61.38 57.00 62.00 54.19 62.00 9.50 60.44 5.44 57.62 2.94 54.81 2.00ZM9.19 6.06 54.81 6.06 57.62 7.94 57.94 55.12 56.06 57.62 9.19 57.94 6.38 56.06 6.06 9.19 7.00 7.00Z"/>
            <path fill="#aaaaaa" fill-rule="evenodd" d="M9.50 6.06 7.00 7.00 6.06 9.19 6.38 56.06 9.19 57.94 56.06 57.62 57.94 55.12 57.62 7.94 54.81 6.06Z"/>
            <g class="gear">
              <path fill="#aaaaaa" fill-rule="evenodd" d="M29.50 12.94 35.75 13.56 36.69 14.81 36.69 17.94 37.94 18.88 40.44 16.69 43.56 16.69 47.62 20.75 47.62 22.94 45.12 26.38 45.75 27.31 49.19 27.31 50.75 28.88 50.75 34.81 50.12 36.06 45.75 36.69 45.12 38.25 47.62 40.75 47.62 43.25 42.31 47.94 40.75 47.62 38.56 45.12 37.00 45.44 36.69 49.19 34.81 50.75 28.25 50.44 27.31 49.19 27.31 45.75 26.38 45.12 25.44 45.12 23.25 47.62 20.75 47.62 19.50 46.69 16.38 42.94 16.69 40.44 18.88 38.56 18.56 37.00 14.81 36.69 12.94 34.19 13.25 28.56 14.81 27.31 18.56 27.31 18.88 26.69 18.88 25.44 17.62 24.81 16.38 22.62 17.62 19.19 21.38 16.38 23.56 16.69 25.44 18.88 27.31 18.56 27.31 14.50ZM31.06 27.31 27.94 29.50 27.31 33.25 29.81 36.06 32.62 36.69 35.44 35.12 36.69 31.38 34.50 27.94Z"/>
              <path fill="#fefefe" fill-rule="evenodd" d="M29.81 12.94 27.31 14.50 27.31 18.56 25.44 18.88 23.56 16.69 21.38 16.38 17.62 19.19 16.38 22.62 17.62 24.81 18.88 25.44 18.88 26.69 18.56 27.31 14.81 27.31 13.25 28.56 12.94 34.19 14.19 36.38 18.56 37.00 18.88 38.56 16.69 40.44 16.38 42.94 19.50 46.69 20.75 47.62 23.25 47.62 25.44 45.12 26.38 45.12 27.31 45.75 27.31 49.19 28.25 50.44 34.81 50.75 36.69 49.19 37.00 45.44 38.56 45.12 40.75 47.62 42.31 47.94 47.62 43.25 47.62 40.75 45.12 38.25 45.75 36.69 50.12 36.06 50.75 34.81 50.75 28.88 49.19 27.31 45.75 27.31 45.12 26.38 47.62 22.94 47.62 20.75 44.81 17.62 42.94 16.38 41.38 16.38 37.94 18.88 36.69 17.94 36.69 14.81 35.75 13.56ZM30.75 27.31 34.50 27.94 36.38 30.44 36.38 33.56 33.88 36.38 30.44 36.38 27.31 33.25 27.94 29.50Z"/>
            </g>
          </svg>
        </button>
        <button id="dexBtn" class="dockbtn">
          <img src="assets/ui/btn-bee.svg?v=2" alt="">
        </button>
      </div>

      <!-- 底部常驻快捷栏：上行 = 当前装备的卡（主槽），下行 = 副槽（临时存储，按 R 整排互换） -->
      <div id="quickbar">
        <div id="slotRow" class="quickrow"></div>
        <!-- [R] 提示用绝对定位挂在 .subwrap 上，不参与副槽行的居中计算 -->
        <div class="subwrap">
          <div id="subRow" class="quickrow"></div>
          <div class="qkey">[R]</div>
        </div>
      </div>

      <!-- 背包窗口：所有花瓣 × 全部稀有度 -->
      <div id="inventory" class="window hidden">
        <div class="win-head">
          <span class="win-title">${I18N.t('UI/Inventory/Title', 'Inventory')}</span>
          <div class="win-subtitle">${I18N.t('UI/Inventory/Instructions', 'Drag a petal to equip it')}</div>
          <button class="win-close" data-close="bag">
            <img src="assets/ui/btn-close.svg?v=2" alt="">
          </button>
        </div>
        <div class="win-body">
          <div id="invGallery" class="gallery"></div>
        </div>
      </div>

      <!-- 图鉴窗口（同一矢量风格） -->
      <div id="dex" class="window hidden">
        <div class="win-head">
          <span class="win-title">${I18N.t('UI/MobGallery/Title', 'Pokédex')}</span>
          <span id="dexCount" class="win-count"></span>
          <button class="win-close" data-close="dex">
            <img src="assets/ui/btn-close.svg?v=2" alt="">
          </button>
        </div>
        <div class="win-body"><div id="dexBody" class="dex-grid"></div></div>
      </div>

      <!-- 设置窗口（主色 = 设置按钮主色 #aaaaaa，描边 #8c8c8c） -->
      <div id="settings" class="window hidden">
        <div class="win-head">
          <span class="win-title">${I18N.t('UI/Settings/Title', 'Settings')}</span>
          <button class="win-close" data-close="settings">
            <img src="assets/ui/btn-close.svg?v=2" alt="">
          </button>
        </div>
        <!-- 分栏顺序：Game / Controls / Graphics / Credits（Credits 放最后一栏） -->
        <div class="set-tabs">
          <button class="set-tab on" data-tab="game">${I18N.t('UI/Settings/Tab/Game', 'Game')}</button>
          <button class="set-tab" data-tab="controls">${I18N.t('UI/Settings/Tab/Controls', 'Controls')}</button>
          <button class="set-tab" data-tab="graphics">${I18N.t('UI/Settings/Tab/Graphics', 'Graphics')}</button>
          <button class="set-tab" data-tab="credits">${I18N.t('UI/Settings/Tab/Credits', 'Credits')}</button>
        </div>
        <div class="win-body">
          <div class="set-panel" data-panel="game">
            <label class="set-row">
              <span>${I18N.t('UI/Settings/Language', 'Language')}</span>
              <select id="setLang">
                <option value="en_US">English</option>
                <option value="zh_CN">简体中文</option>
              </select>
            </label>
            <div class="set-note">${I18N.t('UI/Settings/Restart', 'Restart the game to apply.')}</div>
            <label class="set-row">
              <span>${I18N.t('UI/Settings/Debug', 'Debug mode')}</span>
              <!-- 通用勾选框（与聊天面板同款，见 CSS .set-check） -->
              <span class="set-check" id="setDebug"><i class="set-box"><b class="set-fill"></b></i></span>
            </label>
          </div>
          <div class="set-panel hidden" data-panel="controls">
            <label class="set-row">
              <span>${I18N.t('UI/Settings/KeyboardMove', 'Keyboard movement')}</span>
              <span class="set-check" id="setKeyboard"><i class="set-box"><b class="set-fill"></b></i></span>
            </label>
            <div class="set-note">${I18N.t('UI/Settings/MouseNote', 'Unchecked: the flower follows the mouse cursor.')}</div>
          </div>
          <div class="set-panel hidden" data-panel="graphics">
            <div class="set-note">${I18N.t('UI/Settings/GraphicsNote', 'More options coming soon.')}</div>
          </div>
          <div class="set-panel hidden" data-panel="credits">
            <div class="set-credits">
              ${I18N.t('UI/Settings/CreditsBy', 'Powered by VP_xudon')}<br>
              ${I18N.t('UI/Settings/CreditsGithub', 'Github')}
            </div>
          </div>
        </div>
      </div>

      <div id="loading">${I18N.t('UI/Title/Loading', 'Loading...')}</div>
    `;
    document.body.appendChild(root);
    this.root = root;

    const $ = (id) => root.querySelector('#' + id);
    this.refs = {
      bagBtn: $('bagBtn'), dexBtn: $('dexBtn'), setBtn: $('setBtn'),
      inv: $('inventory'), invGallery: $('invGallery'),
      dex: $('dex'), dexBody: $('dexBody'), dexCount: $('dexCount'),
      settings: $('settings'),
      setLang: $('setLang'), setDebug: $('setDebug'), setKeyboard: $('setKeyboard'),
      slotRow: $('slotRow'), subRow: $('subRow'),
      loading: $('loading')
    };
    this._initOverlay();   // 悬浮框 / 卡牌覆盖层：纯 canvas
    this._mmInit();        // 小地图三档模式 + 地图名标签
    // 全局聊天：DOM 由 chat.js 建（挂在 #ui 下）；Enter 热键在这里统一管理
    if (typeof Chat !== 'undefined') Chat.init(null);
    this._initChatKeys();

    this.refs.bagBtn.addEventListener('click', () => { if (this.onBagToggle) this.onBagToggle(); });
    this.refs.dexBtn.addEventListener('click', () => { if (this.onDexToggle) this.onDexToggle(); });
    this.refs.setBtn.addEventListener('click', () => { if (this.onSettingsToggle) this.onSettingsToggle(); });
    // 按钮悬浮提示：原生 title 已移除，改用与卡牌同款式的 canvas 悬浮框
    this._bindSimpleTip(this.refs.bagBtn, () => I18N.t('UI/Inventory/Title', 'Inventory'));
    this._bindSimpleTip(this.refs.dexBtn, () => I18N.t('UI/MobGallery/Title', 'Mob Gallery'));
    this._bindSimpleTip(this.refs.setBtn, () => I18N.t('UI/Settings/Title', 'Settings'));
    this._initSettings();
    // 红色矢量叉 -> 关闭对应窗口
    root.querySelectorAll('.win-close').forEach((b) => {
      this._bindSimpleTip(b, () => I18N.t('UI/Close', 'Close'));
      b.addEventListener('click', () => {
        const t = b.dataset.close;
        if (t === 'bag') { if (this.onBagToggle) this.onBagToggle(); }
        else if (t === 'dex') { if (this.onDexToggle) this.onDexToggle(); }
        else if (t === 'settings') { if (this.onSettingsToggle) this.onSettingsToggle(); }
      });
    });
    // 兜底：窗口失焦/右键菜单时，清掉可能残留的拖拽幽灵
    window.addEventListener('blur', () => this._removeGhost());
    root.addEventListener('contextmenu', (e) => { this._removeGhost(); e.preventDefault(); });
    // 任何元素发生滚动（含背包窗口内容 .win-body）-> 悬浮栏立刻渐隐，
    // 绝不能跟着内容一起滑走（scroll 不冒泡，用捕获阶段监听）
    window.addEventListener('scroll', () => { if (this._tipOn) this._hideTip(); }, true);
  },

  // HUD 不再含等级/经验/血量（战斗系统已移除）
  updateHUD() {},

  setBagVisible(v) { this.refs.inv.classList.toggle('hidden', !v); if (!v) this._hideTip(); },
  isBagVisible() { return !this.refs.inv.classList.contains('hidden'); },
  toggleBag() { if (this.onBagToggle) this.onBagToggle(); },

  setDexVisible(v) { this.refs.dex.classList.toggle('hidden', !v); if (!v) this._hideTip(); },
  isDexVisible() { return !this.refs.dex.classList.contains('hidden'); },
  toggleDex() { if (this.onDexToggle) this.onDexToggle(); },

  // ---------- 设置窗口 ----------
  setSettingsVisible(v) { this.refs.settings.classList.toggle('hidden', !v); if (!v) this._hideTip(); },
  isSettingsVisible() { return !this.refs.settings.classList.contains('hidden'); },
  toggleSettings() { if (this.onSettingsToggle) this.onSettingsToggle(); },

  // 是否有【任意窗口】打开。所有"窗口打开时应当暂停"的逻辑都走这一个入口，
  // 以后新增窗口只要在这里加一项即可，不会出现"某个窗口忘了判断"的情况。
  isAnyWindowOpen() {
    return this.isBagVisible() || this.isDexVisible() || this.isSettingsVisible();
  },

  // 分栏切换 + 三个设置项（写 Cookie；移动方式 / 调试模式当场生效，语言需重启）
  _initSettings() {
    const r = this.refs;
    // 分栏：Game / Controls / Graphics / Credits
    this.root.querySelectorAll('.set-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const name = tab.dataset.tab;
        this.root.querySelectorAll('.set-tab').forEach((t) => t.classList.toggle('on', t === tab));
        this.root.querySelectorAll('.set-panel').forEach((p) => {
          p.classList.toggle('hidden', p.dataset.panel !== name);
        });
      });
    });
    if (!r.setLang) return;
    // 初始值 = 当前设置
    const cur = (typeof Settings !== 'undefined')
      ? Settings.all() : { lang: 'en_US', debug: false, keyboardMove: false };
    r.setLang.value = cur.lang || 'en_US';
    r.setLang.addEventListener('change', () => this._setSetting('lang', r.setLang.value));
    // 勾选框：与聊天面板同款（黑描边外框 + 内部填充块）
    this._bindCheck(r.setDebug, !!cur.debug, (v) => this._setSetting('debug', v));
    this._bindCheck(r.setKeyboard, !!cur.keyboardMove, (v) => this._setSetting('keyboardMove', v));
  },

  // 单个设置项变更：写 Cookie + 立刻通知 Game 应用（不再需要重启）
  _setSetting(key, value) {
    if (typeof Settings !== 'undefined') Settings.set(key, value);
    if (this.onSettingChange) this.onSettingChange(key, value);
  },

  // 通用勾选框：点击切换 + 复用聊天面板的 cbx-check / cbx-uncheck 动画
  //   el = <span class="set-check"><i class="set-box"><b class="set-fill"></b></i></span>
  _bindCheck(el, initial, onChange) {
    if (!el) return null;
    const fill = el.querySelector('.set-fill');
    const apply = (v, anim) => {
      el.classList.toggle('on', v);
      if (!anim || !fill) return;
      fill.classList.remove('cbx-checking', 'cbx-unchecking');
      void fill.offsetWidth;               // 强制重排：保证同一动画能重复播放
      fill.classList.add(v ? 'cbx-checking' : 'cbx-unchecking');
      setTimeout(() => fill.classList.remove('cbx-checking', 'cbx-unchecking'), 400);
    };
    const toggle = () => { const v = !el.classList.contains('on'); apply(v, true); onChange(v); };
    apply(initial, false);
    el.addEventListener('click', (e) => { e.preventDefault(); toggle(); });
    // 整行也能点（但下拉框/输入框/勾选框自身的点击不重复触发）
    const row = el.closest ? el.closest('.set-row') : null;
    if (row && row !== el) {
      row.addEventListener('click', (e) => {
        if (el.contains(e.target)) return;
        if (e.target.closest && e.target.closest('select, input, textarea')) return;
        toggle();
      });
    }
    return el;
  },

  // ---------------- 死亡界面 ----------------
  // 半透明灰色蒙版渐显 + 面板从屏幕下方滑入渐显（退出反向），符合全 UI 平滑过渡要求。
  // 结构：死亡标题（i18N UI/Death/Title）换行 死因（生物名称，i18N 已本地化）
  //       + 绿色 Continue 按钮（UI/Death/Continue）→ onRespawn 回调重生。
  showDeathScreen(cause) {
    if (this._deathEl) return;
    const t = (typeof I18N !== 'undefined') ? I18N.t : (k, fb) => fb;
    // ① 晕影层：全屏径向灰黑渐变，置于所有 UI 之下、不挡交互（.death-vignette）
    const vig = document.createElement('div');
    vig.className = 'death-vignette';
    document.body.appendChild(vig);
    // ② 死亡面板：标题 + 死因 + Continue；容器不挡交互，仅按钮可点
    const wrap = document.createElement('div');
    wrap.className = 'death-overlay';
    const panel = document.createElement('div');
    panel.className = 'death-panel';
    const title = document.createElement('div');
    title.className = 'death-title';
    title.textContent = t('UI/Death/Title', 'You were destroyed by:');
    const reason = document.createElement('div');
    reason.className = 'death-cause';
    reason.textContent = cause || t('UI/Death/NoSource', 'A mysterious entity');
    const btn = document.createElement('button');
    btn.className = 'death-continue';
    btn.textContent = t('UI/Death/Continue', 'Continue');
    panel.appendChild(title);
    panel.appendChild(reason);
    panel.appendChild(btn);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    this._deathEl = wrap;
    this._deathVig = vig;
    // 双 rAF 后再加 .on：确保初始样式先完成一帧渲染，transition 才会播放
    requestAnimationFrame(() => requestAnimationFrame(() => { vig.classList.add('on'); wrap.classList.add('on'); }));
    btn.addEventListener('click', () => {
      this.hideDeathScreen();
      if (this.onRespawn) this.onRespawn();
    });
  },
  hideDeathScreen() {
    const wrap = this._deathEl;
    const vig = this._deathVig;
    this._deathEl = null;
    this._deathVig = null;
    if (wrap) { wrap.classList.remove('on'); setTimeout(() => wrap.remove(), 400); }
    if (vig) { vig.classList.remove('on'); setTimeout(() => vig.remove(), 450); }
  },

  hideLoading() {
    if (this.refs.loading) this.refs.loading.style.display = 'none';
    this.hideLoadingWarn();
  },

  // 加载过慢提示：定格于「正上方中央」的悬浮框（只提示，不影响后台继续加载）。
  // 文案一律从 i18N 提取（UI/Title/LoadingSlow），不硬编码。
  showLoadingWarn() {
    if (this._loadWarn) return;
    const el = document.createElement('div');
    el.id = 'loadWarn';
    el.textContent = I18N.t('UI/Title/LoadingSlow',
      'Loading is taking longer than expected. If you\'d like, refresh the page or check your network settings.');
    document.body.appendChild(el);
    this._loadWarn = el;
  },
  hideLoadingWarn() {
    if (this._loadWarn) { this._loadWarn.remove(); this._loadWarn = null; }
  },

  // ---------------- 底部常驻快捷栏：上行主槽（装备）+ 下行副槽（临时存储） ----------------
  // 行尺寸用 CSS zoom 整体缩放（0.9 / 0.75），描边、圆角、字体等所有子元素同步缩放。
  // 卡槽格子完全静态，不参与任何动画/变换，只作为对齐辅助。
  //
  // 【重要】采用「增量更新」而不是 innerHTML 清空重建：
  //   .qslot 元素本身永远复用，只有卡牌内容变化时才替换内部的 .card。
  //   旧实现每次 renderInvBar 都 main.innerHTML=''，会把正在播放入换动画的 .card 一起销毁，
  //   于是连续切换多个栏位时，只有最后一次动画能播完（前面的元素已经没了）。
  renderInvBar(p) {
    this._rowsVer++;                       // 行结构可能变化：失效卡槽矩形缓存
    this._renderRow(this.refs.slotRow, p.slots, 'slot', false);
    this._renderRow(this.refs.subRow, p.subSlots, 'subslot', true);
  },
  // 卡槽"水缸"阴影已改由 _reloadTick 在卡牌 canvas 内板内驱动（cards.js drawHpShadow）。
  // 增量渲染一行：格子数量不够就补、多出来就删；内容没变的格子原样保留（动画不被打断）。
  _renderRow(rowEl, cards, drop, isSub) {
    while (rowEl.children.length < cards.length) {
      rowEl.appendChild(this._makeCell(drop, rowEl.children.length, isSub));
    }
    while (rowEl.children.length > cards.length) rowEl.lastElementChild.remove();
    for (let i = 0; i < cards.length; i++) {
      this._updateCell(rowEl.children[i], cards[i], drop, i, isSub);
    }
  },
  _makeCell(drop, i, isSub) {
    const box = document.createElement('div');
    box.className = 'qslot';
    box.dataset.drop = drop; box.dataset.idx = i;
    const inner = document.createElement('div');
    inner.className = 'qinner';
    if (isSub) {
      // 副槽格子正下方的数字快捷键提示（放在 .qinner 内，随副槽缩放同步缩放）
      const num = document.createElement('div');
      num.className = 'qnum';
      num.textContent = '[' + ((i + 1) % 10) + ']';   // 第 10 个显示 [0] 而非 [10]
      inner.appendChild(num);
    }
    if (drop === 'slot') {
      // 花瓣血量"水缸"阴影改画在卡牌 canvas 内板上（与 reload 阴影同层同色，见
      // cards.js drawHpShadow / ui.js _reloadTick），不再用 DOM 层。
    }
    box.appendChild(inner);
    box._cardKey = '\u0000none';           // 强制首次一定建卡面
    return box;
  },
  // 只在该格卡牌确实变化时才换 .card；否则整个格子（含进行中的动画）原封不动
  _updateCell(box, card, drop, i, isSub) {
    const inner = box.firstElementChild;
    if (!inner) return;
    const num = inner.querySelector('.qnum');
    if (num) num.textContent = '[' + ((i + 1) % 10) + ']';
    const key = card ? (card.type.key + '|' + card.rarity) : '';
    if (box._cardKey === key) {
      // key 没变 -> 保留现有 DOM（关键：进行中的动画不被打断）。
      // 但必须把可见性复位：拖拽/点击时 _beginPointer 会把源卡临时设成 visibility:hidden，
      // 若在这里直接返回，那张卡就再也显示不出来了 —— 表现为
      //   ① 把卡拖出再放回原槽，该槽变空槽；
      //   ② 主/副槽互换「同属性」花瓣时吞掉一张（两边 key 相同，双双被跳过）。
      // 例外：_dropHidden 表示"卡正在飞入该槽、还没落到位"，此刻不能提前显示。
      const keep = inner.querySelector('.card');
      if (keep && !keep._dropHidden) keep.style.visibility = '';
      return;
    }
    box._cardKey = key;
    const old = inner.querySelector('.card');
    // 旧卡面连同其事件监听、以及它的数量角标兄弟节点一起移除（否则会残留一排孤立的 xN）
    if (old) { if (old._countEl) old._countEl.remove(); old.remove(); }
    if (!card) return;
    const cardEl = CardRenderer.createCard({ rarity: card.rarity, svg: card.type.svg });
    cardEl.style.visibility = '';
    inner.appendChild(cardEl);
    this._bindCard(cardEl, card, { type: drop, index: i },
      () => { if (isSub) { if (this.onSubClick) this.onSubClick(i); }
              else if (this.onSlotClick) this.onSlotClick(i); });
    this._bindTip(cardEl, card.type, card.rarity);
  },
  // 显式垂直交换动画：cols=null 整排互换；否则只动指定列。
  // 不记录卡的初始行数——交换后主槽卡一定来自同列副槽、反之亦然，矩形由固定卡槽直接给出。
  animateRowSwap(cols) {
    const main = this.refs.slotRow, sub = this.refs.subRow;
    if (!main || !sub) return;
    const n = main.children.length;
    const list = (cols == null) ? Array.from({ length: n }, (_, i) => i) : cols;
    const zm = parseFloat(getComputedStyle(main).zoom) || 1;
    const zs = parseFloat(getComputedStyle(sub).zoom) || 1;
    for (const i of list) {
      const mb = main.children[i], sb = sub.children[i];
      if (!mb || !sb) continue;
      // 用 .qinner 的视觉矩形（副槽被 scale 缩小，布局矩形与视觉矩形不一致）
      const mr = (mb.querySelector('.qinner') || mb).getBoundingClientRect();
      const sr = (sb.querySelector('.qinner') || sb).getBoundingClientRect();
      const mc = mb.querySelector('.card'), sc = sb.querySelector('.card');
      // 冷却结算与阴影动画都要等翻转动画完全播完才开始
      this._holdReload(i);
      // zoom 传"卡片所在行"（即目标行）的缩放：旧实现传反了，位移量会多出约 20%
      const a1 = mc ? this._flipVertical(mc, sr, mr, zm,
        () => this._releaseReload(i)) : false;   // 主槽卡：从副槽出发落回主槽
      const a2 = sc ? this._flipVertical(sc, mr, sr, zs,
        () => this._releaseReload(i)) : false;   // 副槽卡：从主槽出发落回副槽
      if (!a1) this._releaseReload(i);      // 没动画可播（位移可忽略）-> 立即放行，否则冷却永远不开始
      if (!a2) this._releaseReload(i);
    }
  },
  // 卡面从 fromRect 平滑回到其原位（toRect）：按两行「实测矩形」算出斜向位移 + 等比缩放。
  // 上下两行 zoom 不同（0.9 / 0.75）-> 卡槽并不对齐，必须同时补 X 与 Y；只动 Y 会让横向差
  // 直接跳过去（旧实现抖动/跳动的来源）。终点严格回到 transform:''（即本槽原位），
  // 因此到位后绝不会有残留偏移。多列可同时播放（各自元素独立）。
  // 返回 true 表示确实播了动画（调用方据此决定是否放行装填计时）。
  //
  // 【关键】起始状态必须【同步】写好：Anim.play 只在下一帧才第一次 apply，若不先摆好起始
  // 变换，卡片会在自己的槽位（= 终点）上先显示一帧，看起来就是"飞入之前卡牌就已经在那儿了"。
  _flipVertical(cardEl, fromRect, toRect, zoom, onSettled) {
    const dx = ((fromRect.left + fromRect.width / 2) - (toRect.left + toRect.width / 2)) / zoom;
    const dy = ((fromRect.top + fromRect.height / 2) - (toRect.top + toRect.height / 2)) / zoom;
    const s = (toRect.width > 0) ? fromRect.width / toRect.width : 1;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(s - 1) < 0.01) {
      if (onSettled) onSettled();
      return false;
    }
    const setT = (x, y, k) => {
      cardEl.style.transition = 'none';
      cardEl.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${k.toFixed(4)})`;
    };
    setT(dx, dy, s);                     // ← 同步摆好起始位，消除那一帧的"提前显示"
    Anim.play(cardEl, {
      from: { dx, dy, s },
      to: { dx: 0, dy: 0, s: 1 },
      dur: 0.5,                       // 0.5s
      ease: Anim.ease.out,            // 起步快、收尾缓：同样 0.5s 但观感更利落，不拖沓
      apply: (el, st) => setT(st.dx, st.dy, st.s),
      onDone: (el) => { el.style.transform = ''; if (onSettled) onSettled(); }
    });
    return true;
  },

  // ---------------- 背包窗口 = 全部花瓣画廊（每张卡带数量角标） ----------------
  // 调试模式 ?mode=debug：全部显示 ∞，怎么拿都拿不空；否则每种默认 2 张。
  renderInventory() {
    const g = this.refs.invGallery;
    g.innerHTML = '';
    const rarName = (r) => I18N.t('Rarities/' + r + '/Name', r);
    const petals = PETAL_TYPES.slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const rar of RARITY_ORDER) {
      const col = (RARITIES[rar] && RARITIES[rar].color) || '#fff';
      const grp = this._rarGroup(rarName(rar), col, petals, rar);
      if (grp) g.appendChild(grp);   // 该等级一张都没有则不显示分割线
    }
  },

  // 画廊卡数量（调试=∞，普通=2）；拿空(<=0)后该卡不再渲染
  _galleryCount(key) {
    if (!this._gc) this._gc = {};
    if (!(key in this._gc)) this._gc[key] = window.__debug ? Infinity : 2;
    return this._gc[key];
  },
  _decGallery(card) {
    const key = card.type.key + '|' + card.rarity;
    if (window.__debug) return true;
    if (!this._gc) this._gc = {};
    if (this._gc[key] === undefined) this._gc[key] = 2;
    if (this._gc[key] <= 0) return false;   // 已取完：拒绝再取（防止连点刷出超量卡）
    this._gc[key] -= 1;
    return true;
  },
  // 取消拖拽（回退背包）时恢复数量（+1）；调试模式恒 ∞ 不变
  _incGallery(card) {
    const key = card.type.key + '|' + card.rarity;
    if (window.__debug) return;
    if (!this._gc) this._gc = {};
    if (this._gc[key] === undefined) this._gc[key] = 2;
    this._gc[key] += 1;
  },
  // 拾取掉落：对应卡牌数量 +1（进背包 = all petals）。调试模式恒 ∞，不加不减。
  addGalleryCount(type, rarity) {
    const key = type.key + '|' + rarity;
    if (!this._gc) this._gc = {};
    if (this._gc[key] === undefined) this._gc[key] = window.__debug ? Infinity : 2;
    if (this._gc[key] !== Infinity) this._gc[key] += 1;
    // 背包开着才实时刷新（关着则下次打开自然读新值，避免无谓重建 900+ 卡）
    if (this.refs.inv && !this.refs.inv.classList.contains('hidden')) this.renderInventory();
  },

  // 生成一个「稀有度分组」：该等级一张卡都没有则不显示分割线；否则展示分割条 + 等级名字 + 卡片网格（带数量）
  _rarGroup(name, color, petals, rarity) {
    const items = petals.filter(p => this._galleryCount(p.key + '|' + rarity) > 0);
    if (items.length === 0) return null;   // 该等级一张都没有 -> 不显示分割线
    const group = document.createElement('div');
    group.className = 'rar-group';
    group.style.color = color;
    const div = document.createElement('div');
    div.className = 'rar-divider';
    const lineCol = '#4981B1';   // 分割线 = 与窗口边框同色（只有中心字母是稀有度色）
    div.innerHTML =
      `<span class="rar-line" style="background:${lineCol}"></span>` +
      `<span class="rar-name" style="color:${color}">${name}</span>` +
      `<span class="rar-line" style="background:${lineCol}"></span>`;
    group.appendChild(div);
    const grid = document.createElement('div');
    grid.className = 'rar-grid';
    for (const p of items) {
      const key = p.key + '|' + rarity;
      const cell = document.createElement('div');
      cell.className = 'cardcell';
      cell.appendChild(CardRenderer.createCard({
        rarity, svg: p.svg, count: this._galleryCount(key),
        pad: 0.0756, radius: 0.0588   // 背包卡牌：描边/圆角按卡面比例同步缩小
      }));
      const card = { type: p, rarity };
      this._bindCard(cell, card, { type: 'gallery', index: -1 },
        () => {
          // 数量已在「按下」时原子扣过，这里只负责装备，绝不再动数量
          if (this.onGalleryCardClick) this.onGalleryCardClick(card);
        });  // gallery 支持拖拽和点击
      this._bindTip(cell, p, rarity);
      grid.appendChild(cell);
    }
    group.appendChild(grid);
    return group;
  },

  // ---------------- 图鉴：生物图鉴 ----------------
  // 一行 = 一种生物，9 格 = 9 个稀有度（从左到右递增）。
  // 只显示"打过"的生物（game.dex 有记录），行序 = 生物名（当前译文）字典序。
  // 每格：灰色半透明槽；打过的那一格 = 该稀有度的空白卡面 + 生物贴图。
  // 窗口高度随行数增长，上限约背包窗口的一半（见 css 里 #dex 的 max-height）。
  renderDex(game) {
    const g = game || window.__game;
    const body = this.refs.dexBody;
    if (!body) return;
    body.innerHTML = '';
    const dex = (g && g.dex) ? g.dex : {};
    // 只留有记录的生物
    const rowMobs = MOB_TYPES.filter((m) => {
      const s = dex[m.id];
      return !!(s && s.size);
    });
    // 字典序：按当前语言显示名排序（同分按 id 稳定）
    rowMobs.sort((a, b) => String(a.name).localeCompare(String(b.name)) || (a.id - b.id));

    for (const m of rowMobs) {
      const row = document.createElement('div');
      row.className = 'dex-row';
      for (const rar of RARITY_ORDER) {
        const cell = document.createElement('div');
        cell.className = 'dex-cell';
        if (g && g.isDefeated && g.isDefeated(m.id, rar)) {
          cell.classList.add('on');
          // 空白稀有度卡面（与花瓣卡同一套底板）+ 生物贴图
          cell.appendChild(CardRenderer.createCard({
            rarity: rar, svg: null, pad: 0.0756, radius: 0.0588
          }));
          const art = document.createElement('canvas');
          art.className = 'dex-mob';
          cell.appendChild(art);
          this._paintMobArt(art, m, rar);
          this._bindMobTip(cell, m, rar);      // 只有打过的格子才有悬浮框
        }
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
    if (this.refs.dexCount) {
      this.refs.dexCount.textContent = I18N.tf('UI/MobGallery/Count',
        { 0: fmtNum(rowMobs.length), 1: fmtNum(MOB_TYPES.length) });
    }
    this._dexBuilt = true;
  },

  // 图鉴格子里的生物贴图。
  // 缩放口径（参照 83.svg 这类"图案自带圆角外框"的官方素材）：官方生物的图案本体在
  // SVG 里本来就留了外圈空白，卡面上应保留同样的留白 —— 所以图案只占格子的 ART_FILL，
  // 四角圆角与描边都在留白之内，绝不溢出；描边圈再按 RING_RECT 的外扩比例叠上去。
  //   本体 0.78 × 圈外扩 1.1172 ≈ 0.87 → 连描边一起也落在格子里。
  _paintMobArt(cv, mob, rarity, tries) {
    const S = 96;
    if (cv.width !== S) { cv.width = S; cv.height = S; }
    const key = 'mob' + mob.svg;
    // 用裁剪到图案包围盒的版本：条纹/斑点/轮廓都按实际图案等比铺开（不做非等比拉伸）
    const body = (typeof SpriteStore !== 'undefined' && SpriteStore.artCanvas)
      ? SpriteStore.artCanvas(key, S) : null;
    if (!body) {
      // 素材还没解码好：稍后重试（最多 25 次 ≈ 3s，避免无谓的空转）
      const n = (tries || 0) + 1;
      if (n <= 25) setTimeout(() => { if (cv.isConnected) this._paintMobArt(cv, mob, rarity, n); }, 120);
      return;
    }
    const c = cv.getContext('2d');
    c.clearRect(0, 0, S, S);
    c.imageSmoothingQuality = 'high';
    const bd = S * 0.78;                 // 图案本体直径（其余留白）
    const bx0 = (S - bd) / 2, by0 = (S - bd) / 2;
    c.drawImage(body, bx0, by0, bd, bd);
    // 瓢虫：斑点 + 描边圈（与场景内 Mob.draw 完全同一顺序：本体 -> 斑点 -> 圈）
    if (mob.svg === 3) {
      this._paintLadybugDots(c, rarity, S, bd);
      const ring = (typeof LADYBUG_RING_KEY !== 'undefined' && SpriteStore.artCanvas)
        ? SpriteStore.artCanvas(LADYBUG_RING_KEY, S) : null;
      if (ring) {
        const k = (typeof LADYBUG_RING_RECT !== 'undefined' && LADYBUG_RING_RECT)
          ? Math.max(LADYBUG_RING_RECT[2], LADYBUG_RING_RECT[3]) : 1.1172;
        const rd = bd * k;
        c.drawImage(ring, (S - rd) / 2, (S - rd) / 2, rd, rd);
      }
    }
  },

  // 瓢虫斑点（图鉴用）：与场景内 Mob._makeDots 同一套分布 —— 数量随稀有度 2..9、
  // 均匀圆盘撒点、半径 0.11×直径浮动，裁剪在鞘翅内圈（0.48×直径）里。
  // 用固定种子，保证同一格每次绘制完全一致。
  _paintLadybugDots(c, rarity, S, bd) {
    const idx = Math.max(0, RARITY_ORDER.indexOf(rarity));
    const n = 2 + idx;
    let s = 3 * 131 + idx * 17 || 1;
    const rng = () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffffff) / 0x1000000; };
    c.save();
    c.beginPath();
    c.arc(S / 2, S / 2, bd * 0.48, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#111';
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * 0.38;
      const r = 0.11 * (0.65 + 0.7 * rng());
      c.beginPath();
      c.arc(S / 2 + Math.cos(a) * d * bd, S / 2 + Math.sin(a) * d * bd, r * bd, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  },

  // ---------------- 主槽装填（reload）阴影 ----------------
  // 阴影画在卡牌 canvas 内部（内板之上、花瓣图形与名称之下），所以：
  //   · 只覆盖卡牌中部（内板），卡牌外周那圈稀有度描边不被遮住；
  //   · 花瓣本体与名称文字完全不被遮盖。
  // 视觉 = 一块"无阴影扇形"从 0 长满一整圈，扇形之外是阴影；扇形没有描边，就是两块区域的分界。
  //   · 扇形两条边界同点出发：慢边界与快边界，两者转速比率恒定（快 = 慢的 2 倍）；
  //   · 慢边界在装填期间正好转一圈，快边界转两圈，因此在"装填完成"那一刻快边界恰好追上慢边界，
  //     扇形宽度 = 2π -> 覆盖整圈 -> 阴影消失；
  //   · 整个过程时长 = 该花瓣的 reload 秒数（type.spd），装填完成后才会生成花瓣实体。
  // 实现：每帧把装填进度写进 canvas 状态并重绘那一张卡（按进度取 key 去重，没变就不重绘）。
  _reloadTick(dt) {
    const g = window.__game;
    const p = g && g.player;
    const row = this.refs.slotRow;
    if (!p || !row || !p.reload) return;
    const n = Math.min(row.children.length, p.slots.length);
    for (let i = 0; i < n; i++) {
      const cv = row.children[i].querySelector('.card');
      if (!cv || !cv._card) continue;
      // —— reload 扇形阴影进度 ——
      // 玩家死亡后 reload 计时冻结（update 早退不再推进），若仍按 active 绘制，
      // 扇形会停在死前那半截进度 —— 表现为"卡面上停着的加载特效"。
      // 死亡期间一律按未激活处理：扇形阴影消失，统一由 hpShadow 爬到全阴影接管。
      const r = p.reload[i];
      const active = !p.dead && !!(r && r.dur > 0 && r.age < r.dur);
      // —— 花瓣血量阴影（"水缸"）——目标值即时生效，不做过渡：
      // 阴影与 reload 阴影颜色天然相同（同色同级），状态切换无需动画；
      // 旧版指数平滑会让花瓣死亡瞬间的 hp 阴影回退与 reload 扇形短暂叠加
      // （两层 0.5 alpha 重叠变深），这正是"颜色略有不同"的来源。
      //   · 玩家死亡          -> 全 1：所有卡【快速平滑】过渡到 reload 前的全阴影
      //                          状态（reload 待命），重生后统一重新装填
      //   · reload 阴影进行中 -> 0（视觉全部交给扇形阴影，绝不叠加）
      //   · 有花瓣实体        -> 1 - hp/maxHp（归零即整块全阴影，无缝接 reload 起始）
      //   · 无实体（装填中）  -> 0
      let hpTarget = 0;
      if (p.dead) {
        hpTarget = 1;
      } else if (!active) {
        // 水位 = 1 - 存活实体血量总和 / 【卡面总 hp】。
        // 一张卡可能对应多个独立实体（Light 的每个光点，各自占卡面 hp 的 1/N）：
        // 死掉的光点不计血量，装填好一个就回涨 1/N。
        const arr = p.petals ? p.petals.filter((x) => x.slotIndex === i) : null;
        if (arr && arr.length) {
          const card = p.slots[i];
          const st = (typeof petalStatsFor === 'function' && card) ? petalStatsFor(card.type, card.rarity) : null;
          const total = (st && st.hp > 0) ? st.hp : arr.reduce((s, b) => s + b.maxHp, 0);
          let hpSum = 0;
          for (const b of arr) if (!b.dead) hpSum += Math.max(0, b.hp);
          if (total > 0) hpTarget = 1 - Math.max(0, Math.min(1, hpSum / total));
        }
      }
      // —— 平滑过渡（上升/下降都要能感知）——
      // 统一用指数逼近：cur += (target - cur) * (1 - e^(-dt/τ))，帧率无关；
      // τ ≈ 0.25s 让"掉血变深 / 回血变浅"都看得见，而不是瞬间跳变。
      // reload 扇形激活期间直接归零（扇形本身代表进度，避免两层 0.5 alpha 叠加变深，
      // 那正是旧版"颜色略有不同"的来源）。
      let cur;
      const prev = (cv._hpShadowSm != null) ? cv._hpShadowSm : hpTarget;
      if (active) {
        cur = 0;
      } else {
        const d = Math.max(0, Math.min(0.1, dt || 0.016));
        const k = 1 - Math.exp(-d / 0.25);      // τ = 0.25s
        cur = prev + (hpTarget - prev) * k;
        if (Math.abs(hpTarget - cur) < 0.002) cur = hpTarget;   // 收敛后吸附，避免长期重绘
      }
      cv._hpShadowSm = cur;
      // 合并去重 key：reload 进度或阴影值任一变化才重绘那一张卡
      const key = (active ? (r.age / r.dur).toFixed(4) : '') + '|' + cur.toFixed(3);
      if (cv._rlKey === key) continue;        // 都没变：不重绘
      cv._rlKey = key;
      cv._card.reload = active ? r : null;
      cv._card.hpShadow = cur;
      CardRenderer.paintCard(cv);
    }
  },

  // 装填计时的暂停/恢复：卡牌"换上来"的动画（互换翻转 / 飞入卡槽）播放期间必须暂停，
  // 等动画完全结束、卡牌已经落在卡槽里，才开始结算冷却并播放阴影动画（用户要求）。
  _holdReload(i) {
    const p = window.__game && window.__game.player;
    if (p && p.reload) p.reloadHold[i] = true;
  },
  _releaseReload(i) {
    const p = window.__game && window.__game.player;
    if (p && p.reload) p.reloadHold[i] = false;
  },

  // ---------------- 卡牌数据悬浮框：纯 canvas 绘制 ----------------
    // 排版在「参考空间」里算（宽 320，与 info.png 同比例），绘制时整体乘 TIP_SCALE(0.6)。
    // 结构：名称(左上) + 冷却(右上黄字) / 稀有度名 / 介绍(紧贴稀有度) / 间隔一小块 / Health、Damage 数值
    // 所有文字统一黑色描边（漫画字），数值字号与介绍一致。
    _bindTip(el, type, rarity) {
      el.addEventListener('mouseenter', () => this._showTip(type, rarity, el));
      el.addEventListener('mouseleave', () => this._hideTip());
    },
    _showTip(type, rarity, el) {
        // 元素所在窗口已关闭时不再响应（隐藏窗口内部元素理论上收不到事件，这是第二道保险）
        if (el && el.closest && el.closest('.window.hidden')) return;
        // 数值随稀有度换算（与装备/提示一致）
        let dmg = type.dmg || 0, hp = type.hp || 0, heal = type.heal || 0;
        // 有「各稀有度数值表」就整表取用（Rose）；否则退回倍率表（Basic）；再否则用基础值
        const rs = type.rarityStats && type.rarityStats[rarity];
        if (rs) { dmg = rs.dmg || 0; hp = rs.hp || 0; heal = rs.heal || 0; }
        else {
          const m = type.rarityMultipliers && type.rarityMultipliers[rarity];
          if (m) { dmg = type.dmg * (m.dmg || 1); hp = type.hp * (m.hp || 1); }
        }
        const slug = type.slug || String(type.name || '').toLowerCase().replace(/ /g, '_');
        // 从"刚离开的另一张卡"快速移来（120ms 宽限）：不做「上一个渐隐 + 下一个渐显」，
        // 直接保持不透明并把框平移过去 —— 任何时刻画面上只有一个悬浮框
        const now = performance.now();
        this._tipSlide = !!(this._tipOn || (now - (this._tipHideAt || 0) < 120));
        if (this._tipSlide) this._tipAlpha = 1;
        this._tip = {
          name: type.name || '',
          rarityName: I18N.t('Rarities/' + rarity + '/Name', rarity),
          rarityColor: (RARITIES[rarity] && RARITIES[rarity].color) || '#fff',
          desc: I18N.t('Petals/' + slug + '/Description', ''),
          dmg: Math.round(dmg * 10) / 10,
          hp: Math.round(hp * 10) / 10,
          heal: Math.round(heal * 10) / 10,
          reload: (type.reload != null) ? type.reload : Math.max(0, type.spd || 0),
          reloadText: type.reloadText || null,
          // Honey 的 Max Mob Rarity：标签固定 #d2eb34，值用【被吸引稀有度自己的颜色】
          ...(() => {
            const mr = (typeof petalMaxMobRarity === 'function') ? petalMaxMobRarity(type, rarity) : null;
            if (!mr) return {};
            return {
              maxMobRarityName: I18N.t('Rarities/' + mr + '/Name', mr),
              maxMobRarityColor: (RARITIES[mr] && RARITIES[mr].color) || '#ffffff'
            };
          })(),
          anchor: el
        };
        this._tipOn = true;
      },
      // ---------------- 生物悬浮框（图鉴格子） ----------------
    // 与卡牌悬浮框同一块面板；右上角把"冷却文字 + 旋转图标"换成"菱形 + XP Reward 数值"。
    _bindMobTip(el, mob, rarity) {
      el.addEventListener('mouseenter', () => this._showMobTip(mob, rarity, el));
      el.addEventListener('mouseleave', () => this._hideTip());
    },
    _showMobTip(mob, rarity, el) {
      // 图鉴已关闭时不再弹（关闭后鼠标扫过原位置不应还有悬浮框）
      if (el && el.closest && el.closest('.window.hidden')) return;
      if (!this.isDexVisible()) return;
      const now = performance.now();
      this._tipSlide = !!(this._tipOn || (now - (this._tipHideAt || 0) < 120));
      if (this._tipSlide) this._tipAlpha = 1;
      const rs = (mob.rarityStats && mob.rarityStats[rarity]) || {};
      // 必须用 registry 里的【官方英文名】算 slug：mob.name 是当前语言的译文，
      // 拿它反推会得到 "瓢虫" 之类的键，简介永远查不到（这就是介绍不显示的原因）。
      const slug = mob.slug || String(mob.name || '').toLowerCase().replace(/ /g, '_');
      this._tip = {
        mob: true,
        name: mob.name || '',
        rarityName: I18N.t('Rarities/' + rarity + '/Name', rarity),
        rarityColor: (RARITIES[rarity] && RARITIES[rarity].color) || '#fff',
        // 简介可能缺条目：用 opt（缺失不显示 <键名>）
        desc: I18N.opt('Mobs/' + slug + '/Description', ''),
        xp: rs.exp || 0,
        // 数值：与花瓣悬浮框同款式（Health / Damage / Armor）
        hp: rs.hp || 0,
        dmg: rs.dmg || 0,
        armor: rs.armor || 0,
        // 掉落物：一种花瓣一行，行内是该花瓣各掉落稀有度（卡面 + 下方概率）
        drops: (typeof mobDropRows === 'function') ? mobDropRows(mob.id, rarity) : [],
        anchor: el
      };
      this._tipOn = true;
    },

    _hideTip() { if (this._tipOn) this._tipHideAt = performance.now(); this._tipOn = false; },

  // ---------------- 简易文字悬浮框（按钮提示） ----------------
  // 样式与卡牌悬浮框一致：同底色透明度、同渐变高光；单行、宽度自适应
  _bindSimpleTip(el, textFn) {
    el.addEventListener('mouseenter', () => this._showSimpleTip(textFn(), el));
    el.addEventListener('mouseleave', () => this._hideTip());
  },
  _showSimpleTip(str, el) {
    const now = performance.now();
    this._tipSlide = !!(this._tipOn || (now - (this._tipHideAt || 0) < 120));
    if (this._tipSlide) this._tipAlpha = 1;
    this._tip = { simple: str, anchor: el };
    this._tipOn = true;
  },
  // 字号与背包窗口小标题(.win-subtitle)一致
  _subtitleFontSize() {
    if (this._subFS) return this._subFS;
    const el = document.querySelector('.win-subtitle');
    this._subFS = el ? (parseFloat(getComputedStyle(el).fontSize) || 10.8) : 10.8;
    return this._subFS;
  },
  _simpleTipLayout(ctx, t) {
    const FS = this._subtitleFontSize();
    const str = String(t.simple || '');
    ctx.font = `900 ${FS}px ${CardRenderer.FONT}`;
    const tw = ctx.measureText(str).width;
    const PADX = 11, PADY = 6, RAD = 7;
    return { W: Math.ceil(tw) + PADX * 2, H: Math.ceil(FS * 1.15) + PADY * 2, FS, PADX, RAD, tw };
  },

      // 参考空间排版：宽度由内容自适应（介绍优先单行不换行），数值统一排在左下角
      _tipLayout(ctx, t) {
        const PADX = 16, RH = 14, LH = 19, BLANK = LH, MIN_W = 176, MAX_W = 620;
        const ICON = 15;                                   // 冷却后的"旋转"静态图标边长
        // 名称上方留一点、最后一行数据下方也留一点
        const titleY = 34, reloadY = 33, rarityY = 58;
        const FS_TITLE = 26, FS_RELOAD = 21, FS_RAR = 17, FS_DESC = 15, FS_STAT = 15;
        const W_ALL = 700;                      // 全局加粗 Ubuntu
        const F = CardRenderer.FONT;
        const measure = (size, str) => { ctx.font = `${W_ALL} ${size}px ${F}`; return ctx.measureText(str).width; };
        const desc = String(t.desc || '');
        // 冷却展示：优先用 reloadText（如 "3.5s + 1.5s"）；否则按秒数生成。
        // 生物悬浮框没有冷却，右上角改为"菱形 + XP Reward"，所以这里为空。
        const reload = t.mob ? '' : (t.reloadText || (t.reload > 0 ? (fmtNum(t.reload) + 's') : ''));
        // 生物右上角：菱形 + "数值 XP"（XP 是两种语言下的通用单位，不额外翻译）
        const xpTxt = t.mob ? (fmtNum(t.xp) + ' XP') : '';
        const titleW = measure(FS_TITLE, t.name);
        const rarW = measure(FS_RAR, t.rarityName);
        const reloadW = reload ? measure(FS_RELOAD, reload) : 0;
        // 数值行：{ label, value, labelColor?, valueColor? }
        // 规则：这张卡**没有的数值整行不画**（Damage 为 0 就是没有伤害，如 Honey）。
        const STAT_GAP = 6;                                     // 标签与数值的间距（参考空间）
        const rows = [];
        if (t.mob) {
          rows.push({ label: statLabel('Mob/Attribute/Health', 'Health:'), value: t.hp });
          if (t.dmg > 0) rows.push({ label: statLabel('Mob/Attribute/Damage', 'Damage:'), value: t.dmg });
          if (t.armor > 0) rows.push({ label: statLabel('Mob/Attribute/Armor', 'Armor:'), value: t.armor });
        } else {
          if (t.hp > 0) rows.push({ label: statLabel('Petal/Attribute/Health', 'Health:'), value: t.hp });
          if (t.dmg > 0) rows.push({ label: statLabel('Petal/Attribute/Damage', 'Damage:'), value: t.dmg });
          if (t.heal > 0) rows.push({ label: statLabel('Petal/Attribute/Heal', 'Heal:'), value: t.heal });
          if (t.maxMobRarityName) {
            rows.push({
              label: statLabel('Petal/Attribute/MaxMobRarity', 'Max Mob Rarity:'),
              value: t.maxMobRarityName,
              labelColor: (typeof MAX_MOB_RARITY_COLOR !== 'undefined') ? MAX_MOB_RARITY_COLOR : '#d2eb34',
              valueColor: t.maxMobRarityColor || '#ffffff'      // 稀有度名用它自己的颜色
            });
          }
        }
        // 行宽 = 标签宽 + 间距 + 数值宽（与绘制时同一字体、同一算法，不会互相压字）
        let statW = 0;
        for (const r of rows) {
          const w = measure(FS_STAT, r.label) + STAT_GAP
            + measure(FS_STAT, (typeof r.value === 'number' ? fmtNum(r.value) : String(r.value)));
          if (w > statW) statW = w;
        }
        // 介绍：先按官方的换行标记 <n/> 强制断行（Honey 等卡面的介绍里就带这个），
        // 每段再按宽度折行；宽度够就单行。以前直接把 <n/> 当普通文字测宽 -> 界面上
        // 原样显示 "<n/>"，所以这里必须先拆再排。
        const limit = MAX_W - PADX * 2;
        const lines = [];
        if (desc) {
          const paras = String(desc).split(/<n\s*\/?>|\r?\n/gi);
          for (const raw of paras) {
            const seg = raw.trim();
            if (!seg) { if (lines.length) lines.push(''); continue; }   // 保留段落间空行
            if (measure(FS_DESC, seg) <= limit) { lines.push(seg); continue; }
            let cur = '';
            for (const word of seg.split(' ')) {
              const test = cur ? cur + ' ' + word : word;
              if (cur && measure(FS_DESC, test) > limit) { lines.push(cur); cur = word; }
              else cur = test;
            }
            if (cur) lines.push(cur);
          }
          while (lines.length && !lines[lines.length - 1]) lines.pop();   // 去掉尾部空行
        }
        // 宽度 = 最宽一行 + 左右留白；标题、冷却与旋转图标都不重叠
        let contentW = Math.max(titleW, rarW, statW);
        for (const l of lines) contentW = Math.max(contentW, measure(FS_DESC, l));
        let W = Math.max(MIN_W, PADX * 2 + contentW);
        if (reload) W = Math.max(W, PADX + titleW + 14 + reloadW + 8 + ICON + RH);
        // 生物：右上角 = 菱形图标 + 右侧 XP 数值（两者都要塞进标题右侧）
        if (t.mob) W = Math.max(W, PADX + titleW + 14 + measure(FS_RELOAD, xpTxt) + 8 + ICON + RH);
        W = Math.min(MAX_W, W);
        // 介绍上下各空出一行；数值统一在左下角，自上而下：Health / Damage / (Heal)
        const descTop = rarityY + 22 + BLANK;
        const descBottom = descTop + Math.max(0, lines.length - 1) * LH;
        const statY = [];
        for (let i = 0; i < rows.length; i++) statY.push(descBottom + 22 + BLANK + i * 21);
        // ---- 掉落物区（仅生物悬浮框）----
        // 每种花瓣一行；行内并排该花瓣的各掉落稀有度卡面，卡面下方标概率。
        // CS = 背包卡（44.544px）的 0.8 倍再换算到参考空间：44.544×0.8÷0.6 ≈ 59.4
        const drops = (t.mob && t.drops) ? t.drops : [];
        const CS = 59.4, CGAP = 8, PCT_H = 23, DROP_GAP = 12;   // 参考空间尺寸（绘制时整体 × S）
        const lastStat = statY.length ? statY[statY.length - 1] : descBottom;
        const dropTop = lastStat + 32;
        const dropRowH = CS + PCT_H + DROP_GAP;
        if (drops.length) {
          let wMax = 0;
          for (const d of drops) {
            wMax = Math.max(wMax, d.items.length * CS + (d.items.length - 1) * CGAP);
          }
          W = Math.max(W, PADX * 2 + wMax);
        }
        // 高度：有掉落物 -> 末尾掉落行之后；否则数值行之后
        const H = (drops.length ? dropTop + (drops.length - 1) * dropRowH + CS + PCT_H : lastStat) + 16;
        return { W, H, RH, PADX, LH, ICON, lines, titleY, reloadY, rarityY, descTop, rows, statY, W_ALL, STAT_GAP,
          xpTxt, drops, dropTop, dropRowH, CS, CGAP,
          FS_TITLE, FS_RELOAD, FS_RAR, FS_DESC, FS_STAT };
      },

    _drawTip(ctx, t, alpha) {
        const S = TIP_SCALE;                       // 整体 0.6 倍
        // 简易模式（按钮提示）：单行、宽度自适应、绘制用真实像素；卡牌模式照旧
        let L = null, W, H;
        if (t.simple) { const m = this._simpleTipLayout(ctx, t); W = m.W; H = m.H; }
        else { L = this._tipLayout(ctx, t); W = L.W * S; H = L.H * S; }
        const pad = 10 * S;
        // 目标位置：卡牌正上方居中；顶部放不下则改到下方；再夹进视口
    // 锚点元素会被重渲染销毁（点击装备 -> renderInvBar 重建卡槽），此时必须沿用
    // 最后一次有效矩形原地渐隐；旧实现回退到屏幕中心 —— 而主角永远在屏幕中心，
    // 于是悬浮框"飞到主角身上"再消失。
    if (this._tipOn && t.anchor && t.anchor.isConnected) {
      const ar = t.anchor.getBoundingClientRect();
      const last = this._tipLastRect;
      // 只有"同一个元素"发生位移才算内容在滚动/重排 —— 换到另一张卡时矩形当然不同，
      // 那是一次正常的悬浮切换，不能误判成移动（否则悬浮栏会只闪一下就再也不出现）。
      const sameAnchor = (this._tipAnchor === t.anchor);
      if (sameAnchor && last && (Math.abs(ar.left - last.left) > 0.5 || Math.abs(ar.top - last.top) > 0.5)) {
        this._hideTip();          // 锚点开始移动（滚动/重排/缩放）-> 立刻渐隐
      } else {
        this._tipAnchor = t.anchor;
        this._tipLastRect = ar;
      }
    }
    const r = this._tipLastRect || null;
    if (this._tipOn && r) {
      let tx = r.left + r.width / 2 - W / 2;
      let ty = r.top - H - 8;
      if (ty < 4) ty = r.bottom + 8;
      tx = Math.max(4, Math.min(tx, innerWidth - W - 4));
      ty = Math.max(4, Math.min(ty, innerHeight - H - 4));
      // 首次出现直接落位；相邻卡之间移动时把框平移过去
      if (!this._tipSlide || !this._tipPos) this._tipPos = { x: tx, y: ty };
      else {
        this._tipPos.x += (tx - this._tipPos.x) * 0.4;
        this._tipPos.y += (ty - this._tipPos.y) * 0.4;
      }
    }
    if (!this._tipPos) this._tipPos = { x: innerWidth / 2 - W / 2, y: innerHeight / 2 - H / 2 };
    const x = this._tipPos.x, y = this._tipPos.y;

        ctx.save();
        ctx.globalAlpha = alpha;
        // 面板：半透明深绿底（0.5）+ 斜向柔和高光；无描边
        ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18 * S; ctx.shadowOffsetY = 6 * S;
        roundRectPath(ctx, x, y, W, H, pad);
        ctx.fillStyle = 'rgba(10,56,30,0.5)';
        ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.save();
        roundRectPath(ctx, x, y, W, H, pad);
        ctx.clip();
        const gl = ctx.createLinearGradient(x, y, x + W, y + H);
        gl.addColorStop(0, 'rgba(255,255,255,0)');
        gl.addColorStop(0.55, 'rgba(190,255,205,.025)');
        gl.addColorStop(1, 'rgba(190,255,205,.065)');
        ctx.fillStyle = gl;
        ctx.fillRect(x, y, W, H);
        ctx.restore();

        if (t.simple) {
          // 单行提示：Ubuntu 900、字号与背包窗口小标题一致、同比例黑描边
          const m = this._simpleTipLayout(ctx, t);
          ctx.textBaseline = 'middle';
          ctx.font = `900 ${m.FS}px ${CardRenderer.FONT}`;
          ctx.textAlign = 'left';
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.lineWidth = m.FS * 0.15;           // 与卡牌悬浮框相同的描边比例
          ctx.strokeStyle = '#000';
          const ty = y + H / 2 + 0.5;
          ctx.strokeText(t.simple, x + m.PADX, ty);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(t.simple, x + m.PADX, ty);
          ctx.restore();
          return;
        }

        // 文字：Ubuntu 加粗 + 纯黑描边（描边宽度随字号等比缩放）
        ctx.textBaseline = 'alphabetic';
        const bx = x + L.PADX * S, rx = x + W - L.RH * S;
        const text = (str, tx2, ty2, refSize, weight, color, align) => {
          const size = Math.round(refSize * S * 100) / 100;
          ctx.font = `${weight} ${size}px ${CardRenderer.FONT}`;
          ctx.textAlign = align || 'left';
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.lineWidth = size * 0.15;
          ctx.strokeStyle = '#000';
          ctx.strokeText(str, tx2, ty2);
          ctx.fillStyle = color;
          ctx.fillText(str, tx2, ty2);
        };
        // 名称（左上）
        text(t.name, bx, y + L.titleY * S, L.FS_TITLE, L.W_ALL, '#ffffff');
        // 生物：右上角 = 菱形（稀有度色 + 黑描边）+ 右侧 XP 数值
            if (t.mob) {
              const cy = y + L.reloadY * S;
              const icon = L.ICON * S, gap = 6 * S;
              const txt = L.xpTxt || fmtNum(t.xp);
              // 先量宽度（与 text() 用同一字体/字号），才能把菱形排在数值左边
              ctx.font = `${L.W_ALL} ${Math.round(L.FS_RELOAD * S * 100) / 100}px ${CardRenderer.FONT}`;
              const vw = ctx.measureText(txt).width;
              text(txt, rx, cy, L.FS_RELOAD, L.W_ALL, '#ffffff', 'right');
              const dr = icon * 0.5;
              const dcx = rx - vw - gap - dr, dcy = cy - L.FS_RELOAD * S * 0.34;
              ctx.save();
              ctx.translate(dcx, dcy);
              ctx.beginPath();
              ctx.moveTo(0, -dr); ctx.lineTo(dr, 0); ctx.lineTo(0, dr); ctx.lineTo(-dr, 0);
              ctx.closePath();
              ctx.lineJoin = 'round';
              ctx.lineWidth = Math.max(1.2, icon * 0.16);
              ctx.strokeStyle = '#000';
              ctx.stroke();
              ctx.fillStyle = t.rarityColor || '#fff';
              ctx.fill();
              ctx.restore();
            }
        // 冷却（白字）+ 后面紧跟一个表示旋转的静态图标
            if (t.reload > 0) {
              const cy = y + L.reloadY * S;
              const icon = L.ICON * S, gap = 6 * S;
              text(t.reloadText || (fmtNum(t.reload) + 's'), rx - icon - gap, cy,
                L.FS_RELOAD, L.W_ALL, '#ffffff', 'right');
              // 图标：270° 圆环 + 端点箭头（静态，不旋转）
              const icx = rx - icon / 2, icy = cy - L.FS_RELOAD * S * 0.34, rad = icon * 0.42;
              ctx.save();
              ctx.translate(icx, icy);
              ctx.lineCap = 'butt';
              ctx.lineWidth = Math.max(1.2, icon * 0.16);              // 先画黑描边
              ctx.strokeStyle = '#000';
              ctx.beginPath();
              ctx.arc(0, 0, rad, -Math.PI * 0.72, Math.PI * 0.72);      // 270° 弧
              ctx.stroke();
              ctx.lineWidth = Math.max(1, icon * 0.11);                 // 再画白色弧线（半透明底上也清晰）
              ctx.strokeStyle = '#fff';
              ctx.stroke();
              ctx.beginPath();                                          // 箭头（弧的起点方向）
              ctx.moveTo(-rad - rad * 0.12, -rad * 0.58);
              ctx.lineTo(-rad * 0.14, -rad * 1.04);
              ctx.lineTo(-rad * 0.58, 0);
              ctx.closePath();
              ctx.lineWidth = Math.max(1, icon * 0.11);
              ctx.strokeStyle = '#000';
              ctx.stroke();
              ctx.fillStyle = '#fff';
              ctx.fill();
              ctx.restore();
            }
        // 稀有度名（稀有度本色）
        text(t.rarityName, bx, y + L.rarityY * S, L.FS_RAR, L.W_ALL, t.rarityColor);
        // 介绍（上下各空一行；宽度自适应时不会换行）
        for (let i = 0; i < L.lines.length; i++) {
          text(L.lines[i], bx, y + (L.descTop + i * L.LH) * S, L.FS_DESC, L.W_ALL, '#e9f2ec');
        }
        // Health / Damage / Heal：统一排在左下角，标签彩色 + 数值白色（字号与介绍一致）
        // 治疗用专用粉色，不与伤害(红)/生命(绿)共用颜色（与玫瑰回血飘字同色）
        const STAT_COLORS = ['#7fe08a', '#ff6b6b', HEAL_TEXT_COLOR];
        // 生物：Health / Damage / Armor（Armor 用中性灰蓝，避免与治疗的粉色混淆）
        const MOB_STAT_COLORS = ['#7fe08a', '#ff6b6b', '#b8c6d1'];
        const rowColors = t.mob ? MOB_STAT_COLORS : STAT_COLORS;
        // 每行：标签（默认按行序取色，可被 row.labelColor 覆盖）+ 数值（默认白色，
        // 可被 row.valueColor 覆盖，例如 Max Mob Rarity 用被吸引稀有度自己的颜色）。
        // 标签宽度用【与 text() 完全相同的字体】量，数值跟在后面不会压住标签。
        const gapPx = L.STAT_GAP * S;
        for (let i = 0; i < L.rows.length; i++) {
          const row = L.rows[i];
          const size = Math.round(L.FS_STAT * S * 100) / 100;
          ctx.font = `${L.W_ALL} ${size}px ${CardRenderer.FONT}`;
          const lw = ctx.measureText(row.label).width;
          const ty = y + L.statY[i] * S;
          text(row.label, bx, ty, L.FS_STAT, L.W_ALL, row.labelColor || rowColors[i] || '#ffffff');
          text(typeof row.value === 'number' ? fmtNum(row.value) : String(row.value),
            bx + lw + gapPx, ty, L.FS_STAT, L.W_ALL, row.valueColor || '#ffffff');
        }
        // 掉落物：每种花瓣一行（紧接在数值行下方），行内是该花瓣的各掉落稀有度；
        // 卡面 = 与背包卡完全同一条绘制管线（缩放 0.8 倍），概率标在卡面正下方。
        if (L.drops && L.drops.length) {
          const cs = L.CS * S, gap = L.CGAP * S;
          for (let r = 0; r < L.drops.length; r++) {
            const d = L.drops[r];
            const rowY = y + (L.dropTop + r * L.dropRowH) * S;
            for (let i = 0; i < d.items.length; i++) {
              const it = d.items[i];
              const px0 = bx + i * (cs + gap);
              // 卡面：与背包/卡槽【完全同一条绘制管线】（外框、内板、名称文字、留白），
              // 只是整张卡等比缩放到 0.8 倍于背包卡。
              const card = this._dropCard(d.svg, it.rarity, d.name);
              if (card) ctx.drawImage(card, px0, rowY, cs, cs);
              // 概率：卡面正下方居中（与卡面留出空隙，避免压到卡片底边/名称）
              text(fmtChance(it.chance), px0 + cs / 2, rowY + cs + 17 * S,
                17, L.W_ALL, '#ffffff', 'center');
            }
          }
        }
        ctx.restore();
      },

      // 掉落物卡面（离屏渲染 + 缓存）。
      // 与背包卡同一套 CardRenderer 绘制：稀有度外框 + 内板 + 花瓣贴图 + 底部名称文字，
      // 内板/圆角比例也一致（pad 0.0756 / radius 0.0588）；这里只做 4 倍超采样，
      // 绘制时缩到 0.8 × 背包卡尺寸（44.544 → 35.635px）。
      _dropCard(svg, rarity, name) {
        this._dc = this._dc || {};
        const key = svg + '|' + rarity;
        if (this._dc[key]) return this._dc[key];
        const cv = document.createElement('canvas');
        if (typeof CardRenderer.renderCardTo === 'function') {
          CardRenderer.renderCardTo(cv, {
            svg: (svg != null) ? svg : null, name: name || null,
            rarity, px: 144, pad: 0.0756, radius: 0.0588
          });
        }
        this._dc[key] = cv;
        return cv;
      },

    // Enter 聊天热键：非输入态下按 Enter 进入聊天输入态。
    // 注意三点：
    //   ① 输入框自己处理 Enter/Esc（chat.js 内已 stopPropagation），这里只在非输入态生效；
    //   ② 背包/图鉴开着时不抢 Enter，避免与界面冲突；
    //   ③ 同时认 e.code 与 e.key，主键盘/小键盘 Enter 都覆盖。
    _initChatKeys() {
      window.addEventListener('keydown', (e) => {
        if (e.code !== 'Enter' && e.key !== 'Enter') return;
        if (typeof Chat === 'undefined' || Chat.inputMode) return;
        if ((this.isBagVisible && this.isBagVisible()) ||
            (this.isDexVisible && this.isDexVisible())) return;
        e.preventDefault();
        Chat.enter();
      });
    },

    // 悬浮框专用覆盖层：全屏 canvas，0.2s 渐显渐隐，自带 rAF 循环
    _initOverlay() {
      const cv = document.createElement('canvas');
      cv.id = 'uiOverlay';
      document.body.appendChild(cv);
      this.refs.overlay = cv;
          this._tipAlpha = 0;
          this._tipPos = null;      // 悬浮框当前位置（相邻卡之间平移用）
              this._tipLastRect = null; // 锚点最后一次有效矩形：锚点被重建后据此原地渐隐
    this._tipAnchor = null;  // 上一次记录的锚点元素（用于区分"换卡"与"元素移动"）
              this._tipSlide = false;   // 是否处于"卡与卡之间平移"
          this._tipHideAt = 0;      // 上次隐藏时刻（120ms 宽限期内移动到新卡则不淡出）
      const resize = () => {
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        cv.width = Math.round(innerWidth * dpr);
        cv.height = Math.round(innerHeight * dpr);
        cv.style.width = innerWidth + 'px';
        cv.style.height = innerHeight + 'px';
        cv._dpr = dpr;
      };
      resize();
      window.addEventListener('resize', () => {
        resize();
        this._rowsVer++;                 // 尺寸变化：失效卡槽矩形缓存
              CardRenderer.repaintAll();
            });
            // Ubuntu 网络字体就绪后重绘一次（canvas 文字会立刻改用 Ubuntu；离线时自动回退系统字体）
            if (document.fonts && document.fonts.load) {
              Promise.all([
                document.fonts.load('700 26px Ubuntu'),
                document.fonts.load('400 15px Ubuntu'),
                document.fonts.load('700 15px Ubuntu')
              ]).catch(() => {}).then(() => CardRenderer.repaintAll());
            }
      const loop = () => {
        // 小地图动画推进（三档切换 = 0.6s 平滑过渡）
        const now = performance.now();
        const dt = this._mmLast ? Math.min(0.05, (now - this._mmLast) / 1000) : 0.016;
        this._mmLast = now;
        this._mmTick(dt);
        this._reloadTick(dt);   // 主槽装填阴影 + 水缸阴影推进（带平滑）
        if (typeof Chat !== 'undefined') Chat.tick(dt);   // 聊天漂浮态渐隐推进
        const target = this._tipOn && this._tip ? 1 : 0;
        const cur = this._tipAlpha;
        if (cur !== target) {
          // 0.2s 线性渐变（与原 CSS transition .2s 一致）
          const step = 1 / 12 * (target ? 1 : -1);
          this._tipAlpha = (target > cur) ? Math.min(target, cur + step) : Math.max(target, cur + step);
        }
        const ctx = cv.getContext('2d');
        if (this._tipAlpha > 0.01 && this._tip) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, cv.width, cv.height);
          ctx.scale(cv._dpr || 1, cv._dpr || 1);
          this._drawTip(ctx, this._tip, this._tipAlpha);
          this._overlayDirty = true;
        } else if (this._overlayDirty) {
          // 完全透明后只清一次，之后空帧不做任何绘制
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, cv.width, cv.height);
          this._overlayDirty = false;
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },

  // ---------------- 交互：点击 / 拖拽 ----------------
  // 只响应鼠标左键（右键不产生任何卡牌幽灵，清理右键残留）
  _bindCard(el, card, from, onClick) {
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this._beginPointer(card, from, e, onClick, el);
    });
  },
  // 画廊卡「按住前先取走一张」：库存不足直接返回 false，整次交互不产生任何效果
  _canTakeFromGallery(card) {
    if (window.__debug) return true;
    const key = card.type.key + '|' + card.rarity;
    if (!this._gc) this._gc = {};
    if (this._gc[key] === undefined) this._gc[key] = 2;
    return this._gc[key] > 0;
  },

  _beginPointer(card, from, ev, onClick, srcEl) {
    // 库存校验必须在最前面：卡已取完时连点击都不生效，避免"按了却凭空多出一张"
    if (from.type === 'gallery' && !this._canTakeFromGallery(card)) return;
    const startX = ev.clientX, startY = ev.clientY;
    const startTime = ev.timeStamp || performance.now();
    let windowsClosed = false;   // 延迟关闭窗口标志
    let dragging = false;        // 是否已进入拖拽态（已生成幽灵）
    let over = false;            // 本次交互是否已结束
    let movedMax = 0;            // 指针最大位移（判"原位松手"用）

    // 进入拖拽态才生成幽灵：卡片会被放大到 1.3 倍、开始跟随指针，源卡即时隐藏。
    // （点击路径绝不调用它 —— 0.1s 内松手时卡片不放大、不变形、不产生幽灵。）
    const startDrag = (e) => {
      if (dragging || over) return;
      dragging = true;
      this._hideTip();
      this._createGhost(card, e, srcEl);
      // 暂不关闭窗口，等按住时长够再关
      if (from.type === 'gallery') { this._decGallery(card); this.renderInventory(); }
      // 卡槽/物品栏卡：拿起瞬间隐藏源卡，由幽灵从原卡中心无缝接替（不再有残影）
      else if (srcEl && srcEl.isConnected) srcEl.style.visibility = 'hidden';
      // 记住来源：自动对齐【只有背包拖出的卡】才有，卡槽内拖出的统一不吸附
      this._dragFrom = from.type;
    };

    // 0.1s 后仍未松手 -> 升级为拖拽（此时才放大、才产生幽灵）
    const clickTimer = setTimeout(() => startDrag(ev), 100);

    const move = (e) => {
      if (over) return;
      const md = Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY);
      if (md > movedMax) movedMax = md;
      if (!dragging) {
        // 还没到 0.1s，但已经明显移动 -> 也立即升级为拖拽
        if (md <= 6) return;
        clearTimeout(clickTimer);
        startDrag(e);
      }
      const held = (e.timeStamp || performance.now()) - startTime;
      if (held >= 200 && !windowsClosed) {
        // 按住≥0.2s -> 识别为拖拽，立即关闭窗口
        this._closeAllWindows();
        windowsClosed = true;
      }
      this._moveGhost(e);
    };
    const up = (e) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (over) return;
      over = true;
      clearTimeout(clickTimer);
      if (!dragging) {
        // —— 点击（按住 < 0.1s）：无幽灵、无放大、无形态变化 ——
        // 但仍要播「飞入空槽」动画并正常扣数量（这两件事此前被一起弄丢了）。
        this._snap = null; this._snapPos = null; this._snapScale = null;
        this._clickFly(card, from, srcEl, (t) => { if (onClick) onClick(card, t); });
        return;
      }
      // 按住≥0.2s -> 拖拽，窗口已关闭；吸附中的槽位优先作为落点（幽灵已对齐，松手即装）
      // 【原位松手修正】：指针几乎没动（≤6px）说明用户是想"点一下"，只是按住超过了 0.1s。
      // 旧逻辑把它当拖拽取消 -> 幽灵飞向背包按钮（用户看到"飞向背包按钮"）。
      // 正确行为：回滚数量、移除拖拽幽灵，用幽灵当前位置当起点走点击装备路径（飞向空槽）。
      if (from.type === 'gallery' && movedMax <= 6) {
        const ghost = this._drag;
        const gr = ghost ? ghost.getBoundingClientRect() : null;
        this._removeGhost();
        this._incGallery(card);
        this._clickFly(card, from, gr, (t) => { if (onClick) onClick(card, t); });
        return;
      }
      const target = this._snap
        ? { type: this._snap.type, index: this._snap.index, el: this._snap.el }
        : this._dropTargetAt(e.clientX, e.clientY);
      const handled = this.onDrop ? !!this.onDrop({ card, from }, target) : false;
      const ghost = this._drag;
      // 已像素级焊死在卡槽上 -> 无需再飞，直接移除幽灵（renderInvBar 已重建，卡面即刻显示）
      if (handled && target && ghost && ghost._boxLocked) {
        // 幽灵已经和卡槽像素级重合：这里补上"隐藏目标卡 -> 动画结束后再显示 + 放行装填"
        // （正常情况下会走下面的飞行分支；焊死时没有飞行过程，所以立即收尾）
        this._settleDropTarget(target);
        this._removeGhost(ghost);
        return;
      }
      let tx, ty, dur, endScale;
      // 注意判据是 handled && target：拖到空白处松手时，dispatchDrop 对卡槽卡会返回 true
      // （那是"卸下回背包"，并非装入卡槽）。若只判 handled，幽灵会以原尺寸飞向背包按钮、
      // 既不缩小也不渐隐 —— 必须走下面的缩小渐隐分支。
      let dropped = null;
      if (handled && target) {
        // 装入卡槽 -> 飞向该槽（全程清晰不渐隐：到达后卡槽才显示卡面）
        let r = (target.el && target.el.isConnected) ? target.el.getBoundingClientRect() : null;
        if (!r && target.type === 'slot' && this.refs.slotRow.children[target.index]) {
          r = this.refs.slotRow.children[target.index].getBoundingClientRect();
        }
        if (r) { tx = r.left + r.width / 2; ty = r.top + r.height / 2; }
        else { const bag = this.refs.bagBtn.getBoundingClientRect(); tx = bag.left + bag.width / 2; ty = bag.top + bag.height / 2; }
        dur = 0.22;
        // 缩放一律按目标卡槽的"视觉宽度"换算（卡槽带 zoom，视觉宽度并不是 54px）
        endScale = r ? (r.width / GHOST_SIZE) : GHOST_TO_SLOT;
        dropped = target;
        // 数据已经换上来了，但卡要等飞到才显示：先把目标卡的可见性关掉，
        // 并暂停该槽的装填计时（等落到卡槽里才开始结算冷却）。
        this._holdDropTarget(target);
      } else {
        // 取消 / 卸下回背包：缩到最小 + 渐隐，飞向背包按钮
        if (from.type === 'gallery') this._incGallery(card);
        this._restoreAfterCancel(from);
        const bag = this.refs.bagBtn.getBoundingClientRect();
        tx = bag.left + bag.width / 2; ty = bag.top + bag.height / 2;
        dur = 0.5; endScale = 0.05;
      }
      this._flyGhostTo(ghost, tx, ty,
        { dur, endScale, fade: !handled },   // 装入卡槽：全程清晰；取消/回背包：渐隐
        (gh) => {
          if (dropped) this._settleDropTarget(dropped);
          this._removeGhost(gh);
        });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  },

  // 拖拽落入卡槽：先把目标卡藏起来，并暂停该槽装填计时。
  // （数据在 dispatchDrop 时就已经换上来了，若不藏，卡会出现在槽里而幽灵还在半空飞。）
  _holdDropTarget(target) {
    if (!target) return;
    const rowEl = (target.type === 'slot') ? this.refs.slotRow : this.refs.subRow;
    const box = rowEl && rowEl.children[target.index];
    const cv = box && box.querySelector('.card');
    if (cv) { cv.style.visibility = 'hidden'; cv._dropHidden = true; }
    if (target.type === 'slot') this._holdReload(target.index);
  },
  // 飞行结束：显示目标卡、放行装填计时（阴影此刻才开始播放）。
  _settleDropTarget(target) {
    if (!target) return;
    const rowEl = (target.type === 'slot') ? this.refs.slotRow : this.refs.subRow;
    const box = rowEl && rowEl.children[target.index];
    const cv = box && box.querySelector('.card');
    if (cv) { cv.style.visibility = ''; cv._dropHidden = false; }
    if (target.type === 'slot') {
      this._releaseReload(target.index);
      // 强制重绘一次：阴影状态可能在隐藏期间已经变过
      if (cv && cv._card) { cv._rlKey = null; }
    }
  },

  // 取消拖拽后恢复源区域显示（装卡槽失败/回退背包时调用）
  _restoreAfterCancel(from) {
    const g = window.__game;
    // 统一处理：任何源都重新渲染对应区域，不区别对待
    if (from.type === 'slot' || from.type === 'inv' || from.type === 'subslot') {
      if (g) this.renderInvBar(g.player);
    } else if (from.type === 'gallery') {
      this.renderInventory();
    }
  },

  // 拖拽开始：关闭所有小窗口（背包/图鉴）
  _closeAllWindows() {
    if (this.onCloseAll) this.onCloseAll();
    else { this.refs.inv.classList.add('hidden'); this.refs.dex.classList.add('hidden'); }
  },

  // 放下后的平滑动画：位置 / 尺寸 / 透明度一起补间（装卡槽快速变小；回退背包缩小渐隐）
  // 走通用播放器：落点用「中心点 + 视觉尺寸」精确计算，到位即严格同心，不会残留斜角。
  _flyGhostTo(ghost, toX, toY, opts, done) {
    if (!ghost) { if (done) done(); return; }
    const o = opts || {};
    const dur = (o.dur != null) ? o.dur : 0.22;
    const endScale = (o.endScale != null) ? o.endScale : GHOST_TO_SLOT;
    // 交还给动画前先停掉 JS 跟踪循环与可能正在跑的吸附过渡
    this._stopDragLoop();
    this._dragTarget = null;
    Anim.stop(ghost);
    ghost._snapAnim = false;
    // 起点必须是幽灵「当前的真实视觉矩形」：拿起时被放大到 1.3 倍、吸附时缩到卡槽尺寸，
    // 只有照此起步，缩小 / 放大 / 渐隐这些细节才是平滑过渡过去的。
    // （早先硬编码 GHOST_SIZE 会瞬间跳一级，动画细节就全丢了。）
    const cur = ghost.getBoundingClientRect();
    const fromW = cur.width > 0 ? cur.width : GHOST_SIZE;
    const fromX = cur.left + cur.width / 2, fromY = cur.top + cur.height / 2;
    // 还原被"焊死"的盒子（否则宽度基准还是卡槽那套，缩放会算错）
    if (ghost._boxLocked) this._unlockGhostBox(ghost);
    ghost.style.width = GHOST_SIZE + 'px';
    ghost.style.height = GHOST_SIZE + 'px';
    ghost._boxW = GHOST_SIZE;
    ghost.style.transition = 'none';
    const fade = (o.fade !== false);
    Anim.play(ghost, {
      base: GHOST_SIZE,
      from: { x: fromX, y: fromY, w: fromW, h: fromW, a: 1 },
      to: { x: toX, y: toY, w: GHOST_SIZE * endScale, h: GHOST_SIZE * endScale, a: fade ? 0 : 1 },
      dur, ease: Anim.ease.out,
      onDone: (el) => { if (done) done(el); }
    });
  },

  // 点击（按住 < 0.1s）行为：不产生幽灵、不放大、不变形。
  //   背包画廊卡 -> 扣数量 + 播飞入动画 + 装入第一个空卡槽（主槽优先从左到右，满则副槽）；全满则原路飞回
  //   主槽 / 副槽卡 -> 同列互换，动画由 swapSlotColumn -> animateRowSwap 唯一播放一次
  _clickFly(card, from, srcElOrRect, done) {
    const g = window.__game;
    if (from.type !== 'gallery' && from.type !== 'inv') {
      if (done) done();          // 卡槽卡：交给同列互换动画
      return;
    }
    // 【必须最先做】先把源卡的矩形量下来。
    // 下面 renderInventory() 会重建整个画廊，srcEl 随即被摘掉；此时再取
    // getBoundingClientRect() 只会得到全 0（left/top/width/height 都是 0），
    // 于是飞行动画的起点变成 (0,0) —— 也就是屏幕左上角。这正是"没有从对应位置飞出"的根因。
    // 也接受调用方已量好的矩形（拖拽原位松手转点击时，源元素早已被重建）。
    const sr = (srcElOrRect && srcElOrRect.getBoundingClientRect)
      ? srcElOrRect.getBoundingClientRect()
      : (srcElOrRect && srcElOrRect.width > 0 ? srcElOrRect : null);
    const hasSrc = !!(sr && sr.width > 0 && sr.height > 0);
    // 数量在「点击」时就要扣掉（与拖拽路径一致），否则点击不计数
    if (from.type === 'gallery') { this._decGallery(card); this.renderInventory(); }
    const t = g ? g.firstEmptyAny() : null;    // 空槽计算含副槽：主槽优先、从左到右
    const bagPos = () => {
      const b = this.refs.bagBtn.getBoundingClientRect();
      return [b.left + b.width / 2, b.top + b.height / 2];
    };
    if (!t) {
      // 全部卡槽已满：恢复数量，原路飞回背包按钮（缩小 + 渐隐），不装备
      if (from.type === 'gallery') { this._incGallery(card); this.renderInventory(); }
      const [bx, by] = bagPos();
      this._flyElFrom(sr, card, bx, by, 54 * 0.05, { dur: 0.5, fade: true });
      return;
    }
    const rowEl = (t.row === 'slot') ? this.refs.slotRow : this.refs.subRow;
    const slot = rowEl.children[t.index] || rowEl.children[0];
    const rect = slot ? slot.getBoundingClientRect()
      : { left: innerWidth / 2 - 26, top: innerHeight - 60, width: 52, height: 52 };
    // 关键：把「已确定的目标」随回调一起传下去，避免 done() 里重新检索空槽，
    // 导致"动画飞向 A 槽、卡却装进 B 槽"（槽位数不为 5 时更容易暴露）。
    this._flyElFrom(sr, card, rect.left + rect.width / 2, rect.top + rect.height / 2,
      rect.width, { dur: 0.22, fade: false }, () => { if (done) done(t); });
  },

  // 生成一张「纯飞行」的卡（不参与拖拽、不放大、不摇晃），从 srcRect 飞往目标点。
  // srcRect 必须是【调用方预先量好的】矩形（不能传元素：画廊重建后元素已脱离文档，量出来全是 0）。
  // 起点尺寸取源卡真实视觉尺寸 -> 点击路径下卡片完全不变形；目标尺寸由调用方给出（槽宽 / 5%）。
  _flyElFrom(srcRect, card, toX, toY, toW, opts, done) {
    const fly = this._ghostEl(card);
    fly.style.transition = 'none';
    document.body.appendChild(fly);
    const base = fly.offsetWidth || 54;
    const has = !!(srcRect && srcRect.width > 0 && srcRect.height > 0);
    const o = opts || {};
    const dur = (o.dur != null) ? o.dur : 0.22;
    const fade = (o.fade !== false);
    const fromW = has ? srcRect.width : base;
    const fx = has ? srcRect.left + srcRect.width / 2 : toX;
    const fy = has ? srcRect.top + srcRect.height / 2 : toY;
    // 先按起点摆好（否则第一帧前元素会停在"静态位置"，看起来像从页面左上角闪一下）
    fly.style.transformOrigin = '0 0';
    fly.style.left = (fx - fromW / 2) + 'px';
    fly.style.top = (fy - fromW / 2) + 'px';
    fly.style.transform = 'scale(' + (fromW / base).toFixed(4) + ')';
    if (!fade) fly.style.opacity = '1';
    Anim.play(fly, {
      base,
      from: { x: fx, y: fy, w: fromW, h: fromW, a: 1 },
      to: { x: toX, y: toY, w: toW, h: toW, a: fade ? 0 : 1 },
      dur, ease: Anim.ease.out,
      onDone: (el) => { el.remove(); if (done) done(); }
    });
  },

  // 被替换下来的卡：从卡槽位置播放「飞回背包」动画（独立幽灵，不影响正在拖拽的卡）
  // row = 'sub' 时从副槽同列格起飞
  flySlotCardToBag(slotIndex, card, row) {
    const bag = this.refs.bagBtn.getBoundingClientRect();
    const tx = bag.left + bag.width / 2, ty = bag.top + bag.height / 2;
    const srcRow = (row === 'sub' && this.refs.subRow) ? this.refs.subRow : this.refs.slotRow;
    const slot = srcRow.children[slotIndex];
    const r = slot ? slot.getBoundingClientRect() : { left: tx, top: ty, width: 54, height: 54 };
    const g = this._ghostEl(card);
    g.style.transition = 'none';
    document.body.appendChild(g);
    const base = g.offsetWidth || 54;
    Anim.play(g, {
      base,
      from: { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, a: 1 },
      to: { x: tx, y: ty, w: base * 0.05, h: base * 0.05, a: 0 },
      dur: 0.5, ease: Anim.ease.inOut,
      onDone: (el) => el.remove()
    });
  },

  _flyCard(fromEl, toX, toY, card, cb) {
    const r = fromEl.getBoundingClientRect();
    const g = this._ghostEl(card);
    g.style.left = (r.left + r.width / 2) + 'px';
    g.style.top = (r.top + r.height / 2) + 'px';
    g.style.transition = 'none';
    document.body.appendChild(g);
    requestAnimationFrame(() => {
      g.style.transition = 'transform .26s ease, opacity .26s ease';
      const dx = toX - (r.left + r.width / 2), dy = toY - (r.top + r.height / 2);
      g.style.transform = `translate(${dx}px,${dy}px) scale(.55)`;
      g.style.opacity = '0.15';
    });
    setTimeout(() => { g.remove(); if (cb) cb(); }, 270);
  },

  _ghostEl(card) {
    const g = document.createElement('div');
    g.className = 'flyghost';
    g.appendChild(CardRenderer.createCard({ rarity: card.rarity, svg: card.type.svg }));   // 100% 填满容器：拖拽=1.3×，飞入=1×
    return g;
  },
  // 拿起：幽灵从「源卡牌位置」长出来并放大（0.2s），位置由跟踪循环每帧逼近指针
  _createGhost(card, e, srcEl) {
    // 防御：上一次交互的幽灵还挂着（快速连点时飞行动画未结束）-> 立即清掉，绝不叠加；
    // 待触发的完成回调仍会照常执行（其 _removeGhost 只会移除它自己的幽灵）
    if (this._drag) { this._drag.remove(); this._drag = null; }
    this._snap = null; this._snapPos = null; this._snapScale = null; this._dragShown = null;
    const g = this._ghostEl(card);
    g.id = 'dragGhost';
    g.classList.add('dragging');
    // 起点 = 源卡牌中心，终点 = 指针位置（缩放 1 -> 1.3）
    let x = e.clientX, y = e.clientY;
    const r = (srcEl && srcEl.getBoundingClientRect) ? srcEl.getBoundingClientRect() : null;
    if (r && r.width > 0) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
    g.style.transition = 'none';          // 位置完全交给 JS 跟踪，绝不再让 CSS transition 拖后腿
    g.style.left = x + 'px';
    g.style.top = y + 'px';
    g.style.transform = 'translate(-50%,-50%) scale(1)';
    document.body.appendChild(g);
    this._drag = g;
    this._dragCur = { x: x, y: y };
    this._dragTarget = { x: e.clientX, y: e.clientY };
    this._dragStart = performance.now();
    this._dragLast = 0;
    this._startDragLoop();
  },
  // 跟踪算法：mousemove 只更新"目标点"，实际位置在 rAF 里按指数逼近（帧率无关）。
  // 好处：① 事件合并/丢帧时目标始终是最新指针位置，不会越拖越偏；
  //      ② 没有 CSS transition 参与，快速甩动时不会出现橡皮筋式的滞后。
  _startDragLoop() {
    if (this._dragRaf) return;
    const step = (ts) => {
      const g = this._drag;
      if (!g || !this._dragTarget) { this._dragRaf = 0; return; }
      const dt = Math.min(0.05, this._dragLast ? (ts - this._dragLast) / 1000 : 0.016);
      this._dragLast = ts;
      const cur = this._dragCur;
      const a = 1 - Math.exp(-DRAG_FOLLOW * dt);
      cur.x += (this._dragTarget.x - cur.x) * a;
      cur.y += (this._dragTarget.y - cur.y) * a;
      // 差距极小时直接吸附到目标，避免残留 0.01px 的漂移抖动
      if (Math.abs(this._dragTarget.x - cur.x) < 0.3) cur.x = this._dragTarget.x;
      if (Math.abs(this._dragTarget.y - cur.y) < 0.3) cur.y = this._dragTarget.y;
      // 拿起时 0.2s 内由 1 倍放大到 1.3 倍（与位置跟踪互不干扰）
      const k = 1 + 0.3 * Math.min(1, (ts - this._dragStart) / DRAG_PICK_MS);
      // 自动对齐【仅背包拖出的卡】才有；卡槽内拖出的卡统一不吸附（落点仍按 ≥50% 覆盖判定）
      // 判定尺寸用幽灵"当前实际缩放"（未吸附=拿起后的 1.3，吸附中=当前缩放），与视觉严格一致
      const scTest = this._snap ? this._snapScale : k;
      const snap = (this._dragFrom === 'gallery') ? this._snapTargetAt(cur.x, cur.y, scTest) : null;
      let sx = cur.x, sy = cur.y, sc = k;
      if (snap) {
        if (!this._snap) g.classList.remove('dragging');      // 吸附即停晃动（装好的感觉）
        // 目标变化（含第一次吸附）-> 用播放器从「当前视觉矩形」平滑过渡到新卡槽矩形。
        // 切换对齐格子也因此有平滑的平移 + 缩放，不再是瞬移/直接跳过去。
        if (!this._snap || this._snap.el !== snap.el) {
          this._snap = snap;
          this._snapTo(g, snap.el);
        }
      } else if (this._snap) {
        g.classList.add('dragging');                          // 离开卡槽：恢复跟随晃动
        this._snap = null; this._snapPos = null; this._snapScale = null;
        this._unsnap(g);
      }
      // 吸附中（过渡动画播放中 / 已焊死）：位置与尺寸都交给动画，循环不再插手
      if (this._snap) { this._dragRaf = requestAnimationFrame(step); return; }
      this._dragShown = { x: sx, y: sy };
      const bw = g._boxW || GHOST_SIZE;                       // 盒子宽度（焊死时会是卡槽宽度）
      g.style.left = sx + 'px';
      g.style.top = sy + 'px';
      // 目标视觉尺寸 = GHOST_SIZE × sc；按盒子实际宽度换算 scale，避免焊死/还原时跳一级
      g.style.transform = `translate(-50%,-50%) scale(${(sc * GHOST_SIZE / bw).toFixed(3)})`;
      this._dragRaf = requestAnimationFrame(step);
    };
    this._dragRaf = requestAnimationFrame(step);
  },
  // 把幽灵盒子"焊死"到卡槽矩形：与卡槽共用同一组小数 left/top/width/height 且 transform:none，
  // 卡面 canvas 经 ResizeObserver 同步重绘 -> 像素级完全对准（修掉右下 1~2px 偏移）
  _lockGhostBox(g, el) {
    if (!g) return;
    if (g._boxLockedEl && g._boxLockedEl !== el) this._unlockGhostBox(g);   // 换目标：先还原再焊到新槽
    if (g._boxLocked) return;
    const s = this._slotRects().find((it) => it.el === el);
    const r = s ? s.r : el.getBoundingClientRect();
    g.style.transition = 'none';
    g.style.width = r.width + 'px';
    g.style.height = r.height + 'px';
    g.style.left = r.left + 'px';
    g.style.top = r.top + 'px';
    g.style.transform = 'none';
    g._boxLocked = true;
    g._boxLockedEl = el;
    g._boxW = r.width;
    this._snapPos = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    this._snapScale = r.width / GHOST_SIZE;
  },
  // 离开卡槽：还原为跟随指针的标准幽灵（50.54px + translate(-50%,-50%)）
  _unlockGhostBox(g) {
    if (!g || !g._boxLocked) return;
    g._boxLocked = false;
    g._boxLockedEl = null;
    g._boxW = GHOST_SIZE;
    // 先把 left/top 同步到"当前视觉中心"再改尺寸/变换，否则幽灵会瞬间跳到旧卡槽左上角
    const r = g.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    g.style.transition = 'none';
    g.style.width = GHOST_SIZE + 'px';
    g.style.height = GHOST_SIZE + 'px';
    g.style.left = cx + 'px';
    g.style.top = cy + 'px';
    g.style.transform = 'translate(-50%,-50%) scale(1)';
    if (this._dragCur) { this._dragCur.x = cx; this._dragCur.y = cy; }
    if (this._snapPos) { this._snapPos.x = cx; this._snapPos.y = cy; }
  },
  // 吸附到指定卡槽：用通用播放器从「当前视觉矩形」平滑过渡到卡槽矩形，到位后再焊死。
  // 第一次吸附与切换对齐目标都走这里 —— 两者都有平滑的平移 + 缩放。
  _snapTo(g, el) {
    const s = this._slotRects().find((it) => it.el === el);
    if (!s) return;
    const r = s.r;
    const cur = g.getBoundingClientRect();
    if (!(cur.width > 0)) return;
    this._snapScale = r.width / GHOST_SIZE;
    g._snapAnim = true;
    Anim.stop(g);
    Anim.play(g, {
      base: g._boxW || GHOST_SIZE,
      from: { x: cur.left + cur.width / 2, y: cur.top + cur.height / 2, w: cur.width, h: cur.width },
      to: { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.width },
      dur: 0.18, ease: Anim.ease.out,
      onDone: (el2) => {
        el2._snapAnim = false;
        // 只有仍在拖拽中才焊死（若已松手，_flyGhostTo 会接管）
        if (this._drag === el2) this._lockGhostBox(el2, el);
      }
    });
  },
  // 脱离吸附：停掉过渡动画、还原盒子，并让指针跟踪从幽灵当前位置接续（避免瞬移回指针处）
  _unsnap(g) {
    Anim.stop(g);
    g._snapAnim = false;
    if (g._boxLocked) this._unlockGhostBox(g);
    const r = g.getBoundingClientRect();
    if (r.width > 0 && this._dragCur) {
      this._dragCur.x = r.left + r.width / 2;
      this._dragCur.y = r.top + r.height / 2;
    }
  },

  // 卡槽矩形缓存：拖拽中每帧都要做命中判定，反复 getBoundingClientRect() 会强制布局 -> 卡顿。
  // 只在 renderInvBar 重建行、或窗口尺寸变化时重新测量。
  // 注意：缓存属性名不能与方法同名（_slotRectList ≠ _slotRects），否则方法会被数组覆盖。
  _slotRects() {
    if (this._slotRectsVer === this._rowsVer && this._slotRectList) return this._slotRectList;
    const list = [];
    document.querySelectorAll('#quickbar .qslot').forEach((d) => {
      const vis = d.querySelector('.qinner') || d;   // 视觉矩形（副槽被 scale 缩小）
      const r = vis.getBoundingClientRect();
      if (r.width && r.height) {
        list.push({ el: d, type: d.dataset.drop, index: parseInt(d.dataset.idx, 10), r });
      }
    });
    this._slotRectList = list;
    this._slotRectsVer = this._rowsVer;
    return list;
  },
  // 吸附判定：用幽灵"当前实际显示尺寸"（GHOST_SIZE × 缩放）做命中，而不是拿起时的 1.3 倍。
  // 之前用大盒子判定：主槽间距小会同时压住多个槽、目标反复横跳（表面已对齐、底层还按大盒子算），
  // 这正是"拖拽与自动对齐卡顿、主槽尤其明显"的来源。
  _snapTargetAt(x, y, sc) {
    const gw = GHOST_SIZE * sc, gh = GHOST_SIZE * sc;
    const need = gw * gh * 0.30;
    let best = null, bestArea = 0;
    for (const s of this._slotRects()) {
      const r = s.r;
      const ix = Math.max(0, Math.min(x + gw / 2, r.right) - Math.max(x - gw / 2, r.left));
      const iy = Math.max(0, Math.min(y + gh / 2, r.bottom) - Math.max(y - gh / 2, r.top));
      const area = ix * iy;
      if (area > bestArea) { bestArea = area; best = s; }
    }
    if (!best || bestArea < need) return null;
    return {
      el: best.el,
      type: best.type,                    // 'slot' | 'subslot'
      index: best.index,
      cx: best.r.left + best.r.width / 2,
      cy: best.r.top + best.r.height / 2,
      scale: best.r.width / GHOST_SIZE    // 与该槽完全对齐所需缩放
    };
  },
  _stopDragLoop() {
    if (this._dragRaf) { cancelAnimationFrame(this._dragRaf); this._dragRaf = 0; }
  },
  _moveGhost(e) {
    if (!this._drag || !this._dragTarget) return;
    this._dragTarget.x = e.clientX;      // 只更新目标点，由 rAF 循环去追
    this._dragTarget.y = e.clientY;
  },
  _removeGhost(g) {
    const ghost = g || this._drag;
    // 传入了具体幽灵且不是当前拖拽幽灵 -> 只移除它自身（快速连点时旧飞行动画
    // 的定时器不能误删新幽灵，否则新幽灵会变成永远晃动的孤儿）
    if (ghost && ghost !== this._drag) { Anim.stop(ghost); ghost.remove(); return; }
    if (this._drag) Anim.stop(this._drag);   // 停掉可能还在跑的飞行/吸附动画
    this._stopDragLoop();
    this._dragTarget = null; this._dragCur = null; this._dragShown = null;
    this._snap = null; this._snapPos = null; this._snapScale = null;
    if (this._drag) { this._drag.remove(); this._drag = null; }
  },

  // 判定落点：直接用各 [data-drop] 元素的矩形做几何命中（不依赖 elementFromPoint，
  // 避免被覆盖层/正在滑出的窗口/canvas 命中差异干扰），且拖拽卡(1.3×)覆盖该槽面积 ≥ 50% 才算"装入"
  _dropTargetAt(x, y) {
    const ghost = this._drag;
    const gw = ghost ? ghost.offsetWidth : 54, gh = ghost ? ghost.offsetHeight : 54;
    const need = gw * gh * 0.5;
    let best = null, bestArea = 0;
    const nodes = document.querySelectorAll('[data-drop]');
    for (const d of nodes) {
      const r = d.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const ix = Math.max(0, Math.min(x + gw / 2, r.right) - Math.max(x - gw / 2, r.left));
      const iy = Math.max(0, Math.min(y + gh / 2, r.bottom) - Math.max(y - gh / 2, r.top));
      const area = ix * iy;
      if (area > bestArea) { bestArea = area; best = d; }
    }
    if (best && bestArea >= need) {
      return { type: best.dataset.drop, index: parseInt(best.dataset.idx, 10), el: best };
    }
    return null;   // 覆盖不足 50% 或未命中任何卡槽 -> 不装入，回退背包
  },

  // ---------------- 小地图：三档模式 + 平滑切换 ----------------
  // 0 小（局部）：直径 = 0.5×原(160)；"一个瓦片 = 0.5×直径"（即直径跨 2 个瓦片）；
  //               以人物白点为中心，贴边时自动偏移，不显示边界外内容。
  // 1 中（全图）：直径 = 1.2×原；全图 + 人物绝对位置白点。[M] 第一下；小档悬浮临时进入。
  // 2 大（全图）：屏幕居中、0.6 半透明、直径 = 0.6×屏高；圆点等比放大。[M] 第二下。
  // 再按 [M] 回到小档。大小与内容的切换都是 0.6s 同步平滑过渡。
  _mmInit() {
    this._mmMode = 0;
    this._mmHover = false;
    this._mmEase = 0;                                   // 0=局部视角 1=全图视角（切换时插值）
    const W0 = window.innerWidth, s0 = 160 * 0.5;
    this._mm = { size: s0, span: GARDEN_TILE * 6, x: W0 - s0 - 12, y: 12, alpha: 1, cx: 0, cy: 0 };
    this._mmTo = null; this._mmFrom = null; this._mmT = 1;
    this._mmKey = [s0, GARDEN_TILE * 6, W0 - s0 - 12, 12, 1, 0].join('|');
    this._mmLast = 0;
    // 地图名：样式与副槽 [1][2] 相同（Ubuntu 800 + 黑描边），始终居中在小地图正下方
    const nm = document.createElement('div');
    nm.id = 'mmName';
    nm.textContent = I18N.t('Maps/garden/Name', 'Garden');
    document.body.appendChild(nm);
    this.refs.mmName = nm;
    // 悬浮进入二档：用「移动命中」而不是 mouseenter。
    // 原因：从大档按 M 缩回小档时，指针本来就在小地图那片区域，把热区的 pointer-events
    // 从 none 改回 auto 并不会补发 mouseenter —— 残留的 _mmHover 会立刻再把小档顶成二档，
    // 于是表现为"最大档按一下只回到中档，小档永远切不回去"。改成每帧按矩形判定即可。
    // 命中区域 = 二档地图的矩形（与一档同锚点、尺寸更大）。
    window.addEventListener('mousemove', (e) => {
      if (this._mmMode !== 0) { this._mmHover = false; return; }
      const size = 160 * 1.2;
      const left = window.innerWidth - size - 12, top = 12;
      this._mmHover = e.clientX >= left - 4 && e.clientX <= left + size + 4
                   && e.clientY >= top - 4 && e.clientY <= top + size + 4;
    });
    // 预热位图（中档 + 全图/局部兜底）：避免第一次按 M 时现场构建整张地图造成延迟
    setTimeout(() => {
      const g = window.__game;
      if (!g || !g.map || typeof g.map.minimapCanvas !== 'function') return;
      try {
        g.map.minimapCanvas(this._mmFullPx());
        g.map.minimapCanvas(this._mmBmpPx(160 * 1.2));
      } catch (e) { /* 忽略：预热失败只影响首次切换 */ }
    }, 800);
  },
  cycleMinimapMode() {
    this._mmMode = (this._mmMode + 1) % 3;
    // 必须无条件清掉悬浮标记：否则从大档回到小档的瞬间，指针仍在小地图上，
    // mouseenter 早已触发过、不会再发一次，_mmHover 残留为 true 会立刻又把小档顶成中档
    // （表现为"最大档按一下只回到中档，再按又去最大档"，小档永远切不回去）。
    this._mmHover = false;
  },
  // 每帧推进小地图动画（由 overlay 的 rAF 循环驱动）
  _mmTick(dt) {
    const g = window.__game;
    const player = g && g.player, map = g && g.map;
    if (!player || !map) return;
    const half = map.R || (map.width * (map.tile || 1)) / 2;
    if (!(half > 0)) return;
    const W = window.innerWidth, H = window.innerHeight;
    const tile = map.tile || GARDEN_TILE;
    const eff = (this._mmMode === 0 && this._mmHover) ? 1 : this._mmMode;
    // full = 「显示全图」的视角（视图回到地图中心，白点用绝对位置）；centered = 「屏幕居中」的位置。
    // 这两个必须分开：中档是全图视角但仍在右上角。早先混用一个标志，导致中档的视角中心
    // 也跟着变成"跟随人物"——于是二档地图像小档一样跟着人走，白点始终停在出生点位置。
    let size, span, alpha, centered, full;
    if (eff === 2) { size = H * 0.6; span = 2 * half; alpha = 0.8; centered = true; full = true; }
    else if (eff === 1) { size = 160 * 1.2; span = 2 * half; alpha = 1; centered = false; full = true; }
    else { size = 160 * 0.5; span = tile * 6; alpha = 1; centered = false; full = false; }
    const tx = centered ? (W - size) / 2 : (W - size - 12);
    const ty = centered ? (H - size) / 2 : 12;
    const key = [size, span, tx, ty, alpha, full ? 1 : 0].join('|');
    if (key !== this._mmKey) {                 // 目标变化 -> 起一段 0.6s 过渡
      this._mmKey = key;
      this._mmFrom = { size: this._mm.size, span: this._mm.span, x: this._mm.x, y: this._mm.y, alpha: this._mm.alpha, e: this._mmEase };
      this._mmTo = { size, span, x: tx, y: ty, alpha, e: full ? 1 : 0 };
      this._mmT = 0;
    }
    if (this._mmTo) {
      this._mmT = Math.min(1, this._mmT + dt / 0.6);
      const t = this._mmT;
      const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // easeInOutQuad
      const f = this._mmFrom, to = this._mmTo;
      this._mm.size = f.size + (to.size - f.size) * k;
      this._mm.span = f.span + (to.span - f.span) * k;
      this._mm.x = f.x + (to.x - f.x) * k;
      this._mm.y = f.y + (to.y - f.y) * k;
      this._mm.alpha = f.alpha + (to.alpha - f.alpha) * k;
      this._mmEase = f.e + (to.e - f.e) * k;
      if (this._mmT >= 1) this._mmTo = null;
    }
    // 视图中心：小档跟随人物；全图档回到地图中心；按过渡进度混合
    const wcx = player.x * (1 - this._mmEase), wcy = player.y * (1 - this._mmEase);
    const a = Math.min(1, dt * 16);
    this._mm.cx += (wcx - this._mm.cx) * a;
    this._mm.cy += (wcy - this._mm.cy) * a;
    // 同步地图名位置（地图名始终居中在小地图正下方，随动画平滑跟随）
    const nm = this.refs.mmName;
    if (nm) {
      nm.style.left = (this._mm.x + this._mm.size / 2) + 'px';
      nm.style.top = (this._mm.y + this._mm.size + 6) + 'px';
    }
  },

  // 位图请求尺寸：按"显示尺寸 × dpr"取整到 48 的倍数。
  // 取整后动画期间只会出现寥寥几个值（每个只构建一次并永久缓存），
  // 既保证接近 1:1 的清晰度，又不会每帧重建整张地图位图（那正是按 M 卡顿的主因）。
  _mmBmpPx(S) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    return Math.max(96, Math.ceil((S * dpr) / 48) * 48);
  },
  // 全图位图的固定分辨率（= 大档直径 × dpr）：与"当前动画尺寸"无关，
  // 因此过渡期间不会触发新的位图构建（按 M 卡顿的根源）；启动时预热，切档零等待。
  _mmFullPx() {
    if (this._mmFullPxV && this._mmFullH === window.innerHeight) return this._mmFullPxV;
    this._mmFullPxV = this._mmBmpPx(window.innerHeight * 0.6);
    this._mmFullH = window.innerHeight;
    return this._mmFullPxV;
  },

  // 用 solidQuad（四分之一格碰撞栅格）实时绘制视野内的碰撞体，返回画出的格子数。
  // 这是局部小地图的主渲染路径：数据源与角色碰撞完全一致，绝无"画不出来"的情况。
  _mmDrawQuad(ctx, map, vx, vy, span, x0, y0, S, color) {
    const SQ = map.solidQuad, FW = map.FW, FH = map.FH, half = map.R;
    if (!SQ || !FW || !FH || !(half > 0) || !(span > 0)) return 0;
    const q = (2 * half) / FW;                        // 每个四分之一格对应的世界尺寸
    const cell = S / (span / q);                      // 映射到小地图后的像素边长
    const gx0 = Math.max(0, Math.floor((vx + half) / q));
    const gy0 = Math.max(0, Math.floor((vy + half) / q));
    const gx1 = Math.min(FW - 1, Math.ceil((vx + span + half) / q));
    const gy1 = Math.min(FH - 1, Math.ceil((vy + span + half) / q));
    if (gx1 < gx0 || gy1 < gy0) return 0;
    ctx.fillStyle = color;
    let n = 0;
    for (let gy = gy0; gy <= gy1; gy++) {
      const py = y0 + (gy * q - (vy + half)) / span * S;
      for (let gx = gx0; gx <= gx1; gx++) {
        if (SQ[gy * FW + gx] !== 1) continue;
        ctx.fillRect(x0 + (gx * q - (vx + half)) / span * S, py, cell + 0.5, cell + 0.5);
        n++;
      }
    }
    return n;
  },

  // 画在游戏主画布上（位置/尺寸/缩放均由 _mmTick 动画驱动）
  drawMinimap(ctx, viewW, viewH, map, player, mobs, tp) {
    const half = map.R || (map.width * (map.tile || 1)) / 2;
    const m = this._mm;
    if (!(half > 0) || !m || !(m.size > 0)) return;
    const S = m.size, x0 = m.x, y0 = m.y;
    const span = Math.max(1, m.span);
    const tileNow = map.tile || GARDEN_TILE;
    // 局部模式：视野中心直接取「人物当前坐标」（不经动画插值）—— 保证小档永远跟着人物。
    const local = (span <= 7 * tileNow) && typeof map.drawCollisionRegion === 'function';
    // 局部档：视图随人物移动，但【夹紧在地图范围内】—— 贴边时环境停住、人物小点在框内继续移动，
    // 绝不显示地图之外的内容（与主屏幕相机的行为一致）。span < 2*half，所以区间恒有效。
    let vx = (local ? player.x : m.cx) - span / 2;
    let vy = (local ? player.y : m.cy) - span / 2;
    if (local) {
      vx = clamp(vx, -half, half - span);
      vy = clamp(vy, -half, half - span);
    }

    ctx.save();
    ctx.globalAlpha = m.alpha;
    // 取消描边：只做「略微圆角」的内容裁剪（原来是深色实心外框，现已移除）
    const rad = Math.max(3, S * 0.09);
    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, x0, y0, S, S, rad);
    ctx.clip();

    ctx.fillStyle = '#d7ddcf';
    ctx.fillRect(x0, y0, S, S);

    // 地形：一律使用「精确碰撞多边形」数据（collisionTiles），不再用会把边界撑胖一圈的
    //       solidQuad 四分之一格近似。
    //   · 局部档 -> 实时矢量绘制（只遍历视野内那几个瓦片，任意缩放/dpr 都锐利）
    //   · 全图档 -> 预渲染位图（同样由精确多边形栅格化而来；尺寸按档位固定 -> 不卡）
    //   只有精确数据完全不可用时，才最后退回 solidQuad 近似。
    let drew = 0;
    if (local) {
      ctx.save();
      ctx.translate(x0, y0);
      drew = map.drawCollisionRegion(ctx, { x0: vx, y0: vy, size: span }, S / span, '#11130f');
      ctx.restore();
    }
    if (!local || drew === 0) {
      const px = local ? this._mmFullPx() : this._mmBmpPx(this._mmTo ? this._mmTo.size : S);
      const bmp = (typeof map.minimapCanvas === 'function') ? map.minimapCanvas(px) : null;
      if (bmp) {
        // blit 位图里对应视图的那一块；夹紧在边界内 -> 不显示地图外内容
        const k = bmp.width / (2 * half);
        const sw = Math.min(span * k, bmp.width), sh = Math.min(span * k, bmp.width);
        const sx = clamp((vx + half) * k, 0, bmp.width - sw);
        const sy = clamp((vy + half) * k, 0, bmp.width - sh);
        ctx.drawImage(bmp, sx, sy, sw, sh, x0, y0, S, S);
      } else {
        drew = this._mmDrawQuad(ctx, map, vx, vy, span, x0, y0, S, '#11130f');
      }
    }
    if (!this._mmDiag) {   // 一次性诊断：万一还有问题，控制台会直接给出原因
      this._mmDiag = true;
      console.info('[minimap] local=%s span=%s S=%s polyHit=%s tile=%s',
        local, span, S, drew, tileNow);
    }

    // 生物点 / 玩家白点（同样受上面的裁剪保护，贴边时不会溢出框外）
    const dotR = Math.max(2.2, S * 0.0125);        // 圆点随直径等比缩放（大档明显更大）
    if (mobs && mobs.length) {
      ctx.fillStyle = '#ff6b6b';
      for (const mb of mobs) {
        if (mb.dead) continue;
        const mx = x0 + (mb.x - vx) / span * S, my = y0 + (mb.y - vy) / span * S;
        if (mx < x0 - dotR || mx > x0 + S + dotR || my < y0 - dotR || my > y0 + S + dotR) continue;
        ctx.beginPath(); ctx.arc(mx, my, Math.max(1.1, dotR * 0.62), 0, TAU); ctx.fill();
      }
    }
    // /tp 目标红点：在小地图视野内 -> 实心红点；在视野外 -> 贴边画空心环（不会"看不见"）
    if (tp) {
      let tmx = x0 + (tp.x - vx) / span * S;
      let tmy = y0 + (tp.y - vy) / span * S;
      const inView = tmx >= x0 && tmx <= x0 + S && tmy >= y0 && tmy <= y0 + S;
      const pad = dotR * 1.8;
      tmx = clamp(tmx, x0 + pad, x0 + S - pad);
      tmy = clamp(tmy, y0 + pad, y0 + S - pad);
      if (inView) {
        // 与外圈白色底环错开：生物点是浅红小点，这里是"白色光圈 + 纯红实心 + 黑描边"，
        // 一眼就能从一堆红点里认出来。
        ctx.beginPath();
        ctx.arc(tmx, tmy, dotR * 2.1, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tmx, tmy, dotR * 1.25, 0, TAU);
        ctx.fillStyle = '#ff2b2b';
        ctx.fill();
        ctx.lineWidth = Math.max(1, dotR * 0.4);
        ctx.strokeStyle = '#000';
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(tmx, tmy, dotR * 1.6, 0, TAU);
        ctx.lineWidth = Math.max(1.8, dotR * 0.7);
        ctx.strokeStyle = '#ff2b2b';
        ctx.stroke();
      }
    }

    // 玩家小点：Common 等级的草绿色 + 灰色描边（与 common 稀有度色 #7EEF6D 一致）
    const px = x0 + (player.x - vx) / span * S, py = y0 + (player.y - vy) / span * S;
    ctx.beginPath();
    ctx.arc(px, py, dotR, 0, TAU);
    ctx.fillStyle = '#7EEF6D';
    ctx.fill();
    ctx.lineWidth = Math.max(1, dotR * 0.3);
    ctx.strokeStyle = '#8a8a8a';          // 灰色描边：在深浅地形上都看得清
    ctx.stroke();

    ctx.restore();   // 撤销裁剪
    ctx.restore();   // 撤销外框
  }
};
