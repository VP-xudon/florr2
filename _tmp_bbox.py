import io, re, sys

NUM = re.compile(r'-?\d*\.?\d+(?:e-?\d+)?')

def path_points(d):
    """粗解析 path d，返回所有端点/控制点坐标（含相对命令累积）"""
    pts = []
    cx = cy = 0.0
    sx = sy = 0.0
    i = 0
    cmd = None
    tokens = re.findall(r'[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e-?\d+)?', d)
    while i < len(tokens):
        t = tokens[i]
        if re.match(r'[A-Za-z]', t):
            cmd = t
            i += 1
            if cmd in 'Zz':
                cx, cy = sx, sy
                continue
        if cmd is None:
            break
        rel = cmd.islower()
        c = cmd.upper()
        try:
            if c == 'M' or c == 'L' or c == 'T':
                x = float(tokens[i]); y = float(tokens[i + 1]); i += 2
                if rel: x += cx; y += cy
                cx, cy = x, y
                if c == 'M': sx, sy = x, y
                pts.append((x, y))
            elif c == 'H':
                x = float(tokens[i]); i += 1
                if rel: x += cx
                cx = x; pts.append((cx, cy))
            elif c == 'V':
                y = float(tokens[i]); i += 1
                if rel: y += cy
                cy = y; pts.append((cx, cy))
            elif c == 'C':
                v = [float(tokens[i + k]) for k in range(6)]; i += 6
                if rel: v = [v[0] + cx, v[1] + cy, v[2] + cx, v[3] + cy, v[4] + cx, v[5] + cy]
                pts += [(v[0], v[1]), (v[2], v[3]), (v[4], v[5])]
                cx, cy = v[4], v[5]
            elif c == 'S' or c == 'Q':
                v = [float(tokens[i + k]) for k in range(4)]; i += 4
                if rel: v = [v[0] + cx, v[1] + cy, v[2] + cx, v[3] + cy]
                pts += [(v[0], v[1]), (v[2], v[3])]
                cx, cy = v[2], v[3]
            elif c == 'A':
                v = [float(tokens[i + k]) for k in range(7)]; i += 7
                x, y = v[5], v[6]
                if rel: x += cx; y += cy
                # 粗略：把弧的两端与半径盒都算进来
                pts += [(x, y), (cx - v[0], cy - v[1]), (cx + v[0], cy + v[1])]
                cx, cy = x, y
            else:
                i += 1
        except IndexError:
            break
    return pts


def svg_bbox(path):
    s = io.open(path, encoding='utf-8').read()
    vb = re.search(r'viewBox="([-\d.\s]+)"', s).group(1).split()
    vx, vy, vw, vh = [float(t) for t in vb]
    body = re.sub(r'<clipPath.*?</clipPath>', '', s, flags=re.S)
    pts = []
    for m in re.finditer(r'<path[^>]*\sd="([^"]+)"', body):
        pts += path_points(m.group(1))
    for m in re.finditer(r'<circle[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"[^>]*r="([\d.]+)"', body):
        x, y, r = [float(g) for g in m.groups()]
        pts += [(x - r, y - r), (x + r, y + r)]
    for m in re.finditer(r'<rect[^>]*x="([\d.]+)"[^>]*y="([\d.]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"', body):
        x, y, w, h = [float(g) for g in m.groups()]
        pts += [(x, y), (x + w, y + h)]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys)
    # 换算成画布比例（画布 = viewBox 方形）
    fx = (bx1 - bx0) / vw
    fy = (by1 - by0) / vh
    ccx = ((bx0 + bx1) / 2 - vx) / vw
    ccy = ((by0 + by1) / 2 - vy) / vh
    return dict(viewBox=(vx, vy, vw, vh), bbox=(bx0, by0, bx1, by1),
                frac=(fx, fy), center=(ccx, ccy))


for mid in (3, 4):
    r = svg_bbox('assets/mobs/%d.svg' % mid)
    print(mid, 'viewBox=%s' % (r['viewBox'],))
    print('   bbox=%s' % (tuple(round(v, 2) for v in r['bbox']),))
    print('   frac=%.3f x %.3f   center=(%.3f, %.3f)' % (r['frac'][0], r['frac'][1], r['center'][0], r['center'][1]))
