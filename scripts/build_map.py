import base64, zlib, struct, json, os, re, math
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_PATH = os.path.join(ROOT, 'assets', 'static', 'maps', 'garden.tmj')
TSJ_DIR = os.path.join(ROOT, 'assets', 'static', 'tiles')

# 遮罩分辨率：每片瓦片烘焙成 RASTER_N x RASTER_N 的占用位图（越高越精细）
RASTER_N = 16

# ----------------------------------------------------------------------------
# 纯 Python SVG 栅格化器（不依赖任何外部库）：把瓦片 SVG 的真实矢量轮廓
# 栅格化为占用遮罩。这样碰撞精确跟随素材形状（含曲线），且运行时无需
# DOMParser / getImageData，彻底摆脱“人工描边”与 file:// 下的 taint 问题。
# ----------------------------------------------------------------------------
def mmul(A, B):
    a = A[0]*B[0] + A[2]*B[1]; b = A[1]*B[0] + A[3]*B[1]
    c = A[0]*B[2] + A[2]*B[3]; d = A[1]*B[2] + A[3]*B[3]
    e = A[0]*B[4] + A[2]*B[5] + A[4]; f = A[1]*B[4] + A[3]*B[5] + A[5]
    return [a, b, c, d, e, f]

def applyM(M, x, y):
    return (M[0]*x + M[2]*y + M[4], M[1]*x + M[3]*y + M[5])

def parse_transform(s):
    M = [1, 0, 0, 1, 0, 0]
    if not s:
        return M
    for m in re.finditer(r'([a-zA-Z]+)\s*\(([^)]*)\)', s):
        op = m.group(1).lower()
        nums = [float(x) for x in re.findall(r'[-+]?\d*\.?\d+', m.group(2))]
        if op == 'translate':
            tx = nums[0] if len(nums) > 0 else 0
            ty = nums[1] if len(nums) > 1 else 0
            M = mmul(M, [1, 0, 0, 1, tx, ty])
        elif op == 'scale':
            sx = nums[0] if len(nums) > 0 else 1
            sy = nums[1] if len(nums) > 1 else sx
            M = mmul(M, [sx, 0, 0, sy, 0, 0])
        elif op == 'rotate':
            ang = math.radians(nums[0] if nums else 0)
            ca, sa = math.cos(ang), math.sin(ang)
            if len(nums) >= 3:
                cx, cy = nums[1], nums[2]
                M = mmul(M, [1, 0, 0, 1, cx, cy])
                M = mmul(M, [ca, sa, -sa, ca, 0, 0])
                M = mmul(M, [1, 0, 0, 1, -cx, -cy])
            else:
                M = mmul(M, [ca, sa, -sa, ca, 0, 0])
        elif op == 'matrix':
            if len(nums) >= 6:
                M = mmul(M, nums[:6])
        elif op == 'skewx':
            ang = math.radians(nums[0] if nums else 0)
            M = mmul(M, [1, 0, math.tan(ang), 1, 0, 0])
        elif op == 'skewy':
            ang = math.radians(nums[0] if nums else 0)
            M = mmul(M, [1, math.tan(ang), 0, 1, 0, 0])
    return M

def bezier(x0, y0, x1, y1, x2, y2, x3, y3):
    pts = []; STEPS = 18
    for i in range(STEPS + 1):
        t = i/STEPS; u = 1 - t
        x = u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3
        y = u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3
        pts.append((x, y))
    return pts

def quad(x0, y0, x1, y1, x2, y2):
    pts = []; STEPS = 14
    for i in range(STEPS + 1):
        t = i/STEPS; u = 1 - t
        x = u*u*x0 + 2*u*t*x1 + t*t*x2; y = u*u*y0 + 2*u*t*y1 + t*t*y2
        pts.append((x, y))
    return pts

