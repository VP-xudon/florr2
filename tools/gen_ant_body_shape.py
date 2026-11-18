# tools/gen_ant_body_shape.py — 兵蚁（7.svg）【去翅膀去小牙】的身体碰撞轮廓
#
# 为什么单独一支脚本：gen_mob_shapes_vector.py 的口径是"包围盒最大的单条 path = 主体"。
# 兵蚁的身体由【两条】大 path 组成（前后两个体节，各自一个圆），任何一条单独取都只覆盖
# 一半；翅膀（#eee）与两只小牙（fill=none 的描边）必须排除。所以这里：
#   ① 按 fill 分类，只保留身体 path（翅膀 = #eee，小牙 = fill="none"）；
#   ② 全部身体 path 的点一起取凸包 -> 两个体节合成一个外轮廓；
#   ③ 归一化到 viewBox [0,1]（与 SpriteStore.vectorContour 的读取口径一致），
#      以 '7_body' 为键追加进 assets/mob-shapes.js。
import io
import re
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from fit_mob_viewbox import path_points, compose_transforms
from gen_mob_shapes_vector import convex_hull, resample, MAX_PTS

SRC = 'assets/mobs/7.svg'


def main(svg_id):
    SRC = 'assets/mobs/%s.svg' % svg_id
    KEY = '%s_body' % svg_id
    s = io.open(SRC, encoding='utf-8').read()
    vb = [float(v) for v in re.findall(r'viewBox="([^"]*)"', s)[0].replace(',', ' ').split()]
    sc, tx, ty = compose_transforms(s)

    body = []
    skipped = []
    for m in re.finditer(r'<path\b[^>]*?/>', s):
        el = m.group(0)
        d = re.findall(r'\sd="([^"]*)"', el)
        fill = (re.findall(r'fill="([^"]*)"', el) or [''])[0]
        stroke = bool(re.findall(r'stroke="[^"]+"', el))
        if not d:
            continue
        # 翅膀 = 半透明浅色；小牙 = 只有描边没有面。两者都不进碰撞箱。
        if fill == 'none' or fill == '#eee':
            skipped.append((len(body), fill or 'none', stroke))
            continue
        pts = [(x * sc + tx, y * sc + ty) for x, y in path_points(d[0])]
        if len(pts) >= 3:
            body.append(pts)

    if len(body) < 1:
        raise SystemExit('body paths not found: %d' % len(body))

    allpts = [p for part in body for p in part]
    hull = convex_hull(allpts)
    pts = resample(hull, MAX_PTS)
    out = [[round((x - vb[0]) / vb[2], 5), round((y - vb[1]) / vb[3], 5)] for x, y in pts]

    xs = [p[0] for p in allpts]
    ys = [p[1] for p in allpts]
    print('%s: %d 条身体 path, %d 个点 -> %d 顶点' % (SRC, len(body), len(allpts), len(pts)))
    print('  跳过 %d 条（翅膀/小牙）' % len(skipped))
    print('  身体包围盒 %.2f x %.2f viewBox=%s' % (max(xs) - min(xs), max(ys) - min(ys), vb))

    body_js = ','.join('[%s,%s]' % (p[0], p[1]) for p in out)
    entry = ("  '%s': { vb: [%s], pts: [%s] }," %
             (KEY, ', '.join(str(round(v, 3)) for v in vb), body_js))

    path = 'assets/mob-shapes.js'
    js = io.open(path, encoding='utf-8').read()
    if ("'%s':" % KEY) in js:
        js = re.sub(r"  '%s': \{ vb: \[[^\]]*\], pts: \[.*?\] \},\n" % re.escape(KEY), entry + '\n', js, flags=re.S)
    else:
        # 插到 MOB_SHAPES 表的最后一条之后（'};' 之前的第一处）
        i = js.index('window.MOB_SHAPES = {')
        j = js.index('\n};', i)
        js = js[:j + 1] + entry + '\n' + js[j + 1:]
    io.open(path, 'w', encoding='utf-8', newline='').write(js)
    print('written %s' % path)


# 三种蚂蚁：兵蚁/工蚁 = 两个体节，幼蚁 = 一个体节（脚本对路径条数不做假设）
for sid in ('5', '6', '7'):
    main(sid)
