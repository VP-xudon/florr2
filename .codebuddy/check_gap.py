import re, math

svg = open(r'e:\SynthOOPDeveloping\florr2\.codebuddy\source.svg', encoding='utf-8').read()
paths = re.findall(r'<path fill="(#[0-9a-fA-F]{6})" d="([^"]+)"', svg)

def parse(d):
    tokens = re.findall(r'[A-Za-z]|-?(?:\d+\.\d+|\.\d+|\d+)', d)
    sizes = {'M': 2, 'm': 2, 'q': 4, 't': 2}
    cmds, cmd, nums = [], None, []
    for tk in tokens:
        if re.match(r'[A-Za-z]', tk):
            cmd, nums = tk, []
            continue
        nums.append(float(tk))
        if cmd in sizes and len(nums) == sizes[cmd]:
            cmds.append((cmd, list(nums)))
            nums = []
    return cmds

def endpoints(d):
    cmds = parse(d)
    x, y = cmds[0][1]
    pts = [(x, y)]
    prev_ctrl = None
    for kind, p in cmds[1:]:
        x0, y0 = x, y
        if kind == 'q':
            x1, y1 = x0 + p[0], y0 + p[1]
            x, y = x0 + p[2], y0 + p[3]
        else:
            x2, y2 = p[0], p[1]
            x1, y1 = (2*x0 - prev_ctrl[0], 2*y0 - prev_ctrl[1]) if prev_ctrl else (x0, y0)
            x, y = x0 + x2, y0 + y2
        prev_ctrl = (x1, y1)
        pts.append((x, y))
    return pts

def quad_extrema(d):
    cmds = parse(d)
    x, y = cmds[0][1]
    xs, ys = [x], [y]
    prev_ctrl = None
    for kind, p in cmds[1:]:
        x0, y0 = x, y
        if kind == 'q':
            x1, y1 = x0 + p[0], y0 + p[1]
            x, y = x0 + p[2], y0 + p[3]
        else:
            x2, y2 = p[0], p[1]
            x1, y1 = (2*x0 - prev_ctrl[0], 2*y0 - prev_ctrl[1]) if prev_ctrl else (x0, y0)
            x, y = x0 + x2, y0 + y2
        prev_ctrl = (x1, y1)
        for a, b, c in ((x0, x1, x), (y0, y1, y)):
            den = a - 2*b + c
            if den:
                t = (a - b) / den
                if 0 < t < 1:
                    v = (1-t)**2*a + 2*t*(1-t)*b + t**2*c
                    (xs if (a, b, c) == (x0, x1, x) else ys).append(v)
        xs.append(x); ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)

for i, (fill, d) in enumerate(paths, 1):
    pts = endpoints(d)
    x0, y0, x1, y1 = quad_extrema(d)
    cx, cy, R = (x0+x1)/2, (y0+y1)/2, (x1-x0)/2
    sx, sy = pts[0]
    ex, ey = pts[-1]
    gap = math.hypot(ex-sx, ey-sy)
    # 起止角（SVG 坐标，y 向下）
    ang_s = math.degrees(math.atan2(sy-cy, sx-cx))
    ang_e = math.degrees(math.atan2(ey-cy, ex-cx))
    sweep = (ang_e - ang_s) % 360
    # 半径一致性
    rr = [math.hypot(px-cx, py-cy) for px, py in pts]
    print(f'#{i} {fill}')
    print(f'   圆心({cx:.4f},{cy:.4f}) R={R:.4f}  半径范围[{min(rr):.4f},{max(rr):.4f}]')
    print(f'   起点({sx:.4f},{sy:.4f}) 角度{ang_s:7.2f}°  ->  终点({ex:.4f},{ey:.4f}) 角度{ang_e:7.2f}°')
    print(f'   扫过 {sweep:7.2f}°   首尾距离={gap:.4f}   {"缺一块!" if gap > 0.01 else "闭合"}')