def arc(x0, y0, rx, ry, rot, large, sweep, x2, y2):
    rot = math.radians(rot)
    rx = abs(rx); ry = abs(ry)
    if rx == 0 or ry == 0:
        return [(x0, y0), (x2, y2)]
    dx = (x0 - x2)/2; dy = (y0 - y2)/2
    x1p = math.cos(rot)*dx + math.sin(rot)*dy
    y1p = -math.sin(rot)*dx + math.cos(rot)*dy
    num = (x1p*x1p)/(rx*rx) + (y1p*y1p)/(ry*ry)
    if num > 1:
        rx *= math.sqrt(num); ry *= math.sqrt(num)
    sq = (rx*rx*ry*ry - rx*rx*y1p*y1p - ry*ry*x1p*x1p)
    sq = 0 if sq < 0 else sq
    coef = math.sqrt(sq/((rx*rx*y1p*y1p) + (ry*ry*x1p*x1p))) * (1 if large != sweep else -1)
    cxp = coef*(rx*y1p/ry); cyp = -coef*(ry*x1p/rx)
    cx0 = math.cos(rot)*cxp - math.sin(rot)*cyp + (x0 + x2)/2
    cy0 = math.sin(rot)*cxp + math.cos(rot)*cyp + (y0 + y2)/2

    def ang(ux, uy, vx, vy):
        dot = ux*vx + uy*vy
        l = math.sqrt((ux*ux + uy*uy)*(vx*vx + vy*vy))
        if l == 0:
            return 0
        a = math.acos(max(-1, min(1, dot/l)))
        return -a if ux*vy - uy*vx < 0 else a
    th0 = ang(1, 0, (x1p - cxp)/rx, (y1p - cyp)/ry)
    th1 = ang((x1p - cxp)/rx, (y1p - cyp)/ry, (-x1p - cxp)/rx, (-y1p - cyp)/ry)
    if sweep == 0 and th1 > 0:
        th1 -= 2*math.pi
    if sweep == 1 and th1 < 0:
        th1 += 2*math.pi
    pts = []; STEPS = 24
    for i in range(STEPS + 1):
        t = th0 + (th1 - th0)*i/STEPS
        ex = math.cos(t)*rx; ey = math.sin(t)*ry
        x = math.cos(rot)*ex - math.sin(rot)*ey + cx0
        y = math.sin(rot)*ex + math.cos(rot)*ey + cy0
        pts.append((x, y))
    return pts

