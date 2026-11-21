"""从 SVG 矢量几何重新生成【硬编码碰撞箱】assets/crbs/mobs/*.crb。

为什么需要单独一支工具（而不是复用 gen_mob_shapes_vector.py）：
  · 那个脚本按"包围盒最大的单条 path"选主体，会漏掉身体之外的黑色部件
    （瓢虫的黑色头部 → 碰撞箱在头部凹进一块），也会漏掉身体的描边；
  · 它输出的是 MOB_SHAPES（整图 viewBox 坐标），而 .crb 用的是
    【裁剪框坐标系】（×drawSize = 世界像素），两者归一化口径不同。

本脚本的规则（显式声明，不做启发式猜测）：
  · BODY_PARTS[id] = 参与碰撞的填充路径颜色（可按需增减）；
  · 若某条 fill="none" 的描边路径与某条身体填充路径的 d 完全相同，
    它就是【身体自己的描边】——按 stroke-width/2 向外扩一圈（画面最外沿就是它）；
  · 触角 / 腿 / 尾针（fill="none" 的细线、不与身体同 d）不参与。

输出格式与 js/sim/crb.js 一致：
  { "id", "kind", "source", "pts": [[x,y],...], "r": 外接半径 }
  pts 归一化到 [-0.5, 0.5]（× collSize/drawSize = 世界像素）。

用法：
    python tools/gen_mob_crb.py            # 生成下面 TARGETS 里的全部
    python tools/gen_mob_crb.py 3 4 27     # 只生成指定 id
"""
import io
import json
import math
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from fit_mob_viewbox import path_points, compose_transforms

MAX_PTS = 96                 # 与 MOB_SHAPES 同一档：够精确，逐帧多边形判定也不慢

# 每个物种参与碰撞的【填充路径颜色】。描边（与身体同 d 的 fill=none）自动并入。
BODY_PARTS = {
    # 瓢虫：红壳 #eb4034 + 黑色头部 #0e0e0e + 头部内圈 #111。
    # 旧版只取了红壳，黑色头部露在壳外的那一块被漏掉 -> 头部凹陷。
    '3': ['#eb4034', '#0e0e0e', '#111'],
    # 蜜蜂 / 大黄蜂：黄色身体 + 与身体同 d 的描边（stroke-width 4.167）。
    # 触角（细线 + 端点小球）与尾针（右下角三角形）不参与。
    '4': ['#ffe763'],
    '27': ['#ffd363'],
    # 蚁后：3 个体节（深色填充 #454545 + 内圈 #555）。
    # 翅膀（#eee）与小牙（fill=none 的粗描边）不参与碰撞。
    '8': ['#454545', '#555'],
}
TARGETS = list(BODY_PARTS.keys())


def svg_points(svg_text):
    """返回 [(fill, stroke, stroke_width, d, pts)]，坐标已换算到 viewBox 坐标系。"""
    sc, tx, ty = compose_transforms(svg_text)
    out = []
    for m in re.finditer(r'<path\b[^>]*?/>', svg_text):
        el = m.group(0)
        d = (re.findall(r'\sd="([^"]*)"', el) or [''])[0]
        if not d.strip():
            continue
        fill = (re.findall(r'fill="([^"]*)"', el) or [''])[0]
        stroke = (re.findall(r'stroke="([^"]*)"', el) or [''])[0]
        sw = float((re.findall(r'stroke-width="([^"]*)"', el) or ['0'])[0] or 0)
        pts = [(x * sc + tx, y * sc + ty) for x, y in path_points(d)]
        if len(pts) < 3:
            continue
        out.append((fill, stroke, sw, d.strip(), pts))
    return out


def viewbox_of(svg_text):
    vb = [float(v) for v in re.findall(r'viewBox="([^"]*)"', svg_text)[0].replace(',', ' ').split()]
    return vb


def content_bbox(paths, vb):
    """全部可见路径（含描边半径）的包围盒：用于复现运行时的固定裁剪框比例。"""
    xs0 = ys0 = 1e18
    xs1 = ys1 = -1e18
    for (fill, stroke, sw, d, pts) in paths:
        pad = (sw / 2.0) if (stroke and fill == 'none') else 0.0
        for (x, y) in pts:
            xs0 = min(xs0, x - pad); xs1 = max(xs1, x + pad)
            ys0 = min(ys0, y - pad); ys1 = max(ys1, y + pad)
    return xs0, ys0, xs1, ys1


