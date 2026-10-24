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
  const _winW = {};     // svgId -> number（卡面统一窗口宽：多体花瓣直径换算用）
  const _entWinW = {};  // svgId -> number（实体统一窗口宽：多体花瓣直径换算用）

  // 统一缩放参数见下方 PETAL_ART_REF（Basic vb = 所有花瓣共用的窗口尺寸）。
  // 装填阴影角位移的「缓入」参数（drawReload 用）：
  //   POW   > 1 表示越转越快；越大末段越快（要求"最后快一点"）
  //   FLOOR 线性分量下限：保证起步瞬间角速度不为 0（否则看起来像卡住不动）
  // POW=2.5、FLOOR=0.12 -> 角速度从 0.12 升到 2.32（约 19 倍）；
  // 时间过半时只转过 21.6%，最后 20% 的时间转过 40% —— 末段明显更快。
  const RELOAD_EASE_POW = 2.5;
  const RELOAD_EASE_FLOOR = 0.12;
  // 花瓣本体在卡面里的额外上移量（占内板高度的比例）。
  // 图形已按实测中心居中，此上移给底部名称文字让位；用户反馈仍偏下 -> 0.11。
  const ART_LIFT = 0.11;

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

  // —— 统一缩放比例（取消自适应缩放）——
  // 旧做法：按每张图自己的包围盒收紧 viewBox（bbox 越大撑得越满）—— 这是【自适应】，
  // SVG 里本来很小的图形会被充大、本来大的又被压小，比例全丢（Stinger 尺寸错误、
  // 实体/卡面图形过大的根源）。
  // 新做法：所有花瓣共用【同一个窗口尺寸】（= Basic 的对应基准），窗口中心取各自锚点：
  //   · 卡面基准 = Basic 的 vb 尺寸（68.2557×79.3829）；锚点取图形实测中心，
  //     Basic 图形比旧版上移约 5%（旧版被字母区锚点带偏），换取全花瓣一视同仁；
  //   · 实体基准 = Basic 花瓣实体的【实测内容包围盒】尺寸（旧版实体是 bbox 裁剪
  //     撑满盒子，只有这个基准能让 Basic 实体观感不变）；
  //   · svg 里小就是小，大就是大；防裁切：内容超出窗口时窗口放大到刚好包住
  //     （只放大、不缩小，绝不把小图充大）。
  const PETAL_CARD_REF = [68.2557, 79.3829];   // Basic vb 宽高 = 卡面统一基准
  let PETAL_ENT_REF = null;                    // 实体统一基准 [w,h]（Basic 实测，懒加载）

  const _bb = {};    // svgId -> [x, y, w, h] | null（离屏 getBBox 实测内容包围盒）
  // 实测 SVG 内容包围盒（含 <g transform> 的整体范围）。
  function measureBox(svgId, svgText) {
    if (_bb[svgId] !== undefined) return _bb[svgId];
    let bb = null;
    try {
      const box = document.createElement('div');
      box.style.cssText =
        'position:absolute;left:-9999px;top:0;width:120px;height:120px;' +
        'overflow:hidden;opacity:0;pointer-events:none;';
      document.body.appendChild(box);
      box.innerHTML = svgText;
      const svg = box.querySelector('svg');
      if (svg && svg.getBBox) {
        const b = svg.getBBox();
        if (b.width > 0 && b.height > 0) bb = [b.x, b.y, b.width, b.height];
      }
      box.remove();
    } catch (e) { bb = null; }
    _bb[svgId] = bb;
    return bb;
  }

  // 统一窗口 viewBox：[cx, cy] 处放 refW×refH 的窗口；内容 (bw×bh) 更大则放大窗口防裁切。
  function uniformWindow(cx, cy, bw, bh, refW, refH) {
    let w = refW, h = refH;
    if (bw > w) w = bw;      // 防裁切：只放大不缩小
    if (bh > h) h = bh;
    return [cx - w / 2, cy - h / 2, w, h];
  }

  // ---- 多体花瓣（Light）----
  // Light 由 N 个相同小圆组成，N 随稀有度增长（官方维基 + 本作实装口径）：
  //   common 1 / unusual,rare 2 / epic,legendary 3 / mythic,ultra 5 / super,eternal 6
  //   —— 顶层 6 个对应 Duplicator 天赋的效果（10 个 super Light 槽 = 60 个光点）；
  //      按约定【不存在 4 个】这种排布。
  // 所有排布都以「单个 Light 的直径 D」为单位，卡面与实体共用同一套布局：
  //   1 -> 单个居中
  //   2 -> 平行并排，中间留缝，不越出卡面
  //   3 -> 三角形
  //   5 -> 五边形紧贴，中心留空
  //   6 -> 更紧贴、轻微交叠，逐个叠压（风车感）
  function lightCount(rarity) {
    switch (rarity) {
      case 'unusual': case 'rare': return 2;
      case 'epic': case 'legendary': return 3;
      case 'mythic': case 'ultra': return 5;
      case 'super': case 'eternal': return 6;
      default: return 1;
    }
  }
  function lightRing(n, r, k, start) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = start + i * Math.PI * 2 / n;
      out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, k });
    }
    return out;
  }
  // x/y 以 D 为单位，k = 该实例相对单体的缩放
  const LIGHT_LAYOUTS = {
    1: [{ x: 0, y: 0, k: 1 }],
    2: [{ x: -0.62, y: 0, k: 0.9 }, { x: 0.62, y: 0, k: 0.9 }],
    3: [
      { x: 0, y: -0.62, k: 0.85 },
      { x: -0.537, y: 0.31, k: 0.85 },
      { x: 0.537, y: 0.31, k: 0.85 }
    ],
    // Mythic 及以上的多光点卡面【更紧凑】：半径从 0.68D 收到 0.60D / 0.58D，
    // 光点之间靠得更近（Mythic 5 个 ≈0.71D 间距、更高稀有度 6 个 ≈0.58D 间距），
    // 单体大小不变，所以只是"挤得更紧"，不会显得变小。
    5: lightRing(5, 0.60, 0.88, -Math.PI / 2),
    6: lightRing(6, 0.58, 0.88, -Math.PI / 2)
  };

  // 该花瓣在【实体】里由几个独立光点组成（Light 多体；其他花瓣 = 1）。
  // 实体的每个光点各占一个轨道位，等同"装了 N 个单体 Light"，不套用卡面的紧凑排布。
  function lightSubCount(type, rarity) {
    return (type && type.slug === 'light') ? lightCount(rarity) : 1;
  }

  // 该花瓣的多体布局（卡面用）；非多体花瓣返回 null
  function multiLayout(svgId, rarity) {
    const t = (typeof getPetal === 'function') ? getPetal(svgId) : null;
    if (!t || t.slug !== 'light') return null;
    return LIGHT_LAYOUTS[lightCount(rarity)] || null;
  }

  // 单个 Light 的直径占素材绘制矩形【宽】的比例：用实测 bbox / 统一窗口宽反推，
  // 不写死数值。forEntity 区分卡面窗口（Basic vb 宽）与实体窗口（Basic 实测 bbox 宽）。
  function lightDRatio(svgId, forEntity) {
    const bb = _bb[svgId];
    const winW = forEntity ? _entWinW[svgId] : _winW[svgId];
    if (bb && winW) return bb[2] / winW;
    // 兜底（测量/窗口尚未就绪）：Light 实测 ≈24.28，卡面窗口 68.26、实体窗口 32.86
    return forEntity ? 0.7389 : 0.3558;
  }

  // 绘制多体花瓣：cv = 单体素材（canvas/Image），boxW×boxH = 单体素材该画多大，
  // D = 单个 Light 的像素直径，layout = multiLayout() 的结果。
  function drawMulti(ctx, cv, boxW, boxH, D, cx, cy, rot, scale, alpha, layout) {
    ctx.save();
    ctx.translate(cx, cy);
    if (rot) ctx.rotate(rot);
    if (scale && scale !== 1) ctx.scale(scale, scale);
    if (alpha != null) ctx.globalAlpha = alpha;
    for (const s of layout) {
      const w = boxW * s.k, h = boxH * s.k;
      ctx.drawImage(cv, s.x * D - w / 2, s.y * D - h / 2, w, h);
    }
    ctx.restore();
  }

  // 卡面布局参数（由 assets/petal-metrics.js 离线提供，运行时零测量）：
  //   vb = 卡面素材的 viewBox（原"图形+名称"整体包围盒按 1/ART_SCALE 放大）——
  //        仅 t（字母位置）用于名称字高换算；【窗口锚点不用它】（其中心被字母区拉低，
  //        会让图形偏下），改用实测图形包围盒中心，全花瓣通用、无需逐张调
  //   t  = 原素材中名称字母的位置 [cx, top, bottom]（同一 viewBox 坐标系）
  function metrics(svgId) {
    const M = (typeof window !== 'undefined' && window.PETAL_METRICS) ? window.PETAL_METRICS : null;
    return (M && svgId != null && M[svgId]) ? M[svgId] : null;
  }

  // 取卡面素材（纯图形 + 统一缩放窗口）。只依赖素材本身，与稀有度无关。
  function asset(svgId) {
    if (_tinted[svgId] !== undefined) return Promise.resolve(_tinted[svgId]);
    return loadRaw(svgId).then((txt) => {
      if (!txt) { _tinted[svgId] = null; return null; }
      let out = txt;
      // 锚点 = 图形【实测包围盒中心】。petal/ 素材的图形一律预居中在画布 (55,55)，
      // 而 metrics.vb 的中心是"图形+名称字母"的整体中心（被字母区拉低）—— 用它锚定
      // 会让图形和文字整体偏下（Stinger 低约 12%、Basic 低约 5%）。
      // 改用实测图形中心后：所有花瓣图形一律居中，无需逐张单独调。
      let vb = null;
      const bb = measureBox(svgId, txt);
      if (bb) {
        vb = uniformWindow(bb[0] + bb[2] / 2, bb[1] + bb[3] / 2, bb[2], bb[3],
          PETAL_CARD_REF[0], PETAL_CARD_REF[1]);
      } else {
        const m = metrics(svgId);                  // 测量失败才退回旧锚点
        if (m && m.vb) {
          vb = uniformWindow(m.vb[0] + m.vb[2] / 2, m.vb[1] + m.vb[3] / 2,
            m.vb[2], m.vb[3], PETAL_CARD_REF[0], PETAL_CARD_REF[1]);
        }
      }
      if (vb) {
        // 记下统一窗口宽：多体花瓣（Light）的直径换算基准
        _winW[svgId] = vb[2];
        out = /viewBox="[^"]*"/.test(out)
          ? out.replace(/viewBox="[^"]*"/, 'viewBox="' + vb.join(' ') + '"')
          : out.replace(/<svg\b/, '<svg viewBox="' + vb.join(' ') + '"');
      }
      const url = 'data:image/svg+xml,' + encodeURIComponent(out);
      _tinted[svgId] = url;
      return url;
    });
  }

  // ---- 世界里的"花瓣实体"：直接用 petal/ 里【已拆分好】的素材 ----
  // 统一缩放窗口：窗口尺寸 = Basic 的实测内容包围盒（PETAL_ENT_REF，懒加载测一次），
  // 窗口中心 = 该花瓣自身内容包围盒中心 —— 与旧版"bbox 裁剪撑满盒子"对 Basic 完全一致，
  // 其他花瓣按 SVG 真实大小呈现（小就是小，大就是大；防裁切只放大）。
  const _artSvg = {};   // svgId -> Promise<string|null>（统一窗口化后的素材文本）
  function artSvg(svgId) {
    if (_artSvg[svgId]) return _artSvg[svgId];
    _artSvg[svgId] = loadRaw(svgId).then((txt) => {
      if (!txt) return null;
      const bb = measureBox(svgId, txt);
      if (!bb) return txt;
      // 统一基准：Basic 的实测包围盒（与 svgId 无关，全局测一次缓存）
      return loadRaw('1').then((basicTxt) => {
        let rw = bb[2], rh = bb[3];               // 取不到 Basic 时退回自身大小（旧行为）
        if (basicTxt) {
          const b = measureBox('1', basicTxt);
          if (b) { PETAL_ENT_REF = [b[2], b[3]]; rw = b[2]; rh = b[3]; }
        }
        const v = uniformWindow(bb[0] + bb[2] / 2, bb[1] + bb[3] / 2, bb[2], bb[3], rw, rh);
        _entWinW[svgId] = v[2];      // 实体窗口宽：多体花瓣直径换算基准
        return /viewBox="[^"]*"/.test(txt)
          ? txt.replace(/viewBox="[^"]*"/, 'viewBox="' + v.join(' ') + '"')
          : txt.replace(/<svg\b/, '<svg viewBox="' + v.join(' ') + '"');
      });
    });
    return _artSvg[svgId];
  }

  const _artCv = {};    // `${svgId}|${px}` -> canvas|null（异步构建，未就绪返回 null；调用方不画也不回退）
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

  // 装填（reload）阴影：画在【内板之上、花瓣图形与名称之下】。
  // 因此阴影只压暗卡牌中部那一块底板，花瓣本体和名字完全不被遮盖（用户要求）。
  // 形状 = 一块"无阴影扇形"在长大，扇形之外是阴影；扇形两条边界（慢/快）同步加速，
  // 快边界角速度恒为慢边界的 2 倍（相对速度不变），装填完成时正好覆盖整圈 -> 阴影消失。
  // (p, iw, ih) = 内板矩形；扇形圆心即内板中心，半径取内板半对角线保证盖住四角。
  function drawReload(ctx, st, p, iw, ih) {
    const rl = st.reload;
    if (!rl || !(rl.dur > 0) || rl.age >= rl.dur) return;
    const t = Math.max(0, Math.min(1, rl.age / rl.dur));
    const e = RELOAD_EASE_FLOOR * t
            + (1 - RELOAD_EASE_FLOOR) * Math.pow(t, RELOAD_EASE_POW);
    const slow = e * TAU;                    // 慢边界：装填完成时正好转满一圈
    const fast = e * TAU * 2;                // 快边界：转速恒为慢的 2 倍
    if (fast - slow >= TAU - 1e-3) return;   // 已铺满：不留阴影
    const cx = p + iw / 2, cy = p + ih / 2;
    const rad = Math.hypot(iw, ih) / 2 + 1;
    // canvas 的 0° 在正右方，而描述中的"起点"习惯用正上方 -> 统一减 π/2
    const a0 = -Math.PI / 2 + fast;          // 阴影从快边界开始
    const a1 = -Math.PI / 2 + slow + TAU;    // 绕一大圈到慢边界
    ctx.save();
    ctx.beginPath();
    ctx.rect(p, p, iw, ih);
    ctx.clip();                              // 绝不溢出内板（卡牌描边不被遮住）
    ctx.fillStyle = 'rgba(18, 24, 20, 0.5)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rad, a0, a1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 花瓣血量阴影（"水缸"）：与 reload 阴影【同一套视觉语言】——
  //   · 同样画在内板之上、花瓣图形与名称之下，clip 到内板，绝不遮稀有度描边/花瓣/名字；
  //   · 同样的颜色与不透明度（rgba(18,24,20,0.5)）；
  //   · 形状不同：从内板【顶边水平下垂】的矩形，高度 = 内板高 × hpShadow
  //     （hpShadow = 1 - hp/maxHp，由 ui.js 每帧平滑写入 st.hpShadow）。
  // 与 reload 阴影天然兼容：血量归零 = 整块内板全阴影 = reload 起始状态，
  // 亮扇形从全阴影中长大退散阴影，两个阶段无缝衔接；reload 期间 st.hpShadow=0 不叠加。
  function drawHpShadow(ctx, st, p, iw, ih) {
    const f = st.hpShadow;
    if (!(f > 0)) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(p, p, iw, ih);
    ctx.clip();
    ctx.fillStyle = 'rgba(18, 24, 20, 0.5)';
    ctx.fillRect(p, p, iw, Math.max(1, ih * Math.min(1, f)));
    ctx.restore();
  }

  // 卡牌名称：白字 + 黑描边（先描边后填充，等价于 SVG 的 paint-order:stroke fill），
  // Ubuntu 800。文本取自 i18N（Petals/<slug>/Name），切换译文包时卡面文字随之改变。
  // 布局（用户要求）：文字【强制在底部】，且图层在图形之上（drawCard 里先画图形、
  // 再调本函数 -> 天然上层）；x 居中，【基线】贴 13% 底边距（基线对齐而非底部对齐）。
  // 字号：【全花瓣严格统一的固定值】—— 不读 metrics、不按宽度收缩、不做任何自适应
  // 计算。曾按各花瓣的字母高度换算，导致 Light（t 高 19.3）比 Basic（15.6）大半圈。
  const NAME_FS_RATIO = 0.27;        // 字号 = 内板高 × 0.27（Basic 的原生观感）
  const NAME_BASE_RATIO = 0.13;      // 基线 = 内板底往上 13%
  // (p, iw, ih) = 内板矩形。
  function drawName(ctx, st, p, iw, ih) {
    const name = st.name;
    if (!name) return;
    const fs = ih * NAME_FS_RATIO;
    if (!(fs > 2)) return;
    ctx.save();
    ctx.font = `800 ${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // 基线固定在底部边距处（【不】按字形 descender 补偿）：带下伸部的名字（如
    // Stinger 的 g）若按"底部对齐"会把基线抬高，与其他卡的文字不平行。
    // 统一基线对齐后所有卡面文字同线，下伸部自然伸进底边距内。
    const baseY = p + ih - ih * NAME_BASE_RATIO;
    ctx.lineWidth = fs * 0.115;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.strokeText(name, p + iw / 2, baseY);
    ctx.fillStyle = '#fff';
    ctx.fillText(name, p + iw / 2, baseY);
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
      // 装填阴影：先画（在内板之上）-> 后面的花瓣图形与名称会盖在它上面，
      // 所以阴影只压暗底板，花瓣本体和名字完全不被遮盖
      drawReload(ctx, st, p, iw, ih);
      // 花瓣血量阴影：与 reload 阴影同层级，紧随其后（都是压底板不压图形/名称）
      drawHpShadow(ctx, st, p, iw, ih);
      // 素材：contain 塞进内板（统一缩放窗口 -> 等比例，非自适应）
      const im = st.img;
      let ox = p, oy = p, dw = iw, dh = ih;
      if (im && im.complete && im.naturalWidth > 0 && im.naturalHeight > 0) {
        const k = Math.min(iw / im.naturalWidth, ih / im.naturalHeight);
        dw = im.naturalWidth * k; dh = im.naturalHeight * k;
        ox = p + (iw - dw) / 2; oy = p + (ih - dh) / 2;
        // 花瓣本体略微上移（按内板高度取比例），给底部名称文字让位
        oy -= ih * ART_LIFT;
        // 多体花瓣（Light）：按稀有度画 1~5 个相同小圆，布局见 LIGHT_LAYOUTS
        const lay = multiLayout(st.svg, st.rarity);
        if (lay) {
          const D = lightDRatio(st.svg, false) * dw;    // 单个 Light 的像素直径
          drawMulti(ctx, im, dw, dh, D, ox + dw / 2, oy + dh / 2, 0, 1, null, lay);
        } else {
          ctx.drawImage(im, ox, oy, dw, dh);
        }
      }
      // 名称：强制底部、固定字号，画在图形【上层】（本调用在 drawImage 之后）
      drawName(ctx, st, p, iw, ih);
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

  // 离屏渲染一张卡面到给定 canvas（不插入 DOM、不依赖布局）。
  // 悬浮框里的"掉落物卡面"用它 —— 与背包/卡槽里的卡【完全同一套绘制逻辑】：
  // 同样的外框/内板比例、同样的名称文字（Ubuntu 800 + 黑描边）、同样的留白，
  // 只是整张卡等比缩放到目标像素尺寸。
  //   opts = { rarity, svg, px(像素边长), pad, radius }
  function renderCardTo(cv, opts) {
    const o = opts || {};
    const px = Math.max(8, Math.round(o.px || 128));
    if (cv.width !== px || cv.height !== px) { cv.width = px; cv.height = px; }
    const st = cv._card || (cv._card = {});
    st.rarity = o.rarity || 'common';
    st.svg = (o.svg != null) ? o.svg : null;
    st.count = null;                       // 掉落物卡不显示数量角标
    st.pad = o.pad; st.radius = o.radius;
    st.name = null; st.metrics = null; st.img = null;
    if (o.name) st.name = String(o.name);       // 外部指定名称（未实装花瓣也能显示文字）
    if (st.svg != null) {
      const t = (typeof getPetal === 'function') ? getPetal(st.svg) : null;
      if (!st.name && t && t.name) st.name = t.name;
      const mt = metrics(st.svg);
      if (mt) st.metrics = mt;
      const u = _tinted[st.svg];
      if (u != null) {
        const im = imgFor(cv, u);
        if (im.complete && im.naturalWidth > 0) st.img = im;
        else im.addEventListener('load', () => { st.img = im; drawCard(cv, st); });
      } else {
        asset(st.svg).then((url) => {
          if (!url) return;
          const im = imgFor(cv, url);
          if (im.complete && im.naturalWidth > 0) { st.img = im; drawCard(cv, st); }
          else im.addEventListener('load', () => { st.img = im; drawCard(cv, st); });
        });
      }
    }
    drawCard(cv, st);                      // 先画纯色卡面（素材就绪后自动补画）
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

  return {
    createCard, darken, rarityColor, artCanvas, renderCardTo, repaintAll, paintCard: paint, FONT,
    // 多体花瓣（Light）：卡面布局 / 直径换算 / 通用绘制 / 实体光点数
    multiLayout, lightDRatio, drawMulti, lightSubCount
  };
})();
