// sim/physics.js — 统一物理世界：所有实体（玩家 / 生物 / 花瓣 / 落位实体）共用一套碰撞解算
// 'use strict';
//
// 【统一实体接口】参与物理的实体只需要这些字段：
//   x, y              位置
//   r                 等面积圆半径（粗判 / 网格用）
//   vx, vy            速度
//   weight            重量（反质量分配：越重越难被推动）
//   static            可选：true = 不可推动（硬碰撞，对方承担全部修正）
//   shape             可选：生物轮廓 { pts: 归一化多边形, r: 外接圆半径 }，随 facing+artRot 旋转
//   collSize          可选：shape 的世界尺寸（shape.pts × collSize = 世界半径）
//   shapePoly         可选：静态多边形（不随朝向旋转，如 Wax），归一化顶点 × cr
//   cr                可选：shapePoly 的世界半径
//
// 判定优先级（一个函数内分派，任何实体对都走这一条路）：
//   ① 轮廓 vs 圆（mobHitTest，随朝向旋转 —— 生物）
//   ② 多边形 vs 圆（polyVsCircle，不旋转 —— Wax 这类落位实体）
//   ③ 圆 vs 圆（兜底）
// 位置修正与冲量对【所有实体对】同一套反质量公式；static 方 inv=0，对方承担全部修正
// —— "硬碰撞"由此而来，不需要任何调用方写特判。

function _pairHit(a, b) {
  // 判定优先级（一旦选定就返回该结果，绝不 fall through 到更粗的圆）：
  //   ① 静态多边形（shapePoly，Wax 这类落位实体）优先 —— 它的形状是"墙"，
  //     对方（玩家/生物）必须被这个真实多边形挡住；
  //   ② 生物轮廓（shape，随朝向旋转）；
  //   ③ 圆 vs 圆兜底。
  // 早期把生物轮廓放在最前，于是 physicsPush(生物, 蜡块) 实际用的是
  // "蜡块的外接圆 vs 生物轮廓"—— 圆比六边形大一圈，视觉上就是"碰撞箱比 F3 大"。
  if (b && b.shapePoly && b.shapePoly.length >= 3 && typeof polyVsCircle === 'function') {
    // polyVsCircle 的法线是 多边形 -> 圆心(a)，即 b -> a，取反成 a -> b
    const h = polyVsCircle(b.shapePoly, b.x, b.y, b.cr || b.r || 1, a.x, a.y, a.r || 0);
    return h ? { nx: -h.nx, ny: -h.ny, depth: h.depth } : null;
  }
  if (a && a.shapePoly && a.shapePoly.length >= 3 && typeof polyVsCircle === 'function') {
    return polyVsCircle(a.shapePoly, a.x, a.y, a.cr || a.r || 1, b.x, b.y, b.r || 0);
  }
  if (a && a.shape && a.shape.pts && a.shape.pts.length >= 3
    && typeof mobHitTest === 'function') {
    return mobHitTest(a, b.x, b.y, b.r || 0);
  }
  if (b && b.shape && b.shape.pts && b.shape.pts.length >= 3
    && typeof mobHitTest === 'function') {
    const h = mobHitTest(b, a.x, a.y, a.r || 0);
    return h ? { nx: -h.nx, ny: -h.ny, depth: h.depth } : null;
  }
  // ⑤ 圆 vs 圆
  const dx = b.x - a.x, dy = b.y - a.y;
  const rr = (a.r || 0) + (b.r || 0);
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr || d2 <= 1e-6) return null;
  const d = Math.sqrt(d2);
  return { nx: dx / d, ny: dy / d, depth: rr - d };
}

function physicsPush(a, b) {
  const hit = _pairHit(a, b);
  if (!hit || !(hit.depth > 0)) return;
  const nx = hit.nx, ny = hit.ny;                       // 统一为 a -> b
  const invA = a.static ? 0 : 1 / (a.weight || 1);
  const invB = b.static ? 0 : 1 / (b.weight || 1);
  const sum = (invA + invB) || 1;
  // 位置修正：按反质量分配（static 方不动，对方吃下全部重叠）
  const pa = hit.depth * invA / sum, pb = hit.depth * invB / sum;
  a.x -= nx * pa; a.y -= ny * pa;
  b.x += nx * pb; b.y += ny * pb;
  // 冲量：接近速度 -> 低恢复推挤（static 方不吃冲量）
  const closing = ((a.vx || 0) - (b.vx || 0)) * nx + ((a.vy || 0) - (b.vy || 0)) * ny;
  if (closing > 0) {
    const j = (1 + PUSH_RESTITUTION) * closing / sum;
    a.vx = (a.vx || 0) - j * invA * nx; a.vy = (a.vy || 0) - j * invA * ny;
    b.vx = (b.vx || 0) + j * invB * nx; b.vy = (b.vy || 0) + j * invB * ny;
  }
}

// 实体 vs 生物：等价于 physicsPush（保留旧名字，内部已统一）。
function physicsPushMob(e, m) {
  physicsPush(e, m);
}

// 只把【玩家】推出生物轮廓，不反向推动生物（多节生物链节专用）。
function physicsPushPlayerOnly(e, m) {
  if (!e || !m) return;
  const hit = _pairHit(m, e);                    // 法线统一为 m -> e（由生物指向玩家）
  if (!hit || !(hit.depth > 0)) return;
  e.x += hit.nx * hit.depth; e.y += hit.ny * hit.depth;
}

// 把一次【物理推挤产生的位移】过一遍地形：有墙就不动 / 沿墙滑动。
// physicsPush 只解实体之间的重叠，不管地形 —— 所以 Wax 这类"会被玩家推"的落位实体
// 必须在推完之后经这里落地，否则会被一路推进墙里。
function physicsMoveWithWall(ent, dx, dy, map) {
  if (!ent || !map || (!dx && !dy)) return;
  if (ent.shapePoly && ent.shapePoly.length >= 3 && typeof map.moveShape === 'function') {
    const pos = map.moveShape(ent.x, ent.y, dx, dy, ent.shapePoly, ent.cr || ent.r || 1);
    ent.x = pos.x; ent.y = pos.y;
    return;
  }
  if (typeof map.move === 'function') {
    const pos = map.move(ent.x, ent.y, dx, dy, ent.r || 0);
    ent.x = pos.x; ent.y = pos.y;
    return;
  }
  ent.x += dx; ent.y += dy;
}

// 推挤 + 地形：先让 physicsPush 算出"纯实体间的位移"，回退后用地形解算重走一遍。
// 所有会移动的实体都走这一条，墙体与实体碰撞不会互相打架。
function physicsPushOnMap(a, b, map) {
  const bx = b.x, by = b.y;
  physicsPush(a, b);
  const dx = b.x - bx, dy = b.y - by;
  if (!dx && !dy) return;
  b.x = bx; b.y = by;
  physicsMoveWithWall(b, dx, dy, map);
}

// 位移解算（自主速度 + 反弹冲量），并处理墙体碰撞。
// 与上面的推挤同属"物理世界"：所有实体都必须经它移动，才有统一的地形碰撞。
function moveEntity(entity, dt, map) {
  const dx = (entity.vx + (entity.kbX || 0)) * dt;
  const dy = (entity.vy + (entity.kbY || 0)) * dt;
  const poly = entity.walkHull || entity.hull;
  const shapeSize = (entity.walkHull && entity.walkSize != null) ? entity.walkSize : entity.drawSize;
  const radius = (entity.walkR != null) ? entity.walkR : entity.r;
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
