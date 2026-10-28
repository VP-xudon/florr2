# -*- coding: utf-8 -*-
"""离线生成生物碰撞轮廓（向量几何 -> 逐行左右极值多边形）。

为什么离线：浏览器在 file:// 下画布会被标记为污染，getImageData 抛异常，
运行时无法从像素里提取轮廓；而 SVG 文本在 file:// 下也读不到。
所以这里直接解析 SVG 的路径几何，算出与运行时 contourFromGrid 完全相同语义的
"逐行左右极值"多边形，作为 assets/mob-shapes.js 随包发布。

坐标系：贴图 viewBox 归一化到 [0,1]（x、y 各自独立映射，与 preserveAspectRatio=none 一致）。
"""
import io
import math
import re

N_ROWS = 96          # 扫描行数（与运行时 CONTOUR_N 同量级）
SAMPLE = 48          # 行采样数（与运行时一致）
MIN_STEP = 1.2       # 相邻点曼哈顿距离下限（网格单位，与运行时一致）


# ---------------- SVG path 解析 ----------------
NUM = re.compile(r'[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?')


def tokenize(d):
    """把 d 拆成 (命令, [数字...]) 序列，支持隐式重复。"""
    out = []
    i, n = 0, len(d)
    cur = None
    while i < n:
        ch = d[i]
        if ch in 'MmLlHhVvCcSsQqTtAaZz':
            cur = ch
            i += 1
            nums = []
            while i < n:
                m = NUM.match(d, i)
                if not m:
                    break
                nums.append(float(m.group()))
                i = m.end()
                while i < n and d[i] in ' ,\t\r\n':
                    i += 1
            out.append([cur, nums])
        else:
            i += 1
    return out


def bez3(p0, p1, p2, p3, n=10):
    pts = []
    for k in range(1, n + 1):
        t = k / n
        mt = 1 - t
        x = mt**3*p0[0] + 3*mt*mt*t*p1[0] + 3*mt*t*t*p2[0] + t**3*p3[0]
        y = mt**3*p0[1] + 3*mt*mt*t*p1[1] + 3*mt*t*t*p2[1] + t**3*p3[1]
        pts.append((x, y))
    return pts


def bez2(p0, p1, p2, n=8):
    pts = []
    for k in range(1, n + 1):
        t = k / n
        mt = 1 - t
        x = mt*mt*p0[0] + 2*mt*t*p1[0] + t*t*p2[0]
        y = mt*mt*p0[1] + 2*mt*t*p1[1] + t*t*p2[1]
        pts.append((x, y))
    return pts


def arc(p0, rx, ry, phi_deg, large, sweep, p1, n=14):
    """SVG 端点式椭圆弧 -> 折线。"""
    x1, y1 = p0
    x2, y2 = p1
    if rx == 0 or ry == 0:
        return [(x2, y2)]
    rx, ry = abs(rx), abs(ry)
    phi = math.radians(phi_deg)
    cosp, sinp = math.cos(phi), math.sin(phi)
    dx2, dy2 = (x1 - x2) / 2, (y1 - y2) / 2
    x1p = cosp * dx2 + sinp * dy2
    y1p = -sinp * dx2 + cosp * dy2
    lam = (x1p**2) / (rx*rx) + (y1p**2) / (ry*ry)
    if lam > 1:
        s = math.sqrt(lam)
        rx *= s
        ry *= s
    num = rx*rx*ry*ry - rx*rx*y1p*y1p - ry*ry*x1p*x1p
    den = rx*rx*y1p*y1p + ry*ry*x1p*x1p
    co = math.sqrt(max(0.0, num / den)) if den else 0.0
    if large == sweep:
        co = -co
    cxp = co * rx * y1p / ry
    cyp = -co * ry * x1p / rx
    cx = cosp * cxp - sinp * cyp + (x1 + x2) / 2
    cy = sinp * cxp + cosp * cyp + (y1 + y2) / 2
    def ang(ux, uy, vx, vy):
        dot = ux*vx + uy*vy
        ln = math.hypot(ux, uy) * math.hypot(vx, vy) or 1
        a = math.acos(max(-1.0, min(1.0, dot / ln)))
        return -a if (ux*vy - uy*vx) < 0 else a
    th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not sweep and dth > 0:
        dth -= 2*math.pi
    elif sweep and dth < 0:
        dth += 2*math.pi
    pts = []
    for k in range(1, n + 1):
        t = th1 + dth * k / n
        pts.append((cx + rx*math.cos(t)*cosp - ry*math.sin(t)*sinp,
                    cy + rx*math.cos(t)*sinp + ry*math.sin(t)*cosp))
    return pts


