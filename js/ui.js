// ui.js — 全部 HUD/面板由 JS 动态生成（无静态 HTML 元素，便于后续动效）
'use strict';

const DEX_MAX_LEVEL = 9;   // 图鉴每个生物展示的等级列数

const UI = {
  root: null,
  refs: {},
  onBagToggle: null,
  onDexToggle: null,
  onSlotClick: null,
  onInvBarClick: null,
  onBagCardClick: null,
  onDrop: null,
  _drag: null,

  init() {
    const root = document.createElement('div');
    root.id = 'ui';
    root.innerHTML = `
      <div id="hud">
        <div id="topbar"><span id="lvl">${I18N.tf('UI/Flower/Level', { 0: 1 }, 'Lvl 1')}</span><span id="pname">${I18N.t('ui.pname', 'Flower')}</span></div>
        <div id="bottom">
          <div id="hpwrap"><div id="hpfill"></div><span id="hptext">100/100</span></div>
          <div id="xpwrap"><div id="xpfill"></div></div>
        </div>
        <button id="bagBtn" title="${I18N.t('UI/Inventory/Title', 'Inventory')} (B)">🎒</button>
        <button id="dexBtn" title="${I18N.t('UI/MobGallery/Title', 'Mob Gallery')} (V)">📖</button>
        <div id="hint">${I18N.t('ui.hint', 'WASD / arrow keys to move · petals attack automatically · B backpack · V pokédex')}</div>
      </div>

      <!-- 即时物品栏：永久可见的淡灰卡槽 -->
      <div id="invBarWrap"><div id="invBar" data-drop="inv" data-idx="-1"></div></div>

      <!-- 背包面板（不显示物品栏；含已装备卡槽 + 背包库存） -->
      <div id="inventory" class="hidden" data-drop="bag" data-idx="-1">
        <div class="inv-title">${I18N.t('UI/Inventory/Title', 'Inventory')}</div>
        <div class="inv-section">${I18N.t('ui.bagSection1', 'Equipped petals (slots · click to unequip / drag to another slot)')}</div>
        <div id="slotRow" class="slot-row"></div>
        <div class="inv-section">${I18N.t('ui.bagSection2', 'Backpack storage (click → inventory · drag → slot/inventory)')}</div>
        <div id="invGrid" class="inv-grid"></div>
        <div class="inv-hint">${I18N.t('ui.bagHint', 'Tip: click an inventory card to equip it to the flower; click a backpack card to move it into inventory (no effect if full); drag cards between backpack/inventory and any slot or the flower.')}</div>
      </div>

      <!-- 图鉴 -->
      <div id="dex" class="hidden">
        <div class="dex-head">
          <div class="inv-title">${I18N.t('UI/MobGallery/Title', 'Mob Gallery')}</div>
          <div id="dexCount" class="dex-count"></div>
        </div>
        <div id="dexBody" class="dex-body"></div>
        <div id="dexManual" class="dex-manual"></div>
      </div>

      <div id="death" class="hidden">
        <div class="death-card">
          <div class="death-title">${I18N.t('UI/Death/Title', 'You were destroyed by:')}</div>
          <div class="death-sub">${I18N.t('ui.deathSub', 'Dropped your equipped petals…')}</div>
          <div id="death-timer">${I18N.t('UI/Death/RevivingSoon', "You'll be revived soon.")}</div>
        </div>
      </div>

      <div id="dexTip" class="hidden"></div>
      <div id="loading">${I18N.t('UI/Title/Loading', 'Loading...')}</div>
    `;
    document.body.appendChild(root);
    this.root = root;

    const $ = (id) => root.querySelector('#' + id);
    this.refs = {
      lvl: $('lvl'), pname: $('pname'),
      hpfill: $('hpfill'), hptext: $('hptext'), xpfill: $('xpfill'),
      bagBtn: $('bagBtn'), dexBtn: $('dexBtn'),
      inv: $('inventory'), slotRow: $('slotRow'), invGrid: $('invGrid'),
      invBar: $('invBar'),
      dex: $('dex'), dexBody: $('dexBody'), dexCount: $('dexCount'), dexManual: $('dexManual'), dexTip: $('dexTip'),
      death: $('death'), deathTimer: $('death-timer'),
      loading: $('loading')
    };

    this.refs.bagBtn.addEventListener('click', () => { if (this.onBagToggle) this.onBagToggle(); });
    this.refs.dexBtn.addEventListener('click', () => { if (this.onDexToggle) this.onDexToggle(); });
  },

  // ---------------- HUD ----------------
  updateHUD(p) {
    const r = this.refs;
    const hpPct = Math.max(0, Math.min(1, p.hp / p.maxHp)) * 100;
    r.hpfill.style.width = hpPct + '%';
    r.hptext.textContent = Math.max(0, Math.ceil(p.hp)) + '/' + p.maxHp;
    r.xpfill.style.width = Math.max(0, Math.min(1, p.xp / p.xpNext)) * 100 + '%';
    r.lvl.textContent = I18N.tf('UI/Flower/Level', { 0: p.level }, 'Lvl ' + p.level);
  },

  setBagVisible(v) { this.refs.inv.classList.toggle('hidden', !v); },
  isBagVisible() { return !this.refs.inv.classList.contains('hidden'); },
  toggleBag() { if (this.onBagToggle) this.onBagToggle(); },

  setDexVisible(v) { this.refs.dex.classList.toggle('hidden', !v); },
  isDexVisible() { return !this.refs.dex.classList.contains('hidden'); },
  toggleDex() { if (this.onDexToggle) this.onDexToggle(); },

  showDeath() { this.refs.death.classList.remove('hidden'); },
  hideDeath() { this.refs.death.classList.add('hidden'); },
  hideLoading() { if (this.refs.loading) this.refs.loading.style.display = 'none'; },

  // ---------------- 即时物品栏（底部常驻） ----------------
  renderInvBar(p) {
    const bar = this.refs.invBar;
    bar.innerHTML = '';
    for (let i = 0; i < p.maxInvBar; i++) {
      const slot = document.createElement('div');
      slot.className = 'invslot';
      slot.dataset.drop = 'inv'; slot.dataset.idx = i;
      const card = p.invBar[i];
      if (card) {
        const col = RARITIES[card.rarity].color;
        slot.style.borderColor = col;
        slot.innerHTML =
          `<div class="invcard" style="border-color:${col}">` +
            `<img src="assets/petals/${card.type.svg}.svg"/>` +
            `<span class="rar" style="background:${col}"></span>` +
            `<span class="nm">${card.type.name}</span>` +
          `</div>`;
        const ic = slot.querySelector('.invcard');
        this._bindCard(ic, card, { type: 'inv', index: i },
          () => { if (this.onInvBarClick) this.onInvBarClick(i); });
      }
      bar.appendChild(slot);
    }
  },

  // ---------------- 背包面板 ----------------
  renderInventory(p) {
    const r = this.refs;
    // 已装备花瓣（卡槽）
    r.slotRow.innerHTML = '';
    for (let i = 0; i < p.slots.length; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.drop = 'slot'; slot.dataset.idx = i;
      const pet = p.slots[i];
      if (pet) {
        const col = pet.type.color;
        slot.style.borderColor = col;
        slot.innerHTML = '<img src="assets/petals/' + pet.type.svg + '.svg"/><span class="rar" style="background:' + col + '"></span>';
        this._bindCard(slot, pet, { type: 'slot', index: i },
          () => { if (this.onSlotClick) this.onSlotClick(i); });
      }
      r.slotRow.appendChild(slot);
    }
    // 背包库存
    r.invGrid.innerHTML = '';
    if (p.backpack.length === 0) {
      const e = document.createElement('div'); e.className = 'empty'; e.textContent = I18N.t('ui.dexEmpty', '(empty)');
      r.invGrid.appendChild(e);
    }
    p.backpack.forEach((card, idx) => {
      const el = document.createElement('div');
      el.className = 'card';
      const col = RARITIES[card.rarity].color;
      el.style.borderColor = col;
      el.innerHTML = '<img src="assets/petals/' + card.type.svg + '.svg"/><span class="rar" style="background:' + col + '"></span><span class="nm">' + card.type.name + '</span>';
      this._bindCard(el, card, { type: 'bag', index: idx },
        () => { if (this.onBagCardClick) this.onBagCardClick(idx); });
      r.invGrid.appendChild(el);
    });
  },

  // 绑定卡片：点击=装入动画；拖拽=跟随光标（放大+轻微旋转摇晃）
  _bindCard(el, card, from, onClick) {
    el.addEventListener('mousedown', (e) => {
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
        // 未拖动 = 点击：带飞入动画后执行
        this._clickAnimate(card, from, srcEl, onClick);
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  },

  _clickAnimate(card, from, srcEl, onClick) {
    let toX, toY;
    if (from.type === 'bag') {
      // 飞向物品栏下一个空槽（或物品栏中心）
      const slot = this._nextInvSlotEl();
      const rect = slot ? slot.getBoundingClientRect() : { left: innerWidth / 2 - 27, top: innerHeight - 60, width: 54, height: 54 };
      toX = rect.left + rect.width / 2; toY = rect.top + rect.height / 2;
    } else {
      // inv / slot -> 飞向花朵中心（屏幕中心）
      toX = innerWidth / 2; toY = innerHeight / 2;
    }
    this._flyCard(srcEl, toX, toY, card, onClick);
  },

  _nextInvSlotEl() {
    const p = window.__game ? window.__game.player : null;
    const idx = p ? Math.min(p.invBar.length, p.maxInvBar - 1) : 0;
    return this.refs.invBar.children[idx] || this.refs.invBar.children[0];
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
    g.innerHTML = `<div class="inner"><img src="assets/petals/${card.type.svg}.svg"/><span class="rar" style="background:${RARITIES[card.rarity].color}"></span></div>`;
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
    if (el.id === 'game' || el.closest('#hud') || el.closest('#invBarWrap')) return { type: 'flower' };
    return { type: 'flower' };
  },

  // ---------------- 图鉴 ----------------
  renderDex(game) {
    const body = this.refs.dexBody;
    body.innerHTML = '';
    let total = 0, got = 0;
    const mobs = MOB_TYPES.slice().sort((a, b) => a.id - b.id);
    for (const m of mobs) {
      total += DEX_MAX_LEVEL;
      const row = document.createElement('div');
      row.className = 'dex-row';
      const label = document.createElement('div');
      label.className = 'dex-label';
      label.innerHTML = `<span class="dex-name">${m.name}</span><span class="dex-tier">T${m.tier}${m.boss ? ' ·Boss' : ''}</span>`;
      row.appendChild(label);
      const slots = document.createElement('div');
      slots.className = 'dex-slots';
      const defeated = game.dex[m.id];
      for (let lv = 1; lv <= DEX_MAX_LEVEL; lv++) {
        const cell = document.createElement('div');
        cell.className = 'dex-cell';
        if (defeated && defeated.has(lv)) {
          got++;
          cell.classList.add('got');
          cell.innerHTML = `<img src="assets/mobs/${m.svg}.svg"/><span class="dex-lv">${lv}</span>`;
          cell.addEventListener('mouseenter', (e) => this._showDexTip(m, lv, e));
          cell.addEventListener('mousemove', (e) => this._moveDexTip(e));
          cell.addEventListener('mouseleave', () => this._hideDexTip());
        }
        slots.appendChild(cell);
      }
      row.appendChild(slots);
      body.appendChild(row);
    }
    const species = game.dex ? Object.keys(game.dex).length : 0;
    this.refs.dexCount.textContent = I18N.tf('ui.dexCount', { n: got, m: total, s: species }, 'Collected {n} / {m} ({s} species)');

    // 待手填 / 已忽略（二创）清单
    const man = this.refs.dexManual;
    if (window.NEEDS_MANUAL && NEEDS_MANUAL.length) {
      man.innerHTML = '<div class="dex-manual-title">' + I18N.t('ui.dexManualTitle', 'Pending manual fill / ignored (fan-made, names not invented):') + '</div>' +
        NEEDS_MANUAL.map(n => `<div class="dex-manual-item">${n.kind} id=${n.id} · ${n.name} — ${n.reason}</div>`).join('');
    } else {
      man.innerHTML = '';
    }
  },

  _showDexTip(m, lv, e) {
    const sc = mobScale(lv);
    const hp = Math.round((m.hp || 0) * sc);
    const dmg = Math.round((m.dmg || 0) * sc);
    const tip = this.refs.dexTip;
    tip.classList.remove('hidden');
    tip.innerHTML =
      `<div class="tip-name">${m.zh || m.name} <span class="tip-en">${m.name}</span></div>` +
      `<div class="tip-row"><b>等级</b> Lv ${lv}</div>` +
      `<div class="tip-row"><b>介绍</b> ${m.desc || '（暂无）'}</div>` +
      `<div class="tip-row"><b>攻击</b> ${dmg}　<b>生命</b> ${hp}</div>` +
      `<div class="tip-row"><b>速度</b> ${m.speed || 0}　<b>类型</b> ${m.type || '—'}</div>` +
      `<div class="tip-row"><b>出没</b> ${m.biome || '—'}　<b>阶</b> T${m.tier}${m.boss ? ' ·Boss' : ''}</div>` +
      `<div class="tip-row"><b>防御</b> —（该来源未提供生物防御值）</div>`;
    this._moveDexTip(e);
  },
  _moveDexTip(e) {
    const tip = this.refs.dexTip;
    let x = e.clientX + 16, y = e.clientY + 16;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > innerWidth) x = e.clientX - w - 16;
    if (y + h > innerHeight) y = e.clientY - h - 16;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  },
  _hideDexTip() { this.refs.dexTip.classList.add('hidden'); },

  // ---------------- 小地图 ----------------
  // 画在【游戏主画布】上（与游戏同一渲染通道，不再作为独立 DOM 元素），rect 为屏幕坐标矩形。
  // 按“能不能走”显示黑白形状（可走=浅色，阻挡=深色），精确到四分之一格(solidQuad)。
  drawMinimap(ctx, rect, map, player, mobs) {
    const S = rect.size, x0 = rect.x, y0 = rect.y;
    const half = map.R || (map.width * (map.tile || 1)) / 2;
    const scale = S / (2 * half);
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,9,0.55)';
    ctx.fillRect(x0 - 5, y0 - 5, S + 10, S + 10);
    if (map.solidQuad && map.FW && map.FH) {
      const W = map.width, H = map.height;
      ctx.fillStyle = '#d7ddcf';                       // 可走：浅色底
      ctx.fillRect(x0, y0, S, S);
      ctx.fillStyle = '#11130f';                       // 阻挡：深色
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
    ctx.fillStyle = '#e05a4a';
    for (const m of mobs) if (!m.dead) { ctx.beginPath(); ctx.arc(x0 + m.x * scale + S / 2, y0 + m.y * scale + S / 2, m.boss ? 3 : 1.6, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x0 + player.x * scale + S / 2, y0 + player.y * scale + S / 2, 2.4, 0, TAU); ctx.fill();
    ctx.restore();
  }
};
