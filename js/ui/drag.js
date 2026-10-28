// ui/drag.js — 拖拽、飞卡与吸附：统一的一套幽灵元素动画
'use strict';

Object.assign(UI, {
  // ---------------- 交互：点击 / 拖拽 ----------------
  // 鼠标 / 触摸 / 触控笔统一走 Pointer Events（老浏览器退回 mouse + touch 双通道）。
  // 触屏上必须声明 touch-action:none，否则浏览器会把"手指按住拖动"当成页面滚动，
  // 直接发 pointercancel 把这次拖拽掐掉 —— 这就是移动端拖不动卡牌的根因。
  _bindCard(el, card, from, onClick) {
    el.style.touchAction = 'none';
    const down = (e) => {
      const type = e.pointerType || (e.touches ? 'touch' : 'mouse');
      if (type === 'mouse') {
        if (e.button !== 0) return;
        // 触摸后浏览器会补发一次合成 mouse 事件：800ms 内一律忽略，避免一次点击算两次
        if (performance.now() - (this._lastTouchTs || -1e9) < 800) return;
      } else {
        this._lastTouchTs = performance.now();
        if (e.touches && e.touches.length > 1) return;   // 双指缩放等手势不参与拖卡
      }
      e.preventDefault();
      if (type !== 'mouse') this._hideTip();   // 触屏没有 hover：别让悬浮框黏在卡上
      this._beginPointer(card, from, e, onClick, el);
    };
    if (window.PointerEvent) {
      el.addEventListener('pointerdown', down);
      el.addEventListener('contextmenu', (e) => e.preventDefault());   // 长按不弹系统菜单
    } else {
      el.addEventListener('mousedown', down);
      el.addEventListener('touchstart', down, { passive: false });
    }
  },
  // 画廊卡「按住前先取走一张」：库存不足直接返回 false，整次交互不产生任何效果
  _canTakeFromGallery(card) {
    if (window.__debug) return true;
    const key = card.type.key + '|' + card.rarity;
    if (!this._gc) this._gc = {};
    if (this._gc[key] === undefined) this._gc[key] = this._gcDefault(key);
    return this._gc[key] > 0;
  },

  _beginPointer(card, from, ev, onClick, srcEl) {
    // 库存校验必须在最前面：卡已取完时连点击都不生效，避免"按了却凭空多出一张"
    if (from.type === 'gallery' && !this._canTakeFromGallery(card)) return;
    // ---- 指针归一化：PointerEvent / MouseEvent / TouchEvent 三种来源取同一组坐标 ----
    // 只用 pointerId 过滤（多指时每根手指各走一次交互，互不干扰）。
    const isTouch = ev.pointerType === 'touch' || !!ev.touches;
    const pid = (ev.pointerId != null) ? ev.pointerId : null;
    const pt = (e) => {
      if (e.changedTouches || e.touches) {
        const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
        return t ? { x: t.clientX, y: t.clientY } : null;
      }
      return { x: e.clientX, y: e.clientY };
    };
    const own = (e) => pid == null || e.pointerId == null || e.pointerId === pid;
    const startPt = pt(ev) || { x: 0, y: 0 };
    const startX = startPt.x, startY = startPt.y;
    const startTime = ev.timeStamp || performance.now();
    let windowsClosed = false;   // 延迟关闭窗口标志
    const bagWasOpen = !this.refs.inv.classList.contains('hidden');   // 拖拽前背包是否开着（用于落点后自动重开）
    let dragging = false;        // 是否已进入拖拽态（已生成幽灵）
    let over = false;            // 本次交互是否已结束
    let movedMax = 0;            // 指针最大位移（判"原位松手"用）

    // 进入拖拽态才生成幽灵：卡片会被放大到 1.3 倍、开始跟随指针，源卡即时隐藏。
    // （点击路径绝不调用它 —— 0.1s 内松手时卡片不放大、不变形、不产生幽灵。）
    const startDrag = (p) => {
      if (dragging || over) return;
      dragging = true;
      this._hideTip();
      this._createGhost(card, p, srcEl);
      // 暂不关闭窗口，等按住时长够再关
      if (from.type === 'gallery') { this._decGallery(card); this.renderInventory(); }
      // 卡槽/物品栏卡：拿起瞬间隐藏源卡，由幽灵从原卡中心无缝接替（不再有残影）
      else if (srcEl && srcEl.isConnected) srcEl.style.visibility = 'hidden';
      // 记住来源：自动对齐【只有背包拖出的卡】才有，卡槽内拖出的统一不吸附
      this._dragFrom = from.type;
    };

    // 0.1s 后仍未松手 -> 升级为拖拽（此时才放大、才产生幽灵）
    const clickTimer = setTimeout(() => startDrag(startPt), 100);

    const move = (e) => {
      if (over || !own(e)) return;
      const q = pt(e);
      if (!q) return;
      if (isTouch) e.preventDefault();     // 拖卡期间不让页面跟着滚（需 passive:false）
      const md = Math.abs(q.x - startX) + Math.abs(q.y - startY);
      if (md > movedMax) movedMax = md;
      if (!dragging) {
        // 还没到 0.1s，但已经明显移动 -> 也立即升级为拖拽
        if (md <= 6) return;
        clearTimeout(clickTimer);
        startDrag(q);
      }
      const held = (e.timeStamp || performance.now()) - startTime;
      if (held >= 200 && !windowsClosed) {
        // 按住≥0.2s -> 识别为拖拽，立即关闭窗口
        this._closeAllWindows();
        windowsClosed = true;
      }
      this._moveGhost(q);
    };
    const up = (e) => {
      if (!own(e)) return;
      unbind();
      if (over) return;
      over = true;
      clearTimeout(clickTimer);
      const q = pt(e) || { x: startX, y: startY };
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
        : this._dropTargetAt(q.x, q.y);
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
          // 拖出背包时关闭了背包窗口：装入卡槽后自动重新打开（像硬窗口一样跟手）
          if (windowsClosed && bagWasOpen) {
            this.refs.inv.classList.remove('hidden');
            if (window.__game) window.__game.renderInventory();
          }
        });
    };
    // 指针被系统抢走（触屏上来了电话 / 手势被系统判定为返回）：按"取消"收尾，绝不留下幽灵
    const cancel = (e) => {
      if (!own(e)) return;
      unbind();
      if (over) return;
      over = true;
      clearTimeout(clickTimer);
      if (dragging) {
        if (from.type === 'gallery') { this._incGallery(card); this.renderInventory(); }
        this._removeGhost();
      }
      this._restoreAfterCancel(from);
    };

    const usePtr = !!window.PointerEvent;
    const evs = usePtr
      ? [['pointermove', move, { passive: false }], ['pointerup', up], ['pointercancel', cancel]]
      : [['mousemove', move], ['mouseup', up],
         ['touchmove', move, { passive: false }], ['touchend', up], ['touchcancel', cancel]];
    function unbind() {
      for (const [n, fn, opt] of evs) window.removeEventListener(n, fn, opt);
    }
    for (const [n, fn, opt] of evs) window.addEventListener(n, fn, opt);
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
  // p = { x, y }（已归一化的指针坐标，鼠标/触摸通用）
  _createGhost(card, p, srcEl) {
    // 防御：上一次交互的幽灵还挂着（快速连点时飞行动画未结束）-> 立即清掉，绝不叠加；
    // 待触发的完成回调仍会照常执行（其 _removeGhost 只会移除它自己的幽灵）
    if (this._drag) { this._drag.remove(); this._drag = null; }
    this._snap = null; this._snapPos = null; this._snapScale = null; this._dragShown = null;
    const g = this._ghostEl(card);
    g.id = 'dragGhost';
    g.classList.add('dragging');
    // 起点 = 源卡牌中心，终点 = 指针位置（缩放 1 -> 1.3）
    let x = p.x, y = p.y;
    const r = (srcEl && srcEl.getBoundingClientRect) ? srcEl.getBoundingClientRect() : null;
    if (r && r.width > 0) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
    g.style.transition = 'none';          // 位置完全交给 JS 跟踪，绝不再让 CSS transition 拖后腿
    g.style.left = x + 'px';
    g.style.top = y + 'px';
    g.style.transform = 'translate(-50%,-50%) scale(1)';
    document.body.appendChild(g);
    this._drag = g;
    this._dragCur = { x: x, y: y };
    this._dragTarget = { x: p.x, y: p.y };   // 目标点 = 指针位置，随后由 pointermove 更新
    this._dragStart = performance.now();
    this._dragLast = 0;
    this._startDragLoop();
  },
  // 跟踪算法：pointermove 只更新"目标点"，实际位置在 rAF 里按指数逼近（帧率无关）。
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
  // p = { x, y }：只更新目标点，由 rAF 循环去追
  _moveGhost(p) {
    if (!this._drag || !this._dragTarget) return;
    this._dragTarget.x = p.x;
    this._dragTarget.y = p.y;
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

});