def flatten(d):
    """返回若干条子路径（每条是闭合点列）。"""
    subs = []
    cur = []
    pos = (0.0, 0.0)
    start = (0.0, 0.0)
    last_ctrl = None
    last_cmd = ''
    toks = tokenize(d)
    for cmd, nums in toks:
        rel = cmd.islower()
        c = cmd.upper()
        i = 0
        first = True
        while True:
            if c == 'M' or c == 'L' or c == 'T':
                if i + 1 >= len(nums) + 1 and c != 'T':
                    break
                if c == 'T':
                    if i >= len(nums):
                        break
                if c == 'M':
                    if i + 2 > len(nums):
                        break
                else:
                    if i + 2 > len(nums):
                        break
            if c in 'ML':
                if i + 1 >= len(nums):
                    break
                x, y = nums[i], nums[i+1]
                i += 2
                if rel:
                    x += pos[0]; y += pos[1]
                if c == 'M' and first:
                    if len(cur) > 1:
                        subs.append(cur)
                    cur = [(x, y)]
                    start = (x, y)
                else:
                    cur.append((x, y))
                pos = (x, y)
                first = False
                last_ctrl = None
            elif c == 'H':
                if i >= len(nums):
                    break
                x = nums[i]; i += 1
                if rel:
                    x += pos[0]
                pos = (x, pos[1])
                cur.append(pos)
                last_ctrl = None
            elif c == 'V':
                if i >= len(nums):
                    break
                y = nums[i]; i += 1
                if rel:
                    y += pos[1]
                pos = (pos[0], y)
                cur.append(pos)
                last_ctrl = None
            elif c in 'CS':
                need = 6 if c == 'C' else 4
                if i + need - 1 >= len(nums):
                    break
                if c == 'C':
                    x1, y1, x2, y2, x3, y3 = nums[i:i+6]
                    i += 6
                else:
                    x2, y2, x3, y3 = nums[i:i+4]
                    i += 4
                    if last_ctrl and last_cmd in 'CS':
                        x1 = 2*pos[0] - last_ctrl[0]
                        y1 = 2*pos[1] - last_ctrl[1]
                    else:
                        x1, y1 = pos
                if rel:
                    x1 += pos[0]; y1 += pos[1]
                    x2 += pos[0]; y2 += pos[1]
                    x3 += pos[0]; y3 += pos[1]
                cur.extend(bez3(pos, (x1, y1), (x2, y2), (x3, y3)))
                last_ctrl = (x2, y2)
                pos = (x3, y3)
            elif c in 'QT':
                need = 4 if c == 'Q' else 2
                if i + need - 1 >= len(nums):
                    break
                if c == 'Q':
                    x1, y1, x2, y2 = nums[i:i+4]
                    i += 4
                else:
                    x2, y2 = nums[i:i+2]
                    i += 2
                    if last_ctrl and last_cmd in 'QT':
                        x1 = 2*pos[0] - last_ctrl[0]
                        y1 = 2*pos[1] - last_ctrl[1]
                    else:
                        x1, y1 = pos
                if rel:
                    x1 += pos[0]; y1 += pos[1]
                    x2 += pos[0]; y2 += pos[1]
                cur.extend(bez2(pos, (x1, y1), (x2, y2)))
                last_ctrl = (x1, y1)
                pos = (x2, y2)
            elif c == 'A':
                if i + 6 >= len(nums):
                    break
                rx, ry, rot, la, sw, x, y = nums[i:i+7]
                i += 7
                if rel:
                    x += pos[0]; y += pos[1]
                cur.extend(arc(pos, rx, ry, rot, int(la), int(sw), (x, y)))
                pos = (x, y)
                last_ctrl = None
            elif c == 'Z':
                if len(cur) > 2:
                    subs.append(cur)
                cur = []
                pos = start
                last_ctrl = None
                break
            last_cmd = c
            if i >= len(nums):
                break
    if len(cur) > 2:
        subs.append(cur)
    return subs


