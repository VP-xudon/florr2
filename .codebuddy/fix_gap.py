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

def fmt(v):
    s = f'{v:.3f}'
    s = s.rstrip('0').rstrip('.') if '.' in s else s
    if s.startswith('0.'): s = s[1:]
    elif s.startswith('-0.'): s = '-' + s[2:]
    return s or '0'

def delta(cmd):
    return (cmd[1][2], cmd[1][3]) if cmd[0] == 'q' else (cmd[1][0], cmd[1][1])

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
            x1, y1 = (2*x0 - prev_ctrl[0], 2*y0 - prev_ctrl[1]) if prev_ctrl else (x0, y0)
            x, y = x0 + p[0], y0 + p[1]
        prev_ctrl = (x1, y1)
        pts.append((x, y))
    return pts

def bbox(d):
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
            x1, y1 = (2*x0 - prev_ctrl[0], 2*y0 - prev_ctrl[1]) if prev_ctrl else (x0, y0)
            x, y = x0 + p[0], y0 + p[1]
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

# ---- 修复第 1 条（球1 的深色描边圆）：补齐缺失的 1/4 圈 ----
fill_dark, d_dark = paths[0]
cmds = parse(d_dark)
segs = cmds[1:]
n = len(segs)
q = n // 3
print(f'描边圆共 {n} 段，分 {len(segs)/q:.2f} 个四分之一圈（每个 {q} 段）')

# 用第二段(下->左)的位移取反得到缺失的第四段(上->右)
missing = [(-dx, -dy) for dx, dy in (delta(s) for s in segs[q:2*q])]
add = 't' + ''.join(fmt(dx) + fmt(dy) for dx, dy in missing)
d_fixed = d_dark + add + 'Z'

pts = endpoints(d_fixed)
x0, y0, x1, y1 = bbox(d_fixed)
cx, cy, R = (x0+x1)/2, (y0+y1)/2, (x1-x0)/2
rr = [math.hypot(px-cx, py-cy) for px, py in pts]
sx, sy = pts[0]; ex, ey = pts[-1]
ang_s = math.degrees(math.atan2(sy-cy, sx-cx))
ang_e = math.degrees(math.atan2(ey-cy, ex-cx))
print(f'修复后: 段数={len(pts)-1}, 起点({sx:.4f},{sy:.4f}) 终点({ex:.4f},{ey:.4f}) 首尾距离={math.hypot(ex-sx,ey-sy):.4f}')
print(f'        扫过 {(ang_e-ang_s)%360:.2f}°, 圆心({cx:.4f},{cy:.4f}) R={R:.4f}, 半径范围[{min(rr):.4f},{max(rr):.4f}]')
print(f'        包围盒 x[{x0:.4f},{x1:.4f}] y[{y0:.4f},{y1:.4f}] 尺寸 {x1-x0:.4f} x {y1-y0:.4f}')

open(r'e:\SynthOOPDeveloping\florr2\.codebuddy\fixed_dark.txt', 'w', encoding='utf-8').write(d_fixed)
open(r'e:\SynthOOPDeveloping\florr2\.codebuddy\light.txt', 'w', encoding='utf-8').write(paths[1][1])
print('\n已写出 fixed_dark.txt / light.txt')
