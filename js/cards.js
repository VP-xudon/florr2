// cards.js — 卡牌渲染接口：稀有度「双色圆角底板」+ 素材（纯图形）+ i18n 名称文字
// 参照成品卡（Antennae_29 / Dark_Mark_29）：
//   - 外框 = 同等级颜色偏深（圆角方），内板 = 同色纯色（更亮）；
//   - 图形与名称由素材/文字层共同构成：图形取 petal/ 里【已去除名称字母、已居中】的纯素材，
//     名称文字按原字母的位置与大小实时绘制（白字 + 黑描边 + Ubuntu 800）；
//   - 全程纯色，无任何渐变。
//
// 名称文本一律来自 i18N（Petals/<slug>/Name），因此切换译文包时卡面文字随之改变，
// 而图形的位置/大小与原版像素级一致（布局参数见 assets/petal-metrics.js）。
// 早期名称字母是烘焙在 SVG 里的，那样卡面文字就固定无法翻译了；那份原始素材已移除。
//
// 素材里烘焙了一层底板色（如 common 的 #cfcfcf）。做法：取素材原文，把非白(#fff)/非黑(#000)
// 的颜色统一换成稀有度色，白与黑原样保留 —— 于是素材的底板与内板同色融为一体，只剩图形与名称。
'use strict';

