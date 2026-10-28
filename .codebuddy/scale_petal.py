# -*- coding: utf-8 -*-
"""把 assets/petals/44.svg 的所有图形绕其中心缩小为 0.5x（位置保持不变）。"""
import re, io

PATH = r'e:\SynthOOPDeveloping\florr2\assets\petals\44.svg'
src = open(PATH, encoding='utf-8', newline='').read()

def parse_d(d):
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

def path_bbox(d):
    """返回路径（未变换）的包围盒，含二次贝塞尔极值"""
    cmds = parse_d(d)
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

# 收集所有 path 及其自身 transform
paths = re.findall(r'<path[^>]*?d="([^"]+)"[^>]*?(?:transform="([^"]*)")?[^>]*?/>', src)
INNER = (0.0, 7.143)          # <g transform="translate(0 7.143)">
OUTER_S = 9.3058
OUTER_T = (-111.82, -261.82)

def tr_of(s):
    if not s: return (0.0, 0.0)
    m = re.search(r'translate\(\s*(-?[\d.eE+]+)[ ,]+(-?[\d.eE+]+)', s)
    return (float(m.group(1)), float(m.group(2))) if m else (0.0, 0.0)

boxes = []
for d, tf in paths:
    x0, y0, x1, y1 = path_bbox(d)
    tx, ty = tr_of(tf)
    # 路径 transform + 内层 g transform
    fx, fy = tx + INNER[0], ty + INNER[1]
    boxes.append((x0+fx, y0+fy, x1+fx, y1+fy))
    print(f'  path: 自身 bbox=({x0:.4f},{y0:.4f})-({x1:.4f},{y1:.4f})  transform=({tx},{ty})')

lx0 = min(b[0] for b in boxes); ly0 = min(b[1] for b in boxes)
lx1 = max(b[2] for b in boxes); ly1 = max(b[3] for b in boxes)
lcx, lcy = (lx0+lx1)/2, (ly0+ly1)/2
print(f'\n外层变换前的内容 bbox: ({lx0:.6f},{ly0:.6f})-({lx1:.6f},{ly1:.6f})')
print(f'  尺寸 {lx1-lx0:.6f} x {ly1-ly0:.6f}   中心 ({lcx:.6f},{lcy:.6f})')

def rendered(S, T):
    return (S*lx0+T[0], S*ly0+T[1], S*lx1+T[0], S*ly1+T[1])

old = rendered(OUTER_S, OUTER_T)
print(f'\n原始渲染 bbox: ({old[0]:.4f},{old[1]:.4f})-({old[2]:.4f},{old[3]:.4f})')
print(f'  中心 ({(old[0]+old[2])/2:.4f},{(old[1]+old[3])/2:.4f})  尺寸 {old[2]-old[0]:.4f} x {old[3]-old[1]:.4f}')

# 绕中心缩放 0.5：p' = T + 0.5*S*...  =>  新 T = T + 0.5*S*中心
NEW_S = round(OUTER_S * 0.5, 6)              # 4.6529
NEW_TX = OUTER_T[0] + 0.5 * OUTER_S * lcx
NEW_TY = OUTER_T[1] + 0.5 * OUTER_S * lcy
print(f'\n新变换: translate({NEW_TX:.4f}, {NEW_TY:.4f}) scale({NEW_S})')

new = rendered(NEW_S, (NEW_TX, NEW_TY))
print(f'新渲染 bbox: ({new[0]:.4f},{new[1]:.4f})-({new[2]:.4f},{new[3]:.4f})')
print(f'  中心 ({(new[0]+new[2])/2:.4f},{(new[1]+new[3])/2:.4f})  尺寸 {new[2]-new[0]:.4f} x {new[3]-new[1]:.4f}')

# 应用
old_tf = 'translate(-111.82, -261.82) scale(9.3058)'
new_tf = f'translate({NEW_TX:.4f}, {NEW_TY:.4f}) scale({NEW_S})'
assert src.count(old_tf) == 1, f'未找到唯一的外层变换，命中 {src.count(old_tf)} 次'
out = src.replace(old_tf, new_tf)
open(PATH, 'w', encoding='utf-8', newline='').write(out)
print('\n已写入:', PATH)
print('变换:', old_tf, '->', new_tf)
