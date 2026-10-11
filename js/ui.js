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
// 拖拽幽灵尺寸（卡槽卡 54px × 1.3 × 0.6）与"飞入卡槽"时的目标缩放
const GHOST_SIZE = 54 * 1.3 * 0.6;          // 42.12
const GHOST_TO_SLOT = 54 / GHOST_SIZE;      // 飞进卡槽时放大回 54px

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
  _tip: null,         // 当前悬浮框数据（canvas 绘制）
  _tipOn: false,
  _tipAlpha: 0,
  onCloseAll: null,   // 拖拽开始时关闭所有窗口

  init() {
    const root = document.createElement('div');
    root.id = 'ui';
    root.innerHTML = `
      <div id="hud">
        <div id="topbar"><span id="pname">${I18N.t('ui.pname', 'Flower')}</span></div>
        <div id="hint">${I18N.t('ui.hint', 'WASD / arrow keys to move · B backpack · V pokédex')}</div>
      </div>

      <!-- 左下角图标列：背包 / 图鉴（淡蓝底 + 白色矢量图形） -->
      <div id="dockBtns">
        <button id="bagBtn" class="dockbtn" title="${I18N.t('UI/Inventory/Title', 'Inventory')} (B)">
          <svg viewBox="0 0 24 24"><path d="M8 9.6V7a4 4 0 0 1 8 0v2.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><rect x="4.6" y="9" width="14.8" height="11.4" rx="3.6" fill="#fff"/><rect x="8.8" y="12.6" width="6.4" height="3.2" rx="1.6" fill="#8fc4ea"/></svg>
        </button>
        <button id="dexBtn" class="dockbtn" title="${I18N.t('UI/MobGallery/Title', 'Pokédex')} (V)">
          <svg viewBox="0 0 24 24"><path d="M5 5h6.2a2 2 0 0 1 2 2v12H7a2 2 0 0 1-2-2z" fill="#fff"/><path d="M19 5h-6.2a2 2 0 0 0-2 2v12H17a2 2 0 0 0 2-2z" fill="#e6f3fb"/></svg>
        </button>
      </div>

      <!-- 底部常驻快捷栏：仅一行 = 当前装备的卡（空位为灰色半透明圆角块） -->
      <div id="quickbar">
        <div id="slotRow" class="quickrow"></div>
      </div>

      <!-- 背包窗口：所有花瓣 × 全部稀有度 -->
      <div id="inventory" class="window hidden">
        <div class="win-head">
          <span class="win-title">${I18N.t('UI/Inventory/Title', 'Inventory')}</span>
          <div class="win-subtitle">${I18N.t('UI/Inventory/Subtitle', 'Drag a petal to equip it')}</div>
          <button class="win-close" data-close="bag" title="${I18N.t('ui.close', 'Close')}">
            <svg viewBox="0 0 16 16"><path d="M4 4 12 12 M12 4 4 12" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>
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
          <button class="win-close" data-close="dex" title="${I18N.t('ui.close', 'Close')}">
            <svg viewBox="0 0 16 16"><path d="M4 4 12 12 M12 4 4 12" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="win-body"><div id="dexBody" class="gallery"></div></div>
      </div>

      <div id="loading">${I18N.t('UI/Title/Loading', 'Loading...')}</div>
    `;
    document.body.appendChild(root);
    this.root = root;

    const $ = (id) => root.querySelector('#' + id);
    this.refs = {
      pname: $('pname'),
      bagBtn: $('bagBtn'), dexBtn: $('dexBtn'),
      inv: $('inventory'), invGallery: $('invGallery'),
      dex: $('dex'), dexBody: $('dexBody'), dexCount: $('dexCount'),
      slotRow: $('slotRow'),
      loading: $('loading')
    };
    this._initOverlay();   // 悬浮框 / 卡牌覆盖层：纯 canvas

    this.refs.bagBtn.addEventListener('click', () => { if (this.onBagToggle) this.onBagToggle(); });
    this.refs.dexBtn.addEventListener('click', () => { if (this.onDexToggle) this.onDexToggle(); });
    // 红色矢量叉 -> 关闭对应窗口
    root.querySelectorAll('.win-close').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.close === 'bag') { if (this.onBagToggle) this.onBagToggle(); }
        else { if (this.onDexToggle) this.onDexToggle(); }
      });
    });
    // 兜底：窗口失焦/右键菜单时，清掉可能残留的拖拽幽灵
    window.addEventListener('blur', () => this._removeGhost());
    root.addEventListener('contextmenu', (e) => { this._removeGhost(); e.preventDefault(); });
  },

  // HUD 不再含等级/经验/血量（战斗系统已移除）
  updateHUD() {},

  setBagVisible(v) { this.refs.inv.classList.toggle('hidden', !v); },
  isBagVisible() { return !this.refs.inv.classList.contains('hidden'); },
  toggleBag() { if (this.onBagToggle) this.onBagToggle(); },

  setDexVisible(v) { this.refs.dex.classList.toggle('hidden', !v); },
  isDexVisible() { return !this.refs.dex.classList.contains('hidden'); },
  toggleDex() { if (this.onDexToggle) this.onDexToggle(); },

  hideLoading() { if (this.refs.loading) this.refs.loading.style.display = 'none'; },

  // ---------------- 底部常驻快捷栏：仅「当前装备的卡」一行 ----------------
  renderInvBar(p) {
    const slots = this.refs.slotRow;
    slots.innerHTML = '';
    for (let i = 0; i < p.slots.length; i++) {
      const box = document.createElement('div');
      box.className = 'qslot';
      box.dataset.drop = 'slot'; box.dataset.idx = i;
      const pet = p.slots[i];
      if (pet) {
        const cardEl = CardRenderer.createCard({ rarity: pet.rarity, svg: pet.type.svg });
        box.appendChild(cardEl);
        this._bindCard(cardEl, pet, { type: 'slot', index: i },
          () => { if (this.onSlotClick) this.onSlotClick(i); });
        this._bindTip(cardEl, pet.type, pet.rarity);
      }
      slots.appendChild(box);
    }
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

  // ---------------- 图鉴：花瓣陈列馆 ----------------
  // 说明：florr 中花瓣本身不绑定单一稀有度（同一花瓣可有多种稀有度），稀有度是“卡牌实例”的属性。
  // 图鉴：稀有度背景板展示 + 花瓣按类别(kind)陈列（均复用窗口内的分组样式）。
  renderDex() {
    if (this._dexBuilt) return;          // 图鉴内容静态：只构建一次
    const body = this.refs.dexBody;
    body.innerHTML = '';
    const sample = PETAL_TYPES[0];
    const rarName = (r) => I18N.t('Rarities/' + r + '/Name', r);
    let total = 0;

    // 1) 稀有度背景板展示：同一示例花瓣在各级稀有度下的拼接效果
    for (const rar of RARITY_ORDER) {
      const col = (RARITIES[rar] && RARITIES[rar].color) || '#fff';
      body.appendChild(this._rarGroup(rarName(rar), col, [sample], rar));
    }

    // 2) 花瓣按类别陈列（中性 common 背景板）
    const kinds = [];
    const byKind = {};
    for (const p of PETAL_TYPES) {
      const k = p.kind || 'misc';
      if (!byKind[k]) { byKind[k] = []; kinds.push(k); }
      byKind[k].push(p);
    }
    for (const k of kinds) {
      const title = (k.charAt(0).toUpperCase() + k.slice(1)) + ' · ' + byKind[k].length;
      const petals = byKind[k].slice().sort((a, b) => a.name.localeCompare(b.name));
      body.appendChild(this._rarGroup(title, '#0d3a52', petals, 'common'));
      total += petals.length;
    }
    this.refs.dexCount.textContent = I18N.tf('ui.dexCount', { n: total, m: total }, 'Petals: {n}');
    this._dexBuilt = true;
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
        // 数值随稀有度倍率换算（与装备/提示一致）
        let dmg = type.dmg || 0, hp = type.hp || 0;
        const m = type.rarityMultipliers && type.rarityMultipliers[rarity];
        if (m) { dmg = type.dmg * (m.dmg || 1); hp = type.hp * (m.hp || 1); }
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
          spd: type.spd || 0,
          anchor: el
        };
        this._tipOn = true;
      },
      _hideTip() { if (this._tipOn) this._tipHideAt = performance.now(); this._tipOn = false; },

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
        const reload = t.spd > 0 ? (t.spd + 's') : '';
        const titleW = measure(FS_TITLE, t.name);
        const rarW = measure(FS_RAR, t.rarityName);
        const reloadW = reload ? measure(FS_RELOAD, reload) : 0;
        const statW = Math.max(measure(FS_STAT, 'Health: ' + t.hp), measure(FS_STAT, 'Damage: ' + t.dmg));
        // 介绍：宽度够就单行（不换行），超上限才折行
        const descFull = desc ? measure(FS_DESC, desc) : 0;
        let lines;
        if (!desc) lines = [];
        else if (descFull + PADX * 2 <= MAX_W) lines = [desc];
        else {
          const limit = MAX_W - PADX * 2;
          lines = []; let cur = '';
          for (const word of desc.split(' ')) {
            const test = cur ? cur + ' ' + word : word;
            if (cur && measure(FS_DESC, test) > limit) { lines.push(cur); cur = word; }
            else cur = test;
          }
          if (cur) lines.push(cur);
        }
        // 宽度 = 最宽一行 + 左右留白；标题、冷却与旋转图标都不重叠
        let contentW = Math.max(titleW, rarW, statW);
        for (const l of lines) contentW = Math.max(contentW, measure(FS_DESC, l));
        let W = Math.max(MIN_W, PADX * 2 + contentW);
        if (reload) W = Math.max(W, PADX + titleW + 14 + reloadW + 8 + ICON + RH);
        W = Math.min(MAX_W, W);
        // 介绍上下各空出一行；数值统一在左下角
        const descTop = rarityY + 22 + BLANK;
        const descBottom = descTop + Math.max(0, lines.length - 1) * LH;
        const healthY = descBottom + 22 + BLANK;
        const dmgY = healthY + 21;
        const H = dmgY + 12;
        return { W, H, RH, PADX, LH, ICON, lines, titleY, reloadY, rarityY, descTop, healthY, dmgY, W_ALL,
          FS_TITLE, FS_RELOAD, FS_RAR, FS_DESC, FS_STAT };
      },

    _drawTip(ctx, t, alpha) {
        const S = TIP_SCALE;                       // 整体 0.6 倍
        const L = this._tipLayout(ctx, t);
        const W = L.W * S, H = L.H * S;
        const pad = 10 * S;
        // 目标位置：卡牌正上方居中；顶部放不下则改到下方；再夹进视口
        const r = t.anchor && t.anchor.isConnected ? t.anchor.getBoundingClientRect() : null;
        let tx = r ? (r.left + r.width / 2 - W / 2) : (innerWidth / 2 - W / 2);
        let ty = r ? (r.top - H - 8) : (innerHeight / 2 - H / 2);
        if (ty < 4) ty = (r ? r.bottom + 8 : 8);
        tx = Math.max(4, Math.min(tx, innerWidth - W - 4));
        ty = Math.max(4, Math.min(ty, innerHeight - H - 4));
        // 首次出现直接落位；相邻卡之间移动时把框平移过去（不淡出再淡入）
        if (!this._tipSlide || !this._tipPos) this._tipPos = { x: tx, y: ty };
        else {
          this._tipPos.x += (tx - this._tipPos.x) * 0.4;
          this._tipPos.y += (ty - this._tipPos.y) * 0.4;
        }
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
        // 冷却（白字）+ 后面紧跟一个表示旋转的静态图标
            if (t.spd > 0) {
              const cy = y + L.reloadY * S;
              const icon = L.ICON * S, gap = 6 * S;
              text(t.spd + 's', rx - icon - gap, cy, L.FS_RELOAD, L.W_ALL, '#ffffff', 'right');
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
        // Health / Damage：统一排在左下角，标签彩色 + 数值白色（字号与介绍一致）
        const statLine = (label, color, val, refY) => {
          const size = Math.round(L.FS_STAT * S * 100) / 100;
          ctx.font = `${L.W_ALL} ${size}px ${CardRenderer.FONT}`;
          const lw = ctx.measureText(label).width;
          text(label, bx, y + refY * S, L.FS_STAT, L.W_ALL, color);
          text(String(val), bx + lw + 6 * S, y + refY * S, L.FS_STAT, L.W_ALL, '#ffffff');
        };
        statLine('Health:', '#7fe08a', t.hp, L.healthY);
        statLine('Damage:', '#ff6b6b', t.dmg, L.dmgY);
        ctx.restore();
      },

    // 悬浮框专用覆盖层：全屏 canvas，0.2s 渐显渐隐，自带 rAF 循环
    _initOverlay() {
      const cv = document.createElement('canvas');
      cv.id = 'uiOverlay';
      document.body.appendChild(cv);
      this.refs.overlay = cv;
          this._tipAlpha = 0;
          this._tipPos = null;      // 悬浮框当前位置（相邻卡之间平移用）
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
    // 库存校验必须在最前面：卡已取完时连幽灵都不生成，避免"按了却凭空多出一张"
    if (from.type === 'gallery' && !this._canTakeFromGallery(card)) return;
    const startX = ev.clientX, startY = ev.clientY;
    const startTime = ev.timeStamp || performance.now();
    let windowsClosed = false;   // 延迟关闭窗口标志
    // 按下即视为"拿起"：立即生成幽灵（放大 + 摇晃），源卡即时隐藏
    this._hideTip();
    this._createGhost(card, ev, srcEl);
    // 暂不关闭窗口，等判定为拖拽时再关闭
    if (from.type === 'gallery') { this._decGallery(card); this.renderInventory(); }
    else {
      // 卡槽/物品栏卡：等幽灵从卡面"长"出来（0.2s）后再隐藏卡面，源卡 -> 幽灵连贯过渡
      setTimeout(() => { if (srcEl.isConnected) srcEl.style.visibility = 'hidden'; }, 200);
    }
    const move = (e) => {
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
      const held = (e.timeStamp || performance.now()) - startTime;
      if (held < 200) {   // 按住<0.2s -> 点击，不关闭窗口
        this._clickFly(card, from, () => { if (onClick) onClick(); });
        return;
      }
      // 按住≥0.2s -> 拖拽，窗口已关闭
      const target = this._dropTargetAt(e.clientX, e.clientY);
      const handled = this.onDrop ? !!this.onDrop({ card, from }, target) : false;
      const ghost = this._drag;
      let tx, ty, dur, endScale;
      if (handled) {
        // 装入卡槽 -> 飞向该槽；卸下回背包（target 为 null）-> 飞向背包按钮
        let r = (target && target.el && target.el.isConnected) ? target.el.getBoundingClientRect() : null;
        if (!r && target && target.type === 'slot' && this.refs.slotRow.children[target.index]) {
          r = this.refs.slotRow.children[target.index].getBoundingClientRect();
        }
        if (r) { tx = r.left + r.width / 2; ty = r.top + r.height / 2; }
        else { const bag = this.refs.bagBtn.getBoundingClientRect(); tx = bag.left + bag.width / 2; ty = bag.top + bag.height / 2; }
        dur = 0.22; endScale = GHOST_TO_SLOT;
      } else {
        // 未装入任何卡槽 -> 取消：gallery 恢复数量；统一飞回背包按钮
        if (from.type === 'gallery') this._incGallery(card);
        this._restoreAfterCancel(from);
        const bag = this.refs.bagBtn.getBoundingClientRect();
        tx = bag.left + bag.width / 2; ty = bag.top + bag.height / 2;
        dur = 0.5; endScale = 0.05;
      }
      this._flyGhostTo(ghost, tx, ty, { dur, endScale, fade: true }, () => this._removeGhost());
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  },

  // 取消拖拽后恢复源区域显示（装卡槽失败/回退背包时调用）
  _restoreAfterCancel(from) {
    const g = window.__game;
    // 统一处理：任何源都重新渲染对应区域，不区别对待
    if (from.type === 'slot' || from.type === 'inv') {
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

  // 放下后的平滑动画：位置 / 缩放 / 透明度全部过渡（装卡槽快速变小；回退背包 0.5s 飞速缩小）
  _flyGhostTo(ghost, toX, toY, opts, done) {
    if (!ghost) { if (done) done(); return; }
    const o = opts || {};
    const dur = (o.dur != null) ? o.dur : 0.22;
    const endScale = (o.endScale != null) ? o.endScale : GHOST_TO_SLOT;
    ghost.style.transition = `left ${dur}s ease, top ${dur}s ease, transform ${dur}s ease, opacity ${dur}s ease`;
    requestAnimationFrame(() => {
      ghost.style.left = toX + 'px';
      ghost.style.top = toY + 'px';
      ghost.style.transform = `translate(-50%,-50%) scale(${endScale})`;
      ghost.style.opacity = '0';
    });
    setTimeout(() => { if (done) done(); }, dur * 1000 + 30);
  },

  // 点击（按住<0.2s）行为：
  //   背包画廊卡 / 物品栏卡 -> 飞入第一个空卡槽并装备；卡槽已满则「不替换」，不播放飞入动画，直接回退
  //   卡槽卡 -> 卸下回背包
  _clickFly(card, from, done) {
    const g = window.__game;
    const bagPos = () => {
      const b = this.refs.bagBtn.getBoundingClientRect();
      return [b.left + b.width / 2, b.top + b.height / 2];
    };
    if (from.type === 'gallery' || from.type === 'inv') {
      const emptyIdx = g ? g.firstEmptySlot() : -1;
      if (emptyIdx < 0) {
        // 卡槽已满：不替换 -> 不播放飞入动画，恢复来源显示并回退背包
        if (from.type === 'gallery') { this._incGallery(card); this.renderInventory(); }
        else this._restoreAfterCancel(from);
        const [bx, by] = bagPos();
        this._flyGhostTo(this._drag, bx, by, { dur: 0.5, endScale: 0.05, fade: true }, () => this._removeGhost());
        return;                       // 不触发 onClick（不装备）
      }
      const slot = this.refs.slotRow.children[emptyIdx] || this.refs.slotRow.children[0];
      const rect = slot ? slot.getBoundingClientRect()
        : { left: innerWidth / 2 - 26, top: innerHeight - 60, width: 52, height: 52 };
      // 数量已在按下时扣过：点击=装备，直接装上即可（不再 +1/-1 反复）
      this._flyGhostTo(this._drag, rect.left + rect.width / 2, rect.top + rect.height / 2,
        { dur: 0.22, endScale: GHOST_TO_SLOT, fade: true }, () => {
          this._removeGhost();
          if (done) done();
        });
      return;
    }
    // 卡槽点击：卸下回背包
    const [bx, by] = bagPos();
    this._flyGhostTo(this._drag, bx, by, { dur: 0.22, endScale: GHOST_TO_SLOT, fade: true }, () => {
      this._removeGhost();
      const ok = done ? done() : true;
      if (ok === false) this._restoreAfterCancel(from);   // 卸下失败 -> 恢复卡面显示
    });
  },

  // 被替换下来的卡：从卡槽位置播放「飞回背包」动画（独立幽灵，不影响正在拖拽的卡）
  flySlotCardToBag(slotIndex, card) {
    const bag = this.refs.bagBtn.getBoundingClientRect();
    const tx = bag.left + bag.width / 2, ty = bag.top + bag.height / 2;
    const slot = this.refs.slotRow.children[slotIndex];
    const r = slot ? slot.getBoundingClientRect() : { left: tx, top: ty, width: 54, height: 54 };
    const g = this._ghostEl(card);
    g.style.left = (r.left + r.width / 2) + 'px';
    g.style.top = (r.top + r.height / 2) + 'px';
    g.style.transition = 'none';
    document.body.appendChild(g);
    const dur = 0.5;
    requestAnimationFrame(() => {
      g.style.transition = `left ${dur}s ease, top ${dur}s ease, transform ${dur}s ease, opacity ${dur}s ease`;
      g.style.left = tx + 'px';
      g.style.top = ty + 'px';
      g.style.transform = 'translate(-50%,-50%) scale(0.05)';
      g.style.opacity = '0';
    });
    setTimeout(() => g.remove(), dur * 1000 + 30);
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
  // 拿起：幽灵从「源卡牌位置」长出来，0.2s 平滑移动+放大到指针位置（过渡期间不跟随鼠标）
  _createGhost(card, e, srcEl) {
    const g = this._ghostEl(card);
    g.id = 'dragGhost';
    g.classList.add('dragging');
    const dur = 0.2;
    // 起点 = 源卡牌中心（缩放 1×），终点 = 指针位置（缩放 1.3×）
    let x = e.clientX, y = e.clientY, scale = 1.3;
    const r = (srcEl && srcEl.getBoundingClientRect) ? srcEl.getBoundingClientRect() : null;
    if (r && r.width > 0) { x = r.left + r.width / 2; y = r.top + r.height / 2; scale = 1; }
    g.style.left = x + 'px';
    g.style.top = y + 'px';
    g.style.transform = `translate(-50%,-50%) scale(${scale})`;
    g.style.transition = 'none';
    document.body.appendChild(g);
    this._drag = g;
    this._dragFrom = performance.now();
    // 必须先落位再于下一帧切transition，才能得到 0.2s 的连贯过渡
    requestAnimationFrame(() => {
      g.style.transition = `left ${dur}s ease, top ${dur}s ease, transform ${dur}s ease`;
      g.style.left = e.clientX + 'px';
      g.style.top = e.clientY + 'px';
      g.style.transform = 'translate(-50%,-50%) scale(1.3)';
    });
  },
  _moveGhost(e) {
    if (!this._drag) return;
    if (performance.now() - (this._dragFrom || 0) < 200) return;   // 0.2s 过渡动画期间不跟手
    this._drag.style.left = e.clientX + 'px';
    this._drag.style.top = e.clientY + 'px';
  },
  _removeGhost() { if (this._drag) { this._drag.remove(); this._drag = null; } },

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

  // ---------------- 小地图 ----------------
  // 画在游戏主画布上；按"能不能走"显示黑白形状（精确到四分之一格）。
  drawMinimap(ctx, rect, map, player, mobs) {
    const S = rect.size, x0 = rect.x, y0 = rect.y;
    const half = map.R || (map.width * (map.tile || 1)) / 2;
    const scale = S / (2 * half);
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,9,0.55)';
    ctx.fillRect(x0 - 5, y0 - 5, S + 10, S + 10);
    if (map.solidQuad && map.FW && map.FH) {
      const W = map.width, H = map.height;
      ctx.fillStyle = '#d7ddcf';
      ctx.fillRect(x0, y0, S, S);
      ctx.fillStyle = '#11130f';
      const qpx = S / map.FW, qpy = S / map.FH, SQ = map.solidQuad;
      for (let qy = 0; qy < map.FH; qy++)
        for (let qx = 0; qx < map.FW; qx++)
          if (SQ[qy * map.FW + qx] === 1)
            ctx.fillRect(x0 + qx * qpx, y0 + qy * qpy, qpx + 0.5, qpy + 0.5);  // 轻微重叠0.5px消除抗锯齿缝隙，保留浮点精度
    } else if (map.solid && map.width && map.height) {
      const W = map.width, H = map.height;
      ctx.fillStyle = '#d7ddcf'; ctx.fillRect(x0, y0, S, S);
      ctx.fillStyle = '#11130f';
      const px = S / W, py = S / H, solid = map.solid;
      for (let ty = 0; ty < H; ty++)
        for (let tx = 0; tx < W; tx++)
          if (solid[ty * W + tx] === 1)
            ctx.fillRect(x0 + tx * px, y0 + ty * py, px + 0.5, py + 0.5);  // 轻微重叠0.5px消除抗锯齿缝隙，保留浮点精度
    } else {
      const poly = map.poly || [[-half, -half], [half, -half], [half, half], [-half, half]];
      ctx.fillStyle = 'rgba(10,20,14,0.7)'; ctx.fillRect(x0, y0, S, S);
      ctx.beginPath();
      ctx.moveTo(poly[0][0] * scale + S / 2, poly[0][1] * scale + S / 2);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0] * scale + S / 2, poly[i][1] * scale + S / 2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(80,150,70,0.55)'; ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x0 + player.x * scale + S / 2, y0 + player.y * scale + S / 2, 2.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
};
