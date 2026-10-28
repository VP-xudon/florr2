import re, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from fit_mob_viewbox import path_points, compose_transforms

# 蜈蚣头/身贴图必须【同一比例】渲染，不能各自"自适应缩放"到满框：
# 之前两张 viewBox 各自紧贴自己的内容 -> 各自被拉满 -> 头的绿圆和身体的绿圆大小对不上。
# 做法：两张用【相同的 viewBox 边长】（= 两者内容里较大的那个），各自居中于自己的内容中心。
# 于是单位长度->像素的缩放系数相同，相对大小被完整保留（触角超出也不影响圆的比例）。

def content_box(path):
    s = pathlib.Path(path).read_text(encoding='utf-8')
    sc, tx, ty = compose_transforms(s)
    pts = []
    for d in re.findall(r'(?:<path[^>]*?\sd="([^"]*)")', s):
        pts += path_points(d)
    tp = [(x * sc + tx, y * sc + ty) for x, y in pts]
    xs = [p[0] for p in tp]; ys = [p[1] for p in tp]
    return min(xs), max(xs), min(ys), max(ys)

files = sys.argv[1:]
boxes = {f: content_box(f) for f in files}
# 统一边长 = 所有内容里最大的边长（留 8% 边距）
side = max(max(x1 - x0, y1 - y0) for x0, x1, y0, y1 in boxes.values()) * 1.08
print('common side = %.4f' % side)

for f in files:
    x0, x1, y0, y1 = boxes[f]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    new = '%.4f %.4f %.4f %.4f' % (cx - side / 2, cy - side / 2, side, side)
    p = pathlib.Path(f)
    svg = p.read_text(encoding='utf-8')
    old = re.search(r'viewBox="([^"]*)"', svg).group(1)
    p.write_text(svg.replace('viewBox="%s"' % old, 'viewBox="%s"' % new), encoding='utf-8')
    print('  %s\n     content %.2fx%.2f -> viewBox %s' % (f, x1 - x0, y1 - y0, new))
