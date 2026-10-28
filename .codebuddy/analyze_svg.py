import re
from fractions import Fraction

svg = open(r'e:\SynthOOPDeveloping\florr2\.codebuddy\source.svg', encoding='utf-8').read()

paths = re.findall(r'<path fill="(#[0-9a-fA-F]{6})" d="([^"]+)"', svg)
print('path 数量:', len(paths))

num_re = re.compile(r'-?(?:\d+\.\d+|\.\d+|\d+)')

def parse(d):
    """返回 [('M',[x,y]), ('q',[dx1,dy1,dx,dy]), ('t',[dx,dy]), ...]，支持命令后重复参数组"""
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

def bbox(d):
    cmds = parse(d)
    x, y = cmds[0][1]
    xs, ys = [x], [y]
    prev_ctrl = None
    for kind, p in cmds[1:]:
        x0, y0 = x, y
        if kind == 'q':
            c1x, c1y, x2, y2 = p[0], p[1], p[2], p[3]
            x1, y1 = x0 + c1x, y0 + c1y
            x, y = x0 + x2, y0 + y2
        else:  # t: 控制点为上一个控制点的镜像
            x2, y2 = p[0], p[1]
            if prev_ctrl is None:
                x1, y1 = x0, y0
            else:
                x1, y1 = 2*x0 - prev_ctrl[0], 2*y0 - prev_ctrl[1]
            x, y = x0 + x2, y0 + y2
        prev_ctrl = (x1, y1)
        # 二次贝塞尔极值点
        for a, b, c in ((x0, x1, x), (y0, y1, y)):
            den = a - 2*b + c
            if den != 0:
                t = (a - b) / den
                if 0 < t < 1:
                    v = (1-t)**2 * a + 2*t*(1-t)*b + t**2 * c
                    (xs if (a, b, c) == (x0, x1, x) else ys).append(v)
        xs.append(x); ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)

for idx, (fill, d) in enumerate(paths, 1):
    x0, y0, x1, y1 = bbox(d)
    cx, cy = (x0+x1)/2, (y0+y1)/2
    print(f'#{idx} {fill}  bbox=[{x0:.6f},{y0:.6f} .. {x1:.6f},{y1:.6f}]  '
          f'center=({cx:.6f},{cy:.6f})  size=({x1-x0:.6f} x {y1-y0:.6f})  R={(x1-x0)/2:.6f}')

print('\n两两配对（深色描边 + 浅色填充）:')
for k in range(0, len(paths), 2):
    a = bbox(paths[k][1]); b = bbox(paths[k+1][1])
    ca = ((a[0]+a[2])/2, (a[1]+a[3])/2); cb = ((b[0]+b[2])/2, (b[1]+b[3])/2)
    print(f'  球{k//2+1}: 描边圆心{ca} R={(a[2]-a[0])/2:.6f} | 填充圆心{cb} r={(b[2]-b[0])/2:.6f}')
