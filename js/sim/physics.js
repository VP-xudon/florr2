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

function moveEntity(entity, dt, map) {
  // 位移 = 自主移动速度 + 反弹冲量速度（kbX/kbY，由 tickKnockback 衰减）
  const dx = (entity.vx + (entity.kbX || 0)) * dt;
  const dy = (entity.vy + (entity.kbY || 0)) * dt;
  // 有碰撞外形（生物，外形取自其 SVG 轮廓）就走多边形碰撞；否则按圆形（主角/卡片）
  if (entity.hull && typeof map.moveShape === 'function') {
    const position = map.moveShape(entity.x, entity.y, dx, dy, entity.hull, entity.drawSize);
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
    const position = map.clampTo(entity.x, entity.y, entity.r);
    entity.x = position[0]; entity.y = position[1];
    return;
  }

  const position = map.move(entity.x, entity.y, dx, dy, entity.r);
  entity.x = position.x; entity.y = position.y;
  for (const normal of position.normals) {
    const intoWall = entity.vx * normal.x + entity.vy * normal.y;
    if (intoWall < 0) {
      entity.vx -= intoWall * normal.x;
      entity.vy -= intoWall * normal.y;
    }
  }
}
