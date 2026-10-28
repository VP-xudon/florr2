import re, pathlib, sys

# 把生物贴图的 viewBox 收紧到【实际内容】包围盒（正方形、居中、留少量边距）。
# 原因：12_h/12_b 的图形缩在 800x500 viewBox 的左上角一小块，
# 而运行时所有生物共用一个"居中固定裁剪框"（按瓢虫标定），
# 裁剪区几乎是空的 -> 贴图空白、碰撞箱也错。改 viewBox 让内容铺满即可。

NUMS = re.compile(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?')
CMD = re.compile(r'([MmZzLlHhVvCcSsQqTtAa])([^MmZzLlHhVvCcSsQqTtAa]*)')


def nums(s):
    return [float(v) for v in NUMS.findall(s)]


def path_points(d):
    """解析 path，返回 (x,y) 列表（含曲线采样点），处理相对命令。"""
    pts = []
    cx = cy = sx = sy = 0.0
    for m in CMD.finditer(d):
        c, a = m.group(1), nums(m.group(2))
        i = 0
        if c in 'Mm':
            while i + 1 < len(a):
                x, y = a[i], a[i+1]; i += 2
                if c == 'm': x += cx; y += cy
                cx, cy, sx, sy = x, y, x, y; pts.append((x, y))
        elif c in 'Ll':
            while i + 1 < len(a):
                x, y = a[i], a[i+1]; i += 2
                if c == 'l': x += cx; y += cy
                cx, cy = x, y; pts.append((x, y))
        elif c in 'Hh':
            while i < len(a):
                x = a[i]; i += 1
                if c == 'h': x += cx
                cx = x; pts.append((x, cy))
        elif c in 'Vv':
            while i < len(a):
                y = a[i]; i += 1
                if c == 'v': y += cy
                cy = y; pts.append((cx, y))
        elif c in 'Cc':
            while i + 5 < len(a):
                p = a[i:i+6]; i += 6
                if c == 'c': p = [p[0]+cx, p[1]+cy, p[2]+cx, p[3]+cy, p[4]+cx, p[5]+cy]
                x0, y0 = cx, cy
                for t in range(1, 9):
                    t = t / 8.0; mt = 1 - t
                    pts.append((mt**3*x0 + 3*mt*mt*t*p[0] + 3*mt*t*t*p[2] + t**3*p[4],
                                mt**3*y0 + 3*mt*mt*t*p[1] + 3*mt*t*t*p[3] + t**3*p[5]))
                cx, cy = p[4], p[5]
        elif c in 'SsQq':
            while i + 3 < len(a):
                p = a[i:i+4]; i += 4
                if c in 'sq': p = [p[0]+cx, p[1]+cy, p[2]+cx, p[3]+cy]
                x0, y0 = cx, cy
                for t in range(1, 9):
                    t = t / 8.0; mt = 1 - t
                    pts.append((mt*mt*x0 + 2*mt*t*p[0] + t*t*p[2],
                                mt*mt*y0 + 2*mt*t*p[1] + t*t*p[3]))
                cx, cy = p[2], p[3]
        elif c in 'Tt':
            while i + 1 < len(a):
                x, y = a[i], a[i+1]; i += 2
                if c == 't': x += cx; y += cy
                pts.append((x, y)); cx, cy = x, y
        elif c in 'Aa':
            while i + 6 < len(a):
                i += 7; pts.append((cx, cy))
        elif c in 'Zz':
            cx, cy = sx, sy
    return pts


def compose_transforms(svg):
    """收集所有 <g transform>，合成 (scale, tx, ty)：p' = (p + t) * s 形式统一为 p' = s*p + T。"""
    s, tx, ty = 1.0, 0.0, 0.0
    for tf in re.findall(r'<g[^>]*transform="([^"]*)"', svg):
        for op, arg in re.findall(r'(translate|scale)\(([^)]*)\)', tf):
            v = nums(arg)
            if op == 'translate':
                dx = v[0] if len(v) > 0 else 0.0
                dy = v[1] if len(v) > 1 else 0.0
                # 在已有缩放之后应用平移
                tx += dx * s; ty += dy * s
            else:
                k = v[0] if len(v) > 0 else 1.0
                s *= k
    return s, tx, ty


def fit(path, pad=0.04):
    svg = pathlib.Path(path).read_text(encoding='utf-8')
    s, tx, ty = compose_transforms(svg)
    pts = []
    for d in re.findall(r'(?:<path[^>]*?\sd="([^"]*)")', svg):
        pts += path_points(d)
    if not pts:
        print('no points:', path); return
    # 应用变换
    tp = [(x * s + tx, y * s + ty) for x, y in pts]
    xs = [p[0] for p in tp]; ys = [p[1] for p in tp]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    w, h = x1 - x0, y1 - y0
    side = max(w, h)
    # 正方形、居中、带边距
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    side *= (1 + pad * 2)
    nx, ny = cx - side / 2, cy - side / 2
    old = re.search(r'viewBox="([^"]*)"', svg).group(1)
    new = '%.4f %.4f %.4f %.4f' % (nx, ny, side, side)
    pathlib.Path(path).write_text(svg.replace('viewBox="%s"' % old, 'viewBox="%s"' % new), encoding='utf-8')
    print('%s\n   old viewBox: %s\n   content(w=%.2f h=%.2f) -> new: %s' % (path, old, w, h, new))


if __name__ == '__main__':
    for f in sys.argv[1:]:
        fit(f)
