// sim/crb.js — 硬编码碰撞箱（.crb）读取器
// 'use strict';
//
// 数据文件：assets/crbs/mobs/*.crb 与 assets/crbs/petals/*.crb
// 格式（JSON，全部硬编码，运行时不解析 SVG）：
//   { "id": "11", "kind": "...", "source": "...", "pts": [[x,y],...], "r": 0.5 }
//   pts = 归一化多边形，× collSize = 世界半径；r = 外接半径（同单位），供粗判
//
// 统一入口：CRB.get(svgKey) / CRB.getPetal(svgKey)
// 生物、花瓣、F3 调试箱全部读同一份数据 —— 不存在"画一套、判一套"。

const CRB = {
  mobs: {},
  petals: {},
  ready: false,

  // 实装的物种才需要碰撞箱；没实装的生物不管（返回 null -> 走素材轮廓兜底）
  MOB_FILES: ['3', '4', '11', '12_h', '12_b', '21', '27', '11_missile'],
  PETAL_FILES: ['96'],

  async loadAll() {
    const jobs = [];
    for (const id of this.MOB_FILES) {
      jobs.push(this._fetch('assets/crbs/mobs/' + id + '.crb').then((d) => { if (d) this.mobs[id] = d; }));
    }
    for (const id of this.PETAL_FILES) {
      jobs.push(this._fetch('assets/crbs/petals/' + id + '.crb').then((d) => { if (d) this.petals[id] = d; }));
    }
    await Promise.allSettled(jobs);
    this.ready = true;
    return this;
  },

  async _fetch(url) {
    try {
      // 破缓存：crb 是数据文件，改内容后必须让浏览器重新拉（不走 ?v= 会拿到旧的）
      const r = await fetch(url + '?v=' + ((typeof ASSET_VER !== 'undefined') ? ASSET_VER : Date.now()),
        { cache: 'no-store' });
      if (!r.ok) return null;
      const d = await r.json();
      return (d && Array.isArray(d.pts) && d.pts.length >= 3)
        ? { pts: d.pts, r: d.r || Math.max(...d.pts.map((p) => Math.hypot(p[0], p[1]))) }
        : null;
    } catch (e) { return null; }
  },

  // 生物：key = artSvg || svg（多节生物头/身体节各有自己的 crb）
  get(key) { return (key != null && this.mobs[String(key)]) || null; },

  // 花瓣（Wax 等落位实体）
  getPetal(key) { return (key != null && this.petals[String(key)]) || null; },
};
