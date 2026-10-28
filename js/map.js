// map.js — 不规则类圆形地图（径向噪声 blob）
'use strict';

// 真实花园地图渲染时的世界像素尺寸（每格瓦片 = GARDEN_TILE 世界单位）。
const GARDEN_TILE = 384 * 0.75;  // 288：瓦片/碰撞/地图整体缩至原 0.75

function createMap(R) {
  const harmonics = [];
  const nH = 6;
  for (let i = 0; i < nH; i++) {
    harmonics.push({
      amp: R * (0.05 + 0.05 * Math.random()) * (1 / (i + 1)),
      freq: 1 + i + ((Math.random() * 2) | 0),
      phase: rand(0, TAU)
    });
  }

  function radiusAt(theta) {
    let r = R;
    for (const h of harmonics) r += h.amp * Math.sin(h.freq * theta + h.phase);
    return Math.max(r, R * 0.5);
  }

  // 多边形采样（用于绘制边界）
  const SAMPLES = 256;
  const poly = [];
  for (let i = 0; i < SAMPLES; i++) {
    const a = i / SAMPLES * TAU;
    const r = radiusAt(a);
    poly.push([Math.cos(a) * r, Math.sin(a) * r]);
  }

  // 把点约束在边界内（0.97 留边）
  function clampTo(x, y) {
    const a = Math.atan2(y, x);
    const r = Math.hypot(x, y);
    const lim = radiusAt(a) * 0.97;
    if (r > lim) { const s = lim / r; return [x * s, y * s]; }
    return [x, y];
  }

  function isInside(x, y) {
    const a = Math.atan2(y, x);
    return Math.hypot(x, y) <= radiusAt(a) * 0.97;
  }

  // 在地图内随机取点（margin<1 留边）
  function randomPoint(margin = 0.85) {
    const a = rand(0, TAU);
    const r = radiusAt(a) * Math.sqrt(Math.random()) * margin;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }

  // 在离玩家 minDist 外取点（用于刷怪）
  function spawnPointAwayFrom(px, py, minDist) {
    let best = null, bestD = -1;
    for (let t = 0; t < 30; t++) {
      const [x, y] = randomPoint(0.94);
      const d = dist(x, y, px, py);
      if (d > minDist) return [x, y];
      if (d > bestD) { bestD = d; best = [x, y]; }
    }
    return best;
  }

  // 简易圆形地图：没有地形瓦片（永不减速）、也没有生成区（由服务端按玩家周围兜底生成）
  return {
    R, radiusAt, poly, clampTo, isInside, randomPoint, spawnPointAwayFrom,
    slowAt: () => false,
    spawnZones: [], zoneAt: () => null, randomPointInZone: () => null,
    checkpoints: [], checkpointAt: () => -1,
    checkpointSpawnPoint: () => ({ x: 0, y: 0 }),
    spawnCheckpointPoint: () => null,
    canStandAt: (x, y, r) => Math.hypot(x, y) < R - (r || 0)
  };
}

const TILED_GID_MASK = 0x0fffffff;
const TILED_FLIP_H = 0x80000000;
const TILED_FLIP_V = 0x40000000;
const TILED_FLIP_D = 0x20000000;

