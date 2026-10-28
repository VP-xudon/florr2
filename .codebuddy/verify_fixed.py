import re, math

def parse(d):
    tokens = re.findall(r'[A-Za-z]|-?(?:\d+\.\d+|\.\d+|\d+)', d)
    sizes = {'M': 2, 'm': 2, 'q': 4, 't': 2, 'Z': 0}
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

def analyze(name, d):
    cmds = parse(d)
    x, y = cmds[0][1]
    xs, ys = [x], [y]
    pts = [(x, y)]
    prev_ctrl = None
    for kind, p in cmds[1:]:
        if kind in ('Z', 'z'):
            break
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
        pts.append((x, y))
    x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
    cx, cy = (x0+x1)/2, (y0+y1)/2
    angs = sorted(math.degrees(math.atan2(py-cy, px-cx)) % 360 for px, py in pts)
    gaps = [(angs[(i+1) % len(angs)] - angs[i]) % 360 for i in range(len(angs))]
    maxgap = max(gaps)
    rr = [math.hypot(px-cx, py-cy) for px, py in pts]
    print(f'{name}: 段数={len(pts)-1} 圆心=({cx:.4f},{cy:.4f}) R={(x1-x0)/2:.4f}')
    print(f'  半径范围[{min(rr):.4f},{max(rr):.4f}]  最大角向缺口={maxgap:.3f}°  ' + ('[OK] 完整闭合' if maxgap < 12 else '[NG] 仍有缺口'))
    print(f'  包围盒 x[{x0:.4f},{x1:.4f}] y[{y0:.4f},{y1:.4f}]')
    return x0, y0, x1, y1

dark = open(r'e:\SynthOOPDeveloping\florr2\.codebuddy\fixed_dark.txt', encoding='utf-8').read()
light = open(r'e:\SynthOOPDeveloping\florr2\.codebuddy\light.txt', encoding='utf-8').read()
a = analyze('描边圆(#709d45)', dark)
b = analyze('填充圆(#8ac255)', light)

cx, cy = (a[0]+a[2])/2, (a[1]+a[3])/2
half = max((a[2]-a[0])/2, (a[3]-a[1])/2) + 0.001
print(f'\n建议 viewBox: {cx-half:.3f} {cy-half:.3f} {2*half:.3f} {2*half:.3f}')
