// ui/tooltip.js — 悬浮框：卡牌详情 canvas 与简易按钮提示
'use strict';

Object.assign(UI, {
  // ---------------- 简易文字悬浮框（按钮提示） ----------------
  // 样式与卡牌悬浮框一致：同底色透明度、同渐变高光；单行、宽度自适应
  _bindSimpleTip(el, textFn) {
    el.addEventListener('mouseenter', () => this._showSimpleTip(textFn(), el));
    el.addEventListener('mouseleave', () => this._hideTip());
  },
  _showSimpleTip(str, el) {
    const now = performance.now();
    this._tipSlide = !!(this._tipOn || (now - (this._tipHideAt || 0) < 120));
    if (this._tipSlide) this._tipAlpha = 1;
    this._tip = { simple: str, anchor: el };
    this._tipOn = true;
  },
  // 字号与背包窗口小标题(.win-subtitle)一致
  _subtitleFontSize() {
    if (this._subFS) return this._subFS;
    const el = document.querySelector('.win-subtitle');
    this._subFS = el ? (parseFloat(getComputedStyle(el).fontSize) || 10.8) : 10.8;
    return this._subFS;
  },
  _simpleTipLayout(ctx, t) {
    const FS = this._subtitleFontSize();
    const str = String(t.simple || '');
    ctx.font = `900 ${FS}px ${CardRenderer.FONT}`;
    const tw = ctx.measureText(str).width;
    const PADX = 11, PADY = 6, RAD = 7;
    return { W: Math.ceil(tw) + PADX * 2, H: Math.ceil(FS * 1.15) + PADY * 2, FS, PADX, RAD, tw };
  },

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
        // 冷却展示：优先用 reloadText（如 "3.5s + 1.5s"）；否则按秒数生成。
        // 生物悬浮框没有冷却，右上角改为"菱形 + XP Reward"，所以这里为空。
        const reload = t.mob ? '' : (t.reloadText || (t.reload > 0 ? (fmtNum(t.reload) + 's') : ''));
        // 生物右上角：菱形 + "数值 XP"（XP 是两种语言下的通用单位，不额外翻译）
        const xpTxt = t.mob ? (fmtNum(t.xp) + ' XP') : '';
        const titleW = measure(FS_TITLE, t.name);
        const rarW = measure(FS_RAR, t.rarityName);
        const reloadW = reload ? measure(FS_RELOAD, reload) : 0;
        // 数值行：{ label, value, labelColor?, valueColor? }
        // 规则：这张卡**没有的数值整行不画**（Damage 为 0 就是没有伤害，如 Honey）。
        const STAT_GAP = 6;                                     // 标签与数值的间距（参考空间）
        const rows = [];
        if (t.mob) {
          rows.push({ label: statLabel('Mob/Attribute/Health', 'Health:'), value: t.hp });
          if (t.dmg > 0) rows.push({ label: statLabel('Mob/Attribute/Damage', 'Damage:'), value: t.dmg });
          if (t.armor > 0) rows.push({ label: statLabel('Mob/Attribute/Armor', 'Armor:'), value: t.armor });
        } else {
          if (t.hp > 0) rows.push({ label: statLabel('Petal/Attribute/Health', 'Health:'), value: t.hp });
          if (t.dmg > 0) rows.push({ label: statLabel('Petal/Attribute/Damage', 'Damage:'), value: t.dmg });
          if (t.heal > 0) rows.push({ label: statLabel('Petal/Attribute/Heal', 'Heal:'), value: t.heal + (t.healPerSec ? '/s' : '') });
          if (t.maxMobRarityName) {
            rows.push({
              // 官方 Petal/Attribute/MaxMobRarity 是"带参数"的模板
              // （{#Rarities/{0}/NameColored}），当纯文本标签用会漏出碎片，
              // 所以用本项目自己的纯文本键。
              label: statLabel('UI/Petal/MaxMobRarityLabel', 'Max Mob Rarity:'),
              value: t.maxMobRarityName,
              labelColor: (typeof MAX_MOB_RARITY_COLOR !== 'undefined') ? MAX_MOB_RARITY_COLOR : '#d2eb34',
              valueColor: t.maxMobRarityColor || '#ffffff'      // 稀有度名用它自己的颜色
            });
          }
        }
        // 行宽 = 标签宽 + 间距 + 数值宽（与绘制时同一字体、同一算法，不会互相压字）
        let statW = 0;
        for (const r of rows) {
          const w = measure(FS_STAT, r.label) + STAT_GAP
            + measure(FS_STAT, (typeof r.value === 'number' ? fmtNum(r.value) : String(r.value)));
          if (w > statW) statW = w;
        }
        // 介绍：先按官方的换行标记 <n/> 强制断行（Honey 等卡面的介绍里就带这个），
        // 每段再按宽度折行；宽度够就单行。以前直接把 <n/> 当普通文字测宽 -> 界面上
        // 原样显示 "<n/>"，所以这里必须先拆再排。
        const limit = MAX_W - PADX * 2;
        const lines = [];
        if (desc) {
          const paras = String(desc).split(/<n\s*\/?>|\r?\n/gi);
          for (const raw of paras) {
            const seg = raw.trim();
            if (!seg) { if (lines.length) lines.push(''); continue; }   // 保留段落间空行
            if (measure(FS_DESC, seg) <= limit) { lines.push(seg); continue; }
            let cur = '';
            for (const word of seg.split(' ')) {
              const test = cur ? cur + ' ' + word : word;
              if (cur && measure(FS_DESC, test) > limit) { lines.push(cur); cur = word; }
              else cur = test;
            }
            if (cur) lines.push(cur);
          }
          while (lines.length && !lines[lines.length - 1]) lines.pop();   // 去掉尾部空行
        }
        // 宽度 = 最宽一行 + 左右留白；标题、冷却与旋转图标都不重叠
        let contentW = Math.max(titleW, rarW, statW);
        for (const l of lines) contentW = Math.max(contentW, measure(FS_DESC, l));
        let W = Math.max(MIN_W, PADX * 2 + contentW);
        if (reload) W = Math.max(W, PADX + titleW + 14 + reloadW + 8 + ICON + RH);
        // 生物：右上角 = 菱形图标 + 右侧 XP 数值（两者都要塞进标题右侧）
        if (t.mob) W = Math.max(W, PADX + titleW + 14 + measure(FS_RELOAD, xpTxt) + 8 + ICON + RH);
        W = Math.min(MAX_W, W);
        // 介绍上下各空出一行；数值统一在左下角，自上而下：Health / Damage / (Heal)
        const descTop = rarityY + 22 + BLANK;
        const descBottom = descTop + Math.max(0, lines.length - 1) * LH;
        const statY = [];
        for (let i = 0; i < rows.length; i++) statY.push(descBottom + 22 + BLANK + i * 21);
        // ---- 掉落物区（仅生物悬浮框）----
        // 每种花瓣一行；行内并排该花瓣的各掉落稀有度卡面，卡面下方标概率。
        // CS = 背包卡（44.544px）的 0.8 倍再换算到参考空间：44.544×0.8÷0.6 ≈ 59.4
        const drops = (t.mob && t.drops) ? t.drops : [];
        const CS = 59.4, CGAP = 8, PCT_H = 23, DROP_GAP = 12;   // 参考空间尺寸（绘制时整体 × S）
        const lastStat = statY.length ? statY[statY.length - 1] : descBottom;
        const dropTop = lastStat + 32;
        const dropRowH = CS + PCT_H + DROP_GAP;
        if (drops.length) {
          let wMax = 0;
          for (const d of drops) {
            wMax = Math.max(wMax, d.items.length * CS + (d.items.length - 1) * CGAP);
          }
          W = Math.max(W, PADX * 2 + wMax);
        }
        // 高度：有掉落物 -> 末尾掉落行之后；否则数值行之后
        const H = (drops.length ? dropTop + (drops.length - 1) * dropRowH + CS + PCT_H : lastStat) + 16;
        return { W, H, RH, PADX, LH, ICON, lines, titleY, reloadY, rarityY, descTop, rows, statY, W_ALL, STAT_GAP,
          xpTxt, drops, dropTop, dropRowH, CS, CGAP,
          FS_TITLE, FS_RELOAD, FS_RAR, FS_DESC, FS_STAT };
      },

    _drawTip(ctx, t, alpha) {
        const S = TIP_SCALE;                       // 整体 0.6 倍
        // 简易模式（按钮提示）：单行、宽度自适应、绘制用真实像素；卡牌模式照旧
        let L = null, W, H;
        if (t.simple) { const m = this._simpleTipLayout(ctx, t); W = m.W; H = m.H; }
        else { L = this._tipLayout(ctx, t); W = L.W * S; H = L.H * S; }
        const pad = 10 * S;
        // 目标位置：卡牌正上方居中；顶部放不下则改到下方；再夹进视口
    // 锚点元素会被重渲染销毁（点击装备 -> renderInvBar 重建卡槽），此时必须沿用
    // 最后一次有效矩形原地渐隐；旧实现回退到屏幕中心 —— 而主角永远在屏幕中心，
    // 于是悬浮框"飞到主角身上"再消失。
    if (this._tipOn && t.anchor && t.anchor.isConnected) {
      const ar = t.anchor.getBoundingClientRect();
      const last = this._tipLastRect;
      // 只有"同一个元素"发生位移才算内容在滚动/重排 —— 换到另一张卡时矩形当然不同，
      // 那是一次正常的悬浮切换，不能误判成移动（否则悬浮栏会只闪一下就再也不出现）。
      const sameAnchor = (this._tipAnchor === t.anchor);
      if (sameAnchor && last && (Math.abs(ar.left - last.left) > 0.5 || Math.abs(ar.top - last.top) > 0.5)) {
        this._hideTip();          // 锚点开始移动（滚动/重排/缩放）-> 立刻渐隐
      } else {
        this._tipAnchor = t.anchor;
        this._tipLastRect = ar;
      }
    }
    const r = this._tipLastRect || null;
    if (this._tipOn && r) {
      let tx = r.left + r.width / 2 - W / 2;
      let ty = r.top - H - 8;
      if (ty < 4) ty = r.bottom + 8;
      tx = Math.max(4, Math.min(tx, innerWidth - W - 4));
      ty = Math.max(4, Math.min(ty, innerHeight - H - 4));
      // 首次出现直接落位；相邻卡之间移动时把框平移过去
      if (!this._tipSlide || !this._tipPos) this._tipPos = { x: tx, y: ty };
      else {
        this._tipPos.x += (tx - this._tipPos.x) * 0.4;
        this._tipPos.y += (ty - this._tipPos.y) * 0.4;
      }
    }
    if (!this._tipPos) this._tipPos = { x: innerWidth / 2 - W / 2, y: innerHeight / 2 - H / 2 };
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

        if (t.simple) {
          // 单行提示：Ubuntu 900、字号与背包窗口小标题一致、同比例黑描边
          const m = this._simpleTipLayout(ctx, t);
          ctx.textBaseline = 'middle';
          ctx.font = `900 ${m.FS}px ${CardRenderer.FONT}`;
          ctx.textAlign = 'left';
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.lineWidth = m.FS * 0.15;           // 与卡牌悬浮框相同的描边比例
          ctx.strokeStyle = '#000';
          const ty = y + H / 2 + 0.5;
          ctx.strokeText(t.simple, x + m.PADX, ty);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(t.simple, x + m.PADX, ty);
          ctx.restore();
          return;
        }

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
        // 生物：右上角 = 菱形（稀有度色 + 黑描边）+ 右侧 XP 数值
            if (t.mob) {
              const cy = y + L.reloadY * S;
              const icon = L.ICON * S, gap = 6 * S;
              const txt = L.xpTxt || fmtNum(t.xp);
              // 先量宽度（与 text() 用同一字体/字号），才能把菱形排在数值左边
              ctx.font = `${L.W_ALL} ${Math.round(L.FS_RELOAD * S * 100) / 100}px ${CardRenderer.FONT}`;
              const vw = ctx.measureText(txt).width;
              text(txt, rx, cy, L.FS_RELOAD, L.W_ALL, '#ffffff', 'right');
              const dr = icon * 0.5;
              const dcx = rx - vw - gap - dr, dcy = cy - L.FS_RELOAD * S * 0.34;
              ctx.save();
              ctx.translate(dcx, dcy);
              ctx.beginPath();
              ctx.moveTo(0, -dr); ctx.lineTo(dr, 0); ctx.lineTo(0, dr); ctx.lineTo(-dr, 0);
              ctx.closePath();
              ctx.lineJoin = 'round';
              ctx.lineWidth = Math.max(1.2, icon * 0.16);
              ctx.strokeStyle = '#000';
              ctx.stroke();
              ctx.fillStyle = t.rarityColor || '#fff';
              ctx.fill();
              ctx.restore();
            }
        // 冷却（白字）+ 后面紧跟一个表示旋转的静态图标
            if (t.reload > 0) {
              const cy = y + L.reloadY * S;
              const icon = L.ICON * S, gap = 6 * S;
              text(t.reloadText || (fmtNum(t.reload) + 's'), rx - icon - gap, cy,
                L.FS_RELOAD, L.W_ALL, '#ffffff', 'right');
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
        // Health / Damage / Heal：统一排在左下角，标签彩色 + 数值白色（字号与介绍一致）
        // 治疗用专用粉色，不与伤害(红)/生命(绿)共用颜色（与玫瑰回血飘字同色）
        const STAT_COLORS = ['#7fe08a', '#ff6b6b', HEAL_TEXT_COLOR];
        // 生物：Health / Damage / Armor（Armor 用中性灰蓝，避免与治疗的粉色混淆）
        const MOB_STAT_COLORS = ['#7fe08a', '#ff6b6b', '#b8c6d1'];
        const rowColors = t.mob ? MOB_STAT_COLORS : STAT_COLORS;
        // 每行：标签（默认按行序取色，可被 row.labelColor 覆盖）+ 数值（默认白色，
        // 可被 row.valueColor 覆盖，例如 Max Mob Rarity 用被吸引稀有度自己的颜色）。
        // 标签宽度用【与 text() 完全相同的字体】量，数值跟在后面不会压住标签。
        const gapPx = L.STAT_GAP * S;
        for (let i = 0; i < L.rows.length; i++) {
          const row = L.rows[i];
          const size = Math.round(L.FS_STAT * S * 100) / 100;
          ctx.font = `${L.W_ALL} ${size}px ${CardRenderer.FONT}`;
          const lw = ctx.measureText(row.label).width;
          const ty = y + L.statY[i] * S;
          text(row.label, bx, ty, L.FS_STAT, L.W_ALL, row.labelColor || rowColors[i] || '#ffffff');
          text(typeof row.value === 'number' ? fmtNum(row.value) : String(row.value),
            bx + lw + gapPx, ty, L.FS_STAT, L.W_ALL, row.valueColor || '#ffffff');
        }
        // 掉落物：每种花瓣一行（紧接在数值行下方），行内是该花瓣的各掉落稀有度；
        // 卡面 = 与背包卡完全同一条绘制管线（缩放 0.8 倍），概率标在卡面正下方。
        if (L.drops && L.drops.length) {
          const cs = L.CS * S, gap = L.CGAP * S;
          for (let r = 0; r < L.drops.length; r++) {
            const d = L.drops[r];
            const rowY = y + (L.dropTop + r * L.dropRowH) * S;
            for (let i = 0; i < d.items.length; i++) {
              const it = d.items[i];
              const px0 = bx + i * (cs + gap);
              // 卡面：与背包/卡槽【完全同一条绘制管线】（外框、内板、名称文字、留白），
              // 只是整张卡等比缩放到 0.8 倍于背包卡。
              const card = this._dropCard(d.svg, it.rarity, d.name);
              if (card) ctx.drawImage(card, px0, rowY, cs, cs);
              // 概率：卡面正下方居中（与卡面留出空隙，避免压到卡片底边/名称）
              text(fmtChance(it.chance), px0 + cs / 2, rowY + cs + 17 * S,
                17, L.W_ALL, '#ffffff', 'center');
            }
          }
        }
        ctx.restore();
      },

      // 掉落物卡面（离屏渲染 + 缓存）。
      // 与背包卡同一套 CardRenderer 绘制：稀有度外框 + 内板 + 花瓣贴图 + 底部名称文字，
      // 内板/圆角比例也一致（pad 0.0756 / radius 0.0588）；这里只做 4 倍超采样，
      // 绘制时缩到 0.8 × 背包卡尺寸（44.544 → 35.635px）。
      _dropCard(svg, rarity, name) {
        this._dc = this._dc || {};
        const key = svg + '|' + rarity;
        if (this._dc[key]) return this._dc[key];
        const cv = document.createElement('canvas');
        if (typeof CardRenderer.renderCardTo === 'function') {
          CardRenderer.renderCardTo(cv, {
            svg: (svg != null) ? svg : null, name: name || null,
            rarity, px: 144, pad: 0.0756, radius: 0.0588
          });
        }
        this._dc[key] = cv;
        return cv;
      },

    // Enter 聊天热键：非输入态下按 Enter 进入聊天输入态。
    // 注意三点：
    //   ① 输入框自己处理 Enter/Esc（chat.js 内已 stopPropagation），这里只在非输入态生效；
    //   ② 背包/图鉴开着时不抢 Enter，避免与界面冲突；
    //   ③ 同时认 e.code 与 e.key，主键盘/小键盘 Enter 都覆盖。
    _initChatKeys() {
      window.addEventListener('keydown', (e) => {
        if (e.code !== 'Enter' && e.key !== 'Enter') return;
        if (typeof Chat === 'undefined' || Chat.inputMode) return;
        if ((this.isBagVisible && this.isBagVisible()) ||
            (this.isDexVisible && this.isDexVisible())) return;
        e.preventDefault();
        Chat.enter();
      });
    },

    // 悬浮框专用覆盖层：全屏 canvas，0.2s 渐显渐隐，自带 rAF 循环
    _initOverlay() {
      const cv = document.createElement('canvas');
      cv.id = 'uiOverlay';
      document.body.appendChild(cv);
      this.refs.overlay = cv;
          this._tipAlpha = 0;
          this._tipPos = null;      // 悬浮框当前位置（相邻卡之间平移用）
              this._tipLastRect = null; // 锚点最后一次有效矩形：锚点被重建后据此原地渐隐
    this._tipAnchor = null;  // 上一次记录的锚点元素（用于区分"换卡"与"元素移动"）
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
        this._rowsVer++;                 // 尺寸变化：失效卡槽矩形缓存
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
        // 小地图动画推进（三档切换 = 0.6s 平滑过渡）
        const now = performance.now();
        const dt = this._mmLast ? Math.min(0.05, (now - this._mmLast) / 1000) : 0.016;
        this._mmLast = now;
        this._mmTick(dt);
        this._reloadTick(dt);   // 主槽装填阴影 + 水缸阴影推进（带平滑）
        if (typeof Chat !== 'undefined') Chat.tick(dt);   // 聊天漂浮态渐隐推进
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

});
