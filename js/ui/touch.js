// touch.js — 移动端触控层：自缩放虚拟摇杆 + A(reach) / B(detect) 按钮。
// 设计：
//   · 只在「粗指针」设备（手指/触控笔）显示；桌面鼠标环境完全隐藏，不影响原有键鼠手感；
//   · 摇杆是【浮动式】：手指按在左侧任意位置就地生成摇杆，按屏幕尺寸自动缩放（小屏不挡视野、大屏好按）；
//   · 摇杆输出写进 game.touchDir，优先级高于键盘/鼠标（见 game._readDir）；
//   · A / B 按住期间分别等价于「左键 reach」「Shift detect」，与键盘完全同一条逻辑通路；
//   · 全部走 Pointer Events，天然支持多指（一手摇杆 + 一手按 A/B）。
'use strict';

const TouchCtl = {
  game: null,
  on: false,          // 当前是否启用（触摸设备）
  refs: null,
  _stick: { id: -1, bx: 0, by: 0, size: 120 },
  _held: { A: 0, B: 0 },

  // forceOn：强制启用（?touch=1 与自测走这条路），undefined 时按设备能力自动判断
  init(game, forceOn) {
    this.game = game;
    // 粗指针 / 有触摸点 -> 启用触控层。桌面浏览器（纯鼠标）不创建任何元素。
    const coarse = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const touchPoints = (navigator.maxTouchPoints || 0) > 0;
    // ?touch=1：在桌面浏览器里强制显示触控层（开发/自测用，不影响自动判断）
    const force = /[?&]touch=1(?:&|$)/.test(location.search);
    this.on = !!(forceOn === true || coarse || touchPoints || force);
    if (!this.on) return;

    document.body.classList.add('touch-ui');
    const root = document.createElement('div');
    root.id = 'touchLayer';
    root.innerHTML = `
      <div id="tStick" class="t-stick">
        <div class="t-stick-base"></div>
        <div class="t-stick-knob"></div>
      </div>
      <div id="tBtns" class="t-btns">
        <button id="tBtnA" class="t-btn t-btn-a" type="button">
          <b>A</b><i>${I18N.t('Touch/Reach', 'Reach')}</i>
        </button>
        <button id="tBtnB" class="t-btn t-btn-b" type="button">
          <b>B</b><i>${I18N.t('Touch/Detect', 'Detect')}</i>
        </button>
      </div>`;
    document.body.appendChild(root);

    this.refs = {
      root,
      stick: root.querySelector('#tStick'),
      knob: root.querySelector('.t-stick-knob'),
      a: root.querySelector('#tBtnA'),
      b: root.querySelector('#tBtnB')
    };
    this._layout();
    window.addEventListener('resize', () => this._layout(), { passive: true });
    window.addEventListener('orientationchange', () => this._layout(), { passive: true });

    this._bindStick();
    this._bindButton(this.refs.a, 'mouse1');
    this._bindButton(this.refs.b, 'mouse2');
  },

  // 自缩放：摇杆直径 = 屏幕短边 × 0.28（84~160px）；按钮 = 摇杆 × 0.62。
  // 用 CSS 变量驱动，JS 只算一次，避免每帧写样式。
  _layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const size = Math.round(clamp(Math.min(vw, vh) * 0.28, 84, 160));
    const btn = Math.round(clamp(size * 0.62, 56, 96));
    const root = this.refs && this.refs.root;
    if (!root) return;
    root.style.setProperty('--t-stick', size + 'px');
    root.style.setProperty('--t-btn', btn + 'px');
    root.style.setProperty('--t-knob', Math.round(size * 0.44) + 'px');
    this._stick.size = size;
    if (this._stick.id < 0) this._parkStick();
  },

  // 摇杆未按下时停在左侧默认位置（右下角按钮区之外）
  _parkStick() {
    const size = this._stick.size;
    const x = Math.round(size * 0.75 + 14);
    const y = Math.round(window.innerHeight - size * 0.75 - 20);
    this._placeStick(x, y);
  },

  _placeStick(x, y) {
    const s = this.refs.stick;
    if (!s) return;
    s.style.left = (x - this._stick.size / 2) + 'px';
    s.style.top = (y - this._stick.size / 2) + 'px';
    s.classList.remove('active');
    this.refs.knob.style.transform = 'translate(0px, 0px)';
    this._stick.bx = x;
    this._stick.by = y;
  },

  _bindStick() {
    const root = this.refs.root;
    const R = () => this._stick.size * 0.34;      // 摇杆最大位移半径

    const move = (e) => {
      if (e.pointerId !== this._stick.id) return;
      const dx = e.clientX - this._stick.bx;
      const dy = e.clientY - this._stick.by;
      const len = Math.hypot(dx, dy) || 1;
      const max = R();
      const k = Math.min(1, len / max);
      const ux = dx / len, uy = dy / len;
      // 视觉：摇杆头限制在底盘内
      this.refs.knob.style.transform = 'translate(' + (ux * max * k) + 'px,' + (uy * max * k) + 'px)';
      // 逻辑：死区 0.16，超过后线性映射到 0~1（外圈满速）
      const mag = k < 0.16 ? 0 : (k - 0.16) / 0.84;
      this.game.touchDir = { x: ux * mag, y: uy * mag };
      e.preventDefault();
    };

    const end = (e) => {
      if (e.pointerId !== this._stick.id) return;
      this._stick.id = -1;
      this.game.touchDir = null;
      this._parkStick();
      try { root.releasePointerCapture(e.pointerId); } catch (_) { /* 已释放 */ }
    };

    root.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;            // 桌面鼠标不走摇杆
      if (e.target.closest('.t-btn')) return;           // 按钮自己处理
      if (this._stick.id >= 0) return;                  // 已经有手指在摇杆上
      // 只在左 60% / 下方 80% 区域起杆，避免和顶栏、聊天抢手势
      if (e.clientX > window.innerWidth * 0.6 || e.clientY < window.innerHeight * 0.2) return;
      this._stick.id = e.pointerId;
      this._placeStick(e.clientX, e.clientY);
      this.refs.stick.classList.add('active');
      try { root.setPointerCapture(e.pointerId); } catch (_) { /* 不支持捕获时退化为冒泡 */ }
      e.preventDefault();
    }, { passive: false });
    root.addEventListener('pointermove', move, { passive: false });
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
  },

  // A/B 按钮：按住 = 对应模式（与键盘 Space / Shift 同一条逻辑通路）
  _bindButton(el, key) {
    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.game.keys[key] = true;
      el.classList.add('down');
    };
    const up = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.game.keys[key] = false;
      el.classList.remove('down');
    };
    el.addEventListener('pointerdown', down, { passive: false });
    el.addEventListener('pointerup', up, { passive: false });
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => { if (e.buttons === 0) up(e); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
};