def convex_hull(pts):
    pts = sorted(set((round(x, 6), round(y, 6)) for x, y in pts))
    if len(pts) <= 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def signed_area(poly):
    a = 0.0
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        a += x1 * y2 - x2 * y1
    return a / 2.0


def offset_polygon(poly, dist):
    """凸多边形向外平移 dist（斜接，夹角过锐时截断到 2×）。"""
    if dist <= 0:
        return poly
    sgn = 1.0 if signed_area(poly) > 0 else -1.0
    n = len(poly)
    out = []
    for i in range(n):
        p0, p1, p2 = poly[i - 1], poly[i], poly[(i + 1) % n]
        e1x, e1y = p1[0] - p0[0], p1[1] - p0[1]
        e2x, e2y = p2[0] - p1[0], p2[1] - p1[1]
        l1 = math.hypot(e1x, e1y) or 1.0
        l2 = math.hypot(e2x, e2y) or 1.0
        e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2
        n1x, n1y = sgn * e1y, -sgn * e1x
        n2x, n2y = sgn * e2y, -sgn * e2x
        nx, ny = n1x + n2x, n1y + n2y
        ln = math.hypot(nx, ny)
        if ln < 1e-9:
            nx, ny, miter = n1x, n1y, 1.0
        else:
            nx /= ln; ny /= ln
            miter = 1.0 / max(0.5, nx * n1x + ny * n1y)
            miter = min(miter, 2.0)
        out.append((p1[0] + nx * dist * miter, p1[1] + ny * dist * miter))
    return out


def resample(poly, n):
    if len(poly) <= 2:
        return poly
    segs = []
    total = 0.0
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        segs.append((a, b, d))
        total += d
    if total <= 0:
        return poly
    step = total / n
    out, idx, acc = [], 0, 0.0
    for k in range(n):
        target = k * step
        while idx < len(segs) and acc + segs[idx][2] < target:
            acc += segs[idx][2]
            idx += 1
        a, b, d = segs[min(idx, len(segs) - 1)]
        t = (target - acc) / d if d > 1e-9 else 0.0
        out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def crop_ratio():
    """运行时的固定裁剪框比例：以瓢虫的实际图案包围盒标定（见 js/assets.js）。"""
    txt = io.open(ROOT / 'assets' / 'mobs' / '3.svg', encoding='utf-8').read()
    vb = viewbox_of(txt)
    x0, y0, x1, y1 = content_bbox(svg_points(txt), vb)
    return max((x1 - x0) / vb[2], (y1 - y0) / vb[3])


def mob_pivot(mob_id, ratio):
    """运行时的旋转轴心位移 pv（见 js/assets.js 的 mobPivot / drawMob）：
    贴图整体按 -pv*size 平移，所以碰撞轮廓必须做同样的平移，否则"画一套、判一套"。
    MOB_PIVOT 里没登记的贴图（如 27）pv = 0。"""
    txt = io.open(ROOT / 'assets' / 'mob-shapes.js', encoding='utf-8').read()
    blk = txt.split('MOB_PIVOT', 1)
    if len(blk) < 2:
        return 0.0, 0.0
    m = re.search(r"'%s'\s*:\s*\[\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\]" % re.escape(mob_id),
                  blk[1])
    if not m:
        return 0.0, 0.0
    return (float(m.group(1)) - 0.5) / ratio, (float(m.group(2)) - 0.5) / ratio


# 运行时【叠加图层】：不在这张 SVG 里，而是由 Mob.draw 按固定矩形盖在本体上。
# 碰撞箱必须把它们算进去，否则"看得见的边缘"比"判定的边缘"大一圈。
RING_LAYERS = {
    # 瓢虫：红描边圈是独立素材 assets/entities/3_ring.svg，
    # 由 Mob.draw 用 sim/mob-shape.js 的 LADYBUG_RING_RECT 拉伸后叠在本体上。
    '3': {
        'svg': 'assets/entities/3_ring.svg',
        'rect': [-0.0582, -0.0590, 1.1172, 1.1181],   # = LADYBUG_RING_RECT（相对 drawSize，0.5 为中心）
    },
}


