// ui/minimap.js — 小地图：大小三档、平滑过渡与位图缓存
'use strict';

Object.assign(UI, {
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
      const size = 160 * 0.5;   // 命中区域按【最小档】尺寸判定：指针碰到小地图才展开，不再提前到中档
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

});