def flatten_path(d):
    cmds = re.findall(r'([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)', d)
    seq = []
    for c, n in cmds:
        if c:
            seq.append((c, []))
        elif n != '':
            seq[-1][1].append(float(n))
    # 合并成 (cmd, nums) 列表（同命令多组参数）
    out = []; cur = None
    for c, nums in seq:
        if cur is None or cur[0] != c:
            cur = (c, []); out.append(cur)
        cur[1].extend(nums)
    subs = []; curpoly = []
    cx = cy = 0.0; sx = sy = 0.0; pc = None

    def flush():
        if len(curpoly) >= 2:
            subs.append(curpoly[:])
    for cmd, nums in out:
        L = cmd.islower(); op = cmd.upper()
        if op == 'M':
            if curpoly:
                flush(); curpoly.clear()
            x, y = nums[0], nums[1]
            if L:
                x += cx; y += cy
            cx, cy = x, y; sx, sy = x, y; pc = None; curpoly = [(x, y)]
        elif op == 'L':
            for k in range(0, len(nums), 2):
                x, y = nums[k], nums[k+1]
                if L:
                    x += cx; y += cy
                cx, cy = x, y; curpoly.append((x, y)); pc = None
        elif op == 'H':
            for v in nums:
                x = v if not L else cx + v
                cx = x; curpoly.append((x, cy)); pc = None
        elif op == 'V':
            for v in nums:
                y = v if not L else cy + v
                cy = y; curpoly.append((cx, y)); pc = None
        elif op == 'C':
            for k in range(0, len(nums), 6):
                x1, y1, x2, y2, x, y = nums[k:k+6]
                if L:
                    x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy
                curpoly.extend(bezier(cx, cy, x1, y1, x2, y2, x, y)[1:])
                cx, cy = x, y; pc = (x2, y2)
        elif op == 'S':
            for k in range(0, len(nums), 4):
                x2, y2, x, y = nums[k:k+4]
                if L:
                    x2 += cx; y2 += cy; x += cx; y += cy
                rcx, rcy = (2*cx - pc[0], 2*cy - pc[1]) if pc else (cx, cy)
                curpoly.extend(bezier(cx, cy, rcx, rcy, x2, y2, x, y)[1:])
                cx, cy = x, y; pc = (x2, y2)
        elif op == 'Q':
            for k in range(0, len(nums), 4):
                x1, y1, x, y = nums[k:k+4]
                if L:
                    x1 += cx; y1 += cy; x += cx; y += cy
                curpoly.extend(quad(cx, cy, x1, y1, x, y)[1:])
                cx, cy = x, y; pc = (x1, y1)
        elif op == 'T':
            for k in range(0, len(nums), 2):
                x, y = nums[k], nums[k+1]
                if L:
                    x += cx; y += cy
                rcx, rcy = (2*cx - pc[0], 2*cy - pc[1]) if pc else (cx, cy)
                curpoly.extend(quad(cx, cy, rcx, rcy, x, y)[1:])
                cx, cy = x, y; pc = (rcx, rcy)
        elif op == 'A':
            for k in range(0, len(nums), 7):
                rx, ry, rot, large, sweep, x, y = nums[k:k+7]
                if L:
                    x += cx; y += cy
                curpoly.extend(arc(cx, cy, rx, ry, rot, int(large), int(sweep), x, y)[1:])
                cx, cy = x, y; pc = None
        elif op == 'Z':
            if curpoly:
                curpoly.append(curpoly[0])
            flush(); curpoly.clear()
    if curpoly:
        flush()
    return subs

def el_to_polygons(el, vbW, vbH):
    tag = el.tag.split('}')[-1].lower()
    if tag == 'path':
        d = el.get('d')
        return flatten_path(d) if d else []
    if tag == 'rect':
        x = float(el.get('x', 0)); y = float(el.get('y', 0))
        w = float(el.get('width', 0)); h = float(el.get('height', 0))
        if w <= 0 or h <= 0:
            return []
        return [[(x, y), (x+w, y), (x+w, y+h), (x, y+h)]]
    if tag == 'polygon' or tag == 'polyline':
        nums = [float(v) for v in re.findall(r'[-+]?\d*\.?\d+', el.get('points', ''))]
        pts = [(nums[i], nums[i+1]) for i in range(0, len(nums)-1, 2)]
        if tag == 'polygon' and pts:
            pts = pts + [pts[0]]
        return [pts] if len(pts) >= 2 else []
    if tag == 'circle':
        cx = float(el.get('cx', 0)); cy = float(el.get('cy', 0)); r = float(el.get('r', 0))
        if r <= 0:
            return []
        pts = [(cx + r*math.cos(2*math.pi*i/32), cy + r*math.sin(2*math.pi*i/32)) for i in range(32)]
        return [pts]
    if tag == 'ellipse':
        cx = float(el.get('cx', 0)); cy = float(el.get('cy', 0))
        rx = float(el.get('rx', 0)); ry = float(el.get('ry', 0))
        if rx <= 0 or ry <= 0:
            return []
        pts = [(cx + rx*math.cos(2*math.pi*i/32), cy + ry*math.sin(2*math.pi*i/32)) for i in range(32)]
        return [pts]
    return []

def render_polys(polys, N, sx, sy):
    mask = [[0]*N for _ in range(N)]
    edges = []
    for poly in polys:
        pts = [(x*sx, y*sy) for (x, y) in poly]
        n = len(pts)
        if n < 2:
            continue
        closed = pts + [pts[0]]
        for i in range(n):
            x0, y0 = closed[i]; x1, y1 = closed[i+1]
            edges.append((x0, y0, x1, y1))
    for py in range(N):
        y = py + 0.5
        xs = []
        for (x0, y0, x1, y1) in edges:
            if (y0 <= y < y1) or (y1 <= y < y0):
                t = (y - y0)/(y1 - y0) if (y1 - y0) != 0 else 0
                xs.append(x0 + t*(x1 - x0))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            a = int(math.floor(xs[i])); b = int(math.ceil(xs[i+1]))
            for px in range(max(0, a), min(N, b)):
                mask[py][px] = 1
    return mask

