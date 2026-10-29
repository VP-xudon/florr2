// ui/bossbar.js — 屏幕顶部 Boss 血条（Eternal / Super）
// 'use strict';
//
// 规则（用户口径）：
//   · 只显示 Eternal 与 Super；
//   · 【Eternal 永远优先于 Super】，先按稀有度分层，层内再按距离排序；
//   · 1~3 只全部显示，沿屏幕中轴线【上下排布】；超过 3 只才择优（取前 3）；
//   · 仅当它在「视野内」或「视野外 150% 距离内」才显示（矩形口径：半宽 = W*0.75）；
//   · 每条血条：正中央上方 = 生物名称，正下方 = 稀有度；
//   · 显示 / 隐藏都有快速的渐大渐小 + 淡入淡出（不是硬切），位置变化也平滑。
//
// 绘制是屏幕空间的（在 Game.render 的 ctx.restore() 之后），不随相机滚动；
// 血量取视图实体的 dispHp（与生物名牌同一条平滑链路），所以掉血也是滑的。
const BossBar = {
  game: null,
  items: [],          // [{ id, mob, a, slot, y, targetY }]，按显示槽位排列
  MAX: 3,             // 最多同时显示 3 条
  REACH: 1.5,         // 视野外扩比例：1.5 = 视野外 150% 距离内
  // 文字：名称 16×1.8 = 28.8（压在条顶边上，上半截出条），稀有度 10×1.8×0.9 = 16.2
  // （压在条底边上，下半截出血条）。一整条文字的纵向跨度约 58px —— 行距必须跟着放大，
  // 否则上一行的稀有度会压住下一行的名称。
  GAP: 34,            // 条与条之间的垂直间距（加在实际画出的条高之后）
  TOP: 30,            // 第一条血条的【顶边】距屏幕顶端（名称只压半个字高，不需要额外留白）

  init(game) {
    this.game = game;
    this.items = [];
  },

  // 尺寸：文字字号固定（名称 16×1.8 / 稀有度 10×1.8），不随血条高度缩放。
  // BAR_K = 血条图形的整体倍率：宽、高、描边、内条、圆角【一起】乘它，中心仍是 (cx, cy)。
  // bh 是设计高度（再乘 BAR_K）。上一版绘制高度 33.6px，这次要 1.1 倍：
  //   33.6 × 1.1 = 36.96px（屏幕上实际画出来的高度）
  //   36.96 / BAR_K(0.7) = 52.8  ->  bh = 52.8
  BAR_K: 0.7,
  _size(g) {
    return { bh: 52.8, bw: Math.min(520, g.W * 0.36) };
  },

  // 第 i 条血条的垂直中心（沿中轴线从上往下排）
  // 行距按【实际画出的高度】算（bh × BAR_K）：设计高度还要乘 BAR_K，直接用 bh 会差一个倍率。
  _slotY(g, i) {
    const { bh } = this._size(g);
    const bhv = bh * this.BAR_K;
    return this.TOP + bhv / 2 + i * (bhv + this.GAP);
  },

  // 选取要展示的 Boss 列表：范围过滤 -> 稀有度优先 -> 距离排序 -> 截断到 MAX
  _pick() {
    const g = this.game;
    if (!g || !g.camera) return [];
    const hw = g.W * 0.5 * this.REACH;
    const hh = g.H * 0.5 * this.REACH;
    const camX = g.camera.x, camY = g.camera.y;
    const list = [];
    for (const m of g.mobs) {
      if (!m || m.dead || m.gone) continue;
      // 稀有度优先级：数字越小越优先（Eternal 永远排在 Super 前面）。
      // 这里内联字符串判断，避免每帧对 4000+ 视图做函数调用。
      const rank = (m.rarity === 'eternal') ? 0 : (m.rarity === 'super' ? 1 : -1);
      if (rank < 0) continue;
      const dx = m.x - camX, dy = m.y - camY;
      if (Math.abs(dx) > hw || Math.abs(dy) > hh) continue;   // 视野 + 外扩 150% 之外
      list.push({ m, rank, d: dx * dx + dy * dy });
    }
    // 关键：先 rank（Eternal 0 < Super 1），再距离 —— 不是"距离优先再比稀有度"。
    list.sort((a, b) => (a.rank - b.rank) || (a.d - b.d));
    return list.slice(0, this.MAX).map((x) => x.m);
  },

  update(dt) {
    const g = this.game;
    if (!g) return;
    // 选取要扫全图 4000+ 只（距离/稀有度/排序），10Hz 足够；渐大渐小的动画仍按帧推进。
    this._pickAcc = (this._pickAcc || 0) + dt;
    if (!this._want || this._pickAcc >= 0.1) {
      this._pickAcc = 0;
      this._want = this._pick();
    }
    const want = this._want;
    const byId = new Map();
    for (let i = 0; i < want.length; i++) byId.set(want[i].netId, i);

    // 1) 已有条目：更新目标槽位（不在 want 里的渐隐，但保留它把缩小动画画完）
    for (const it of this.items) {
      const slot = byId.has(it.id) ? byId.get(it.id) : -1;
      it.slot = slot;
      if (slot >= 0) {
        it.mob = want[slot];
        it.targetY = this._slotY(g, slot);
      }
    }
    // 2) 新条目：从槽位上方 14px 处滑入 + 从 0 放大
    for (let i = 0; i < want.length; i++) {
      const m = want[i];
      if (this.items.some((it) => it.id === m.netId)) continue;
      const y = this._slotY(g, i);
      this.items.push({ id: m.netId, mob: m, a: 0, slot: i, y: y - 14, targetY: y });
    }
    // 3) 动画：a 控制缩放/透明度，y 控制上下排布滑动
    for (const it of this.items) {
      const on = it.slot >= 0;
      it.a = damp(it.a, on ? 1 : 0, on ? 24 : 18, dt);
      it.y = damp(it.y, it.targetY, 18, dt);
    }
    this.items = this.items.filter((it) => it.a > 0.002 || it.slot >= 0);
  },

  draw(ctx, g) {
    if (!g || !this.items.length) return;
    for (const it of this.items) {
      if (it.a <= 0.002 || !it.mob) continue;
      this._drawOne(ctx, g, it);
    }
  },

  _drawOne(ctx, g, it) {
    const m = it.mob;
    const { bw, bh } = this._size(g);
    // 血条图形尺寸（BAR_K = 0.7）：宽高一起缩，中心仍是 (cx, cy)
    const k = this.BAR_K;
    const bwv = bw * k, bhv = bh * k;
    const a = clamp(it.a, 0, 1);
    const cx = g.W / 2;
    const cy = it.y;
    const s = 0.72 + 0.28 * a;                 // 渐大 / 渐小

    // 血量口径与主角血条完全一致：主条（dispHp，快阻尼）+ 灰色残影（ghostHp，欠阻尼弹簧）。
    const hp = clamp((m.dispHp == null ? m.hp : m.dispHp) / Math.max(1, m.maxHp), 0, 1);
    const ghost = clamp((m.ghostHp == null ? m.hp : m.ghostHp) / Math.max(1, m.maxHp), 0, 1);
    // 无敌视觉强度（0..1 平滑）：进入/退出都连续插值，血条整体过渡到「白底 + 金色填充」。
    // 生物目前没有无敌来源，恒为 0；一旦实体挂上 invulnA 就自动同步，不需要改这里。
    const gold = clamp(m.invulnA || 0, 0, 1);
    const rar = (typeof RARITIES !== 'undefined' && RARITIES[m.rarity]) ? RARITIES[m.rarity] : null;
    const rarName = (typeof I18N !== 'undefined')
      ? I18N.t('Rarities/' + m.rarity + '/Name', m.rarity) : m.rarity;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);

    // 外框：深色半透明长条（参考 bosbar.png 的胶囊形）
    roundRectPath(ctx, cx - bwv / 2, cy - bhv / 2, bwv, bhv, bhv / 2);
    ctx.fillStyle = 'rgba(12,16,10,0.66)';
    ctx.fill();
    ctx.lineWidth = 3 * k;
    ctx.strokeStyle = 'rgba(0,0,0,0.72)';
    ctx.stroke();

    // 血条：与主角血条同一套绘制口径 ——
    //   底色 #2b2b33（无敌时插值到白）、灰色残影 #b9bec8（慢跟随）、主条 hpBarColor（连续渐变）、
    //   黑色描边。无敌期间三者一起用 invulnA 做连续插值，不是硬切换。
    // 内条高度按背板高度等比取（32/40 = 0.8，上下各留 10%），改条高时不会变成"厚背板里一根细条"。
    const padX = 6 * k;
    const iw = bwv - padX * 2;
    const ih = bhv * 0.8;
    const ir = ih / 2;
    const ix = cx - bwv / 2 + padX;
    const iy = cy - ih / 2;
    roundRectPath(ctx, ix, iy, iw, ih, ir);
    ctx.fillStyle = mixHex('#2b2b33', INVULN_BAR_BACK, gold);
    ctx.fill();
    if (ghost > 0) {
      roundRectPath(ctx, ix, iy, Math.max(ih, iw * ghost), ih, ir);
      ctx.fillStyle = mixHex('#b9bec8', INVULN_BAR_BACK, gold);
      ctx.fill();
    }
    if (hp > 0) {
      roundRectPath(ctx, ix, iy, Math.max(ih, iw * hp), ih, ir);
      ctx.fillStyle = mixHex(hpBarColor(hp), INVULN_BAR_FILL, gold);
      ctx.fill();
    }
    ctx.lineWidth = Math.max(1.2, ih * 0.1);
    ctx.strokeStyle = '#000';
    roundRectPath(ctx, ix, iy, iw, ih, ir);
    ctx.stroke();

    // 文字：名称在上、稀有度在下，都水平居中；黑描边保证压在血条上也读得清。
    // 字号统一 1.8 倍（名称 16 -> 28.8、稀有度 10 -> 18）。
    // 【名称压半个字高】：名称的视觉垂直中心正好落在【条顶边】上 ——
    // 上半截在条外、下半截压在血条上（既不是整块压在条上，也不是整块离开条）。
    // 用实测 ascent/descent（含 Centipede 的 p 这类下伸笔画），不按字号硬猜，
    // 否则换个名字就会变成"全部在条上"或"全部在条外"。
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    const FS = 1.8;
    const fsN = 16 * FS;
    ctx.font = `800 ${fsN}px ${CardRenderer.FONT}`;
    ctx.lineWidth = fsN * 0.18;
    ctx.strokeStyle = '#000';
    const tmN = ctx.measureText(m.name);
    const ascN = (tmN.actualBoundingBoxAscent > 0) ? tmN.actualBoundingBoxAscent : fsN * 0.72;
    const descN = (tmN.actualBoundingBoxDescent >= 0) ? tmN.actualBoundingBoxDescent : fsN * 0.2;
    // 视觉中心 = 基线 + (desc - asc)/2；令它等于条顶边 -> 基线 = 条顶边 + (asc - desc)/2
    const ny = (cy - bhv / 2) + (ascN - descN) * 0.5;
    ctx.strokeText(m.name, cx, ny);
    ctx.fillStyle = '#fff';
    ctx.fillText(m.name, cx, ny);

    const fsR = 10 * FS * 0.9;      // 稀有度字号 = 1.8 × 0.9 = 1.62 倍（比名称小一档）
    ctx.font = `800 ${fsR}px ${CardRenderer.FONT}`;
    ctx.lineWidth = fsR * 0.2;
    // 【稀有度压半个字高】：视觉垂直中心正好落在【条底边】上 ——
    // 上半截压在血条上、下半截出血条（与名称落在条顶边的规则严格对称，合起来就是
    // "名称上半截在条外、稀有度下半截在条外"）。旧写法是硬编码 `cy + bhv*0.4`，
    // 实测视觉中心落在条内、离底边还有 8px，看起来"整块都挤在条里且偏上"。
    // 与名称一样用实测 ascent/descent 定位，换语言/换单词都不会变形。
    const tmR = ctx.measureText(rarName);
    const ascR = (tmR.actualBoundingBoxAscent > 0) ? tmR.actualBoundingBoxAscent : fsR * 0.72;
    const descR = (tmR.actualBoundingBoxDescent >= 0) ? tmR.actualBoundingBoxDescent : fsR * 0.2;
    const ry = (cy + bhv / 2) + (ascR - descR) * 0.5;
    ctx.strokeText(rarName, cx, ry);
    ctx.fillStyle = rar ? rar.color : '#fff';
    ctx.fillText(rarName, cx, ry);

    ctx.restore();
  },
};
