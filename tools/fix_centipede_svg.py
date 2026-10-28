import re, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from fit_mob_viewbox import path_points, compose_transforms, nums

# 修蜈蚣头/身贴图两处"编辑器残留"导致渲染空白的问题：
#   1) 根 <svg> 上带 CSS transform（translate + scale 0.3）——把图形推出可视区
#   2) viewBox 是 800x500 的大画布，图形只占左上角一小块
# 处理：剥掉根 svg 的 style（含 transform），再把 viewBox 收紧到内容包围盒。

def fix(path):
    p = pathlib.Path(path)
    svg = p.read_text(encoding='utf-8')
    orig = svg

    # 1) 剥掉根 <svg ...> 上的 style 属性（里面有 transform / transform-origin / cursor）
    def strip_style(m):
        tag = m.group(0)
        tag = re.sub(r'\s+style="[^"]*"', '', tag)
        return tag
    svg = re.sub(r'<svg\b[^>]*>', strip_style, svg, count=1)

    # 2) 重算内容包围盒（只看 <g transform>，CSS transform 已剥掉）
    s, tx, ty = compose_transforms(svg)
    pts = []
    for d in re.findall(r'(?:<path[^>]*?\sd="([^"]*)")', svg):
        pts += path_points(d)
    if not pts:
        print('no points:', path)
        return
    tp = [(x * s + tx, y * s + ty) for x, y in pts]
    xs = [q[0] for q in tp]; ys = [q[1] for q in tp]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    w, h = x1 - x0, y1 - y0
    side = max(w, h) * 1.08
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    new = '%.4f %.4f %.4f %.4f' % (cx - side / 2, cy - side / 2, side, side)
    old = re.search(r'viewBox="([^"]*)"', svg).group(1)
    svg = svg.replace('viewBox="%s"' % old, 'viewBox="%s"' % new)

    if svg != orig:
        p.write_text(svg, encoding='utf-8')
    print('%s\n   style-stripped: %s\n   viewBox %s -> %s  (content %.2f x %.2f)' % (
        path, '<svg style' not in svg, old, new, w, h))


for f in sys.argv[1:]:
    fix(f)
