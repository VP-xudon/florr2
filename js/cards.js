// cards.js — 卡牌渲染接口：稀有度「双色圆角底板」+ 素材（自带白色漫画字母）拼接
// 参照成品卡（Antennae_29 / Dark_Mark_29）：
//   - 外框 = 同等级颜色偏深（圆角方），内板 = 同色纯色（更亮）；
//   - 图形与名称由素材自带（黑色图形 + 白色漫画字+黑描边），卡牌不再叠加文字层；
//   - 全程纯色，无任何渐变。
//
// 素材里烘焙了一层底板色（如 common 的 #cfcfcf）。做法：取素材原文，把非白(#fff)/非黑(#000)
// 的颜色统一换成稀有度色，白与黑原样保留 —— 于是素材的底板与内板同色融为一体，只剩图形与名称。
'use strict';

const CardRenderer = (function () {
  const _tinted = {};   // `${svgId}|${rarity}` -> dataURL（已对齐稀有度的素材）
  const _raw = {};      // svgId -> Promise<string|null>（素材原文，按需拉取）
  const _fit = {};      // svgId -> 收紧后的 viewBox（只依赖素材本身，与稀有度无关）

  // 素材在卡面里的占比：1 = 完全撑满（想要再大/再小改这一个数）
  const ART_SCALE = 0.7;

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

  function loadRaw(svgId) {
    if (_raw[svgId]) return _raw[svgId];
    _raw[svgId] = fetch('assets/petals/' + svgId + '.svg')
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null);          // file:// 等场景拉取失败 -> 回退为原素材
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

  // 取素材（原色 + 收紧画布）。只依赖素材本身，与稀有度无关。
  function asset(svgId) {
    if (_tinted[svgId] !== undefined) return Promise.resolve(_tinted[svgId]);
    return loadRaw(svgId).then((txt) => {
      if (!txt) { _tinted[svgId] = null; return null; }
      let out = txt;
      const vb = fitViewBox(svgId, txt);      // 收紧画布 -> 图形撑满
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

  // ---- 世界里的"花瓣实体"：素材自带名称字母，这里把字母去掉，只留图形本身 ----
  // 名称特征：位于整体底部、且比整体扁很多（是文字而不是图形）。
  function stripName(svg) {
    const all = svg.getBBox();
    if (!(all.height > 0)) return;
    for (const el of Array.from(svg.children)) {
      if (el.tagName.toLowerCase() !== 'path') continue;
      let bb; try { bb = el.getBBox(); } catch (e) { continue; }
      if (bb.y > all.y + all.height * 0.55 && bb.height < all.height * 0.4) el.remove();
    }
  }

  const _artSvg = {};   // svgId -> Promise<string|null>（去字母 + 收紧画布的素材文本）
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
        if (svg) {
          stripName(svg);                          // 去掉名称字母
          const bb = svg.getBBox();                // 收紧到剩下的图形
          if (bb.width > 0 && bb.height > 0) {
            svg.setAttribute('viewBox', `${bb.x} ${bb.y} ${bb.width} ${bb.height}`);
          }
          out = svg.outerHTML;
        }
        box.remove();
        return out;
      } catch (e) { return null; }
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
    const txt = (count === Infinity) ? '∞' : (count > 0 ? ('x' + count) : '');
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
      // 素材：contain 塞进内板
      const im = st.img;
      if (im && im.complete && im.naturalWidth > 0 && im.naturalHeight > 0) {
        const k = Math.min(iw / im.naturalWidth, ih / im.naturalHeight);
        const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
        ctx.drawImage(im, p + (iw - dw) / 2, p + (ih - dh) / 2, dw, dh);
      }
    }
    if (st.count != null) drawCount(ctx, W, H, st.count);
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
      count: (o.count != null) ? o.count : null,
      pad: o.pad, radius: o.radius,
      img: null
    };
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

  return { createCard, darken, rarityColor, artCanvas, repaintAll, FONT };
})();
