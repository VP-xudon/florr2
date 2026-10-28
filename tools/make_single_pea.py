"""把原始四球素材 44.svg 变成【一颗豌豆】，并保持与 rose/basic 同一套画布格式。

做法（一条 path 都不删，高光 100% 保留）：
  1. 解析 8 条 path，算出各自在根坐标系下的包围盒；
  2. 按"本体(w≈24.286)+高光(w≈15.715)同心"配对成 4 颗球；
  3. 取【最上面】那颗（cy 最小 = 原图菱形正上方）；
  4. 其余 3 颗用 <g display="none"> 包住（display:none 不参与 getBBox，
     等价于被裁掉，但路径数据原样保留，随时可恢复）；
  5. 外层包 <g transform="translate(tx ty) scale(K)">：
       K  = (0.7 × rose 内容宽) / 本体宽
       平移使本体圆心落在画布中心 (55,55) —— 这样实体的居中裁剪框
       与旋转轴都正好落在绿色身体上；
  6. viewBox 保持 "0 0 110 110"，与 rose(5.svg)/basic(1.svg) 完全一致。

目标比例：单颗豌豆 = 0.7 × rose（用户指定）。
"""
import io
import re
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from fit_mob_viewbox import path_points, compose_transforms

SRC = sys.argv[1] if len(sys.argv) > 1 else '_44_orig.svg'
DST = sys.argv[2] if len(sys.argv) > 2 else 'assets/petals/44.svg'
ROSE = sys.argv[3] if len(sys.argv) > 3 else 'assets/petals/5.svg'
SCALE_VS_ROSE = 0.7
CENTER = 55.0          # 画布 110x110 的中心


def read_any(p):
    raw = io.open(p, 'rb').read()
    for enc in ('utf-8-sig', 'utf-16', 'utf-8', 'latin-1'):
        try:
            return raw.decode(enc).lstrip('\ufeff')
        except Exception:
            continue
    raise SystemExit('cannot decode ' + p)


def path_boxes(s):
    sc, tx, ty = compose_transforms(s)
    out = []
    for m in re.finditer(r'<path\b[^>]*?/>', s):
        el = m.group(0)
        d = re.findall(r'\sd="([^"]*)"', el)
        fill = (re.findall(r'fill="([^"]*)"', el) or [''])[0]
        if not d:
            continue
        pts = [(x * sc + tx, y * sc + ty) for x, y in path_points(d[0])]
        if len(pts) < 3:
            continue
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        out.append({
            'el': el, 'fill': fill,
            'cx': (min(xs) + max(xs)) / 2, 'cy': (min(ys) + max(ys)) / 2,
            'w': max(xs) - min(xs), 'h': max(ys) - min(ys),
        })
    return out


src = read_any(SRC)
rose = read_any(ROSE)

rose_boxes = path_boxes(rose)
rose_w = max(b['w'] for b in rose_boxes)          # rose 的内容宽（32.858）

boxes = path_boxes(src)
if not boxes:
    raise SystemExit('no paths in ' + SRC)

# ---- 配对成球：最大的那批是本体，其余同心的是高光 ----
bodies = sorted([b for b in boxes if b['w'] > 20], key=lambda b: b['w'], reverse=True)
body_w = bodies[0]['w']
mains = [b for b in boxes if abs(b['w'] - body_w) < 1e-3]
balls = []
for m in mains:
    parts = [b for b in boxes
             if abs(b['cx'] - m['cx']) < 0.5 and abs(b['cy'] - m['cy']) < 0.5]
    balls.append({'cx': m['cx'], 'cy': m['cy'], 'w': m['w'], 'h': m['h'], 'parts': parts})

if len(balls) < 2:
    raise SystemExit('expected 4 balls, got %d' % len(balls))

top = min(balls, key=lambda b: b['cy'])            # 正上方那颗
target_w = rose_w * SCALE_VS_ROSE
K = target_w / top['w']
gtx = CENTER - top['cx'] * K
gty = CENTER - top['cy'] * K

# ---- 隐藏其余球（不删除任何 path）----
keep = {p['el'] for p in top['parts']}
out = src
for b in boxes:
    if b['el'] in keep:
        continue
    out = out.replace(b['el'], '<g display="none">%s</g>' % b['el'], 1)

# ---- 外层统一缩放/居中 ----
out = re.sub(r'(<svg\b[^>]*>)',
             r'\1<g transform="translate(%.6f %.6f) scale(%.6f)">' % (gtx, gty, K),
             out, count=1)
out = out.replace('</svg>', '</g></svg>')

io.open(DST, 'w', encoding='utf-8').write(out)

# ---- 校验 ----
n_path_src = len(re.findall(r'<path\b', src))
n_path_dst = len(re.findall(r'<path\b', out))
fills = re.findall(r'fill="(#[0-9a-fA-F]{3,6})"', out)
print('balls=%d  top=(%.3f,%.3f) body_w=%.3f' % (len(balls), top['cx'], top['cy'], top['w']))
print('rose_w=%.3f  target_w=%.3f  K=%.5f' % (rose_w, target_w, K))
print('paths src=%d dst=%d  %s' % (n_path_src, n_path_dst,
                                   'OK' if n_path_src == n_path_dst else 'MISMATCH!'))
print('fills=%s' % sorted(set(fills)))
assert n_path_src == n_path_dst, 'path count changed!'
