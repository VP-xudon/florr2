# -*- coding: utf-8 -*-
"""
crop_mob_svgs.py — 把所有生物 SVG 的 viewBox 烘焙裁剪到实际图案包围盒。

原理（等价于此前运行时 alpha 通道实测）：
  实际图案 = 所有可见几何（path/circle/rect/...，含描边外扩）
           ∩ clipPath 裁剪窗口
           ∩ 原 viewBox。
求出新包围盒后直接改写根元素：
  viewBox="新框"  preserveAspectRatio="none"（拉伸填满，图案正好撑满 size×size）
用法：
  python tools/crop_mob_svgs.py            # 就地改写
  python tools/crop_mob_svgs.py --dry      # 只打印不改写
"""
import re
import sys
import math
import xml.etree.ElementTree as ET
from pathlib import Path

SVG_NS = '{http://www.w3.org/2000/svg}'
MOB_DIR = Path(__file__).resolve().parent.parent / 'assets' / 'mobs'
PAD = 0.1          # 包围盒外扩（viewBox 单位），仅覆盖抗锯齿边缘
CURVE_STEPS = 20   # 曲线采样密度

# ---------- 2x3 矩阵（a b c d e f） ----------
IDENT = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)

def mat_mul(m, n):
    a1, b1, c1, d1, e1, f1 = m
    a2, b2, c2, d2, e2, f2 = n
    return (a1 * a2 + c1 * b2,
            b1 * a2 + d1 * b2,
            a1 * c2 + c1 * d2,
            b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e2,
            b1 * e2 + d1 * f2 + f2)

def mat_apply(m, x, y):
    a, b, c, d, e, f = m
    return (a * x + c * y + e, b * x + d * y + f)

def mat_scale(m):
    a, b, c, d, _, _ = m
    return math.sqrt(abs(a * d - b * c)) or 1.0

NUM = r'[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?'

def parse_transform(s):
    m = IDENT
    for name, args in re.findall(r'([a-zA-Z]+)\s*\(([^)]*)\)', s or ''):
        v = [float(x) for x in re.findall(NUM, args)]
        if name == 'translate':
            tx = v[0] if v else 0.0
            ty = v[1] if len(v) > 1 else 0.0
            t = (1, 0, 0, 1, tx, ty)
        elif name == 'scale':
            sx = v[0] if v else 1.0
            sy = v[1] if len(v) > 1 else sx
            t = (sx, 0, 0, sy, 0, 0)
        elif name == 'rotate':
            a = math.radians(v[0] if v else 0.0)
            ca, sa = math.cos(a), math.sin(a)
            t = (ca, sa, -sa, ca, 0, 0)
            if len(v) >= 3:
                t = mat_mul(mat_mul((1, 0, 0, 1, v[1], v[2]), t),
                            (1, 0, 0, 1, -v[1], -v[2]))
        elif name == 'matrix' and len(v) >= 6:
            t = tuple(v[:6])
        elif name == 'skewX':
            t = (1, 0, math.tan(math.radians(v[0])), 1, 0, 0)
        elif name == 'skewY':
            t = (1, math.tan(math.radians(v[0])), 0, 1, 0, 0)
        else:
            continue
        m = mat_mul(m, t)
    return m

def parse_view_box(s):
    v = [float(x) for x in re.findall(NUM, s or '')]
    return v if len(v) == 4 else [0, 0, 100, 100]