def rasterize_svg(svg, N):
    try:
        root = ET.fromstring(svg)
    except Exception:
        return None
    vb = root.get('viewBox')
    vbW = vbH = 256
    if vb:
        p = [float(x) for x in re.findall(r'[-+]?\d*\.?\d+', vb)]
        if len(p) >= 4:
            vbW, vbH = p[2], p[3]
    parent = {}
    for el in root.iter():
        for c in el:
            parent[c] = el
    out = [[0]*N for _ in range(N)]
    for el in root.iter():
        tag = el.tag.split('}')[-1].lower()
        if tag not in ('path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline'):
            continue
        # 跳过 defs 内部或隐藏元素
        anc = el; skip = False
        while anc is not None:
            t = anc.tag.split('}')[-1].lower()
            if t == 'defs':
                skip = True; break
            if anc.get('display') == 'none':
                skip = True
            anc = parent.get(anc)
        if skip:
            continue
        if el.get('fill') == 'none':
            continue
        # 元素变换（含祖先 <g>）
        chain = []; c = el
        while c is not None:
            chain.append(c); c = parent.get(c)
        M = [1, 0, 0, 1, 0, 0]
        for e in reversed(chain):
            tr = e.get('transform')
            if tr:
                M = mmul(M, parse_transform(tr))
        polys = el_to_polygons(el, vbW, vbH)
        if not polys:
            continue
        tpolys = [[applyM(M, x, y) for (x, y) in poly] for poly in polys]
        tmp = render_polys(tpolys, N, N/vbW, N/vbH)
        for y in range(N):
            for x in range(N):
                if tmp[y][x]:
                    out[y][x] = 1
    return out

# ----------------------------------------------------------------------------
# 瓦片名称处理 & 阻挡判定（与 TMJ 标准一致：瓦片自带 solid 属性）
# ----------------------------------------------------------------------------
def basename_of(image):
    fn = os.path.basename(image)
    return re.sub(r'\.(svg|png)$', '', fn)

FLOOR_KW = ['floor', 'grass', 'sand', 'pavement', 'desert', 'wood', 'ocean', 'bridge', 'overlay']
SOLID_KW = ['wall', 'water', 'castle', 'coral', 'hut', 'grate', 'vent', 'scliff',
            'anthole', 'worm', 'pyramid', 'termite', 'bush', 'seaweed', 'foliage', 'vine',
            'cellar_door', 'factory_entrance', 'sewer_entrance', 'factory', 'organic',
            'dirt']

def is_solid_tile(name, image):
    s = ((name or '') + ' ' + (image or '')).lower()
    if any(k in s for k in FLOOR_KW):
        return False
    if any(k in s for k in SOLID_KW):
        return True
    return False

def load_tileset(path, firstgid):
    with open(path, encoding='utf-8') as f:
        ts = json.load(f)
    tiles = {}
    solid = {}
    for t in ts.get('tiles', []):
        tid = t.get('id')
        img = t.get('image')
        if img:
            bn = basename_of(img)
            tiles[tid] = bn
            solid[bn] = is_solid_tile(t.get('name', ''), img)
    return {'firstgid': firstgid, 'tiles': tiles, 'solid': solid,
            'name': ts.get('name', os.path.basename(path))}

def decode_layer(data_b64):
    raw = base64.b64decode(data_b64)
    blob = zlib.decompress(raw, 16 + zlib.MAX_WBITS)
    n = len(blob) // 4
    return list(struct.unpack('<%di' % n, blob))

with open(MAP_PATH, encoding='utf-8') as f:
    m = json.load(f)

