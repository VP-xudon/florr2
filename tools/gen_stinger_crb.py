# gen_stinger_crb.py — Hornet 尾针碰撞箱（assets/crbs/mobs/11_missile.crb）
#
# 尾针画的是【花瓣 9（Missile）的素材】，所以碰撞箱也必须从这张 SVG 提取：
#   1) 取三角形路径（填充路径与描边路径同 d）；
#   2) 按 stroke-width/2 向外【圆角外扩】—— 素材用的是 stroke-linejoin="round"，
#      描边才是画面最外沿。旧版只取了路径中心线，所以碰撞箱比肉眼看到的小一圈；
#      这里用"顶点圆 + 边外扩条"采样后取凸包 = 凸多边形的精确闵可夫斯基膨胀，
#      不会像斜接那样在尖角处戳出去一大截。
#   3) 归一化到【实体素材窗口】，与 cards.js 的 artSvg() 完全同一口径：
#      center = 内容包围盒中心（含 stroke 外扩），side = max(PETAL_ENT_REF, w, h)。
#
# 用法：python tools/gen_stinger_crb.py
import io
import json
import math
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from fit_mob_viewbox import path_points          # noqa: E402
from gen_mob_crb import convex_hull, resample, signed_area   # noqa: E402

SRC = ROOT / 'assets' / 'petals' / '9.svg'
OUT = ROOT / 'assets' / 'crbs' / 'mobs' / '11_missile.crb'
REF = 32.858            # cards.js 的 PETAL_ENT_REF（Basic 内容包围盒）
ARC_SEG = 24            # 每个顶点的圆采样段数（只求凸包，24 段足够贴圆）
OUT_PTS = 24            # 输出多边形点数


def dilate_hull(poly, d, arc_seg=ARC_SEG):
    """凸多边形向外膨胀 d（圆角）：顶点圆 + 边外扩条，取凸包。"""
    if d <= 0:
        return poly
    sgn = 1.0 if signed_area(poly) > 0 else -1.0
    n = len(poly)
    pts = list(poly)
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        ex, ey = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(ex, ey) or 1.0
        nx, ny = sgn * ey / ln, -sgn * ex / ln      # 外法线
        pts.append((a[0] + nx * d, a[1] + ny * d))
        pts.append((b[0] + nx * d, b[1] + ny * d))
    for (vx, vy) in poly:
        for k in range(arc_seg):
            t = 2 * math.pi * k / arc_seg
            pts.append((vx + math.cos(t) * d, vy + math.sin(t) * d))
    return convex_hull(pts)


def main():
    txt = io.open(SRC, encoding='utf-8').read()
    best, sw = None, 0.0
    for m in re.finditer(r'<path\b[^>]*?/>', txt):
        el = m.group(0)
        d = (re.findall(r'\sd="([^"]*)"', el) or [''])[0]
        if not d:
            continue
        pts = list(path_points(d))
        if not pts:
            continue
        swm = re.findall(r'stroke-width="([^"]*)"', el)
        if swm:
            sw = max(sw, float(swm[0] or 0))
        if best is None or len(pts) > len(best):
            best = pts
    if not best:
        raise SystemExit('no triangle path in ' + str(SRC))

    pad = sw / 2.0
    hull = dilate_hull(convex_hull(best), pad)

    # 内容包围盒（含描边外扩）-> 正方形实体窗口（与 artSvg 一致）
    xs = [p[0] for p in best]
    ys = [p[1] for p in best]
    x0, y0 = min(xs) - pad, min(ys) - pad
    w, h = (max(xs) - min(xs)) + pad * 2, (max(ys) - min(ys)) + pad * 2
    side = max(REF, REF, w, h)
    cx, cy = x0 + w / 2.0, y0 + h / 2.0

    norm = [((x - cx) / side, (y - cy) / side) for (x, y) in hull]
    norm = resample(norm, OUT_PTS)
    r = max(math.hypot(x, y) for (x, y) in norm)
    data = {
        'id': '11_missile',
        'kind': 'Hornet stinger (petal 9 triangle + round stroke %.3f)' % sw,
        'source': 'assets/petals/9.svg',
        'pts': [[round(x, 6), round(y, 6)] for (x, y) in norm],
        'r': round(r, 6),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    io.open(OUT, 'w', encoding='utf-8').write(
        json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    print('%s: %d pts, window side %.4f, stroke %.3f, r=%.5f'
          % (OUT.relative_to(ROOT).as_posix(), len(norm), side, sw, r))


if __name__ == '__main__':
    main()
