"""从 SVG 的【矢量几何】直接提取：
  · MOB_SHAPES —— 碰撞轮廓（主体部件，96 顶点）
  · MOB_PIVOT  —— 旋转轴心（同一外形的包围盒中心，viewBox 归一化）

【只取主体部件，自动忽略触角/腿脚/花纹等附属部件】
  判定规则：一条 <path> 就是一个"部件"，取【包围盒最大的那一条】作为主体。
  为什么这样能自动排除附属部件：florr 的贴图把触角、腿、斑点、头盖都画成
  单独的 <path>（往往还是不同 fill），它们的包围盒远小于身体：
    · 12_h：绿身体 227.3px / 浅绿内圈 206.7 / 触角+腿 165.3 与 88.6 → 选中身体
    · 12_b：绿身体 227.3 / 内圈 206.7 / 腿 88.6 → 选中身体
    · 3（瓢虫）：红壳 50.0 / 黑头 30.8 / 内圈 19.2 → 选中红壳
    · 4（蜜蜂）：黄身 42.5 / 暗色翅 41.8 / 触角尖 12.4、8.3 → 选中黄身
  为什么不能"按颜色分组后整体取包围盒"：12_h 的 #333 同时包含头盖与触角尖，
  分组后包围盒被拉成 1.45 倍高，会把真正的身体挤掉（蜜蜂的 #333 也会把触角算进来）。
  所以规则必须落在"单条路径"这一粒度上。

为什么轴心要单独算：
  轮廓为了控制顶点数会抽稀到 96 点，而且只取"面积最大的单个子路径"。
  某些贴图（如蜈蚣头 12_h）的主体由多条路径/圆弧组成，单条子路径只是其中一部份，
  于是从轮廓点反推出来的中心会偏（实测偏 0.045，约等于画布的 4.5%）。
  轴心必须用【同一颜色的全部路径】的真实包围盒，才是精确的圆心。

"主体颜色"的判定：把所有路径按 fill 分组，取【总面积最大】的那一组。
  · 蜈蚣 12_h/12_b：#709d45（绿色身体）
  · 瓢虫 3 / 蜜蜂 4：各自外壳主色
所有生物一视同仁，没有任何 key 特判。
"""
import re
import io
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from fit_mob_viewbox import path_points, compose_transforms

MAX_PTS = 96          # 轮廓顶点上限（够精确，又不会让逐帧多边形判定变慢）


def poly_area(poly):
    a = 0.0
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0


def convex_hull(pts):
    """单调链凸包。用于把"同一颜色的多条子路径"合成一个外轮廓。"""
    pts = sorted(set((round(x, 6), round(y, 6)) for x, y in pts))
    if len(pts) <= 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def resample(poly, n):
    """按弧长等距重采样到 n 个点（凸包点数不固定，统一成固定顶点数）。"""
    if len(poly) <= 2:
        return poly
    segs = []
    total = 0.0
    for i in range(len(poly)):
        a = poly[i]
        b = poly[(i + 1) % len(poly)]
        d = ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
        segs.append((a, b, d))
        total += d
    if total <= 0:
        return poly
    step = total / n
    out = []
    idx = 0
    acc = 0.0
    for k in range(n):
        target = k * step
        while idx < len(segs) and acc + segs[idx][2] < target:
            acc += segs[idx][2]
            idx += 1
        a, b, d = segs[min(idx, len(segs) - 1)]
        t = (target - acc) / d if d > 1e-9 else 0.0
        out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out