const CardRenderer = (function () {
  const _tinted = {};   // svgId -> dataURL（已收紧画布的卡面素材）
  const _raw = {};      // svgId -> Promise<string|null>（petal/ 素材原文）
  const _fit = {};      // svgId -> 收紧后的 viewBox（只依赖素材本身，与稀有度无关）

  // 素材在卡面里的占比：1 = 完全撑满（想要再大/再小改这一个数）
  const ART_SCALE = 0.7;
  // 花瓣本体在卡面里的额外上移量（占内板高度的比例）。
  // 只动图形，名称文字仍按原字母位置对齐，所以视觉上只有花瓣本体偏上。
  const ART_LIFT = 0.07;

  function hexToRgb(hex) {
    hex = (hex || '#888888').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // 同色偏深（用于卡牌外框）
  function darken(color, amt) {
    const [r, g, b] = hexToRgb(color);
    const f = (v) => Math.max(0, Math.round(v * (1 - amt)));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function rarityColor(rarity) {
    return (RARITIES[rarity] && RARITIES[rarity].color) || '#9aa3a0';
  }

  // 唯一的素材来源：petal/（已去掉底部名称字母、图形已平移到画布正中央、大小与 viewBox 均不变）。
  // 带 ASSET_VER：素材内容换过但文件名没变，必须靠版本号强制浏览器重新拉取，
  // 否则会一直用缓存里的旧文件（表现为"花瓣还带着字"）。
  // 早期还有第二份"原始素材"（名称字母烘焙在图上）专供卡牌显示名字；现在卡牌名字改由
  // i18n 实时绘制，那份素材已彻底删除，本文件只认 petal/ 这一个目录。
  function loadRaw(svgId) {
    if (_raw[svgId]) return _raw[svgId];
    _raw[svgId] = fetch('assets/petals/' + svgId + '.svg?v=' + ASSET_VER)
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null);
    return _raw[svgId];
  }

  // 注意：素材不再做任何改色。
  // 素材本身就是「花瓣图形」（如 Basic = 外层灰描边球 + 内层白球 + 白色字母），背景是透明的。
  // 早先按"烘焙底板"把它改成稀有度色，结果和卡面内板同色 -> 自带的灰色描边被"吃掉"，
  // 只剩一个小白球。现在原样渲染，灰色描边自然保留。

  // 素材画布四周留了大片透明边距（如 viewBox "0 0 110 110"，而图形只占中间一小块）。
  // 此时即便 object-fit 塞满容器，放大的也只是「含白边的画布」，图形本身看着仍然很小。
  // 解法：用离屏容器测出图形的真实包围盒，把 viewBox 收紧到它 —— 图形即可撑满整张卡。
  function fitViewBox(svgId, svgText) {
    if (_fit[svgId] !== undefined) return _fit[svgId];
    let vb = null;
    try {
      const box = document.createElement('div');
      // 注意：必须是"已渲染"的元素（不能用 display:none），否则 getBBox 返回空
      box.style.cssText =
        'position:absolute;left:-9999px;top:0;width:120px;height:120px;' +
        'overflow:hidden;opacity:0;pointer-events:none;';
      document.body.appendChild(box);
      box.innerHTML = svgText;
      const svg = box.querySelector('svg');
      if (svg && svg.getBBox) {
        const bb = svg.getBBox();
        if (bb.width > 0 && bb.height > 0) {
          // 先把包围盒按 1/ART_SCALE 放大（即让图形回缩到 ART_SCALE），并居中
          const w = bb.width / ART_SCALE, h = bb.height / ART_SCALE;
          vb = `${bb.x - (w - bb.width) / 2} ${bb.y - (h - bb.height) / 2} ${w} ${h}`;
        }
      }
      box.remove();
    } catch (e) { vb = null; }
    _fit[svgId] = vb;
    return vb;
  }

  // 卡面布局参数（由 assets/petal-metrics.js 离线提供，运行时零测量）：
  //   vb = 卡面素材的 viewBox —— 与旧版 fitViewBox 的算法完全一致
  //        （原素材"图形+名称"整体包围盒按 1/ART_SCALE 放大并居中）
  //        => 图形的位置与大小和原版像素级相同
  //   t  = 原素材中名称字母的位置 [cx, top, bottom]（同一 viewBox 坐标系）
  //   sw = 原素材名称字母的描边宽度（同一 viewBox 坐标系）
  // 卡面图形一律取自 petal/（已去字母、已居中的纯素材）；名称文字按 t 的位置实时绘制，
  // 文本取自 i18n —— 所以切换语言包，卡牌上的名字会跟着变，而图形丝毫不动。
  function metrics(svgId) {
    const M = (typeof window !== 'undefined' && window.PETAL_METRICS) ? window.PETAL_METRICS : null;
    return (M && svgId != null && M[svgId]) ? M[svgId] : null;
  }

  // 取卡面素材（纯图形 + 收紧画布）。只依赖素材本身，与稀有度无关。
  // 一律从 petal/ 取；viewBox 优先用预置参数（与旧版 fitViewBox 算法一致，保证图形位置/大小不变），
  // 参数缺失时才退化为「按素材自身包围盒收紧」—— 图形依然撑满卡面，只是不再绘制名字。
  function asset(svgId) {
    if (_tinted[svgId] !== undefined) return Promise.resolve(_tinted[svgId]);
    return loadRaw(svgId).then((txt) => {
      if (!txt) { _tinted[svgId] = null; return null; }
      let out = txt;
      const vb = metrics(svgId) ? metrics(svgId).vb : fitViewBox(svgId, txt);   // 收紧画布 -> 图形撑满
      if (vb) {
        out = /viewBox="[^"]*"/.test(out)
          ? out.replace(/viewBox="[^"]*"/, 'viewBox="' + vb + '"')
          : out.replace(/<svg\b/, '<svg viewBox="' + vb + '"');
      }
      const url = 'data:image/svg+xml,' + encodeURIComponent(out);
      _tinted[svgId] = url;
      return url;
    });
  }

  // ---- 世界里的"花瓣实体"：直接用 petal/ 里【已拆分好】的素材 ----
  // petal/ 的素材已去掉底部名称字母、并把剩余图形平移到画布正中央（viewBox 仍是 110×110）。
  // 但图形只占画布中间一小块，若原样用作精灵，图形会非常小 —— 所以这里把 viewBox
  // 【收紧到内容包围盒】。这一步纯粹是"贴合内容"的机械操作：素材里已经没有文字了，
  // 不再需要任何"哪个 path 是字母"的启发式判断（那是旧实现的风险来源）。
  const _artSvg = {};   // svgId -> Promise<string|null>（收紧画布后的素材文本）
  function artSvg(svgId) {
    if (_artSvg[svgId]) return _artSvg[svgId];
    _artSvg[svgId] = loadRaw(svgId).then((txt) => {
      if (!txt) return null;
      try {
        const box = document.createElement('div');
        box.style.cssText =
          'position:absolute;left:-9999px;top:0;width:120px;height:120px;' +
          'overflow:hidden;opacity:0;pointer-events:none;';
        document.body.appendChild(box);
        box.innerHTML = txt;
        const svg = box.querySelector('svg');
        let out = txt;
        if (svg && svg.getBBox) {
          const bb = svg.getBBox();          // 含 <g transform> 的整体包围盒
          if (bb.width > 0 && bb.height > 0) {
            svg.setAttribute('viewBox', `${bb.x} ${bb.y} ${bb.width} ${bb.height}`);
          }
          out = svg.outerHTML;
        }
        box.remove();
        return out;
      } catch (e) { return txt; }
    });
    return _artSvg[svgId];
  }

  const _artCv = {};    // `${svgId}|${px}` -> canvas|null（异步构建，未就绪返回 null 由调用方回退）
  function artCanvas(svgId, px) {
    const key = svgId + '|' + px;
    if (_artCv[key] !== undefined) return _artCv[key];
    _artCv[key] = null;                          // 占位：避免重复触发构建
    artSvg(svgId).then((out) => {
      if (!out) return;
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = c.height = px;
          c.getContext('2d').drawImage(img, 0, 0, px, px);
          _artCv[key] = c;
        } catch (e) { /* 忽略 */ }
      };
      img.src = 'data:image/svg+xml,' + encodeURIComponent(out);
    });
    return null;
  }

  // ---- 卡牌 = 一张 <canvas>：外框/内板/素材/数量角标全部由 JS 绘制 ----
  // 不再产生任何 DOM 文字或 <img>/<svg> 节点：卡面即像素，天然不可被选中。
  // opts: { rarity, svg, count, pad, radius }
  //   pad    = 描边厚度占卡面比例（卡槽/幽灵 0.09，背包卡 0.0756）
  //   radius = 外框圆角比例（卡槽/幽灵 0.07，背包卡 0.0588）
  const FONT = '"Ubuntu", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

  const _imgCache = {};   // url -> HTMLImageElement
  const _imgWait = {};    // url -> [等待该素材的 canvas]
  function imgFor(cv, url) {
    if (!_imgCache[url]) {
      const im = new Image();
      im.onload = () => { for (const c of (_imgWait[url] || [])) paint(c); };
      im.src = url;
      _imgCache[url] = im;
    }
    (_imgWait[url] = _imgWait[url] || []).push(cv);
    return _imgCache[url];
  }

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

  // 数量角标：右上角，白字黑描边，倾斜 30°（与原 .card-count 观感一致）
  function drawCount(ctx, W, H, count) {
    const txt = (count === Infinity) ? '∞' : (count > 0 ? ('x' + fmtNum(count)) : '');
    if (!txt) return;
    const s = Math.min(W, H);
    const fs = 10.4 * (s / 44);            // 原 10.4px 是 44px 卡面的字号，按尺寸等比缩放
    ctx.save();
    ctx.translate(W - 0.15 * s, 0.11 * s);
    ctx.rotate(30 * Math.PI / 180);
    ctx.font = `800 ${fs}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = fs * 0.115;
    ctx.strokeStyle = '#000';
    ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, 0, 0);
    ctx.restore();
  }

  // 数量角标：改为 DOM 文本（.card-count），不再画在 canvas 上。
  // 原因：canvas 会被自身边界裁掉，数量文字（尤其 x10 / ∞ 这种）显示不全；
  // DOM 元素可以自由溢出卡牌框框边界。字号/描边在 paint() 里按卡面尺寸同步。
  //
  // 元素是 canvas 的【兄弟节点】（canvas 不能有子元素），所以必须等 canvas 入 DOM 后才能建。
  // 建的时候紧跟在 canvas 后面插入，父级（.qslot / .cardcell / .qinner）都是定位上下文，
  // 用百分比定位即可随卡牌尺寸等比缩放。
  function ensureCountEl(cv) {
    if (cv._countEl) return cv._countEl;
    const p = cv.parentElement;
    if (!p) return null;
    const el = document.createElement('div');
    el.className = 'card-count';
    el.style.display = 'none';
    cv._countEl = el;
    if (cv.nextSibling) p.insertBefore(el, cv.nextSibling);
    else p.appendChild(el);
    return el;
  }

  function syncCount(cv, st) {
    const el = ensureCountEl(cv);
    if (!el) return;
    const txt = (st.count === Infinity) ? '∞' : (st.count > 0 ? ('x' + fmtNum(st.count)) : '');
    if (!txt) { el.textContent = ''; el.style.display = 'none'; return; }
    const fs = Math.max(7, cv.clientWidth * 0.236);     // 10.4px @ 44px 卡面，等比缩放
    el.textContent = txt;
    el.style.display = '';
    el.style.fontSize = fs.toFixed(2) + 'px';
    el.style.webkitTextStrokeWidth = (fs * 0.115).toFixed(2) + 'px';
  }

  // 名称字号：以「原素材字母的字高」为基准反推，而不是按 measureText 的墨迹包围盒反推。
  //   原文字母高度 ≈ 0.72 × 字号（Ubuntu 的 cap height 比例）=> 字号 = 字高 / 0.72。
  // 这样英文和中文拿到的是【同一个字号】—— 中文全角字形笔画更满，同字号下看起来自然比英文
  // 大一点，绝不会出现"切到中文突然变得非常小"。
  // （旧实现按 actualBoundingBoxAscent+Descent 反推：中文字形墨迹占比约 0.86、英文约 0.75，
  //   同样字高下中文字号会被压小 15%+；而遇到不返回 actualBoundingBox* 的浏览器/回退字体时
  //   h=0 直接 break，字号退化成"字高"本身（约小 28%），中文就显得特别小。）
  // 之后再按可用宽度收缩一两次，保证长译名也不溢出卡面。
  function fitNameFont(ctx, text, targetH, maxW) {
    let fs = targetH / 0.72;
    if (maxW > 0 && fs > 4) {
      for (let i = 0; i < 3; i++) {
        ctx.font = `800 ${fs}px ${FONT}`;
        const w = ctx.measureText(text).width;
        if (!(w > maxW)) break;
        fs *= Math.max(0.55, maxW / w);
      }
    }
    return fs;
  }

  // 卡牌名称：绘制在「原素材自带字母」的同一位置、同一大小，白字 + 黑描边（先描边后填充，
  // 等价于 SVG 的 paint-order:stroke fill），Ubuntu 800 —— 观感与原来烘焙在素材里的字母一致。
  // 文本取自 i18N（Petals/<slug>/Name），因此切换译文包时卡面文字随之改变。
  // (ox,oy,dw,dh) = 素材在小地图/卡面上实际绘制出的矩形，用于把 viewBox 坐标换算成像素。
  function drawName(ctx, st, ox, oy, dw, dh) {
    const mt = st.metrics;
    if (!mt || !mt.t || !mt.vb) return;
    const name = st.name;
    if (!name) return;
    const vb = mt.vb;
    const sx = dw / vb[2], sy = dh / vb[3];           // viewBox -> 卡面像素 的缩放
    const bx = ox - vb[0] * sx, by = oy - vb[1] * sy; // 平移
    const cx = bx + mt.t[0] * sx;
    const top = by + mt.t[1] * sy;
    const bot = by + mt.t[2] * sy;
    const targetH = bot - top;
    if (!(targetH > 1)) return;
    // 可用宽度：取素材绘制宽度的 92%（原字母约占 70%，留点余量给更长的译名）
    const fs = fitNameFont(ctx, name, targetH, dw * 0.92);
    if (!(fs > 2)) return;
    ctx.save();
    ctx.font = `800 ${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(name);
    // 垂直定位仍用真实墨迹度量：让文字【顶部】正好落在原字母顶部（中英文都准）。
    // 取不到 actualBoundingBox* 时退回 0.72×字号（cap height），与基准一致。
    const asc = (m.actualBoundingBoxAscent != null) ? m.actualBoundingBoxAscent : fs * 0.72;
    const baseY = top + asc;
    ctx.lineWidth = (mt.sw != null) ? (mt.sw * Math.max(sx, sy)) : fs * 0.115;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.strokeText(name, cx, baseY);
    ctx.fillStyle = '#fff';
    ctx.fillText(name, cx, baseY);
    ctx.restore();
  }

  function drawCard(cv, st) {
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    if (!W || !H) return;
    const s = Math.min(W, H);
    const base = rarityColor(st.rarity);
    ctx.clearRect(0, 0, W, H);
    // 外框：同色偏深，圆角
    roundRectPath(ctx, 0, 0, W, H, (st.radius != null ? st.radius : 0.07) * s);
    ctx.fillStyle = darken(base, 0.18);
    ctx.fill();
    // 内板：纯色，直角（描边外圆角、内板直角，与原样式一致）
    const p = (st.pad != null ? st.pad : 0.09) * s;
    const iw = W - p * 2, ih = H - p * 2;
    if (iw > 0 && ih > 0) {
      ctx.fillStyle = base;
      ctx.fillRect(p, p, iw, ih);
      // 素材：contain 塞进内板；同时记下它实际绘制出的矩形，供名称文字对齐使用
      const im = st.img;
      let ox = p, oy = p, dw = iw, dh = ih;
      if (im && im.complete && im.naturalWidth > 0 && im.naturalHeight > 0) {
        const k = Math.min(iw / im.naturalWidth, ih / im.naturalHeight);
        dw = im.naturalWidth * k; dh = im.naturalHeight * k;
        ox = p + (iw - dw) / 2; oy = p + (ih - dh) / 2;
        // 花瓣本体略微上移（按内板高度取比例，随卡牌大小等比缩放）。
        // 名称文字仍按未上移的矩形对齐，所以只有图形动、名字留在原位。
        oy -= ih * ART_LIFT;
        ctx.drawImage(im, ox, oy, dw, dh);
      }
      // 名称：按原素材字母的位置/大小实时绘制（观感与原来烘焙在素材里的字母一致）
      drawName(ctx, st, ox, oy + ih * ART_LIFT, dw, dh);
    }
    // 数量角标由 DOM（.card-count）负责，这里只同步文本与字号
    syncCount(cv, st);
  }

  // 画布尺寸跟随元素布局（CSS 决定显示尺寸，这里只同步后备缓冲区）
  function paint(cv) {
    const st = cv._card;
    if (!st || !cv.isConnected) return;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;                       // 尚未布局完成，等下一帧
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    drawCard(cv, st);
  }

  function createCard(opts) {
    const o = opts || {};
    const cv = document.createElement('canvas');
    cv.className = 'card';
    if (o.size) { cv.style.width = o.size + 'px'; cv.style.height = o.size + 'px'; }
    cv._card = {
      rarity: o.rarity || 'common',
      svg: o.svg || null,                 // 用于反查名称与布局参数
      count: (o.count != null) ? o.count : null,
      pad: o.pad, radius: o.radius,
      img: null
    };
    // 名称与布局参数在「绘制时」解析：语言包若后加载/切换，卡面文字会随之更新
    if (o.svg) {
      const t = (typeof getPetal === 'function') ? getPetal(o.svg) : null;
      if (t && t.name) cv._card.name = t.name;
      const mt = metrics(o.svg);
      if (mt) cv._card.metrics = mt;
    }
    if (o.svg) {
      // 先画纯色卡面，素材就绪后自动重绘（与原来 img 异步替换同一观感）
      asset(o.svg).then((u) => { if (u) { cv._card.img = imgFor(cv, u); paint(cv); } });
    }
    // 入 DOM 后才有 clientWidth：下一帧首次绘制；之后跟随布局变化重绘
    requestAnimationFrame(() => paint(cv));
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => paint(cv));
      ro.observe(cv);
      cv._ro = ro;
    }
    return cv;
  }

  // 重绘所有已生成的卡（窗口尺寸/dpr 变化后调用）
  function repaintAll(root) {
    const list = (root || document).querySelectorAll('canvas.card');
    for (const cv of list) paint(cv);
  }

  // Ubuntu 走 Google Fonts 异步加载（display=swap）：卡牌可能在字体到位前就画好了，
  // 那时名称会用了回退字体且不会自动更新。这里主动触发一次加载，就绪后统一重绘。
  if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
    document.fonts.load('800 16px Ubuntu').then(() => repaintAll()).catch(() => {});
  }

  return { createCard, darken, rarityColor, artCanvas, repaintAll, FONT };
})();