async function loadGardenData(url = 'assets/static/maps/garden.tmj') {
  const mapUrl = new URL(url, document.baseURI);
  const mapResponse = await fetch(mapUrl);
  if (!mapResponse.ok) throw new Error(`Failed to load ${mapUrl}: ${mapResponse.status}`);
  const tmj = await mapResponse.json();
  const tilesets = await Promise.all((tmj.tilesets || []).map(async (ref) => {
    const tsjUrl = new URL(ref.source, mapUrl);
    const response = await fetch(tsjUrl);
    if (!response.ok) throw new Error(`Failed to load ${tsjUrl}: ${response.status}`);
    return { firstgid: ref.firstgid, url: tsjUrl, data: await response.json() };
  }));
  tilesets.sort((a, b) => a.firstgid - b.firstgid);

  const tileInfo = new Map();
  const collisionShapes = {};
  for (const tileset of tilesets) {
    for (const tile of tileset.data.tiles || []) {
      if (!tile.image) continue;
      const imagePath = new URL(tile.image, tileset.url).pathname;
      const name = decodeURIComponent(imagePath.slice(imagePath.lastIndexOf('/') + 1)).replace(/\.svg$/i, '');
      const gid = tileset.firstgid + tile.id;
      tileInfo.set(gid, { name, image: new URL(tile.image, tileset.url).href });
      const objects = tile.objectgroup && tile.objectgroup.objects;
      if (objects && objects.length) {
        collisionShapes[name] = objects.map((object) => {
          const rotation = (object.rotation || 0) * Math.PI / 180;
          const points = object.polygon
            ? object.polygon.map((point) => [point.x, point.y])
            : [[0, 0], [object.width, 0], [object.width, object.height], [0, object.height]];
          const cos = Math.cos(rotation), sin = Math.sin(rotation);
          return points.map(([x, y]) => {
            const px = (object.x || 0) + x, py = (object.y || 0) + y;
            return [
              (px * cos - py * sin) / tileset.data.tilewidth,
              (px * sin + py * cos) / tileset.data.tileheight
            ];
          });
        });
      }
    }
  }

  const width = tmj.width, height = tmj.height;
  const layers = [];
  const usedAssets = new Map();
  for (const layer of tmj.layers || []) {
    if (layer.type !== 'tilelayer' || !layer.visible || !layer.data) continue;
    const encoded = Uint8Array.from(atob(layer.data), (char) => char.charCodeAt(0));
    let decoded;
    if (layer.compression === 'gzip') {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser does not support gzip map decoding');
      decoded = new Uint8Array(await new Response(new Blob([encoded]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    } else if (layer.compression === 'zlib') {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser does not support zlib map decoding');
      decoded = new Uint8Array(await new Response(new Blob([encoded]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
    } else {
      decoded = encoded;
    }

    const view = new DataView(decoded.buffer, decoded.byteOffset, decoded.byteLength);
    const tiles = new Array(width * height);
    for (let i = 0; i < tiles.length; i++) {
      const rawGid = view.getUint32(i * 4, true);
      const gid = rawGid & TILED_GID_MASK;
      if (!gid) {
        tiles[i] = -1;
        continue;
      }
      let tile = null;
      for (let ts = tilesets.length - 1; ts >= 0; ts--) {
        if (gid >= tilesets[ts].firstgid) {
          tile = tileInfo.get(gid);
          break;
        }
      }
      if (!tile) {
        tiles[i] = -1;
        continue;
      }
      const flags = (rawGid & TILED_FLIP_H ? 1 : 0) |
        (rawGid & TILED_FLIP_V ? 2 : 0) |
        (rawGid & TILED_FLIP_D ? 4 : 0);
      tiles[i] = flags ? `${tile.name}#${flags}` : tile.name;
      usedAssets.set(tile.name, tile.image);
    }
    const properties = Object.fromEntries((layer.properties || []).map((property) => [property.name, property.value]));
    layers.push({ name: layer.name, tiles, collisions: properties.collisions !== false });
  }

  // ---- 生物生成区（地图自带）----
  // objectgroup 里 type=spawn_mobs 的对象就是官方生成区：
  //   · polygon     区域范围（可凹多边形）
  //   · mobs        物种/组权重串，如 "rock:0.25;\nant_soldier:1;\ngarden:1;"
  //   · difficulty  该区域难度（-5 ~ 75），决定稀有度分布
  //   · density     密度系数
  // 注意：地图只给【组名】（garden 之类），组成员在 florr 的服务端配置里，tmj 内没有。
  const spawnZones = [];
  for (const layer of tmj.layers || []) {
    if (layer.type !== 'objectgroup' || !layer.visible) continue;
    for (const obj of layer.objects || []) {
      if (obj.type !== 'spawn_mobs') continue;
      const polygon = obj.polygon;
      if (!polygon || polygon.length < 3) continue;
      const props = Object.fromEntries((obj.properties || []).map((p) => [p.name, p.value]));
      spawnZones.push({
        layer: layer.name,
        mobs: String(props.mobs || ''),
        density: parseFloat(props.density) || 1,
        difficulty: parseFloat(props.difficulty) || 0,
        // 保留 tmj 对象坐标，世界坐标换算放到 createGardenMap（那里才知道 half）
        raw: polygon.map((pt) => [obj.x + pt.x, obj.y + pt.y])
      });
    }
  }

  // ---- 复活区域（地图自带）----
  // objectgroup 里 type=checkpoint 的对象是【矩形区域】（不是点），带 level 属性；
  // 顺序 = (level 升序, 距原点升序)，也就是玩家由近及远的推进顺序。
  const checkpoints = [];
  for (const layer of tmj.layers || []) {
    if (layer.type !== 'objectgroup' || !layer.visible) continue;
    for (const obj of layer.objects || []) {
      if (obj.type !== 'checkpoint') continue;
      const props = Object.fromEntries((obj.properties || []).map((p) => [p.name, p.value]));
      const lv = parseInt(props.level, 10);
      checkpoints.push({
        level: Number.isFinite(lv) ? lv : 0,
        // tmj 对象坐标（世界坐标换算放到 createGardenMap）
        raw: [obj.x, obj.y, obj.width || 0, obj.height || 0]
      });
    }
  }

  return {
    // 地图名（如 garden）：/init <map> 用它校验；tmj 本身没有 name 字段，取文件名
    name: (String(url).split('/').pop() || '').replace(/\.[^.]+$/, '') || 'map',
    width,
    height,
    tile: tmj.tilewidth,
    size: width * tmj.tilewidth,
    layers,
    collisionShapes,
    spawnZones,
    checkpoints,
    assets: [...usedAssets].map(([name, src]) => ['tile' + name, src])
  };
}

function transformTiledPoint(x, y, flags) {
  if (flags & 4) [x, y] = [y, x];
  if (flags & 1) x = 1 - x;
  if (flags & 2) y = 1 - y;
  return [x, y];
}

// 统一多边形绕向（一律顺时针，即面积为负）。
// 为什么要做：Tiled 对象组的绕向并不统一。若直接用 nonzero 规则，绕向相反的相邻多边形会互相
// 抵消，在墙体内部留下孔洞；而若用 evenodd 规则，重叠对象又会被"挖空"（环绕数为 2 -> 不填充）。
// 本工程全部 7 个多对象瓦片（grate_* / hut_* / castle_tri_0 / cellar_door）都是「并集」形状
// （L 形、十字格栅、门框），没有一个需要挖洞 —— 所以统一绕向后用 nonzero，重叠即取并集。
function normalizeWinding(poly) {
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    area += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  }
  return area > 0 ? poly.slice().reverse() : poly;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Create a playable map from Tiled's original compressed layer data and tileset collision objects.
function createGardenMap(data) {
  const W = data.width, H = data.height, tile = GARDEN_TILE, half = (W * tile) / 2;
  const FW = W * 2, FH = H * 2, ht = tile / 2;   // 半格(象限)尺寸
  let solid = new Uint8Array(W * H);
  let solidQuad = new Uint8Array(FW * FH);

  // Tiled 瓦片对象组被栅格化为细碰撞网格；移动时用扫掠圆检测并沿墙面滑动。
  let grid = null, GW = 0, GH = 0, ss = 0;   // 细网格（GW×GH，单位 ss 世界像素）
  let collisionTiles = null;
  const SUB = 48;                            // 碰撞对象的逐瓦片采样分辨率
  const _mmCache = new Map();                 // 小地图位图缓存（px -> canvas，多级尺寸）

  function isSolid(tx, ty) {                 // 整格（兼容/小地图）
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;  // 地图外视为墙
    return solid[ty * W + tx] === 1;
  }
  function isSolidQuad(sx, sy) {             // 四分之一格
    if (sx < 0 || sy < 0 || sx >= FW || sy >= FH) return true;
    return solidQuad[sy * FW + sx] === 1;
  }
  // 出生点/小地图等判定：细网格优先，否则退回四分之一格
  function solidAtPoint(x, y) {
    if (grid) {
      const gx = Math.floor((x + half) / ss), gy = Math.floor((y + half) / ss);
      if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return true;
      return grid[gy * GW + gx] === 1;
    }
    return isSolidQuad(Math.floor((x + half) / ht), Math.floor((y + half) / ht));
  }

  function circleContact(x, y, r) {
    const gx0 = Math.max(0, Math.floor((x - r + half) / tile));
    const gx1 = Math.min(W - 1, Math.floor((x + r + half) / tile));
    const gy0 = Math.max(0, Math.floor((y - r + half) / tile));
    const gy1 = Math.min(H - 1, Math.floor((y + r + half) / tile));
    let deepest = null;
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const polygons = collisionTiles && collisionTiles[gy * W + gx];
      if (!polygons) continue;
      const offsetX = gx * tile - half, offsetY = gy * tile - half;
      for (const polygon of polygons) {
        let nearestX = 0, nearestY = 0, minDistanceSquared = Infinity;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const ax = offsetX + polygon[j][0] * tile, ay = offsetY + polygon[j][1] * tile;
          const bx = offsetX + polygon[i][0] * tile, by = offsetY + polygon[i][1] * tile;
          const edgeX = bx - ax, edgeY = by - ay;
          const lengthSquared = edgeX * edgeX + edgeY * edgeY;
          const t = lengthSquared ? clamp(((x - ax) * edgeX + (y - ay) * edgeY) / lengthSquared, 0, 1) : 0;
          const px = ax + t * edgeX, py = ay + t * edgeY;
          const dx = x - px, dy = y - py, distanceSquared = dx * dx + dy * dy;
          if (distanceSquared < minDistanceSquared) {
            minDistanceSquared = distanceSquared;
            nearestX = px; nearestY = py;
          }
        }

        const inside = pointInPolygon((x - offsetX) / tile, (y - offsetY) / tile, polygon);
        if (!inside && minDistanceSquared >= r * r) continue;
        let nx = x - nearestX, ny = y - nearestY;
        const distance = Math.sqrt(minDistanceSquared);
        if (distance > 1e-5) {
          if (inside) { nx = -nx / distance; ny = -ny / distance; }
          else { nx /= distance; ny /= distance; }
        } else {
          const a = polygon[0], b = polygon[1];
          const ex = b[0] - a[0], ey = b[1] - a[1];
          const area = polygon.reduce((sum, p, i) => {
            const next = polygon[(i + 1) % polygon.length];
            return sum + p[0] * next[1] - next[0] * p[1];
          }, 0);
          const sign = area >= 0 ? 1 : -1;
          nx = sign * ey; ny = -sign * ex;
          const length = Math.hypot(nx, ny) || 1;
          nx /= length; ny /= length;
        }

        const penetration = inside ? r + distance : r - distance;
        if (!deepest || penetration > deepest.penetration) deepest = { x: nx, y: ny, penetration };
      }
    }
    return deepest;
  }

  function recoverEmbedded(x, y, r) {
    for (let pass = 0; pass < 8; pass++) {
      const contact = circleContact(x, y, r);
      if (!contact) return [x, y];
      x += contact.x * (contact.penetration + 0.05);
      y += contact.y * (contact.penetration + 0.05);
    }
    if (!circleContact(x, y, r)) return [x, y];

    const startX = Math.floor((x + half) / ss), startY = Math.floor((y + half) / ss);
    for (let radius = 1; radius <= 64; radius++) {
      for (let oy = -radius; oy <= radius; oy++) for (let ox = -radius; ox <= radius; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== radius) continue;
        const gx = startX + ox, gy = startY + oy;
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
        const candidateX = gx * ss - half + ss / 2;
        const candidateY = gy * ss - half + ss / 2;
        if (!circleContact(candidateX, candidateY, r)) return [candidateX, candidateY];
      }
    }
    return [x, y];
  }

  function moveCircle(x, y, dx, dy, r) {
    x = clamp(x, -half + r, half - r);
    y = clamp(y, -half + r, half - r);
    if (!grid) return { x: x + dx, y: y + dy, normals: [] };
    if (circleContact(x, y, r)) [x, y] = recoverEmbedded(x, y, r);

    const startX = x, startY = y;
    const maxStep = Math.max(2, ss * 0.4);
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / maxStep));
    const stepX = dx / steps, stepY = dy / steps;
    const normals = [];
    for (let step = 0; step < steps; step++) {
      let remainingX = stepX, remainingY = stepY;
      for (let slide = 0; slide < 4; slide++) {
        if (Math.abs(remainingX) + Math.abs(remainingY) < 1e-5) break;
        const candidateX = clamp(x + remainingX, -half + r, half - r);
        const candidateY = clamp(y + remainingY, -half + r, half - r);
        const contact = circleContact(candidateX, candidateY, r);
        if (!contact) {
          x = candidateX; y = candidateY;
          break;
        }

        if (!normals.some((normal) => normal.x * contact.x + normal.y * contact.y > 0.98)) {
          normals.push({ x: contact.x, y: contact.y });
        }
        const intoWall = remainingX * contact.x + remainingY * contact.y;
        if (intoWall >= -1e-6) {
          const separation = contact.penetration + 0.01;
          x = candidateX + contact.x * separation;
          y = candidateY + contact.y * separation;
          break;
        }
        remainingX -= intoWall * contact.x;
        remainingY -= intoWall * contact.y;
      }
    }
    return { x, y, dx: x - startX, dy: y - startY, normals };
  }

  function collide(x, y, r) {
    const result = moveCircle(x, y, 0, 0, r);
    return [result.x, result.y];
  }

  // ---- 任意凸多边形碰撞（生物用：外形取自其 SVG 的实际轮廓）----
  // poly 为归一化到 [-0.5,0.5] 的顶点表，scale = 碰撞外形的直径（世界像素）。
  // 复用 circleContact(px,py,0)：半径为 0 时它只在"点落在墙内"时返回，并给出
  // 指向墙外法线 + 到最近边的穿透深度 —— 正好就是逐顶点推出所需要的。
  function shapeContact(poly, ox, oy, scale) {
    let deepest = null;
    for (const [nx, ny] of poly) {
      const c = circleContact(ox + nx * scale, oy + ny * scale, 0);
      if (c && (!deepest || c.penetration > deepest.penetration)) deepest = c;
    }
    return deepest;
  }

  function moveShape(x, y, dx, dy, poly, scale) {
    const clampR = scale * 0.5;
    x = clamp(x, -half + clampR, half - clampR);
    y = clamp(y, -half + clampR, half - clampR);
    if (!grid) return { x: x + dx, y: y + dy, normals: [] };

    // 起始就嵌在墙里 -> 先原地推出
    let contact = shapeContact(poly, x, y, scale);
    for (let pass = 0; pass < 8 && contact; pass++) {
      x += contact.x * (contact.penetration + 0.05);
      y += contact.y * (contact.penetration + 0.05);
      contact = shapeContact(poly, x, y, scale);
    }

    const startX = x, startY = y;
    const maxStep = Math.max(2, ss * 0.4);
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / maxStep));
    const stepX = dx / steps, stepY = dy / steps;
    const normals = [];
    for (let step = 0; step < steps; step++) {
      let remainingX = stepX, remainingY = stepY;
      for (let slide = 0; slide < 4; slide++) {
        if (Math.abs(remainingX) + Math.abs(remainingY) < 1e-5) break;
        const candidateX = clamp(x + remainingX, -half + clampR, half - clampR);
        const candidateY = clamp(y + remainingY, -half + clampR, half - clampR);
        contact = shapeContact(poly, candidateX, candidateY, scale);
        if (!contact) { x = candidateX; y = candidateY; break; }

        if (!normals.some((n) => n.x * contact.x + n.y * contact.y > 0.98)) {
          normals.push({ x: contact.x, y: contact.y });
        }
        const intoWall = remainingX * contact.x + remainingY * contact.y;
        if (intoWall >= -1e-6) {
          const separation = contact.penetration + 0.01;
          x = candidateX + contact.x * separation;
          y = candidateY + contact.y * separation;
          break;
        }
        remainingX -= intoWall * contact.x;
        remainingY -= intoWall * contact.y;
      }
    }
    return { x, y, dx: x - startX, dy: y - startY, normals };
  }

  // Rasterize the collision polygons and rectangles stored in the original Tiled tileset.
  function buildCollision() {
    const N = SUB;
    const gw = W * N, gh = H * N, s = tile / N;
    const g = new Uint8Array(gw * gh);
    const templates = new Map();
    const exactTiles = Array.from({ length: W * H }, () => null);
    const layers = data.layers || [];
    for (const layer of layers) {
      if (layer.collisions === false) continue;
      for (let i = 0; i < W * H; i++) {
        const value = layer.tiles[i];
        if (value === -1 || value == null) continue;
        const text = String(value), hash = text.indexOf('#');
        const name = hash < 0 ? text : text.slice(0, hash);
        const flags = hash < 0 ? 0 : (parseInt(text.slice(hash + 1), 10) || 0);
        const shapes = data.collisionShapes[name];
        if (!shapes || !shapes.length) continue;

        const key = name + '#' + flags;
        let template = templates.get(key);
        if (!template) {
          const mask = new Uint8Array(N * N);
          const transformedShapes = shapes.map((polygon) =>
            normalizeWinding(polygon.map(([px, py]) => transformTiledPoint(px, py, flags))));
          for (let sy = 0; sy < N; sy++) {
            for (let sx = 0; sx < N; sx++) {
              const [px, py] = transformTiledPoint((sx + 0.5) / N, (sy + 0.5) / N, flags);
              if (shapes.some((polygon) => pointInPolygon(px, py, polygon))) mask[sy * N + sx] = 1;
            }
          }
          template = { mask, shapes: transformedShapes };
          templates.set(key, template);
        }

        const tx = i % W, ty = (i / W) | 0, bx = tx * N, by = ty * N;
        if (!exactTiles[i]) exactTiles[i] = [];
        exactTiles[i].push(...template.shapes);
        for (let sy = 0; sy < N; sy++) {
          const row = (by + sy) * gw + bx, maskRow = sy * N;
          for (let sx = 0; sx < N; sx++) if (template.mask[maskRow + sx]) g[row + sx] = 1;
        }
      }
    }

    solid = new Uint8Array(W * H);
    solidQuad = new Uint8Array(FW * FH);
    // 四分之一格（角块）判定：扫描该象限内全部 Q×Q 个细网格采样，只要有一个落在碰撞体内就算实心。
    // 旧实现只取象限正中一个采样点，细斜边/窄边的碰撞体会被整块漏判 -> 小地图上显示成"可走的白块"，
    // 与实际碰撞不符（看着能走，走过去被挡）。
    const Q = N >> 1;                 // 每象限 Q×Q 个采样（N=48 -> 24×24）
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      let occupied = false;
      for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++) {
        const x0 = tx * N + qx * Q, y0 = ty * N + qy * Q;
        let blocked = 0;
        for (let sy = y0; sy < y0 + Q && !blocked; sy++) {
          const row = sy * gw;
          for (let sx = x0; sx < x0 + Q; sx++) if (g[row + sx]) { blocked = 1; break; }
        }
        solidQuad[(ty * 2 + qy) * FW + tx * 2 + qx] = blocked;
        occupied = occupied || !!blocked;
      }
      solid[ty * W + tx] = occupied ? 1 : 0;
    }
    grid = g; GW = gw; GH = gh; ss = s; collisionTiles = exactTiles;
    _mmCache.clear();                         // 碰撞体重建后小地图缓存失效
  }

  // 小地图位图：直接按「真实碰撞多边形」精确栅格化（细斜边/窄边/圆弧都是真实轮廓）。
  // 改为「多级尺寸缓存」：UI 端按"显示尺寸×dpr 取整到 48 的倍数"请求，动画期间只有寥寥几个值，
  // 每个值只构建一次。早期只缓存单个尺寸，动画期间每帧都换尺寸 -> 每帧重建全图 -> 按 M 严重卡顿。
  function minimapCanvas(px) {
    px = Math.max(32, Math.round(px || 256));
    const hit = _mmCache.get(px);
    if (hit) return hit;
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const c = cv.getContext('2d');
    const k = px / (W * tile);                // 世界像素 -> 画布像素（画布左上角 = 世界左上角）
    c.fillStyle = '#d7ddcf';                   // 可走底色
    c.fillRect(0, 0, px, px);
    c.fillStyle = '#11130f';                   // 碰撞体
    c.beginPath();
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const polys = collisionTiles && collisionTiles[ty * W + tx];
      if (!polys || !polys.length) continue;
      const ox = tx * tile, oy = ty * tile;    // 顶点在瓦片内的归一化坐标 0..1
      for (const poly of polys) {
        for (let i = 0; i < poly.length; i++) {
          const cx = (ox + poly[i][0] * tile) * k;
          const cy = (oy + poly[i][1] * tile) * k;
          if (i === 0) c.moveTo(cx, cy); else c.lineTo(cx, cy);
        }
        c.closePath();
      }
    }
    // nonzero + 统一绕向：重叠的碰撞对象取并集。
    // （早先用 evenodd，重叠区域环绕数为 2 会被判成"空心"——grate/hut 这类多对象瓦片的
    //   交叉处就这样在墙里挖出白色空腔。现已改为绕向归一化 + nonzero。）
    c.fill('nonzero');
    _mmCache.set(px, cv);
    if (_mmCache.size > 8) _mmCache.delete(_mmCache.keys().next().value);   // 限制缓存规模
    return cv;
  }

  // 实时矢量绘制碰撞几何（小地图"局部模式"用）：只遍历视图范围内的瓦片，按当前缩放直接画路径，
  // 任意尺寸/dpr 都锐利，不依赖任何预渲染图片（这正是"小档模糊"的解法）。
  // rect = { x0, y0, size }：世界坐标下的正方形区域（x0/y0 为左上角，size 为边长）。
  function drawCollisionRegion(ctx, rect, scale, color) {
    // 防御：任何一个量为 NaN/Infinity 都会让下面的循环一次都不执行（静默画不出东西 -> 小地图一片白）
    if (!isFinite(rect.x0) || !isFinite(rect.y0) || !isFinite(rect.size) || !(scale > 0)) return 0;
    const tx0 = Math.max(0, Math.floor((rect.x0 + half) / tile));
    const ty0 = Math.max(0, Math.floor((rect.y0 + half) / tile));
    const tx1 = Math.min(W - 1, Math.floor((rect.x0 + rect.size + half) / tile));
    const ty1 = Math.min(H - 1, Math.floor((rect.y0 + rect.size + half) / tile));
    if (tx1 < tx0 || ty1 < ty0) return 0;
    ctx.beginPath();
    let n = 0;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const polys = collisionTiles && collisionTiles[ty * W + tx];
      if (!polys || !polys.length) continue;
      // 注意坐标空间：tx*tile 是「地图左上角为原点」的空间(0..W*tile)，
      // 而 rect.x0/rect.y0 是「世界」空间(-half..+half)。必须先 +half 统一，否则会差出
      // 一整个 half（约 10 倍视野），多边形全部画到屏幕外 -> 小地图一片白。
      const ox = tx * tile - (rect.x0 + half), oy = ty * tile - (rect.y0 + half);
      for (const poly of polys) {
        for (let i = 0; i < poly.length; i++) {
          const cx = (ox + poly[i][0] * tile) * scale;
          const cy = (oy + poly[i][1] * tile) * scale;
          if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
        }
        ctx.closePath();
        n++;
      }
    }
    ctx.fillStyle = color || '#11130f';
    ctx.fill('nonzero');   // 与 minimapCanvas 一致：统一绕向后重叠对象取并集，不会挖出空腔
    return n;   // 实际画出的碰撞体数量：0 表示视野内没有墙（调用方可回退到位图，保证不会一片白）
  }

  function isInside(x, y) { return Math.abs(x) <= half && Math.abs(y) <= half; }

  function randomPoint(margin = 0.92) {
    for (let i = 0; i < 200; i++) {
      const x = (Math.random() * 2 - 1) * half * margin;
      const y = (Math.random() * 2 - 1) * half * margin;
      if (!solidAtPoint(x, y)) return [x, y];
    }
    return [0, 0];
  }

  function spawnPointAwayFrom(px, py, minDist) {
    let best = null, bestD = -1;
    for (let i = 0; i < 40; i++) {
      const p = randomPoint(0.96); const d = dist(p[0], p[1], px, py);
      if (d > minDist) return p;
      if (d > bestD) { bestD = d; best = p; }
    }
    return best || [0, 0];
  }

  buildCollision();

  // ---- 生物生成区（世界坐标）----
  // tmj 的对象坐标系是"每格 tmj.tilewidth(=512)px"（121 格 = 61952px），
  // 世界是"每格 GARDEN_TILE(288)px"，所以统一乘 OBJ_SCALE、再平移 -half 换到世界坐标。
  const OBJ_SCALE = GARDEN_TILE / (data.tile || 512);
  function polyArea(pts) {
    let a = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
    }
    return Math.abs(a) / 2;
  }
  const spawnZones = (data.spawnZones || []).map((z) => {
    const pts = z.raw.map(([px, py]) => [px * OBJ_SCALE - half, py * OBJ_SCALE - half]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    return {
      mobs: z.mobs, density: z.density, difficulty: z.difficulty,
      pts, bbox: [x0, y0, x1, y1], area: polyArea(pts)
    };
  }).filter((z) => z.area > 1);

  // 某世界坐标落在哪个生成区（后定义的覆盖先定义的：层顺序与 Tiled 一致）
  function zoneAt(x, y) {
    let hit = null;
    for (const z of spawnZones) {
      const b = z.bbox;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (pointInPolygon(x, y, z.pts)) hit = z;
    }
    return hit;
  }

  // 在区域内的"玩家附近环带"取一个可站立点（不在实体内），取不到返回 null
  function randomPointInZone(zone, cx, cy, rMin, rMax) {
    const b = zone.bbox;
    for (let i = 0; i < 120; i++) {
      let x, y;
      if (cx != null) {
        const a = Math.random() * TAU, d = rMin + Math.random() * (rMax - rMin);
        x = cx + Math.cos(a) * d;
        y = cy + Math.sin(a) * d;
      } else {
        x = b[0] + Math.random() * (b[2] - b[0]);
        y = b[1] + Math.random() * (b[3] - b[1]);
      }
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (!pointInPolygon(x, y, zone.pts)) continue;
      if (solidAtPoint(x, y)) continue;
      return [x, y];
    }
    return null;
  }

  // ---- 复活区域（世界坐标）----
  // 顺序 = (level 升序, 距原点升序)：服务端用这个顺序判断"下一个/上一个"复活点。
  const checkpoints = (data.checkpoints || []).map((c) => {
    const px = c.raw[0], py = c.raw[1], pw = c.raw[2], ph = c.raw[3];
    const x = px * OBJ_SCALE - half, y = py * OBJ_SCALE - half;
    const w = pw * OBJ_SCALE, h = ph * OBJ_SCALE;
    const cx = x + w / 2, cy = y + h / 2;
    return { level: c.level, x, y, w, h, cx, cy, dist: Math.hypot(cx, cy) };
  }).sort((a, b) => (a.level - b.level) || (a.dist - b.dist));

  // 某坐标落在哪个复活区域里（-1 = 不在任何复活区）
  function checkpointAt(x, y) {
    for (let i = 0; i < checkpoints.length; i++) {
      const c = checkpoints[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return i;
    }
    return -1;
  }

  // "这个点能站人吗"：点本身不在实心瓦片，且【玩家半径内不压墙】（含碰撞多边形）。
  // 与 /tp 的判定同一口径 —— 只判一个点会让"贴着墙出生"把角色卡进墙里。
  function canStandAt(x, y, r) {
    if (solidAtPoint(x, y)) return false;
    if (r > 0 && circleContact(x, y, r)) return false;
    return true;
  }

  // 复活落点：【在复活区域内部随机】取一个能站人的位置。
  //   · 不再优先区域中心 —— 检查点是一大片矩形（常常是一整段走廊/房间），
  //     中心既可能正好压墙，也会让每次复活都固定在同一点；
  //   · 区域内随机 = 每次重生落在整片区域里的不同位置（同一次死亡重试也一样）。
  function checkpointSpawnPoint(cp, radius) {
    if (!cp) return { x: 0, y: 0 };
    const r = (typeof radius === 'number' && radius > 0) ? radius : 22;
    const w = Math.max(1, cp.w), h = Math.max(1, cp.h);
    // 1) 随机采样：区域通常是一大片空地，命中率很高
    for (let i = 0; i < 96; i++) {
      const x = cp.x + Math.random() * w;
      const y = cp.y + Math.random() * h;
      if (canStandAt(x, y, r)) return { x, y };
    }
    // 2) 兜底：网格扫描，把区域内所有能站人的点收集起来再随机取一个。
    //    狭窄 L 形走廊等"随机点几乎全落墙里"的地形也能复活，且仍然是随机的。
    const step = Math.max(24, r * 1.5);
    const cand = [];
    for (let y = cp.y + step * 0.5; y < cp.y + h; y += step) {
      for (let x = cp.x + step * 0.5; x < cp.x + w; x += step) {
        if (canStandAt(x, y, r)) cand.push([x, y]);
      }
    }
    if (cand.length) {
      const q = cand[(Math.random() * cand.length) | 0];
      return { x: q[0], y: q[1] };
    }
    // 3) 最后兜底：区域中心 + 碰撞推离（宁可贴着墙，也不嵌进墙里）
    const c = collide(cp.cx, cp.cy, r);
    return { x: c[0], y: c[1] };
  }

  // 出生点 = 等级最低的那个复活区域（checkpoints 已按 level/距离排序）。
  // 客户端开局与服务端"未解锁任何复活区时的复活"都用它 —— 不再固定落在世界原点 (0,0)。
  function spawnCheckpointPoint(radius) {
    if (!checkpoints.length) return null;
    return checkpointSpawnPoint(checkpoints[0], radius);
  }

  // ---- 减速瓦片（地形效果）----
  // foliage / seaweed / vine 系列（树叶、海草、藤蔓）会拖慢玩家并把花瓣打回"待加载"。
  // 关键：这些瓦片的美术只覆盖格子的【一部分】（如 foliage_tl_0 只占左上角约 56%），
  // 所以不能用"整格命中"判定 —— 否则人还没走进叶子就开始减速。
  // 这里按素材【实际不透明像素】判定：首次访问某瓦片时把它的 SVG 采样成 16×16 的
  // alpha 掩码并缓存，之后用亚格坐标（u,v）查表，精度 1/16 格。
  const SLOW_TILE_PREFIXES = ['foliage', 'seaweed', 'vine'];
  const SLOW_MASK_N = 16;
  const _slowMaskCache = new Map();          // 瓦片名 -> Uint8Array(N*N) | null（素材未就绪）
  const _slowOffCanvas = document.createElement('canvas');
  _slowOffCanvas.width = _slowOffCanvas.height = SLOW_MASK_N;

  function slowMaskFor(name) {
    if (_slowMaskCache.has(name)) return _slowMaskCache.get(name);
    let mask = null;
    try {
      const img = (typeof SpriteStore !== 'undefined' && SpriteStore.get) ? SpriteStore.get('tile' + name) : null;
      if (img && img.complete && (img.naturalWidth || img.width)) {
        const c = _slowOffCanvas.getContext('2d', { willReadFrequently: true });
        c.clearRect(0, 0, SLOW_MASK_N, SLOW_MASK_N);
        c.drawImage(img, 0, 0, SLOW_MASK_N, SLOW_MASK_N);
        const px = c.getImageData(0, 0, SLOW_MASK_N, SLOW_MASK_N).data;
        mask = new Uint8Array(SLOW_MASK_N * SLOW_MASK_N);
        for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] > 40 ? 1 : 0;
      }
    } catch (e) {
      mask = null;                            // 跨域/取不到像素：退回按后缀估算
    }
    _slowMaskCache.set(name, mask);           // 注意：null 也要缓存，否则每帧重试很浪费
    return mask;
  }

  // 素材未就绪时的兜底：按官方命名后缀估算覆盖区域（数值来自实际掩码实测）
  //   _c_   整格； _t_   顶部 56% 横带； _tl_ 左上 56% 方块； _bri_ 右下 56% 方块
  function slowFallbackHit(name, u, v) {
    const R = 0.5625;
    if (name.indexOf('_bri') >= 0) return u >= R && v >= R;
    if (name.indexOf('_tl') >= 0) return u < R && v < R;
    if (name.indexOf('_t_') >= 0) return v < R;
    return true;                              // 无后缀（整格图案）：整格都算
  }

  function slowAt(x, y) {
    const fx = (x + half) / tile, fy = (y + half) / tile;
    const tx = Math.floor(fx), ty = Math.floor(fy);
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
    const idx = ty * W + tx;
    let u = fx - tx, v = fy - ty;
    for (let i = 0; i < data.layers.length; i++) {
      const layer = data.layers[i];
      const raw = layer.tiles && layer.tiles[idx];
      if (!raw || raw === -1) continue;
      let name = raw, flags = 0;
      const hash = (typeof raw === 'string') ? raw.indexOf('#') : -1;
      if (hash >= 0) { name = raw.slice(0, hash); flags = parseInt(raw.slice(hash + 1), 10) || 0; }
      let slow = false;
      for (let p = 0; p < SLOW_TILE_PREFIXES.length; p++) {
        if (name.indexOf(SLOW_TILE_PREFIXES[p]) === 0) { slow = true; break; }
      }
      if (!slow) continue;
      // 翻转位：掩码查询时把亚格坐标镜像回去，与实际显示一致
      const uu = (flags & 1) ? 1 - u : u;
      const vv = (flags & 2) ? 1 - v : v;
      const mask = slowMaskFor(name);
      if (!mask) { if (slowFallbackHit(name, uu, vv)) return true; continue; }
      const mx = clamp(Math.floor(uu * SLOW_MASK_N), 0, SLOW_MASK_N - 1);
      const my = clamp(Math.floor(vv * SLOW_MASK_N), 0, SLOW_MASK_N - 1);
      if (mask[my * SLOW_MASK_N + mx]) return true;
    }
    return false;
  }

  const poly = [[-half, -half], [half, -half], [half, half], [-half, half]];
  return {
    R: half, half, tile, width: W, height: H, size: data.size, solid, solidQuad, FW, FH, poly,
    isSolid, solidAtPoint, collide, move: moveCircle, moveShape, isInside, randomPoint, spawnPointAwayFrom,
    clampTo: (x, y, r) => collide(x, y, r || 22),
    minimapCanvas, drawCollisionRegion,
    name: data.name || 'map',
    slowAt,
    spawnZones, zoneAt, randomPointInZone,
    checkpoints, checkpointAt, checkpointSpawnPoint, spawnCheckpointPoint, canStandAt,
    buildCollision
    };
    }

    // 实时绘制花园瓦片：只画当前可见区域，避免一次性把超大地图渲染进一张画布
    // （121×121 格 × 384px ≒ 4.6 万 px，远超单张画布上限，会失败/爆内存）。
    // 背景先由 render() 铺一层草地绿，瓦片就绪后再逐格叠加（未加载的格子暂留绿底）。
    function drawGardenTiles(ctx, data, camX, camY, viewW, viewH) {
    const tile = GARDEN_TILE;
    const half = (data.width * tile) / 2;
    const left = camX - viewW / 2, top = camY - viewH / 2;
    const right = camX + viewW / 2, bottom = camY + viewH / 2;
    let tx0 = Math.floor((left + half) / tile);
    let ty0 = Math.floor((top + half) / tile);
    let tx1 = Math.floor((right + half) / tile);
    let ty1 = Math.floor((bottom + half) / tile);
    tx0 = clamp(tx0, 0, data.width - 1); tx1 = clamp(tx1, 0, data.width - 1);
    ty0 = clamp(ty0, 0, data.height - 1); ty1 = clamp(ty1, 0, data.height - 1);
    for (const layer of data.layers) {
    const tiles = layer.tiles;
    for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = tiles[ty * data.width + tx];
      if (t === -1 || !t) continue;
      // 瓦片可能是 "svg名"（无翻转）或 "svg名#翻转码"（1=H 2=V 4=D，来自 Tiled 翻转位）
      let name = t, flags = 0;
      const hash = (typeof t === 'string') ? t.indexOf('#') : -1;
      if (hash >= 0) { name = t.slice(0, hash); flags = parseInt(t.slice(hash + 1), 10) || 0; }
      const key = 'tile' + name;
      const img = SpriteStore.get(key);
      if (!img || !img.complete) continue;          // 贴图未就绪：暂留绿底
      const cv = SpriteStore.canvasFlip(key, tile, flags);
      if (!cv) continue;
      ctx.drawImage(cv, tx * tile - half - 0.5, ty * tile - half - 0.5, tile + 1, tile + 1);  // 重叠 1px：消除相机浮点平移造成的瓦片缝隙
    }
    }
    }
    }