tilesets = []
for tsref in m.get('tilesets', []):
    fg = tsref.get('firstgid', 1)
    src = tsref.get('source', '')
    p = src.replace('\\', '/').split('/')
    fname = p[-1]
    full = os.path.join(TSJ_DIR, fname)
    if not os.path.exists(full):
        full = os.path.join(os.path.dirname(MAP_PATH), '..', 'tiles', fname)
    tilesets.append(load_tileset(full, fg))
tilesets.sort(key=lambda t: t['firstgid'])

FLIP_H = 0x80000000
FLIP_V = 0x40000000
FLIP_D = 0x20000000

def resolve(gid):
    if gid == 0:
        return None
    flags = gid & 0xE0000000
    base = gid & 0x1FFFFFFF
    for ts in reversed(tilesets):
        if base >= ts['firstgid']:
            local = base - ts['firstgid']
            name = ts['tiles'].get(local)
            if name is not None:
                f = 0
                if flags & FLIP_H: f |= 1
                if flags & FLIP_V: f |= 2
                if flags & FLIP_D: f |= 4
                return (name, f)
    return None

W = m['width']; H = m['height']; TILE = 24

layers_resolved = []
for layer in m.get('layers', []):
    if 'data' not in layer:
        continue
    gids = decode_layer(layer['data'])
    resolved = [resolve(g) for g in gids]
    layers_resolved.append({'name': layer.get('name', ''), 'tiles': resolved})

def parse_name(nf):
    if nf is None:
        return None, None, 0
    name = nf[0]
    parts = name.split('_')
    biome = parts[0]
    suffix = parts[-2] if len(parts) >= 2 else ''
    return biome, suffix, (nf[1] or 0)

layer_grids = {}
for lr in layers_resolved:
    g = [None] * (W * H)
    for i in range(W * H):
        b, _, _ = parse_name(lr['tiles'][i])
        g[i] = b
    layer_grids[lr['name']] = g

all_tiles = set()
for ts in tilesets:
    all_tiles.update(ts['tiles'].values())

# ---- 四象角自动描边算法（仅用于【渲染】选取正确瓦片变体，不再用于碰撞）----
QUAD_TL, QUAD_TR, QUAD_BL, QUAD_BR = 1, 2, 4, 8
NATIVE = {'c': 15, 'l': 5, 'tl': 1, 'tri': 13}

def rotcw(f):
    r = 0
    if f & QUAD_TL: r |= QUAD_TR
    if f & QUAD_TR: r |= QUAD_BR
    if f & QUAD_BR: r |= QUAD_BL
    if f & QUAD_BL: r |= QUAD_TL
    return r

FILL_TO_TILE = {}
for variant, base in NATIVE.items():
    if variant == 'c':
        FILL_TO_TILE[base] = (variant, 0)
        continue
    fill = base
    for rot in range(4):
        FILL_TO_TILE[fill] = (variant, rot)
        fill = rotcw(fill)

ROT_TO_FLAG = {0: 0, 1: 4, 2: 3, 3: 7}

def variant_exists(biome, variant):
    return (biome + '_' + variant + '_0') in all_tiles

def is_autotile(biome):
    return (variant_exists(biome, 'c') and
            (variant_exists(biome, 'l') or variant_exists(biome, 'tl') or variant_exists(biome, 'tri')))

def fill_of(grid, x, y, self):
    def same(dx, dy):
        nx, ny = x + dx, y + dy
        if nx < 0 or ny < 0 or nx >= W or ny >= H:
            return False
        return grid[ny * W + nx] == self
    tl = same(0, 0) and same(0, -1) and same(-1, 0) and same(-1, -1)
    tr = same(0, 0) and same(0, -1) and same(1, 0) and same(1, -1)
    bl = same(0, 0) and same(0, 1) and same(-1, 0) and same(-1, 1)
    br = same(0, 0) and same(0, 1) and same(1, 0) and same(1, 1)
    fill = 0
    if tl: fill |= QUAD_TL
    if tr: fill |= QUAD_TR
    if bl: fill |= QUAD_BL
    if br: fill |= QUAD_BR
    return fill

