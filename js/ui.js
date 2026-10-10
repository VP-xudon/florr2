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

      <div id="tip" class="hidden"></div>
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
      tip: $('tip'),
      loading: $('loading')
    };

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
        box.appendChild(CardRenderer.createCard({ rarity: pet.rarity, svg: pet.type.svg }));
        this._bindCard(box, pet, { type: 'slot', index: i },
          () => { if (this.onSlotClick) this.onSlotClick(i); });
        this._bindTip(box, pet.type, pet.rarity);
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
    if (window.__debug) return;
    if (!this._gc) this._gc = {};
    if (this._gc[key] === undefined) this._gc[key] = 2;
    this._gc[key] -= 1;
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
    const lineCol = '#3c5d6b';   // 统一略深描线色（不随稀有度变化，只有中心字母是稀有度色）
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
      cell.appendChild(CardRenderer.createCard({ rarity, svg: p.svg, count: this._galleryCount(key) }));
      const card = { type: p, rarity };
      this._bindCard(cell, card, { type: 'gallery', index: -1 },
        () => {
          const ok = this.onGalleryCardClick ? this.onGalleryCardClick(card) : false;
          if (ok) { this._decGallery(card); this.renderInventory(); }
        });
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

  // ---------------- 卡牌悬浮提示（像生物 nametag） ----------------
  // ---------------- 卡牌悬浮提示：固定显示在卡牌正上方居中（不跟随鼠标） ----------------
  _bindTip(el, type, rarity) {
    el.addEventListener('mouseenter', () => this._showTip(type, rarity, el));
    el.addEventListener('mouseleave', () => this._hideTip());
  },
  _showTip(type, rarity, el) {
    const col = (RARITIES[rarity] && RARITIES[rarity].color) || '#fff';
    const rn = I18N.t('Rarities/' + rarity + '/Name', rarity);
    this.refs.tip.innerHTML =
      `<div class="tip-name">${type.name}</div>` +
      `<div class="tip-rar" style="color:${col}">${rn}</div>` +
      `<div class="tip-stats">` +
        `<span>Damage</span><b>${type.dmg || 0}</b>` +
        `<span>Health</span><b>${type.hp || 0}</b>` +
        `<span>Reload</span><b>${type.spd || 0}</b>` +
      `</div>` +
      (type.kind ? `<div class="tip-kind">${type.kind}</div>` : '');
    this.refs.tip.classList.remove('hidden');
    // 固定定位：卡牌正上方居中
    const r = el.getBoundingClientRect();
    const tr = this.refs.tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - tr.width / 2;
    let y = r.top - tr.height - 8;
    if (y < 0) y = r.bottom + 8;   // 顶部放不下则移到卡牌下方
    this.refs.tip.style.left = x + 'px';
    this.refs.tip.style.top = y + 'px';
  },
  _hideTip() { if (this.refs.tip) this.refs.tip.classList.add('hidden'); },

  // ---------------- 交互：点击 / 拖拽 ----------------
  // 只响应鼠标左键（右键不产生任何卡牌幽灵，清理右键残留）
  _bindCard(el, card, from, onClick) {
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this._beginPointer(card, from, e, onClick, el);
    });
  },

  _beginPointer(card, from, ev, onClick, srcEl) {
    const startX = ev.clientX, startY = ev.clientY;
    let dragging = false;
    const move = (e) => {
      if (!dragging) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 6) {
          dragging = true;
          this._hideTip();
          this._createGhost(card, e);
          this._closeAllWindows();                 // 手上有拖动卡 -> 关闭所有小窗口
          if (from.type === 'gallery') {
            // 从背包拿起即扣数量（立刻少一个），并重建画廊让源格即时更新
            this._decGallery(card);
            this.renderInventory();
          } else {
            // 卡槽卡：保留空框占位（visibility 隐藏，不破坏 qslot 布局）
            srcEl.style.visibility = 'hidden';
          }
        }
      }
      if (dragging) this._moveGhost(e);
    };
    const up = (e) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (!dragging) { if (onClick) this._clickAnimate(card, from, srcEl, onClick); return; }
      const target = this._dropTargetAt(e.clientX, e.clientY);
      const handled = this.onDrop ? !!this.onDrop({ card, from }, target) : false;
      const ghost = this._drag;
      if (handled) {
        // 装入卡槽：飞向目标槽（DOM 可能已重建，用 index 重新查；否则飞向玩家中心）
        let r = (target && target.el && target.el.isConnected) ? target.el.getBoundingClientRect() : null;
        if (!r && target && target.type === 'slot' && this.refs.slotRow.children[target.index]) {
          r = this.refs.slotRow.children[target.index].getBoundingClientRect();
        }
        const tx = r ? r.left + r.width / 2 : innerWidth / 2;
        const ty = r ? r.top + r.height / 2 : innerHeight / 2;
        this._flyGhostTo(ghost, tx, ty, { dur: 0.22, endScale: 54 / 70.2, fade: true }, () => this._removeGhost());
      } else {
        // 未装入任何卡槽 -> 回退背包（gallery 飞向背包按钮并恢复数量；slot 飞回玩家中心归位）
        if (from.type === 'gallery') this._incGallery(card);
        this._restoreAfterCancel(from);
        const bag = this.refs.bagBtn.getBoundingClientRect();
        const tx = (from.type === 'gallery') ? bag.left + bag.width / 2 : innerWidth / 2;
        const ty = (from.type === 'gallery') ? bag.top + bag.height / 2 : innerHeight / 2;
        this._flyGhostTo(ghost, tx, ty, { dur: 0.5, endScale: 0.05, fade: true }, () => this._removeGhost());
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  },

  // 取消拖拽后恢复源区域显示（装卡槽失败/回退背包时调用）
  _restoreAfterCancel(from) {
    const g = window.__game;
    if (from.type === 'slot' || from.type === 'inv') { if (g) this.renderInvBar(g.player); }
    else { this.renderInventory(); }
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
    const endScale = (o.endScale != null) ? o.endScale : 54 / 70.2;
    ghost.style.transition = `left ${dur}s ease, top ${dur}s ease, transform ${dur}s ease, opacity ${dur}s ease`;
    requestAnimationFrame(() => {
      ghost.style.left = toX + 'px';
      ghost.style.top = toY + 'px';
      ghost.style.transform = `translate(-50%,-50%) scale(${endScale})`;
      ghost.style.opacity = '0';
    });
    setTimeout(() => { if (done) done(); }, dur * 1000 + 30);
  },

  _clickAnimate(card, from, srcEl, onClick) {
    let toX, toY;
    if (from.type === 'gallery' || from.type === 'bag') {
      const slot = this._nextInvSlotEl();
      const rect = slot ? slot.getBoundingClientRect() : { left: innerWidth / 2 - 26, top: innerHeight - 60, width: 52, height: 52 };
      toX = rect.left + rect.width / 2; toY = rect.top + rect.height / 2;
    } else {
      toX = innerWidth / 2; toY = innerHeight / 2;
    }
    this._flyCard(srcEl, toX, toY, card, onClick);
  },

  _nextInvSlotEl() {
    const p = window.__game ? window.__game.player : null;
    const idx = p ? Math.max(0, p.slots.findIndex(s => !s)) : 0;
    return this.refs.slotRow.children[idx] || this.refs.slotRow.children[0];
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
  _createGhost(card, e) {
    const g = this._ghostEl(card);
    g.id = 'dragGhost';
    g.classList.add('dragging');
    g.style.left = e.clientX + 'px';
    g.style.top = e.clientY + 'px';
    document.body.appendChild(g);
    this._drag = g;
  },
  _moveGhost(e) {
    if (!this._drag) return;
    this._drag.style.left = e.clientX + 'px';
    this._drag.style.top = e.clientY + 'px';
  },
  _removeGhost() { if (this._drag) { this._drag.remove(); this._drag = null; } },

  // 判定：鼠标下的卡槽，且拖拽卡(1.3×)覆盖该槽面积 ≥ 50% 才算"装入"，否则回退背包
  _dropTargetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const d = el.closest('[data-drop]');
    if (!d) return null;
    const ghost = this._drag;
    const gw = ghost ? ghost.offsetWidth : 54, gh = ghost ? ghost.offsetHeight : 54;
    const r = d.getBoundingClientRect();
    const ix = Math.max(0, Math.min(x + gw / 2, r.right) - Math.max(x - gw / 2, r.left));
    const iy = Math.max(0, Math.min(y + gh / 2, r.bottom) - Math.max(y - gh / 2, r.top));
    if (ix * iy / (gw * gh) >= 0.5) {
      return { type: d.dataset.drop, index: parseInt(d.dataset.idx, 10), el: d };
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
          if (SQ[qy * map.FW + qx] === 1) ctx.fillRect(x0 + qx * qpx, y0 + qy * qpy, qpx, qpy);
    } else if (map.solid && map.width && map.height) {
      const W = map.width, H = map.height;
      ctx.fillStyle = '#d7ddcf'; ctx.fillRect(x0, y0, S, S);
      ctx.fillStyle = '#11130f';
      const px = S / W, py = S / H, solid = map.solid;
      for (let ty = 0; ty < H; ty++)
        for (let tx = 0; tx < W; tx++)
          if (solid[ty * W + tx] === 1) ctx.fillRect(x0 + tx * px, y0 + ty * py, px, py);
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