# ---------- path 几何采样 ----------
def path_points(d):
    """把 path d 属性全部命令采样成点列（足够求包围盒）。"""
    tokens = re.findall(r'([MmLlHhVvQqCcSsTtAaZz])|(' + NUM + ')', d or '')
    seq = [(t[0] or t[1]) for t in tokens]
    pts, cx, cy, px, py, sx, sy = [], 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
    prev_ctrl = None
    prev_cmd = ''
    i = 0
    def nums(n):
        nonlocal i
        out = [float(seq[i + k]) for k in range(n)]
        i += n
        return out
    while i < len(seq):
        t = seq[i]
        if t in 'MmLlHhVvQqCcSsTtAaZz':
            i += 1
        elif prev_cmd == '':
            break
        else:
            t = prev_cmd  # 后续数字组沿用上一命令
        rel = t.islower()
        T = t.upper()
        if T == 'M':
            x, y = nums(2)
            if rel: x += cx; y += cy
            cx, cy = x, y; sx, sy = x, y
            pts.append((x, y))
            prev_cmd = 'l' if rel else 'L'   # 隐式后续 lineto
        elif T == 'L':
            x, y = nums(2)
            if rel: x += cx; y += cy
            cx, cy = x, y; pts.append((x, y))
        elif T == 'H':
            x, = nums(1)
            if rel: x += cx
            cx = x; pts.append((x, cy))
        elif T == 'V':
            y, = nums(1)
            if rel: y += cy
            cy = y; pts.append((cx, y))
        elif T == 'Q':
            x1, y1, x, y = nums(4)
            if rel: x1 += cx; y1 += cy; x += cx; y += cy
            for k in range(1, CURVE_STEPS):
                tt = k / CURVE_STEPS
                u = 1 - tt
                pts.append((u * u * cx + 2 * u * tt * x1 + tt * tt * x,
                            u * u * cy + 2 * u * tt * y1 + tt * tt * y))
            prev_ctrl = (x1, y1)
            cx, cy = x, y; pts.append((x, y))
        elif T == 'T':
            x, y = nums(2)
            if rel: x += cx; y += cy
            x1, y1 = (2 * cx - prev_ctrl[0], 2 * cy - prev_ctrl[1]) if prev_ctrl else (cx, cy)
            for k in range(1, CURVE_STEPS):
                tt = k / CURVE_STEPS
                u = 1 - tt
                pts.append((u * u * cx + 2 * u * tt * x1 + tt * tt * x,
                            u * u * cy + 2 * u * tt * y1 + tt * tt * y))
            prev_ctrl = (x1, y1)
            cx, cy = x, y; pts.append((x, y))
        elif T == 'C':
            x1, y1, x2, y2, x, y = nums(6)
            if rel: x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy
            for k in range(1, CURVE_STEPS):
                tt = k / CURVE_STEPS
                u = 1 - tt
                pts.append((u**3 * cx + 3 * u * u * tt * x1 + 3 * u * tt * tt * x2 + tt**3 * x,
                            u**3 * cy + 3 * u * u * tt * y1 + 3 * u * tt * tt * y2 + tt**3 * y))
            prev_ctrl = (x2, y2)
            cx, cy = x, y; pts.append((x, y))
        elif T == 'S':
            x2, y2, x, y = nums(4)
            if rel: x2 += cx; y2 += cy; x += cx; y += cy
            x1, y1 = (2 * cx - prev_ctrl[0], 2 * cy - prev_ctrl[1]) if prev_ctrl else (cx, cy)
            for k in range(1, CURVE_STEPS):
                tt = k / CURVE_STEPS
                u = 1 - tt
                pts.append((u**3 * cx + 3 * u * u * tt * x1 + 3 * u * tt * tt * x2 + tt**3 * x,
                            u**3 * cy + 3 * u * u * tt * y1 + 3 * u * tt * tt * y2 + tt**3 * y))
            prev_ctrl = (x2, y2)
            cx, cy = x, y; pts.append((x, y))
        elif T == 'A':
            rx, ry, rot, laf, sf, x, y = nums(7)
            if rel: x += cx; y += cy
            pts.extend(arc_points(cx, cy, rx, ry, rot, laf, sf, x, y))
            cx, cy = x, y
        elif T == 'Z':
            cx, cy = sx, sy
            pts.append((sx, sy))
        else:
            break
        if T in 'MmLlHhVvAa':
            prev_ctrl = None
        if T not in 'Zz':
            prev_cmd = t
    return pts

