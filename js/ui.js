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
  _invBuilt: false,   // 画廊内容静态：只构建一次
  _dexBuilt: false,

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
        <div class="win-body"><div id="invGallery" class="gallery"></div></div>
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

  // ---------------- 背包窗口：所有花瓣 × 全部稀有度 ----------------
  // 每个稀有度一组；组内按名称字典序、桌面图标式自动换行；组间分割线标稀有度名（对应颜色）。
  renderInventory() {
    if (this._invBuilt) return;          // 画廊内容静态：只构建一次，避免每次拖放重建 900+ 卡
    const g = this.refs.invGallery;
    g.innerHTML = '';
    const rarName = (r) => I18N.t('Rarities/' + r + '/Name', r);
    const petals = PETAL_TYPES.slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const rar of RARITY_ORDER) {
      const col = (RARITIES[rar] && RARITIES[rar].color) || '#fff';
      g.appendChild(this._rarGroup(rarName(rar), col, petals, rar));
    }
    this._invBuilt = true;
  },

  // 生成一个「稀有度分组」：分割线 + 卡片网格
  _rarGroup(name, color, petals, rarity) {
    const group = document.createElement('div');
    group.className = 'rar-group';
    group.style.color = color;
    const div = document.createElement('div');
    div.className = 'rar-divider';
    div.innerHTML = `<span class="rar-line"></span><span class="rar-name">${name}</span><span class="rar-line"></span>`;
    group.appendChild(div);
    const grid = document.createElement('div');
    grid.className = 'rar-grid';
    for (const p of petals) {
      const cell = document.createElement('div');
      cell.className = 'cardcell';
      cell.appendChild(CardRenderer.createCard({ rarity, svg: p.svg }));
      const card = { type: p, rarity };
      this._bindCard(cell, card, { type: 'gallery', index: -1 },
        () => { if (this.onGalleryCardClick) this.onGalleryCardClick(card); });
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
  _bindTip(el, type, rarity) {
    el.addEventListener('mouseenter', (e) => this._showTip(type, rarity, e));
    el.addEventListener('mousemove', (e) => this._moveTip(e));
    el.addEventListener('mouseleave', () => this._hideTip());
  },
  _showTip(type, rarity, e) {
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
    this._moveTip(e);
  },
  _moveTip(e) {
    const tip = this.refs.tip, pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad;
    const r = tip.getBoundingClientRect();
    if (x + r.width > innerWidth) x = e.clientX - r.width - pad;
    if (y + r.height > innerHeight) y = e.clientY - r.height - pad;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
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
        }
      }
      if (dragging) this._moveGhost(e);
    };
    const up = (e) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (dragging) {
        const target = this._dropTargetAt(e.clientX, e.clientY);
        this._removeGhost();
        if (this.onDrop) this.onDrop({ card, from }, target);
      } else if (onClick) {
        this._clickAnimate(card, from, srcEl, onClick);
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
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
    g.appendChild(CardRenderer.createCard({ rarity: card.rarity, svg: card.type.svg, size: 54 }));
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

  _dropTargetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return { type: 'flower' };
    const d = el.closest('[data-drop]');
    if (d) return { type: d.dataset.drop, index: parseInt(d.dataset.idx, 10) };
    return { type: 'flower' };
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
