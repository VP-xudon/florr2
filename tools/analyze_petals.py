"""离线测量花瓣素材的包围盒结构（诊断用，不改任何文件）。

输出每个 <path> 在根坐标系下的包围盒 + 填充色，便于：
  · 找出四球素材里每颗球的部件归属（本体 + 高光）
  · 量出 rose/basic 的内容包围盒，作为缩放基准
"""
import io
import re
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from fit_mob_viewbox import path_points, compose_transforms


def read_any(p):
    raw = io.open(p, 'rb').read()
    for enc in ('utf-8-sig', 'utf-16', 'utf-8', 'latin-1'):
        try:
            return raw.decode(enc).lstrip('\ufeff')
        except Exception:
            continue
    raise SystemExit('cannot decode ' + p)


def analyze(path):
    s = read_any(path)
    vb = re.findall(r'viewBox="([^"]*)"', s)
    sc, tx, ty = compose_transforms(s)
    rows = []
    for m in re.finditer(r'<path\b[^>]*?/>', s):
        el = m.group(0)
        d = re.findall(r'\sd="([^"]*)"', el)
        fill = (re.findall(r'fill="([^"]*)"', el) or [''])[0]
        if not d:
            continue
        pts = [(x * sc + tx, y * sc + ty) for x, y in path_points(d[0])]
        if len(pts) < 3:
            continue
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        rows.append({
            'fill': fill,
            'x0': min(xs), 'y0': min(ys),
            'w': max(xs) - min(xs), 'h': max(ys) - min(ys),
            'cx': (min(xs) + max(xs)) / 2, 'cy': (min(ys) + max(ys)) / 2,
        })
    print('==', path, 'viewBox', vb)
    if rows:
        ux0 = min(r['x0'] for r in rows); uy0 = min(r['y0'] for r in rows)
        ux1 = max(r['x0'] + r['w'] for r in rows); uy1 = max(r['y0'] + r['h'] for r in rows)
        print('   union  x=%.3f y=%.3f w=%.3f h=%.3f' % (ux0, uy0, ux1 - ux0, uy1 - uy0))
    for i, r in enumerate(rows):
        print('   [%d] %-9s c=(%.3f,%.3f) w=%.3f h=%.3f' %
              (i, r['fill'], r['cx'], r['cy'], r['w'], r['h']))
    return rows


if __name__ == '__main__':
    for p in sys.argv[1:]:
        analyze(p)