def ring_norm_points(mob_id, pvx, pvy):
    """叠加图层的点（已归一化到 drawSize 坐标系，原点 = 精灵中心）。"""
    cfg = RING_LAYERS.get(mob_id)
    if not cfg:
        return []
    txt = io.open(ROOT / cfg['svg'], encoding='utf-8').read()
    vb = viewbox_of(txt)
    pts = [p for (_, _, _, _, ps) in svg_points(txt) for p in ps]
    rx, ry, rw, rh = cfg['rect']
    out = []
    for (x, y) in pts:
        # drawImage 把【整张环素材】拉伸到 rect 指定的矩形；rect 的坐标以精灵中心为 0
        nx = rx + (x - vb[0]) / vb[2] * rw - 0.5 - pvx
        ny = ry + (y - vb[1]) / vb[3] * rh - 0.5 - pvy
        out.append((nx, ny))
    return out


def build(mob_id, ratio):
    txt = io.open(ROOT / 'assets' / 'mobs' / (mob_id + '.svg'), encoding='utf-8').read()
    vb = viewbox_of(txt)
    paths = svg_points(txt)
    wanted = set(BODY_PARTS[mob_id])

    # 身体填充路径的 d：用来识别"身体自己的描边"（同一条 d 的 fill=none 描边）
    body_ds = set(d for (fill, stroke, sw, d, pts) in paths if fill in wanted)
    body_pts = []
    for (fill, stroke, sw, d, pts) in paths:
        if fill in wanted:
            body_pts.extend(pts)
    if not body_pts:
        raise SystemExit('no body path for ' + mob_id)

    hull = convex_hull(body_pts)
    # 描边外扩：取与实际描边路径同 d 的最大 stroke-width/2
    pad = 0.0
    for (fill, stroke, sw, d, pts) in paths:
        if fill == 'none' and stroke and d in body_ds:
            pad = max(pad, sw / 2.0)
    if pad > 0:
        hull = offset_polygon(hull, pad)
    pts = resample(hull, MAX_PTS)

    cx = vb[0] + vb[2] / 2.0
    cy = vb[1] + vb[3] / 2.0
    win_w = ratio * vb[2]
    win_h = ratio * vb[3]
    pvx, pvy = mob_pivot(mob_id, ratio)
    norm = [((x - cx) / win_w - pvx, (y - cy) / win_h - pvy) for (x, y) in pts]
    # 叠加图层（瓢虫红描边圈）：与本体的凸包求并，再统一抽稀
    extra = ring_norm_points(mob_id, pvx, pvy)
    if extra:
        norm = resample(convex_hull(norm + extra), MAX_PTS)
    r = max(math.hypot(x, y) for (x, y) in norm)
    data = {
        'id': mob_id,
        'kind': 'vector body parts %s + own stroke %.3f%s'
                % (sorted(wanted), pad, (' + ring layer' if extra else '')),
        'source': 'assets/mobs/%s.svg' % mob_id,
        'pts': [[round(x, 5), round(y, 5)] for (x, y) in norm],
        'r': round(r, 5),
    }
    # 自检：几何半径 / 归一化半径（画面上应该正好贴住可见边缘）
    print('%s: %d pts, stroke pad=%.3f, r=%.5f (%.2f%% of drawSize), bbox=%.4f x %.4f'
          % (mob_id, len(norm), pad, r, r * 100,
             (max(p[0] for p in norm) - min(p[0] for p in norm)),
             (max(p[1] for p in norm) - min(p[1] for p in norm))))
    return data


def main(argv):
    ids = argv[1:] or TARGETS
    ratio = crop_ratio()
    print('crop ratio (calibrated from 3.svg) = %.5f' % ratio)
    out_dir = ROOT / 'assets' / 'crbs' / 'mobs'
    out_dir.mkdir(parents=True, exist_ok=True)
    for mob_id in ids:
        data = build(mob_id, ratio)
        p = out_dir / (mob_id + '.crb')
        io.open(p, 'w', encoding='utf-8', newline='').write(
            json.dumps(data, ensure_ascii=False, separators=(',', ':')))
        print('  ->', p.relative_to(ROOT).as_posix())


if __name__ == '__main__':
    main(sys.argv)