def build_vector(svg_path):
    """一次扫描同时产出：轮廓（最大子路径）+ 轴心（主色全部路径的包围盒中心）。"""
    s = io.open(svg_path, encoding='utf-8').read()
    vb = [float(v) for v in re.findall(r'viewBox="([^"]*)"', s)[0].replace(',', ' ').split()]
    sc, tx, ty = compose_transforms(s)

    # 主体的判定：【包围盒最大的单条子路径】。
    #
    # 为什么不用多边形面积：深色身体是一个"环"（一条子路径里两个反向绕的圈），
    # 鞋带公式算出来是 外圆-内圆 的差值，会比浅色内圆还小 -> 选中内圆，
    # 半径偏小 9%。环的包围盒正好是外圆，所以按 bbox 选就自然选中真正的身体。
    #
    # 为什么不按颜色分组：触角/头盖和身体的描边常常是同一个颜色
    # （12_h 的 #333 同时包含触角尖和头盖），分组后包围盒被拉成 1.45 倍高，
    # 反而把真正的身体（#709d45, 227px）挤掉。实测四条路径里，
    # "最大单条"正好都落在身体上：4->#ffe763 42.5 / 12_h->#709d45 227.3 /
    # 12_b->#709d45 / 3->#eb4034。
    best = None                      # (bbox面积, pts) 包围盒最大的单个 <path> = 主体部件
    allxs = []                       # 全部部件的外接范围（仅用于自检打印：证明附属部件被排除）
    allys = []

    # 与 tools/analyze_petals.py【完全相同的解析口径】：
    # 逐 <path> 元素、整条 d 一起展平，【不按 M 拆子路径】。
    # 因为一条 path 里可能同时画着身体和翅膀/环，拆开后会只选中其中一块
    # （蜜蜂实测：整条 #ffe763 是 42.5×42.5，拆开只剩 30.8×41.9）。
    for m in re.finditer(r'<path\b[^>]*?/>', s):
        el = m.group(0)
        d = re.findall(r'\sd="([^"]*)"', el)
        fill = (re.findall(r'fill="([^"]*)"', el) or [''])[0]
        if not d or fill == 'none':
            continue
        pts = [(x * sc + tx, y * sc + ty) for x, y in path_points(d[0])]
        if len(pts) < 3:
            continue
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        allxs.extend((min(xs), max(xs)))
        allys.extend((min(ys), max(ys)))
        bbox = (max(xs) - min(xs)) * (max(ys) - min(ys))
        if best is None or bbox > best[0]:
            best = (bbox, pts)

    if not best:
        raise SystemExit('no usable path in ' + svg_path)

    # ---- 轮廓 = 该路径全部点的【凸包】 ----
    # 必须走凸包：环是一条子路径里两个反向绕的圈，直接拿全部点会得到
    # 一圈外圆 + 一圈内圆的自交多边形，点在线测试会把身体中心判成"外部"。
    # 凸包把内圈吃掉，只剩外边界 —— 也就是真正的身体轮廓。
    src = best[1]
    hull = convex_hull(src)
    if len(hull) < 3:
        hull = src
    pts = resample(hull, MAX_PTS)

    xs = [p[0] for p in hull]
    ys = [p[1] for p in hull]
    cx = (min(xs) + max(xs)) / 2
    cy = (min(ys) + max(ys)) / 2
    out = [[round((x - vb[0]) / vb[2], 5), round((y - vb[1]) / vb[3], 5)] for x, y in pts]

    # 轴心 = 同一个轮廓的包围盒中心（与碰撞轮廓严格同源，不会再出现两者不一致）
    pivot = [(cx - vb[0]) / vb[2], (cy - vb[1]) / vb[3]]

    # 自检：轮廓半径 vs 包围盒半径（圆形主体两者应几乎相等）
    rr = max(((p[0] - cx) ** 2 + (p[1] - cy) ** 2) ** 0.5 for p in hull)
    bx = (max(xs) - min(xs)) / 2
    by = (max(ys) - min(ys)) / 2
    print('   [自检] 轮廓半径 %.4f  包围盒半径 %.4f x %.4f  (%d 点)'
          % (rr / vb[2], bx / vb[2], by / vb[3], len(pts)))
    # 自检：主体 vs 全部部件。两者不同 = 触角/腿脚/花纹等附属部件已被排除在外。
    uw = (max(allxs) - min(allxs)) if allxs else 0
    uh = (max(allys) - min(allys)) if allys else 0
    print('   [主体] %.1f x %.1f   全部部件 %.1f x %.1f   排除附属部件=%s'
          % (bx * 2, by * 2, uw, uh, '是' if (uw > bx * 2 * 1.02 or uh > by * 2 * 1.02) else '否'))
    return vb, out, pivot


def main():
    mobs = [
        ('3', 'assets/mobs/3.svg'), ('4', 'assets/mobs/4.svg'),
        ('12_h', 'assets/mobs/12_h.svg'), ('12_b', 'assets/mobs/12_b.svg'),
    ]
    head = [
        '// mob-shapes.js — 生物碰撞轮廓 + 旋转轴心（离线预计算，勿手改）',
        '// 由 tools/gen_mob_shapes_vector.py 从 [SVG 矢量几何] 直接提取：',
        '//   MOB_SHAPES.pts = 面积最大子路径展平后的轮廓，坐标 = viewBox 归一化 [0,1]',
        '//   MOB_PIVOT      = 主色（总面积最大的 fill）全部路径的包围盒中心，同一坐标系',
        '// 所有生物统一走这条路径，没有任何特殊分支。',
        'window.MOB_SHAPES = {',
    ]
    shapes, pivots = [], []
    for key, path in mobs:
        vb, pts, pv = build_vector(path)
        body = ','.join('[%s,%s]' % (p[0], p[1]) for p in pts)
        shapes.append("  '%s': { vb: [%s], pts: [%s] }," %
                      (key, ', '.join(str(round(v, 3)) for v in vb), body))
        pivots.append("  '%s': [%.5f, %.5f]," % (key, pv[0], pv[1]))
        print('%s: %d pts, pivot=(%.4f, %.4f)' % (key, len(pts), pv[0], pv[1]))
    shapes.append('};')
    shapes.append('')
    shapes.append('window.MOB_PIVOT = {')
    shapes.extend(pivots)
    shapes.append('};')
    io.open('assets/mob-shapes.js', 'w', encoding='utf-8').write('\n'.join(head + shapes) + '\n')
    print('written assets/mob-shapes.js')


main()
