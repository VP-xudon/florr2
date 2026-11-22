// ============================================================================
// render/ant-art.js — 蚂蚁家族（Soldier / Worker / Baby Ant）的【分件矢量】素材
//
// 需求（用户口径）：
//   · 碰撞箱只算圆形体节（兵蚁/工蚁 = 两个体节，幼蚁 = 一个体节），小牙（及翅膀）不算；
//   · 小牙与翅膀持续左右小幅摆动，每秒 1.5 个来回，三种蚂蚁用同一档幅度。
//
// 做法（与 spider-gait.js 同一套思路：矢量级，不预渲染帧）：
//   ① 取原始 SVG 文本，按 fill 把 <path> 分成三类：
//        身体（深色填充块）/ 翅膀（fill="#eee" 半透明）/ 小牙（fill="none" 纯描边）；
//   ② 按【原始文档顺序】切成三层：底层身体 → 中层（翅膀 + 小牙，唯一会动的一层）→ 顶层身体。
//      素材里本来就有身体 path 画在翅膀/小牙之上，分层顺序必须原样保留，否则翅膀会盖住腹部。
//   ③ 每层各生成一张【同 viewBox】的图：SpriteStore 对所有生物共用同一个固定裁剪框，
//      所以任意层叠在一起都严丝合缝（与 SpiderGait 的"无腿身体"同一条管线）。
//   ④ 摆动 = 每个运动部件绕【它自己的起笔点】旋转 sin 相位的角度：
//      素材里翅膀/小牙的 path 都是从贴着身体的那一点开始画的，那一点就是天然的铰链。
//
// 碰撞箱（Mob._ensureShape 的 bodyKey = mob<id>_body）用的是【只有身体】的那张图，
// 矢量轮廓离线预计算在 assets/mob-shapes.js 的 '5_body' / '6_body' / '7_body'
// （tools/gen_ant_body_shape.py）。
// ============================================================================
const AntArt = {
  // 物种 → 素材 id（数字前缀就是 registry 贴图 id）
  SPECIES: {
    soldier_ant: '7',
    worker_ant: '6',
    baby_ant: '5',
    // 蚁后：素材同样是「身体 3 节 + 翅膀 + 小牙」，走同一套分层与摆动。
    // 碰撞只用身体（mob8_body），翅膀/小牙不进轮廓。
    queen_ant: '8',
  },
  HZ: 1.5,                  // 摆动频率：每秒 1.5 个来回
  // 摆幅（三种蚂蚁统一标准）：翅膀 ≈ 1.5°、小牙 ≈ 2.9°
  WING_AMP: 0.02665,
  MANDIBLE_AMP: 0.05,

  _recs: {},

  // 取（必要时创建）某个物种的记录
  _rec(slug) {
    let r = this._recs[slug];
    if (r) return r;
    const svgId = this.SPECIES[slug];
    if (!svgId) return null;
    r = {
      slug, svgId,
      src: 'assets/mobs/' + svgId + '.svg',
      bodyKey: 'mob' + svgId + '_body',    // 碰撞箱素材（只有身体）
      baseKey: 'mob' + svgId + '_base',    // 贴图底层（翅膀之下）
      topKey: 'ant' + svgId + '_top',      // 贴图顶层（翅膀之上的身体）
      loading: false,
      promise: null,                       // Loading 阶段等待分层图全部解码
      vb: null, head: '', tail: '',
      base: null, top: null, mid: null,
    };
    this._recs[slug] = r;
    return r;
  },

  of(mob) {
    const slug = mob && mob.type && mob.type.slug;
    return (slug && this.SPECIES[slug]) ? this._rec(slug) : null;
  },

  ready(slug) { const r = this._recs[slug]; return !!(r && r.mid); },

  // 懒加载：失败静默放弃（退回普通整张贴图，功能不坏，只是不摆）
  ensure(slug) {
    const r = this._rec(slug);
    if (!r || r.mid || r.loading) return !!(r && r.mid);
    r.loading = true;
    r.promise = fetch(r.src + '?v=' + (typeof ASSET_VER !== 'undefined' ? ASSET_VER : 1))
      .then((res) => (res.ok ? res.text() : null))
      .then((t) => { if (t && this._parse(r, t)) return this._build(r); return null; })
      .catch(() => { /* 本地直接打开等场景：退回静态贴图 */ })
      .then(() => { r.loading = false; });
    return false;
  },

  // Loading 阶段调用：等所有蚂蚁物种的底层/顶层/翅膀/小牙分层图真正解码好。
  async prewarm() {
    const waits = [];
    for (const slug of Object.keys(this.SPECIES)) {
      const r = this._rec(slug);
      if (!r) continue;
      this.ensure(slug);
      if (r.promise) waits.push(r.promise);
    }
    await Promise.all(waits);
  },

  _parse(r, txt) {
    const vb = /viewBox="([^"]*)"/.exec(txt);
    if (!vb) return false;
    r.vb = vb[1].split(/[\s,]+/).map(Number);
    if (r.vb.length < 4) return false;
    const tags = txt.match(/<path\b[^>]*?\/>/g) || [];
    if (!tags.length) return false;
    // 只保留原始文档里 path 之前/之后的固定部分（clipPath 等），每层复用它
    r.head = txt.slice(0, txt.indexOf(tags[0]));
    r.tail = txt.slice(txt.lastIndexOf(tags[tags.length - 1]) + tags[tags.length - 1].length);
    r.base = [];
    r.top = [];
    r.mid = [];
    let seenMid = false;
    const wings = [], mands = [];
    for (const el of tags) {
      const fill = (/fill="([^"]*)"/.exec(el) || [])[1] || '';
      const d = (/\sd="([^"]*)"/.exec(el) || [])[1];
      if (!d) continue;
      if (fill === '#eee' || fill === 'none') {          // 翅膀 / 小牙
        seenMid = true;
        (fill === 'none' ? mands : wings).push(el);
        continue;
      }
      (seenMid ? r.top : r.base).push(el);               // 身体：按文档顺序分到翅膀前/后
    }
    // 铰链 = path 的起笔点 M x y（素材里都是贴着身体的那一点）
    const pivotOf = (el) => {
      const d = (/\sd="([^"]*)"/.exec(el) || [])[1] || '';
      const m = /^\s*M\s*(-?[\d.]+)[\s,]*(-?[\d.]+)/.exec(d);
      return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
    };
    const add = (list, amp, keyPrefix) => {
      list.forEach((el, i) => {
        const p = pivotOf(el);
        if (!p) return;
        r.mid.push({
          key: keyPrefix + i, el, px: p[0], py: p[1], amp,
          // 同一对部件反向摆（一只往左、一只往右），看起来才是"左右晃"而不是整体平移
          sign: (i % 2 ? -1 : 1),
        });
      });
    };
    // 小牙排在翅膀之后画：与原素材的叠放顺序一致
    add(wings, this.WING_AMP, 'ant' + r.svgId + '_w');
    add(mands, this.MANDIBLE_AMP, 'ant' + r.svgId + '_m');
    return r.mid.length > 0 || r.base.length > 0;
  },

  _html(r, els) { return r.head + els.join('') + r.tail; },
  _url(txt) { return 'data:image/svg+xml,' + encodeURIComponent(txt); },

  _build(r) {
    if (typeof SpriteStore === 'undefined' || !SpriteStore.load) return Promise.resolve();
    const waits = [];
    // 碰撞素材：全部身体（所有体节都在），翅膀/小牙不在里面
    waits.push(SpriteStore.load(r.bodyKey, this._url(this._html(r, r.base.concat(r.top)))));
    // 贴图底层 / 顶层（翅膀与小牙夹在中间）
    waits.push(SpriteStore.load(r.baseKey, this._url(this._html(r, r.base))));
    waits.push(SpriteStore.load(r.topKey, this._url(this._html(r, r.top))));
    for (const p of r.mid) waits.push(SpriteStore.load(p.key, this._url(this._html(r, [p.el]))));
    return Promise.all(waits);
  },

  // SVG 坐标 → artCanvas 局部坐标（与 SpiderGait._map 完全同一套换算）
  _map(r, vx, vy, size) {
    const ratio = (typeof SpriteStore !== 'undefined' && SpriteStore._cropRatio) ? SpriteStore._cropRatio() : null;
    if (!ratio || !r.vb) return null;
    const u = (vx - r.vb[0]) / r.vb[2];
    const v = (vy - r.vb[1]) / r.vb[3];
    const half = (1 - ratio) / 2;
    return [(u - half) / ratio * size, (v - half) / ratio * size];
  },

  // 在中层之上画【会动的那几件】+ 顶层身体。
  // 由 MobFX.drawOver 在实体本体画完之后调用（局部坐标、已含引擎的 alpha/入场缩放）。
  drawOver(ctx, mob) {
    const r = this.of(mob);
    if (!r) return;
    if (!r.mid) { this.ensure(r.slug); return; }
    const size = mob.drawSize;
    if (!(size > 1)) return;
    const bodyKey = r.baseKey;
    const pv = (typeof SpriteStore !== 'undefined') ? SpriteStore.mobPivot(bodyKey) : { x: 0, y: 0 };
    const rot = (mob.facing || 0) + (mob.artRot || 0);
    if (mob.antPhase == null) mob.antPhase = Math.random();      // 每只错开相位，不会齐刷刷同步
    const now = ((typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000) + mob.antPhase;
    const swing = Math.sin(now * this.HZ * TAU);                 // -1..1，每秒 HZ 个来回
    ctx.save();
    if (rot) ctx.rotate(rot);
    // 与 drawMob 同一坐标系：先摆到裁剪框左上角（轴心平移与本体一致）
    ctx.translate(-size / 2 - pv.x * size, -size / 2 - pv.y * size);
    for (const p of r.mid) {
      const cv = SpriteStore.artCanvas(p.key, size);
      if (!cv) continue;                                          // 还没解码好：下一帧再画
      const q = this._map(r, p.px, p.py, size);                    // 铰链位置
      if (!q) continue;
      const a = swing * p.amp * p.sign;
      ctx.save();
      ctx.translate(q[0], q[1]);
      if (a) ctx.rotate(a);
      ctx.drawImage(cv, -q[0], -q[1], size, size);
      ctx.restore();
    }
    const top = SpriteStore.artCanvas(r.topKey, size);
    if (top) ctx.drawImage(top, 0, 0, size, size);
    ctx.restore();
  },
};
