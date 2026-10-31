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

// 圆角矩形路径统一由 render/render-util.js 提供（本文件加载更早，调用发生在运行时，无前向引用问题）。
// 这里曾有一份同算法副本，会静默覆盖后者；已删除，全项目只保留一份实现。

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
  let s = String(I18N.t(key, fallback) || '');
  // ① 先兜底清掉颜色标签（某些官方值里 <c val="…"> 会残留半截）
  s = s.replace(/<c\b[^>]*>/gi, '').replace(/<\/c>/gi, '');
  // ② 再清任意 {#…} 引用：占位符里可能还有嵌套花括号（如 {#Rarities/{0}/NameColored}），
  //    普通 /\{[^{}]*\}/ 剥不干净，会留下 "/NameColored}" 之类的碎片。
  s = s.replace(/\{#[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');
  // ③ 标签部分一定在第一个 { 之前（{0:tooltip} / {0} 等占位都在末尾）
  const i = s.indexOf('{');
  if (i >= 0) s = s.slice(0, i);
  return s.trim();
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
    // 硬窗口风格：左下角按钮不接收键盘焦点，避免按空格（reach）误触发其默认 click /
    // 回车等，导致非主动的焦点交互（如空格开关 Mob Gallery）。鼠标点击不受影响。
    [this.refs.bagBtn, this.refs.dexBtn, this.refs.setBtn].forEach(b => { if (b) b.tabIndex = -1; });
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

  setBagVisible(v) {
    this.refs.inv.classList.toggle('hidden', !v);
    if (!v) { this._hideTip(); return; }
    // 关着的时候所有改动只标脏，真正打开时才刷新（见 renderInventory）
    if (this._invDirty || !this._invBuilt) this.renderInventory();
  },
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
  // 【结构只建一次，之后只更新数量/显隐】
  // 卡片操作（装配 / 切换 / 拾取 / 卸下）非常频繁，以前每次都 innerHTML='' 重建整表：
  // 一次 = 几十上百个 canvas + 各自一个 ResizeObserver + 各自一次强制重排 —— 这就是
  // "一碰卡片 UI 就卡一下"的来源。现在重建成本只在第一次打开背包时付一次。
  renderInventory() {
    if (!this.isBagVisible()) { this._invDirty = true; return; }   // 关着：只标脏
    this._invDirty = false;
    if (!this._invBuilt) this._buildInventory();
    this._syncInventoryCounts();
  },

  _buildInventory() {
    const g = this.refs.invGallery;
    if (!g) return;
    g.innerHTML = '';
    const rarName = (r) => I18N.t('Rarities/' + r + '/Name', r);
    const petals = PETAL_TYPES.slice().sort((a, b) => a.name.localeCompare(b.name));
    this._invCells = new Map();
    this._invGroups = new Map();
    for (const rar of [...RARITY_ORDER].reverse()) {   // 高稀有度在上、低稀有度在下
      const col = (RARITIES[rar] && RARITIES[rar].color) || '#fff';
      const grp = this._rarGroup(rarName(rar), col, petals, rar);
      if (!grp) continue;
      g.appendChild(grp);
      this._invGroups.set(rar, grp);
    }
    this._invBuilt = true;
  },

  // 只刷新"数量角标 + 是否显示"，不动 DOM 结构、不重画卡面
  _syncInventoryCounts() {
    if (!this._invCells) return;
    const visible = new Map();     // rarity -> 是否还有可见卡
    for (const [key, rec] of this._invCells) {
      const n = this._galleryCount(key);
      if (rec.n !== n) { rec.n = n; CardRenderer.setCount(rec.cv, n); }
      const show = n > 0;
      if (rec.shown !== show) { rec.shown = show; rec.cell.style.display = show ? '' : 'none'; }
      if (show) visible.set(rec.rar, true);
    }
    for (const [rar, grp] of this._invGroups) {
      const show = !!visible.get(rar);
      const cur = grp.style.display !== 'none';
      if (cur !== show) grp.style.display = show ? '' : 'none';
    }
  },

  // 非调试模式的初始库存：只有 1 张 common Basic（STARTER_INV_KEY），其余一律 0。
  // 其它卡牌不再"天然存在"于背包，必须靠打怪掉落获得；调试模式仍为 ∞ 方便调试。
  _gcDefault(key) {
    if (window.__debug) return Infinity;
    const invKey = (typeof STARTER_INV_KEY !== 'undefined') ? STARTER_INV_KEY : null;
    return (invKey && key === invKey) ? 1 : 0;
  },
  // 画廊卡数量（调试=∞）；拿空(<=0)后该卡不再渲染
  _galleryCount(key) {
    if (!this._gc) this._gc = {};
    if (!(key in this._gc)) this._gc[key] = this._gcDefault(key);
    return this._gc[key];
  },
  _decGallery(card) {
    const key = card.type.key + '|' + card.rarity;
    if (window.__debug) return true;
    if (!this._gc) this._gc = {};
    if (this._gc[key] === undefined) this._gc[key] = this._gcDefault(key);
    if (this._gc[key] <= 0) return false;   // 已取完：拒绝再取（防止连点刷出超量卡）
    this._gc[key] -= 1;
    return true;
  },
  // 取消拖拽（回退背包）时恢复数量（+1）；调试模式恒 ∞ 不变
  _incGallery(card) {
    const key = card.type.key + '|' + card.rarity;
    if (window.__debug) return;
    if (!this._gc) this._gc = {};
    if (this._gc[key] === undefined) this._gc[key] = this._gcDefault(key);
    this._gc[key] += 1;
  },
  // 拾取掉落：对应卡牌数量 +1（进背包 = all petals）。调试模式恒 ∞，不加不减。
  addGalleryCount(type, rarity) {
    const key = type.key + '|' + rarity;
    if (!this._gc) this._gc = {};
    if (this._gc[key] === undefined) this._gc[key] = this._gcDefault(key);
    if (this._gc[key] !== Infinity) this._gc[key] += 1;
    // 背包开着才实时刷新（关着则下次打开自然读新值，避免无谓重建 900+ 卡）
    if (this.refs.inv && !this.refs.inv.classList.contains('hidden')) this.renderInventory();
  },

  // 生成一个「稀有度分组」：分割条 + 等级名字 + 卡片网格。
  // 【每张卡都建好】但数量为 0 的先隐藏 —— 这样后续刷新只需要改 display 与角标文字，
  // 不再重建 DOM（重建 = 每个 canvas 一次强制重排，见 renderInventory 的注释）。
  _rarGroup(name, color, petals, rarity) {
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
    for (const p of petals) {
      const key = p.key + '|' + rarity;
      const n = this._galleryCount(key);
      const cell = document.createElement('div');
      cell.className = 'cardcell';
      const cv = CardRenderer.createCard({
        rarity, svg: p.svg, count: n,
        pad: 0.0756, radius: 0.0588   // 背包卡牌：描边/圆角按卡面比例同步缩小
      });
      cell.appendChild(cv);
      const card = { type: p, rarity };
      this._bindCard(cell, card, { type: 'gallery', index: -1 },
        () => {
          // 数量已在「按下」时原子扣过，这里只负责装备，绝不再动数量
          if (!this.onGalleryCardClick) return;
          const ok = this.onGalleryCardClick(card);
          if (!ok) this._incGallery(card);   // 装备失败（无空槽等）：回滚按下的那张，避免丢卡
        });  // gallery 支持拖拽和点击
      this._bindTip(cell, p, rarity);
      grid.appendChild(cell);
      const show = n > 0;
      if (!show) cell.style.display = 'none';
      this._invCells.set(key, { cell, cv, n, rar: rarity, shown: show });
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
      // hold（Honey 等"放置后等实体死亡才重装填"）：卡面不显示装填扇形，只显示实体血量水缸阴影，
      // 因此不算"进行中"——否则 honey 卡面会被当成在装填、hpShadow 被强行归零（水桶特效不显示）。
      const active = !p.dead && !!(r && !r.hold && r.dur > 0 && r.age < r.dur);
      // —— 花瓣血量阴影（"水缸"）——目标值即时生效，不做过渡：
      // 阴影与 reload 阴影颜色天然相同（同色同级），状态切换无需动画；
      // 旧版指数平滑会让花瓣死亡瞬间的 hp 阴影回退与 reload 扇形短暂叠加
      // （两层 0.5 alpha 重叠变深），这正是"颜色略有不同"的来源。
      //   · 玩家死亡          -> 全 1：所有卡【快速平滑】过渡到 reload 前的全阴影
      //                          状态（reload 待命），重生后统一重新装填
      //   · reload 阴影进行中 -> 0（视觉全部交给扇形阴影，绝不叠加）
      //   · 有花瓣实体        -> 1 - hp/maxHp（归零即整块全阴影，无缝接 reload 起始）
      //   · 无实体（装填中）  -> 0
      const card = p.slots[i];
      const isAcc = !!(card && card.type && card.type.accessory);
      // 装备型饰品（Third Eye 等）：没有经典 reload 扇形，取而代之的是
      // "整块暗灰 -> 快速渐淡变亮"—— 直接把水缸阴影从 1 平滑放掉，复用同一套渲染。
      // 只在同一格换了新卡时重置一次，之后的每一帧由下面的平滑衰减自然淡出。
      if (isAcc && cv._accCard !== card) { cv._accCard = card; cv._hpShadowSm = 1; }
      // 不可堆叠花瓣的重复件：恒定暗灰"未装填"态（不参与轨道、不产生实体）
      const inactive = !!(p.slotActive && p.slotActive[i] === false);
      let hpTarget = 0;
      if (p.dead) {
        hpTarget = 1;
      } else if (inactive) {
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

  // 拾取落槽动画：卡牌凭空出现在槽里 -> "快速渐大"（0.22s，0.55 -> 1.06 -> 1）。
  // 与飞入动画区分开：这里没有位移，只有缩放 + 淡入。
  popSlot(row, index) {
    const host = (row === 'subslot') ? this.refs.subRow : this.refs.slotRow;
    const cell = host && host.children ? host.children[index] : null;
    const el = cell && (cell.querySelector('.qinner') || cell.querySelector('.card'));
    if (!el) return;
    el.classList.remove('slot-pop');
    void el.offsetWidth;          // 强制重排，保证连续拾取也能重播
    el.classList.add('slot-pop');
    setTimeout(() => el.classList.remove('slot-pop'), 280);
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
        // 数值随稀有度换算：直接走 petalStatsFor（与装备、战斗、引擎加成完全同源，
        // 不再在这里手写一套倍率/整表分支，避免悬停框和实际效果对不上）
        const st = petalStatsFor(type, rarity);
        const dmg = st.dmg, hp = st.hp, heal = st.heal;
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
          // 持续回血的花瓣（healOverTime）治疗量是【每秒】计数单位，显示成 "3/s"；
          // Rose 等一次性治疗不显示 /s。
          healPerSec: !!type.healOverTime,
          reload: (type.reload != null) ? type.reload : Math.max(0, type.spd || 0),
          reloadText: type.reloadText || null,
          // 装备加成类属性（0 = 没有这一项，整行不显示）：
          //   转速加成（Faster）、reach 额外伸距（Third Eye）—— 标签色同 Max Mob Rarity
          rotSpeed: st.rotSpeed || 0,
          attackRange: st.attackRange || 0,
          // 装备型饰品（Third Eye）：没有装填，右上角改画"淡灰圆 + 加号"
          accessory: !!type.accessory,
          // 不可堆叠（Third Eye）：右上角最右侧再加"灰色梯形 + 白 ×"图标
          noStack: type.stackable === false,
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

};
