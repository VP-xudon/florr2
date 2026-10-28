# -*- coding: utf-8 -*-
"""核对蜈蚣每一节的几何：MOB_SHAPES 轮廓算出来的半径，是否等于 SVG 里绿色身体的真实半径。

_solveChains 的节间距 = (radOf(head) + radOf(body)) * GLUE，
radOf = shape.r * drawSize，而 shape.r 来自 MOB_SHAPES 的轮廓点。
只要两张贴图的轮廓半径不一致，头与第一节之间的缝就会和其它节不一样 —— 表现为"头部脱离"。
"""
import re
import io
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from fit_mob_viewbox import path_points, compose_transforms

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load_shapes():
    s = io.open(ROOT / 'assets/mob-shapes.js', encoding='utf-8').read()
    shapes, pivots = {}, {}
    for m in re.finditer(r"'([^']+)':\s*\{[^}]*?pts:\s*\[(.*?)\]\s*\}", s, re.S):
        key, body = m.group(1), m.group(2)
        pts = [(float(a), float(b)) for a, b in re.findall(r'\[([-\d.]+),([-\d.]+)\]', body)]
        shapes[key] = pts
    for m in re.finditer(r"'([^']+)':\s*\[([-\d.]+),\s*([-\d.]+)\]", s):
        pivots[m.group(1)] = (float(m.group(2)), float(m.group(3)))
    return shapes, pivots


def svg_color_box(path, color):
    """SVG 里某个填充色的全部路径的包围盒（viewBox 归一化）与等效半径。"""
    s = io.open(path, encoding='utf-8').read()
    vb = [float(v) for v in re.findall(r'viewBox="([^"]*)"', s)[0].replace(',', ' ').split()]
    sc, tx, ty = compose_transforms(s)
    xs, ys = [], []
    for m in re.finditer(r'<path\b([^>]*)>', s):
        at = m.group(1)
        fill = (re.findall(r'fill="([^"]*)"', at) or [''])[0]
        if fill.lower() != color:
            continue
        d = re.findall(r'\sd="([^"]*)"', at)
        if not d:
            continue
        for x, y in path_points(d[0]):
            xs.append(x * sc + tx)
            ys.append(y * sc + ty)
    if not xs:
        return None
    cx = (min(xs) + max(xs)) / 2
    cy = (min(ys) + max(ys)) / 2
    r = ((max(xs) - min(xs)) / 2 + (max(ys) - min(ys)) / 2) / 2
    return {
        'cx': (cx - vb[0]) / vb[2], 'cy': (cy - vb[1]) / vb[3],
        'r': r / vb[2],
    }


def report(key, svg, color):
    shapes, pivots = load_shapes()
    pts = shapes.get(key)
    if not pts:
        print('%s: NO SHAPE' % key)
        return
    pv = pivots.get(key, (0.5, 0.5))
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    cx = (min(xs) + max(xs)) / 2
    cy = (min(ys) + max(ys)) / 2
    # 以 MOB_PIVOT 为原点时的最大半径（= vectorContour 里算的 shape.r 的分子）
    rm = max(((p[0] - pv[0]) ** 2 + (p[1] - pv[1]) ** 2) ** 0.5 for p in pts)
    truth = svg_color_box(ROOT / svg, color)
    print('== %s' % key)
    print('   轮廓点 bbox中心 = (%.4f, %.4f)  范围 w=%.4f h=%.4f'
          % (cx, cy, max(xs) - min(xs), max(ys) - min(ys)))
    print('   MOB_PIVOT      = (%.4f, %.4f)' % pv)
    print('   轮廓半径(以pivot为原点) = %.4f' % rm)
    if truth:
        print('   SVG主色真实圆心 = (%.4f, %.4f)  半径 = %.4f  [%s]'
              % (truth['cx'], truth['cy'], truth['r'], color))
        print('   >> 圆心误差 = %.4f / %.4f ；半径误差 = %.4f (%.1f%%)'
              % (cx - truth['cx'], cy - truth['cy'],
                 rm - truth['r'], (rm / truth['r'] - 1) * 100 if truth['r'] else 0))
    print('')


report('12_h', 'assets/mobs/12_h.svg', '#709d45')
report('12_b', 'assets/mobs/12_b.svg', '#709d45')
