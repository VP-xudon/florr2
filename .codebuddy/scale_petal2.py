# -*- coding: utf-8 -*-
"""修正版：把 assets/petals/44.svg 的所有图形绕其中心缩小为 0.5x（中心位置不变）。
   注意：每条 path 自身还带 transform，必须计入包围盒。"""
import re

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

def translate_of(s):
    m = re.search(r'translate\(\s*(-?[\d.]+)(?:[ ,]+(-?[\d.]+))?', s or '')
    if not m: return (0.0, 0.0)
    return (float(m.group(1)), float(m.group(2) or 0))

# 内层 <g transform="translate(0 7.143)">
m_inner = re.search(r'<g transform="(translate\([^"]*\))">\s*<path', src)
INNER = translate_of(m_inner.group(1)) if m_inner else (0.0, 0.0)
print('内层 g 变换:', INNER)

boxes = []
for tag in re.finditer(r'<path\b[^>]*>', src):
    t = tag.group(0)
    d = re.search(r'\sd="([^"]+)"', t).group(1)
    tf = re.search(r'transform="([^"]*)"', t)
    tx, ty = translate_of(tf.group(1)) if tf else (0.0, 0.0)
    x0, y0, x1, y1 = path_bbox(d)
    fx, fy = tx + INNER[0], ty + INNER[1]
    print(f'  path: bbox=({x0:.4f},{y0:.4f})-({x1:.4f},{y1:.4f}) 自身transform=({tx},{ty})')
    boxes.append((x0+fx, y0+fy, x1+fx, y1+fy))

lx0, ly0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
lx1, ly1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
lcx, lcy = (lx0+lx1)/2, (ly0+ly1)/2
print(f'\n外层变换前内容 bbox: ({lx0:.6f},{ly0:.6f})-({lx1:.6f},{ly1:.6f})')
print(f'  尺寸 {lx1-lx0:.6f} x {ly1-ly0:.6f}  中心 ({lcx:.6f},{lcy:.6f})')

# 当前（被错误写入的）外层变换
cur = re.search(r'translate\((-?[\d.]+), (-?[\d.]+)\) scale\(([\d.]+)\)', src)
CUR_T = (float(cur.group(1)), float(cur.group(2))); CUR_S = float(cur.group(3))
print(f'\n当前外层变换: translate({CUR_T[0]}, {CUR_T[1]}) scale({CUR_S})')

ORIG_S = 9.3058                       # 原始缩放（= CUR_S / 0.5）
NEW_S = round(ORIG_S * 0.5, 6)        # 4.6529
# 绕中心缩放 0.5：新 T = 原 T + 0.5*原S*中心
NEW_TX = -111.82 + 0.5 * ORIG_S * lcx
NEW_TY = -261.82 + 0.5 * ORIG_S * lcy

def rendered(S, T):
    cx_, cy_ = S*lcx + T[0], S*lcy + T[1]
    return cx_, cy_, S*(lx1-lx0), S*(ly1-ly0)

ocx, ocy, ow, oh = rendered(ORIG_S, (-111.82, -261.82))
ncx, ncy, nw, nh = rendered(NEW_S, (NEW_TX, NEW_TY))
print(f'\n原始: 中心 ({ocx:.4f},{ocy:.4f}) 尺寸 {ow:.4f} x {oh:.4f}')
print(f'新值: 中心 ({ncx:.4f},{ncy:.4f}) 尺寸 {nw:.4f} x {nh:.4f}')
print(f'  中心偏移: ({abs(ncx-ocx):.6f}, {abs(ncy-ocy):.6f})   尺寸比: {nw/ow:.6f}')

new_tf = f'translate({NEW_TX:.4f}, {NEW_TY:.4f}) scale({NEW_S})'
src2 = src.replace(cur.group(0), new_tf)
open(PATH, 'w', encoding='utf-8', newline='').write(src2)
print('\n已写入变换:', new_tf)
