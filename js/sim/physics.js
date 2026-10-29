// sim/physics.js — 实体推挤与地形位移解算（无 DOM）
'use strict';

function physicsPush(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const rr = a.r + b.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 <= 1e-6) return;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
  const overlap = rr - d;
  const invA = 1 / (a.weight || 1), invB = 1 / (b.weight || 1), sum = invA + invB;
  // 位置修正：按反质量分配（重 = 少动）
  const pa = overlap * invA / sum, pb = overlap * invB / sum;
  a.x -= nx * pa; a.y -= ny * pa;
  b.x += nx * pb; b.y += ny * pb;
  // 冲量：接近速度 -> 低恢复推挤（快 = 推动更重的；重 = 难被推动）
  const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (closing > 0) {
    const j = (1 + PUSH_RESTITUTION) * closing / sum;
    a.vx -= j * invA * nx; a.vy -= j * invA * ny;
    b.vx += j * invB * nx; b.vy += j * invB * ny;
  }
}

// 实体 vs 生物：优先用生物的【SVG 轮廓】判定（与伤害结算、F3 碰撞箱同一套）。
// 以前一律按两圆（e.r + m.r）推挤，而 m.r 是"等面积圆"——对大型生物来说它比外形小得多：
// 玩家能走进生物身体里、F3 画出来的外形和实际推挤完全对不上（"大型生物尤为明显"）。
// 轮廓还没就绪（贴图未加载）时才退回两圆，保证不会完全不碰撞。
function physicsPushMob(e, m) {
  if (!e || !m) return;
  const sh = m.shape;
  if (sh && sh.pts && sh.pts.length >= 3 && typeof mobHitTest === 'function') {
    const hit = mobHitTest(m, e.x, e.y, e.r || 0);
    if (!hit || !(hit.depth > 0)) return;
    const nx = hit.nx, ny = hit.ny;                    // 由生物表面指向实体圆心
    const invA = 1 / (e.weight || 1), invB = 1 / (m.weight || 1), sum = (invA + invB) || 1;
    const pa = hit.depth * invA / sum, pb = hit.depth * invB / sum;
    e.x += nx * pa; e.y += ny * pa;
    m.x -= nx * pb; m.y -= ny * pb;
    // 冲量：接近速度 -> 低恢复推挤（与两圆版本同一套反质量分配）
    const closing = ((m.vx || 0) - (e.vx || 0)) * nx + ((m.vy || 0) - (e.vy || 0)) * ny;
    if (closing > 0) {
      const j = (1 + PUSH_RESTITUTION) * closing / sum;
      e.vx = (e.vx || 0) + j * invA * nx; e.vy = (e.vy || 0) + j * invA * ny;
      m.vx -= j * invB * nx; m.vy -= j * invB * ny;
    }
    return;
  }
  physicsPush(e, m);
}

// 只把【玩家】推出生物轮廓，不反向推动生物。
// 多节生物的每一节都是刚性链上的节点：推它会和每帧末的轨迹解算打架，
// 客户端表现为"一帧被顶开、下一帧被拉回"的整条抖动/错位；服务端表现为链被撕开。
// 所以链节与玩家的分离只推玩家（身体扫到花朵时，花朵被顶开）。
function physicsPushPlayerOnly(e, m) {
  if (!e || !m) return;
  const sh = m.shape;
  if (!sh || !sh.pts || sh.pts.length < 3 || typeof mobHitTest !== 'function') return;
  const hit = mobHitTest(m, e.x, e.y, e.r || 0);
  if (!hit || !(hit.depth > 0)) return;
  e.x += hit.nx * hit.depth;
  e.y += hit.ny * hit.depth;
}

function moveEntity(entity, dt, map) {
  // 位移 = 自主移动速度 + 反弹冲量速度（kbX/kbY，由 tickKnockback 衰减）
  const dx = (entity.vx + (entity.kbX || 0)) * dt;
  const dy = (entity.vy + (entity.kbY || 0)) * dt;
  // 墙体碰撞用【行走碰撞箱】（walkHull/walkSize，见 Mob._ensureShape）：
  // 它被钳到「1 格瓦片 0.9 倍正方形的内接圆」以内，因此多大体型的生物都能走 1 格通道。
  // 伤害结算与玩家推挤仍然用 r/shape —— 两套尺寸互不影响。
  // 没有行走箱的实体（主角、卡片、旧数据）自动回落到原来的 hull / 圆。
  const poly = entity.walkHull || entity.hull;
  const shapeSize = (entity.walkHull && entity.walkSize != null) ? entity.walkSize : entity.drawSize;
  const radius = (entity.walkR != null) ? entity.walkR : entity.r;
  // 有碰撞外形（生物，外形取自其 SVG 轮廓）就走多边形碰撞；否则按圆形（主角/卡片）
  if (poly && typeof map.moveShape === 'function') {
    const position = map.moveShape(entity.x, entity.y, dx, dy, poly, shapeSize);
    entity.x = position.x; entity.y = position.y;
    for (const normal of position.normals) {
      const intoWall = entity.vx * normal.x + entity.vy * normal.y;
      if (intoWall < 0) {
        entity.vx -= intoWall * normal.x;
        entity.vy -= intoWall * normal.y;
      }
    }
    return;
  }
  if (typeof map.move !== 'function') {
    entity.x += dx; entity.y += dy;
    const position = map.clampTo(entity.x, entity.y, radius);
    entity.x = position[0]; entity.y = position[1];
    return;
  }

  const position = map.move(entity.x, entity.y, dx, dy, radius);
  entity.x = position.x; entity.y = position.y;
  for (const normal of position.normals) {
    const intoWall = entity.vx * normal.x + entity.vy * normal.y;
    if (intoWall < 0) {
      entity.vx -= intoWall * normal.x;
      entity.vy -= intoWall * normal.y;
    }
  }
}