solidAll = {}
for ts in tilesets:
    solidAll.update(ts.get('solid', {}))

# 每格仅记录“是否被任一实心瓦片占用”（供小地图/整格判定）；
# 真正的精细碰撞由下方烘焙的 masks 决定，不再做象限描边。
solid = [0] * (W * H)

out_layers = []
for lr in layers_resolved:
    g = layer_grids[lr['name']]
    out = []
    for y in range(H):
        for x in range(W):
            i = y * W + x
            biome = g[i]
            if biome is None:
                out.append(-1)
                continue
            if not is_autotile(biome):
                nf = lr['tiles'][i]
                if nf is None:
                    out.append(-1)
                elif (nf[1] or 0) == 0:
                    out.append(nf[0])
                else:
                    out.append('%s#%d' % (nf[0], nf[1]))
                if nf is not None and solidAll.get(nf[0]):
                    solid[i] = 1
                continue
            fill = fill_of(g, x, y, biome)
            variant, rot = FILL_TO_TILE.get(fill, ('c', 0))
            if not variant_exists(biome, variant):
                variant = 'c'
            flag = ROT_TO_FLAG[rot]
            name = '%s_%s_0' % (biome, variant)
            out.append(name if flag == 0 else '%s#%d' % (name, flag))
            if solidAll.get(name):
                solid[i] = 1
    out_layers.append({'name': lr['name'], 'tiles': out})

# 资源清单
used = set()
for ly in out_layers:
    for t in ly['tiles']:
        if t != -1:
            used.add(t.split('#')[0])
assets = [['tile' + n, 'assets/static/tiles/' + n + '.svg'] for n in sorted(used)]

# 烘焙每片瓦片的真实碰撞遮罩（纯 SVG 栅格化，精确跟随形状）
masks = {}
for n in sorted(used):
    p = os.path.join(TSJ_DIR, n + '.svg')
    if os.path.exists(p):
        try:
            with open(p, encoding='utf-8') as f:
                svg = f.read()
            msk = rasterize_svg(svg, RASTER_N)
            if msk:
                masks[n] = [msk[y][x] for y in range(RASTER_N) for x in range(RASTER_N)]
        except Exception:
            pass

out = {
    'name': m.get('name', 'garden'),
    'width': W, 'height': H, 'tile': TILE,
    'size': W * TILE,
    'layers': out_layers,
    'solid': solid,
    'assets': assets,
    'shapes': {},          # 已不再需要运行时 SVG 文本
    'maskN': RASTER_N,
    'masks': masks,        # 基础瓦片名 -> RASTER_N*RASTER_N 占用位图（行优先）
}

OUT = os.path.join(ROOT, 'assets', 'static', 'maps', 'garden.json')
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f)

OUTJS = os.path.join(ROOT, 'assets', 'static', 'maps', 'garden.js')
with open(OUTJS, 'w', encoding='utf-8') as f:
    f.write('window.GARDEN = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')

# 自检：打印 dirt_l_0 遮罩预览（应为左半形状，而非整方块）
if 'dirt_l_0' in masks:
    m = masks['dirt_l_0']
    N = RASTER_N
    print('--- dirt_l_0 遮罩预览 (N=%d) ---' % N)
    for y in range(N):
        print(''.join('#' if m[y*N + x] else '.' for x in range(N)))
    cnt = sum(m)
    print('占用像素: %d / %d (%.1f%%)' % (cnt, N*N, 100.0*cnt/(N*N)))

broken = sum(1 for ly in out_layers for t in ly['tiles']
             if t != -1 and t.split('#')[0] not in {a[0][4:] for a in assets})
print('地图 %dx%d, 层=%d, 基础瓦片=%d, broken=%d, 已烘焙遮罩=%d' %
      (W, H, len(out_layers), len(used), broken, len(masks)))
print('输出:', os.path.relpath(OUT, ROOT), '及', os.path.relpath(OUTJS, ROOT))