def arc_points(x1, y1, rx, ry, rot_deg, laf, sf, x2, y2):
    """端点弧转中心参数并采样（SVG 规范附录算法）。"""
    if rx <= 0 or ry <= 0:
        return [(x1, y1), (x2, y2)]
    phi = math.radians(rot_deg % 360)
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p = cp * dx + sp * dy
    y1p = -sp * dx + cp * dy
    rx, ry = abs(rx), abs(ry)
    lam = x1p**2 / rx**2 + y1p**2 / ry**2
    if lam > 1:
        s = math.sqrt(lam); rx *= s; ry *= s
    num = rx**2 * ry**2 - rx**2 * y1p**2 - ry**2 * x1p**2
    den = rx**2 * y1p**2 + ry**2 * x1p**2
    co = math.sqrt(max(0.0, num / den)) if den else 0.0
    if laf == sf:
        co = -co
    cxp, cyp = co * rx * y1p / ry, -co * ry * x1p / rx
    ccx = cp * cxp - sp * cyp + (x1 + x2) / 2
    ccy = sp * cxp + cp * cyp + (y1 + y2) / 2
    def ang(ux, uy, vx, vy):
        d = math.hypot(ux, uy) * math.hypot(vx, vy)
        c = max(-1.0, min(1.0, (ux * vx + uy * vy) / (d or 1)))
        a = math.acos(c)
        if ux * vy - uy * vx < 0:
            a = -a
        return a
    th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry,
              (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not sf and dth > 0: dth -= 2 * math.pi
    if sf and dth < 0: dth += 2 * math.pi
    out = [(x1, y1)]
    for k in range(1, CURVE_STEPS):
        th = th1 + dth * k / CURVE_STEPS
        out.append((ccx + rx * math.cos(th) * cp - ry * math.sin(th) * sp,
                    ccy + rx * math.cos(th) * sp + ry * math.sin(th) * cp))
    out.append((x2, y2))
    return out

# ---------- clipPath 窗口 ----------
def clip_boxes(root, ns):
    boxes = {}
    for cp in root.iter(ns + 'clipPath'):
        pts = []
        for el in cp:
            m = parse_transform(el.get('transform'))
            pts.extend((mat_apply(m, x, y)) for x, y in elem_local_points(el, ns, {}))
        if len(pts) >= 2:
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            boxes[cp.get('id')] = (min(xs), min(ys), max(xs), max(ys))
    return boxes

def elem_local_points(el, ns, inherit):
    """单个元素在其自身坐标系里的几何点（不含自身 transform）。"""
    tag = el.tag[len(ns):] if el.tag.startswith(ns) else el.tag
    def fattr(name, default=0.0):
        try: return float(el.get(name, default))
        except (TypeError, ValueError): return default
    if tag == 'path':
        return path_points(el.get('d', ''))
    if tag == 'rect':
        x, y = fattr('x'), fattr('y')
        w, h = fattr('width'), fattr('height')
        return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    if tag == 'circle':
        cx, cy, r = fattr('cx'), fattr('cy'), fattr('r')
        return [(cx + r * math.cos(a * math.pi / 16),
                 cy + r * math.sin(a * math.pi / 16)) for a in range(32)]
    if tag == 'ellipse':
        cx, cy = fattr('cx'), fattr('cy')
        rx, ry = fattr('rx'), fattr('ry')
        return [(cx + rx * math.cos(a * math.pi / 16),
                 cy + ry * math.sin(a * math.pi / 16)) for a in range(32)]
    if tag == 'line':
        return [(fattr('x1'), fattr('y1')), (fattr('x2'), fattr('y2'))]
    if tag in ('polygon', 'polyline'):
        v = [float(x) for x in re.findall(NUM, el.get('points', ''))]
        return list(zip(v[0::2], v[1::2]))
    return []

def is_stroked(el, inherit):
    s = el.get('stroke', inherit.get('stroke'))
    return s and s.lower() != 'none'

def stroke_w(el, inherit):
    try: return float(el.get('stroke-width') or inherit.get('stroke-width', 1))
    except ValueError: return 1.0

# ---------- 树遍历求根空间包围盒 ----------
def collect(el, ns, clips, inherit, m, clip_root, acc):
    """m: 当前局部空间 -> 根空间矩阵；clip_root: 根空间内的 clip 矩形列表。"""
    tag = el.tag[len(ns):] if el.tag.startswith(ns) else el.tag
    if tag in ('defs', 'clipPath', 'title', 'desc', 'metadata'):
        return
    own_m = parse_transform(el.get('transform'))
    m2 = mat_mul(m, own_m)
    clip2 = clip_root
    cp_ref = el.get('clip-path')
    if cp_ref:
        cid = re.search(r'url\(#([^)]+)\)', cp_ref)
        if cid and cid.group(1) in clips:
            r = clips[cid.group(1)]               # clip 坐标 = 引用元素的用户空间
            c0 = mat_apply(m2, r[0], r[1]); c1 = mat_apply(m2, r[2], r[3])
            clip2 = clip_root + [(min(c0[0], c1[0]), min(c0[1], c1[1]),
                                   max(c0[0], c1[0]), max(c0[1], c1[1]))]
    stroke_here = is_stroked(el, inherit)
    inh2 = dict(inherit)
    for k in ('fill', 'stroke', 'stroke-width'):
        if el.get(k) is not None: inh2[k] = el.get(k)
    pts = elem_local_points(el, ns, inh2)
    if pts and (el.get('fill', inherit.get('fill', 'black')).lower() != 'none'
                or stroke_here):
        rp = [mat_apply(m2, x, y) for x, y in pts]   # 变换到根空间
        bx0 = min(p[0] for p in rp); by0 = min(p[1] for p in rp)
        bx1 = max(p[0] for p in rp); by1 = max(p[1] for p in rp)
        sw = stroke_w(el, inh2) * mat_scale(m2) / 2 if stroke_here else 0.0
        bx0 -= sw; by0 -= sw; bx1 += sw; by1 += sw   # 先描边外扩（描边也是可见像素）
        for (cx0, cy0, cx1, cy1) in clip2:           # 再按 clip 窗口收紧（被裁掉的描边不占视觉）
            bx0 = max(bx0, cx0); by0 = max(by0, cy0)
            bx1 = min(bx1, cx1); by1 = min(by1, cy1)
        if bx1 > bx0 and by1 > by0:
            acc[0] = min(acc[0], bx0)
            acc[1] = min(acc[1], by0)
            acc[2] = max(acc[2], bx1)
            acc[3] = max(acc[3], by1)
    # N/A 占位图里的 text：矩形背景必然覆盖整个 viewBox，无需单独计量
    for ch in list(el):
        collect(ch, ns, clips, inh2, m2, clip2, acc)

def fmt(v):
    s = f'{v:.3f}'.rstrip('0').rstrip('.')
    return s if s else '0'

def main():
    dry = '--dry' in sys.argv
    files = sorted(MOB_DIR.glob('*.svg'), key=lambda p: int(p.stem) if p.stem.isdigit() else 999)
    changed = kept = 0
    for f in files:
        txt = f.read_text(encoding='utf-8')
        try:
            root = ET.fromstring(txt)
        except ET.ParseError as e:
            print(f'[SKIP] {f.name}: 解析失败 {e}')
            continue
        ns = SVG_NS
        vb = parse_view_box(root.get('viewBox'))
        clips = clip_boxes(root, ns)
        acc = [float('inf'), float('inf'), float('-inf'), float('-inf')]
        collect(root, ns, clips, {}, IDENT, [], acc)
        if acc[2] < acc[0]:
            print(f'[SKIP] {f.name}: 没有可见几何')
            continue
        # ∩ 原 viewBox，再外扩 PAD
        x0 = max(vb[0], acc[0] - PAD); y0 = max(vb[1], acc[1] - PAD)
        x1 = min(vb[0] + vb[2], acc[2] + PAD); y1 = min(vb[1] + vb[3], acc[3] + PAD)
        nw, nh = x1 - x0, y1 - y0
        if nw <= 0 or nh <= 0:
            print(f'[SKIP] {f.name}: 交集为空')
            continue
        old = ' '.join(fmt(v) for v in vb)
        new = f'{fmt(x0)} {fmt(y0)} {fmt(nw)} {fmt(nh)}'
        if abs(nw - vb[2]) < 0.01 and abs(nh - vb[3]) < 0.01 and \
           abs(x0 - vb[0]) < 0.01 and abs(y0 - vb[1]) < 0.01 and \
           root.get('preserveAspectRatio') == 'none':
            kept += 1
            continue
        changed += 1
        print(f'{f.name:>8}: [{old}] -> [{new}]')
        if not dry:
            root.set('viewBox', new)
            root.set('preserveAspectRatio', 'none')
            if root.get('width') and root.get('height'):
                root.set('width', fmt(nw)); root.set('height', fmt(nh))
            ET.register_namespace('', 'http://www.w3.org/2000/svg')
            out = ET.tostring(root, encoding='unicode')
            f.write_text(out, encoding='utf-8')
    print(f'\n完成：改写 {changed} 个，无需改动 {kept} 个（dry={dry}）')

if __name__ == '__main__':
    main()
