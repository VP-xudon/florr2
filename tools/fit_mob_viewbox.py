import re, pathlib, sys

# 把生物贴图的 viewBox 收紧到【实际内容】包围盒（正方形、居中、留少量边距）。
# 原因：12_h/12_b 的图形缩在 800x500 viewBox 的左上角一小块，
# 而运行时所有生物共用一个"居中固定裁剪框"（按瓢虫标定），
# 裁剪区几乎是空的 -> 贴图空白、碰撞箱也错。改 viewBox 让内容铺满即可。

NUMS = re.compile(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?')
CMD = re.compile(r'([MmZzLlHhVvCcSsQqTtAa])([^MmZzLlHhVvCcSsQqTtAa]*)')


def nums(s):
    return [float(v) for v in NUMS.findall(s)]


def path_points(d, steps=8):
    """解析 path，返回 (x,y) 列表（含曲线采样点），处理相对命令。

    【Q/T 与 S 的平滑语义必须实现】：
      · T = 平滑二次贝塞尔 —— 控制点是上一段 Q/T 控制点关于当前点的镜像；
      · S = 平滑三次贝塞尔 —— 第一控制点是上一段 C/S 第二控制点的镜像。
    旧实现把 T 当成"直线端点"处理（不采样、不反射）：大弧段（瓢虫描边圈 /
    蚂蚁 / 蜈蚣身体全是用 T 串起来的 90° 大弧）整段只剩一个端点，
    提取出来的轮廓在弧段中段会往里凹一大块 —— "瓢虫后方碰撞箱缺一块"就是它。
    非曲线命令（M/L/H/V/Z）之后跟 T/S 时按规范用当前点当控制点。"""
    pts = []
    cx = cy = sx = sy = 0.0
    q_last = None      # 上一段 Q/T 的控制点（绝对坐标）
    c_last = None      # 上一段 C/S 的第二控制点（绝对坐标）

    def quad(x0, y0, qx, qy, x1, y1):
        for k in range(1, steps + 1):
            t = k / steps; mt = 1 - t
            pts.append((mt*mt*x0 + 2*mt*t*qx + t*t*x1,
                        mt*mt*y0 + 2*mt*t*qy + t*t*y1))

    def cubic(x0, y0, c1x, c1y, c2x, c2y, x1, y1):
        for k in range(1, steps + 1):
            t = k / steps; mt = 1 - t
            pts.append((mt**3*x0 + 3*mt*mt*t*c1x + 3*mt*t*t*c2x + t**3*x1,
                        mt**3*y0 + 3*mt*mt*t*c1y + 3*mt*t*t*c2y + t**3*y1))

    for m in CMD.finditer(d):
        c, a = m.group(1), nums(m.group(2))
        i = 0
        if c in 'Mm':
            while i + 1 < len(a):
                x, y = a[i], a[i+1]; i += 2
                if c == 'm': x += cx; y += cy
                cx, cy, sx, sy = x, y, x, y; pts.append((x, y))
                q_last = c_last = None
        elif c in 'Ll':
            while i + 1 < len(a):
                x, y = a[i], a[i+1]; i += 2
                if c == 'l': x += cx; y += cy
                cx, cy = x, y; pts.append((x, y))
                q_last = c_last = None
        elif c in 'Hh':
            while i < len(a):
                x = a[i]; i += 1
                if c == 'h': x += cx
                cx = x; pts.append((x, cy))
                q_last = c_last = None
        elif c in 'Vv':
            while i < len(a):
                y = a[i]; i += 1
                if c == 'v': y += cy
                cy = y; pts.append((cx, y))
                q_last = c_last = None
        elif c in 'Cc':
            while i + 5 < len(a):
                p = a[i:i+6]; i += 6
                if c == 'c': p = [p[0]+cx, p[1]+cy, p[2]+cx, p[3]+cy, p[4]+cx, p[5]+cy]
                cubic(cx, cy, p[0], p[1], p[2], p[3], p[4], p[5])
                c_last = (p[2], p[3]); q_last = None
                cx, cy = p[4], p[5]
        elif c in 'Ss':
            while i + 3 < len(a):
                p = a[i:i+3]; i += 3
                if c == 's': p = [p[0]+cx, p[1]+cy, p[2]+cx, p[3]+cy]
                c1 = (2*cx - c_last[0], 2*cy - c_last[1]) if c_last else (cx, cy)
                cubic(cx, cy, c1[0], c1[1], p[0], p[1], p[2], p[3])
                c_last = (p[0], p[1]); q_last = None
                cx, cy = p[2], p[3]
        elif c in 'Qq':
            while i + 3 < len(a):
                p = a[i:i+4]; i += 4
                if c == 'q': p = [p[0]+cx, p[1]+cy, p[2]+cx, p[3]+cy]
                quad(cx, cy, p[0], p[1], p[2], p[3])
                q_last = (p[0], p[1]); c_last = None
                cx, cy = p[2], p[3]
        elif c in 'Tt':
            while i + 1 < len(a):
                x, y = a[i], a[i+1]; i += 2
                if c == 't': x += cx; y += cy
                pc = (2*cx - q_last[0], 2*cy - q_last[1]) if q_last else (cx, cy)
                quad(cx, cy, pc[0], pc[1], x, y)
                q_last = pc; c_last = None
                cx, cy = x, y
        elif c in 'Aa':
            while i + 6 < len(a):
                i += 7; pts.append((cx, cy))
                q_last = c_last = None
        elif c in 'Zz':
            cx, cy = sx, sy
            q_last = c_last = None
    return pts


def compose_transforms(svg):
    """收集所有 <g transform>，合成 (scale, tx, ty)：p' = (p + t) * s 形式统一为 p' = s*p + T。"""
    s, tx, ty = 1.0, 0.0, 0.0
    for tf in re.findall(r'<g[^>]*transform="([^"]*)"', svg):
        for op, arg in re.findall(r'(translate|scale)\(([^)]*)\)', tf):
            v = nums(arg)
            if op == 'translate':
                dx = v[0] if len(v) > 0 else 0.0
                dy = v[1] if len(v) > 1 else 0.0
                # 在已有缩放之后应用平移
                tx += dx * s; ty += dy * s
            else:
                k = v[0] if len(v) > 0 else 1.0
                s *= k
    return s, tx, ty


def fit(path, pad=0.04):
    svg = pathlib.Path(path).read_text(encoding='utf-8')
    s, tx, ty = compose_transforms(svg)
    pts = []
    for d in re.findall(r'(?:<path[^>]*?\sd="([^"]*)")', svg):
        pts += path_points(d)
    if not pts:
        print('no points:', path); return
    # 应用变换
    tp = [(x * s + tx, y * s + ty) for x, y in pts]
    xs = [p[0] for p in tp]; ys = [p[1] for p in tp]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    w, h = x1 - x0, y1 - y0
    side = max(w, h)
    # 正方形、居中、带边距
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    side *= (1 + pad * 2)
    nx, ny = cx - side / 2, cy - side / 2
    old = re.search(r'viewBox="([^"]*)"', svg).group(1)
    new = '%.4f %.4f %.4f %.4f' % (nx, ny, side, side)
    pathlib.Path(path).write_text(svg.replace('viewBox="%s"' % old, 'viewBox="%s"' % new), encoding='utf-8')
    print('%s\n   old viewBox: %s\n   content(w=%.2f h=%.2f) -> new: %s' % (path, old, w, h, new))


if __name__ == '__main__':
    for f in sys.argv[1:]:
        fit(f)
