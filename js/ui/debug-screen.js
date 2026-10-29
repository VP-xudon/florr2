// debug-screen.js — F3 调试屏幕（类 Minecraft F3）。
// 取代原来的两个聊天指令：
//   /pending crash <0|1>  -> 屏幕打开时自动显示碰撞箱（C 键可单独开关）
//   /show-coord           -> 坐标常驻在 Player 栏
// 另外：小地图上的生物点（粉色）只在调试屏幕打开时绘制（见 game._drawMinimap 调用处）。
// 性能：只在可见时更新，且限频 5Hz；所有数值写入已缓存的 span，不重建 DOM。
'use strict';

const DebugScreen = {
  game: null,
  on: false,
  refs: null,
  v: {},              // 字段名 -> 值元素
  _acc: 0,
  // 注意：这里【不再】自己统计帧率。update(dt) 的 dt 是固定模拟步长，
  // 数出来的永远是 60（卡到 3fps 也显示 60）。真实帧率由主循环写进 game.perf.fps/sps。

  init(game) {
    this.game = game;
    const root = document.createElement('div');
    root.id = 'f3';
    root.className = 'hidden';
    root.innerHTML = `
      <div class="f3-col">
        <div class="f3-head">${I18N.t('F3/Frame', 'Frame')}</div>
        ${row('fps', I18N.t('F3/Fps', 'FPS'))}
        ${row('sps', I18N.t('F3/Steps', 'Sim steps'))}
        ${row('frameMs', I18N.t('F3/FrameMs', 'Frame'))}
        ${row('updateMs', I18N.t('F3/UpdateMs', 'Update'))}
        ${row('renderMs', I18N.t('F3/RenderMs', 'Render'))}
        ${row('heap', I18N.t('F3/Heap', 'JS heap'))}
        <div class="f3-head">${I18N.t('F3/Player', 'Player')}</div>
        ${row('x', I18N.t('F3/X', 'X'))}
        ${row('y', I18N.t('F3/Y', 'Y'))}
        ${row('cp', I18N.t('F3/Region', 'Checkpoint'))}
        ${row('facing', I18N.t('F3/Facing', 'Facing'))}
        ${row('speed', I18N.t('F3/Speed', 'Speed'))}
        ${row('maxSpeed', I18N.t('F3/MaxSpeed', 'Max'))}
        ${row('mode', I18N.t('F3/Mode', 'Mode'))}
        ${row('hp', I18N.t('F3/Hp', 'HP'))}
        ${row('inv', I18N.t('F3/Invuln', 'Invulnerable'))}
      </div>
      <div class="f3-col">
        <div class="f3-head">${I18N.t('F3/Engine', 'Engine')}</div>
        ${row('mobs', I18N.t('F3/Mobs', 'Mobs'))}
        ${row('visible', I18N.t('F3/Visible', 'On screen'))}
        ${row('asleep', I18N.t('F3/Asleep', 'Sleeping'))}
        ${row('drops', I18N.t('F3/Drops', 'Drops'))}
        ${row('cards', I18N.t('F3/Cards', 'Ground cards'))}
        ${row('parts', I18N.t('F3/Particles', 'Particles'))}
        ${row('texts', I18N.t('F3/Texts', 'Damage texts'))}
        ${row('tick', I18N.t('F3/Tick', 'Server tick'))}
        ${row('snap', I18N.t('F3/SnapAge', 'Snapshot age'))}
        ${row('pred', I18N.t('F3/PredErr', 'Prediction error'))}
        <div class="f3-head">${I18N.t('F3/Petals', 'Petals')}</div>
        <div id="f3Petals" class="f3-petals"></div>
      </div>
      <div class="f3-hint">${I18N.t('F3/Hint', 'F3: toggle this screen    C: collision boxes')}</div>
    `;
    document.body.appendChild(root);
    this.refs = { root, petals: root.querySelector('#f3Petals') };
    const map = {};
    for (const el of root.querySelectorAll('[data-k]')) map[el.dataset.k] = el;
    this.v = map;
  },

  toggle() {
    this.on = !this.on;
    if (this.refs) this.refs.root.classList.toggle('hidden', !this.on);
    // 碰撞箱跟着调试屏幕走（C 键仍可单独关掉，便于只看数据）
    if (this.game) {
      this.game.showHitbox = this.on;
    }
    this._acc = 1;              // 立刻刷新一帧
    if (this.on) this.update(0);
  },

  // 每帧调用；但只有可见且攒够 0.2s 才真正更新 DOM
  // 【帧率不在这里统计】：update(dt) 拿到的是【固定模拟步长】(1/60)，不是真实帧间隔，
  // 所以在这里数调用次数永远得到 ~60（卡到 3fps 也显示 60）。真实帧率由主循环
  // 用 rAF 间隔算好写进 perf.fps / perf.sps（见 game.js start()），这里只负责显示。
  update(dt) {
    if (!this.on || !this.refs) return;
    this._acc += dt;
    if (this._acc < 0.2) return;
    this._acc = 0;
    try { this._refresh(); } catch (e) { console.error('[F3]', e); }
  },

  _set(k, s) { const el = this.v[k]; if (el && el.textContent !== s) el.textContent = s; },

  _refresh() {
    const g = this.game, p = g.player, perf = g.perf || {};
    // 真实帧率 / 每秒实际模拟步数（<60 表示在慢放：补步被 MAX_STEPS 截断）
    const fps = (perf.fps != null) ? perf.fps
      : (perf.frameMs > 0 ? 1000 / perf.frameMs : 0);
    this._set('fps', fps >= 10 ? fps.toFixed(0) : fps.toFixed(1));
    this._set('sps', (perf.sps != null ? perf.sps : 0).toFixed(0) + ' /s');
    this._set('frameMs', fmtMs(perf.frameMs));
    this._set('updateMs', fmtMs(perf.updateMs));
    this._set('renderMs', fmtMs(perf.renderMs));
    const mem = performance.memory;
    this._set('heap', mem ? (mem.usedJSHeapSize / 1048576).toFixed(1) + ' MB' : '—');

    if (p) {
      this._set('x', p.x.toFixed(1));
      this._set('y', p.y.toFixed(1));
      const cps = (g.map && g.map.checkpoints) || [];
      const cp = cps[g.cpIdx] || cps[0];
      this._set('cp', cp ? ('#' + (g.cpIdx || 0) + ' (' + Math.round(cp.cx) + ', ' + Math.round(cp.cy) + ')') : '—');
      // 朝向：先归一到 [0,360) 再显示。facing 本身可能被写成 -3.7rad 之类的任意值，
      // 直接乘 180/PI 会得到负角/上千度的数字（曾经的 "Facing 无穷大" 就是这个）。
      const deg = (((p.facing || 0) * 180 / Math.PI) % 360 + 360) % 360;
      this._set('facing', deg.toFixed(0) + '°');
      const spd = Math.hypot(p.vx || 0, p.vy || 0);
      this._set('speed', spd.toFixed(0) + ' px/s');
      const maxSpd = (typeof PLAYER_BASE_SPEED !== 'undefined')
        ? PLAYER_BASE_SPEED * (typeof MOVE_MULT !== 'undefined' ? MOVE_MULT : 1) : 0;
      this._set('maxSpeed', maxSpd.toFixed(0) + ' px/s');
      this._set('mode', String(p.mode || 'normal'));
      this._set('hp', Math.round(p.hp) + ' / ' + Math.round(p.maxHp));
      const inv = (p.invulnUntil && p.invulnUntil > performance.now()) ? (p.invulnUntil - performance.now()) / 1000 : 0;
      this._set('inv', inv > 0 ? inv.toFixed(1) + ' s' : '—');
    }

    this._set('mobs', String(g.mobs.length));
    this._set('visible', String((g._visibleMobs || []).length));
    let asleep = 0;
    const R2 = (typeof MOB_ACTIVE_R !== 'undefined' ? MOB_ACTIVE_R : 2200) ** 2;
    if (p) for (const m of g.mobs) {
      const dx = m.x - p.x, dy = m.y - p.y;
      if (dx * dx + dy * dy > R2) asleep++;
    }
    this._set('asleep', String(asleep));
    this._set('drops', String((g.drops || []).length));
    this._set('cards', String((g.cards || []).length));
    this._set('parts', String((g.particles || []).length + (g.dropFx || []).length
      + (g.auraFx || []).length));
    this._set('texts', String((g.dmgTexts || []).length));
    this._set('tick', String(perf.snapCount != null ? perf.snapCount : '—'));
    this._set('snap', perf.snapAge != null ? (perf.snapAge * 1000).toFixed(0) + ' ms' : '—');
    this._set('pred', perf.predErr != null ? perf.predErr.toFixed(1) + ' px' : '—');

    // 花瓣栏：按【装备槽】列（不是按存活实体）——装填中/已碎的槽也要看得见。
    //   · 血量百分比 = 本槽所有存活实体的 hp 总和 / maxHp 总和，并钳到 0~100。
    //     以前直接拿单个实体的 b.hp 算：实体碎裂后 hp 可能是 -29 这种负值，
    //     于是显示成 -2900%，除此之外只有满血的 100%（中间值永远看不到，因为
    //     客户端花瓣血量是整体替换的，掉血那一下就已经碎了）。
    //   · 状态：装填中 / 已碎 / 转速，三者只显示一个。
    const spin = (typeof PETAL_SPIN !== 'undefined')
      ? PETAL_SPIN * (typeof ROT_SCALE !== 'undefined' ? ROT_SCALE : 1) : 0;
    const rpm = spin * 60 / (Math.PI * 2);
    const rotTxt = spin.toFixed(2) + ' rad/s (' + rpm.toFixed(0) + ' rpm)';
    const bits = [];
    const slots = (p && p.slots) || [];
    const bodies = (p && p.petals) || [];
    for (let i = 0; i < slots.length; i++) {
      const card = slots[i];
      if (!card) continue;
      const name = (card.type && card.type.name) ? card.type.name : '?';
      const rar = (typeof RARITIES !== 'undefined' && RARITIES[card.rarity]) ? RARITIES[card.rarity] : null;
      let hp = 0, maxHp = 0, live = 0;
      for (let j = 0; j < bodies.length; j++) {
        const b = bodies[j];
        if (b.dead || b.slotIndex !== i || b.card !== card) continue;
        live++;
        hp += Math.max(0, b.hp || 0);
        maxHp += Math.max(0, b.maxHp || 0);
      }
      const pct = (maxHp > 0) ? Math.round(clamp(100 * hp / maxHp, 0, 100)) + '%' : '—';
      const reloading = (typeof p.reloadDone === 'function') ? !p.reloadDone(i) : false;
      let state;
      if (reloading) state = I18N.t('F3/Reload', 'Reload');
      else if (!live) state = I18N.t('F3/Dead', 'dead');
      else state = rotTxt;
      const color = rar ? ' style="color:' + rar.color + '"' : '';
      bits.push('<div class="f3-petal"><b>' + i + '</b> <span' + color + '>' +
        esc(name) + '</span> <i>' + pct + '</i> <em>' + esc(state) + '</em></div>');
    }
    const html = bits.length ? bits.join('') : '<div class="f3-petal">' + I18N.t('F3/None', 'none') + '</div>';
    if (this.refs.petals._html !== html) {
      this.refs.petals.innerHTML = html;
      this.refs.petals._html = html;
    }
  }
};

function row(k, label) {
  return '<div class="f3-row"><span class="f3-k">' + label + '</span><span class="f3-v" data-k="' + k + '">—</span></div>';
}
function fmtMs(v) { return (v == null) ? '—' : (v.toFixed(2) + ' ms'); }
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