// 从原始 TMJ 解码出的图层绘制可见瓦片；data 保留每格 GID 与翻转标志。
// worldSize: 画布像素尺寸（对应世界直径，= 2*WORLD_R）
function renderTileMap(data, worldSize) {
  const W = data.width, H = data.height;
  const cell = worldSize / W;
  const cw = Math.ceil(cell) + 1;
  // 预渲染每种瓦片到小画布一次（避免对矢量SVG重复栅格化 10 万次）
  const cache = {};
  for (const layer of data.layers) {
    for (const t of layer.tiles) {
      if (t === -1 || !t || cache[t]) continue;
      let name = t, flags = 0;
      const hash = (typeof t === 'string') ? t.indexOf('#') : -1;
      if (hash >= 0) { name = t.slice(0, hash); flags = parseInt(t.slice(hash + 1), 10) || 0; }
      const off = document.createElement('canvas');
      off.width = cw; off.height = cw;
      const oc = off.getContext('2d');
      const base = SpriteStore.canvasFlip('tile' + name, cw, flags);
      if (base) { oc.drawImage(base, 0, 0, cw, cw); }
      else { oc.fillStyle = '#3a6b34'; oc.fillRect(0, 0, cw, cw); }
      cache[t] = off;
    }
  }
  const cv = document.createElement('canvas');
  cv.width = worldSize; cv.height = worldSize;
  const c = cv.getContext('2d');
  c.fillStyle = '#274d22'; c.fillRect(0, 0, worldSize, worldSize); // 非草地区底色
  for (const layer of data.layers) {
    const tiles = layer.tiles;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = tiles[y * W + x];
        if (t === -1 || !t) continue;
        c.drawImage(cache[t], x * cell, y * cell, cell + 1, cell + 1);
      }
    }
  }
  return cv;
}