# ---------------- 逐行左右极值（nonzero winding） ----------------
def spans_at(edges, y):
    xs = []
    for (x1, y1, x2, y2, direction) in edges:
        if (y1 <= y < y2) or (y2 <= y < y1):
            t = (y - y1) / (y2 - y1)
            xs.append((x1 + t * (x2 - x1), direction))
    if not xs:
        return []
    xs.sort()
    out = []
    wind = 0
    startx = None
    for x, d in xs:
        before = wind
        wind += d
        if before == 0 and wind != 0:
            startx = x
        elif before != 0 and wind == 0 and startx is not None:
            out.append((startx, x))
            startx = None
    return out


def build(svg_path, key):
    s = io.open(svg_path, encoding='utf-8').read()
    vb = [float(v) for v in re.findall(r'viewBox="([^"]*)"', s)[0].replace(',', ' ').split()]
    subs = []
    for m in re.finditer(r'<path\b([^>]*)>', s):
        at = m.group(1)
        d = re.findall(r'\sd="([^"]*)"', at)
        fill = (re.findall(r'fill="([^"]*)"', at) or [''])[0]
        if not d or fill == 'none':
            continue
        subs.extend(flatten(d[0]))
    # 应用 <g transform>（translate/scale）：路径坐标默认停在"预变换空间"，
    # 不换算到 viewBox 空间就会与 viewBox 对不上 —— 12_h/12_b 正是因此扫不到任何行。
    # 这一步对所有生物一视同仁（瓢虫/蜜蜂的变换是恒等，等于没变）。
    try:
        from fit_mob_viewbox import compose_transforms
        sc, tx, ty = compose_transforms(s)
        if sc != 1.0 or tx or ty:
            subs = [[(x * sc + tx, y * sc + ty) for (x, y) in poly] for poly in subs]
    except Exception:
        pass

    # 丢弃明显的小装饰（面积 < 视窗 0.2%），保留主体
    def area(poly):
        a = 0.0
        for i in range(len(poly)):
            x1, y1 = poly[i]
            x2, y2 = poly[(i + 1) % len(poly)]
            a += x1 * y2 - x2 * y1
        return abs(a) / 2
    vb_area = vb[2] * vb[3]
    subs = [p for p in subs if area(p) > vb_area * 0.002]
    if not subs:
        raise SystemExit('no usable path in ' + svg_path)

    # 所有子路径合成边表（nonzero：按绕向给方向）
    edges = []
    for poly in subs:
        pts = poly + [poly[0]]
        for i in range(len(pts) - 1):
            x1, y1 = pts[i]
            x2, y2 = pts[i + 1]
            if y1 == y2:
                continue
            edges.append((x1, y1, x2, y2, 1 if y2 > y1 else -1))

    # 只取【视窗内】的可见外形：路径会画到 viewBox 之外（被裁掉的部分不可见），
    # 不裁剪会出现归一化坐标越界（>1）的尖刺。
    x0, x1 = vb[0], vb[0] + vb[2]
    rows = []
    for j in range(N_ROWS):
        y = vb[1] + (j + 0.5) / N_ROWS * vb[3]
        sp = spans_at(edges, y)
        if not sp:
            continue
        vis = [(max(a, x0), min(b, x1)) for a, b in sp if min(b, x1) > max(a, x0)]
        if not vis:
            continue
        l = min(a for a, b in vis)
        r = max(b for a, b in vis)
        rows.append((j, l, r))
    if len(rows) < 2:
        raise SystemExit('no rows for ' + svg_path)

    stride = max(1, len(rows) // SAMPLE)
    picked = rows[::stride]
    if picked[-1] is not rows[-1]:
        picked.append(rows[-1])

    raw = [(p[1], p[0]) for p in picked] + [(p[2], p[0]) for p in reversed(picked)]
    simple = [raw[0]]
    for p in raw[1:]:
        q = simple[-1]
        if abs(p[0] - q[0]) + abs(p[1] - q[1]) >= MIN_STEP:
            simple.append(p)

    out = []
    for x, j in simple:
        nx = (x - vb[0]) / vb[2]
        ny = (j / N_ROWS)
        out.append([round(nx, 5), round(ny, 5)])
    return vb, out


# 蜈蚣是【多节生物】：头节(带触角)与身体节是两张独立贴图，各自都要有碰撞外形。
# 单节的碰撞箱按【圆】推导：节本身近似圆，按贴图像素轮廓取会把腿脚等凹凸带进来，
# 而且两张素材的内容比例不同，像素轮廓连大小都对不齐。
# 圆不是硬编码 —— 由脚本从素材几何【算出】：取内容包围盒的中心与短边半径。
SEGMENT_KEYS = {'12_h', '12_b'}


def build_circle(svg_path):
    """从素材几何推导圆形碰撞箱：内容包围盒中心 + 短边半径（viewBox 归一化 [0,1]）。"""
    import re
    s = io.open(svg_path, encoding='utf-8').read()
    vb = [float(v) for v in re.findall(r'viewBox="([^"]*)"', s)[0].replace(',', ' ').split()]
    # 复用 fit_mob_viewbox 的解析：<g transform> 合成 + 相对命令解析
    from fit_mob_viewbox import path_points, compose_transforms
    sc, tx, ty = compose_transforms(s)
    pts = []
    for d in re.findall(r'(?:<path[^>]*?\sd="([^"]*)")', s):
        pts += path_points(d)
    if not pts:
        raise SystemExit('no points for ' + svg_path)
    tp = [(x * sc + tx, y * sc + ty) for x, y in pts]
    xs = [p[0] for p in tp]; ys = [p[1] for p in tp]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    rad = min(x1 - x0, y1 - y0) / 2.0
    # 归一化到 viewBox
    nx = (cx - vb[0]) / vb[2]
    ny = (cy - vb[1]) / vb[3]
    nr = rad / max(vb[2], vb[3])
    N = 32
    out = []
    for i in range(N):
        a = i * 2 * math.pi / N
        out.append([round(nx + math.cos(a) * nr, 5), round(ny + math.sin(a) * nr, 5)])
    return vb, out


def main():
    mobs = [
        ('3', 'assets/mobs/3.svg'), ('4', 'assets/mobs/4.svg'),
        ('12_h', 'assets/mobs/12_h.svg'), ('12_b', 'assets/mobs/12_b.svg'),
    ]
    lines = [
        '// mob-shapes.js — 生物碰撞轮廓（离线预计算，勿手改）',
        '// 由 tools 脚本从 assets/mobs/*.svg 的路径几何直接算出：逐行左右极值多边形，',
        '// 语义与运行时 contourFromGrid 完全一致；坐标 = 贴图 viewBox 归一化 [0,1]。',
        '// 用途：file:// 下画布被污染（getImageData 抛异常）时，仍能得到真实外形碰撞箱。',
        'window.MOB_SHAPES = {',
    ]
    for key, path in mobs:
        # 一视同仁：所有生物（含蜈蚣的头节/身体节）都用同一个 build() 从贴图几何提取，
        # 不存在"给蜈蚣单独推导一个圆"的特殊分支。
        vb, pts = build(path, key)
        body = ','.join('[%s,%s]' % (p[0], p[1]) for p in pts)
        lines.append("  '%s': { vb: [%s], pts: [%s] }," %
                     (key, ', '.join(str(round(v, 3)) for v in vb), body))
    lines.append('};')
    io.open('assets/mob-shapes.js', 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print('written assets/mob-shapes.js')


main()
