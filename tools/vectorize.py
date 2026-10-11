#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
vectorize.py — 本地通用栅格转矢量（raster-to-vector）工具。

算法流程:
  PNG 解码(zlib+反滤波) -> 双线性超采样 -> 颜色结构分类(边框环/主体/白色图标/深色块,
  所有形状一视同仁, 文字同样按形状矢量化) -> 行列投影自动切分图形 ->
  裂缝轮廓追踪(marching squares 族, fill-on-left, 鞍点左转优先) ->
  Douglas-Peucker 简化 -> SVG(evenodd) 输出, 可选 3x 预览图自检。

用法:
  python vectorize.py 输入.png [选项]

选项:
  -o, --output 路径      输出 SVG 文件（单区域）或目录（多区域, 默认 ./out）
  --regions "x0,y0,x1,y1;x0,y0,x1,y1"
                          手动指定区域（默认自动: 全图按行列投影切分）
  --bg R,G,B             背景色（默认自动 = 全图最常见颜色）
  --bg-dist N            前景/背景判定距离阈值（默认 48）
  --upscale N            超采样倍率（默认 4）
  --eps N                Douglas-Peucker 简化容差, 原始像素（默认 0.4）
  --min-area N           最小保留面积, 原始像素²（默认 2.0）
  --mode auto|full       auto=结构角色层(边框/主体/白图标/深色块);
                         full=全部颜色簇层（默认 auto）
  --names a.svg,b.svg    多区域时依次指定输出文件名（相对 -o 目录）
  --preview              同时输出每个图形的 3x 渲染预览 PNG（_prev_*.png）

示例:
  python vectorize.py 截图.png --bg 30,167,97 -o assets/ui --preview
"""
import zlib, struct, os, sys, argparse
from collections import Counter

UP = 4            # 超采样倍率（可被 --upscale 覆盖）
RDP_EPS = 1.6     # 4x 坐标系默认容差 = --eps * UP
BG_DIST = 48      # 前景判定阈值
MIN_AREA4 = 32    # 4x 坐标系下最小环面积 (= --min-area * UP^2)

# ---------------- PNG 解码 ----------------
def read_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', "not a png"
    pos = 8; idat = b''
    w = h = bd = ct = None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]; chunk = data[pos+8:pos+8+ln]
        if typ == b'IHDR':
            w, h, bd, ct = struct.unpack('>IIBB', chunk[:10])
        elif typ == b'IDAT':
            idat += chunk
        elif typ == b'IEND':
            break
        pos += 12 + ln
    assert bd == 8, "bit depth %s unsupported" % bd
    ch = {0:1, 2:3, 3:1, 4:2, 6:4}[ct]
    raw = zlib.decompress(idat)
    stride = w * ch
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if f == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i-ch]) & 255
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i-ch] if i >= ch else 0
                b = prev[i]; c = prev[i-ch] if i >= ch else 0
                pp = a + b - c
                pa = abs(pp-a); pb = abs(pp-b); pc = abs(pp-c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out[y*stride:(y+1)*stride] = line
        prev = line
    return w, h, ch, out

class Img:
    def __init__(self, w, h, ch, buf):
        self.w, self.h, self.ch, self.buf = w, h, ch, buf
    def rgb(self, x, y):
        i = (y * self.w + x) * self.ch
        return self.buf[i], self.buf[i+1], self.buf[i+2]

def dist2(c1, c2):
    return (c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2

def hexc(c):
    return "#%02x%02x%02x" % tuple(min(255, max(0, int(v))) for v in c)

def luminance(c):
    return 0.299*c[0] + 0.587*c[1] + 0.114*c[2]

# ---------------- 双线性 k 倍超采样 ----------------
def upsample(img, x0, y0, x1, y1, k):
    w, h = x1-x0, y1-y0
    ow, oh = w*k, h*k
    out = bytearray(ow*oh*3)
    for oy in range(oh):
        sy = y0 + oy / k
        iy = int(sy); fy = sy - iy
        iy1 = min(iy+1, img.h-1); iyc = min(iy, img.h-1)
        row = oy*ow*3
        for ox in range(ow):
            sx = x0 + ox / k
            ix = int(sx); fx = sx - ix
            ix1 = min(ix+1, img.w-1); ixc = min(ix, img.w-1)
            r = g = b = 0.0
            for (yy, wy) in ((iyc, 1-fy), (iy1, fy)):
                for (xx, wx) in ((ixc, 1-fx), (ix1, fx)):
                    pr, pg, pb = img.rgb(xx, yy)
                    ww = wx*wy
                    r += pr*ww; g += pg*ww; b += pb*ww
            j = row + ox*3
            out[j]   = min(255, max(0, int(r+0.5)))
            out[j+1] = min(255, max(0, int(g+0.5)))
            out[j+2] = min(255, max(0, int(b+0.5)))
    return ow, oh, out

# ---------------- 行列投影切分 ----------------
def runs_from(proj, min_gap, min_len):
    runs = []; s = None; empty = 0
    for i, v in enumerate(proj):
        if v > 0:
            if s is None:
                s = i
            empty = 0
        elif s is not None:
            empty += 1
            if empty >= min_gap:
                runs.append((s, i-empty+1)); s = None; empty = 0
    if s is not None:
        runs.append((s, len(proj)-empty))
    return [(a, b) for a, b in runs if b-a >= min_len]

def split_cells(fg, w, h, x0, y0, x1, y1, min_gap=3, min_len=20):
    cells = []
    rproj = [sum(fg[y*w+x] for x in range(x0, x1)) for y in range(y0, y1)]
    for (ry0, ry1) in runs_from(rproj, min_gap, min_len):
        cproj = [sum(fg[y*w+x] for y in range(y0+ry0, y0+ry1)) for x in range(x0, x1)]
        for (cx0, cx1) in runs_from(cproj, min_gap, min_len):
            cells.append((x0+cx0, y0+ry0, x0+cx1, y0+ry1))
    return cells

# ---------------- 颜色结构分析 ----------------
def analyze_structure(img, fg, w, h, cell, bg_col, mode):
    """识别 cell 内的颜色层。auto=结构角色; full=全部颜色簇。
    返回 [(z, color, role)] 按 z 升序即绘制顺序。"""
    x0, y0, x1, y1 = cell
    cnt = Counter()
    for y in range(max(1, y0), min(h-1, y1)):
        for x in range(max(1, x0), min(w-1, x1)):
            p = y*w+x
            if fg[p] and fg[p-1] and fg[p+1] and fg[p-w] and fg[p+w]:
                cnt[img.rgb(x, y)] += 1
    if not cnt:
        return []
    buckets = Counter()
    for (r, g, b), n in cnt.items():
        buckets[(r//12*12+6, g//12*12+6, b//12*12+6)] += n
    # 合并近色桶（距离 <40 视为一簇）
    centers = []
    for c, n in buckets.most_common(24):
        merged = False
        for ct in centers:
            if dist2(c, ct[0]) < 40*40:
                ct[1] += n; merged = True; break
        if not merged:
            centers.append([c, n])
    # 用真实像素均值精化
    def refine(center):
        rs = gs = bs = n = 0
        for (r, g, b), c in cnt.items():
            if dist2((r, g, b), center) < 18*18:
                rs += r*c; gs += g*c; bs += b*c; n += c
        return (rs/n, gs/n, bs/n) if n else center
    centers = [(refine(tuple(min(255, v) for v in c)), n) for c, n in centers]
    if mode == 'full':
        # 一视同仁: 所有簇都输出, 按面积降序 = z 升序(大色块垫底)
        out = []
        for i, (c, n) in enumerate(sorted(centers, key=lambda t: -t[1])):
            out.append((i, c, 'c%d' % i))
        return out
    # auto: 结构角色
    body_c, body_n = max(centers, key=lambda t: t[1])
    total = sum(n for _, n in centers)
    def pick(pred):
        best = None
        for c, n in centers:
            if pred(c) and n >= max(20, total*0.02):
                if best is None or n > best[1]:
                    best = (c, n)
        return best[0] if best else None
    icon = pick(lambda c: min(c) > 200)
    dark = pick(lambda c: max(c) < 90)
    # 边框: 外边界像素（紧邻非前景、且不接近背景）的众数色, 需暗于 body
    ecnt = Counter()
    for y in range(max(1, y0), min(h-1, y1)):
        for x in range(max(1, x0), min(w-1, x1)):
            p = y*w+x
            if not fg[p]:
                continue
            if not (fg[p-1] and fg[p+1] and fg[p-w] and fg[p+w]):
                c = img.rgb(x, y)
                if dist2(c, bg_col) > 40*40:
                    ecnt[(c[0]//8*8+4, c[1]//8*8+4, c[2]//8*8+4)] += 1
    border = None
    if ecnt:
        cand = max(ecnt, key=lambda c: ecnt[c])
        cand = refine(cand)
        if luminance(cand) < luminance(body_c) - 18:
            border = cand
    out = []
    if border:
        out.append((0, border, 'border'))
    out.append((1, body_c, 'body'))
    if dark:
        out.append((2, dark, 'dark'))
    if icon:
        out.append((3, icon, 'icon'))
    return out

# ---------------- 裂缝轮廓追踪（fill-on-left, 左转优先） ----------------
def trace_contours(mask, w, h):
    edges = {}
    def filled(x, y):
        return 0 <= x < w and 0 <= y < h and mask[y*w+x]
    for y in range(h):
        row = y*w
        for x in range(w):
            if not mask[row+x]:
                continue
            if not filled(x, y-1): edges[(x+1, y,   -1, 0)] = 1
            if not filled(x-1, y): edges[(x,   y,    0, 1)] = 1
            if not filled(x, y+1): edges[(x,   y+1,  1, 0)] = 1
            if not filled(x+1, y): edges[(x+1, y+1,  0,-1)] = 1
    used = set()
    loops = []
    for start in edges:
        if start in used:
            continue
        loop = [start[:2]]
        cur = start
        while True:
            used.add(cur)
            vx, vy, dx, dy = cur
            nxt_v = (vx+dx, vy+dy)
            found = None
            for cd in ((dy, -dx), (dx, dy), (-dy, dx), (-dx, -dy)):
                key = (nxt_v[0], nxt_v[1], cd[0], cd[1])
                if key in edges and key not in used:
                    found = key; break
            if found is None:
                break
            loop.append(nxt_v)
            cur = found
            if cur == start:
                break
        if len(loop) >= 4:
            loops.append(loop)
    return loops

def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    keep = [False]*len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts)-1)]
    while stack:
        a, b = stack.pop()
        if b <= a+1:
            continue
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx-ax, by-ay
        L2 = dx*dx + dy*dy
        best = -1.0; bi = -1
        for i in range(a+1, b):
            px, py = pts[i]
            if L2 == 0:
                d2 = (px-ax)**2 + (py-ay)**2
            else:
                t = max(0.0, min(1.0, ((px-ax)*dx + (py-ay)*dy) / L2))
                d2 = (px-ax-t*dx)**2 + (py-ay-t*dy)**2
            if d2 > best:
                best = d2; bi = i
        if best > eps*eps:
            keep[bi] = True
            stack.append((a, bi)); stack.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]

def simplify_loop(loop, eps):
    pts = loop[:-1] if loop[0] == loop[-1] else loop[:]
    if len(pts) < 3:
        return []
    out = rdp(pts + [pts[0]], eps)
    return out[:-1] if len(out) > 1 and out[0] == out[-1] else out

def loop_area(lp):
    a = 0.0
    j = len(lp)-1
    for i in range(len(lp)):
        a += lp[j][0]*lp[i][1] - lp[i][0]*lp[j][1]
        j = i
    return abs(a)

# ---------------- 连通域 ----------------
def components(mask, w, h):
    lbl = [0]*(w*h); comps = []; cur = 0
    for s in range(w*h):
        if mask[s] and not lbl[s]:
            cur += 1
            stack = [s]; lbl[s] = cur; pix = [s]
            while stack:
                p = stack.pop()
                x, y = p % w, p // w
                for q in ((x>0 and p-1), (x<w-1 and p+1),
                          (y>0 and p-w), (y<h-1 and p+w)):
                    if q and mask[q] and not lbl[q]:
                        lbl[q] = cur; stack.append(q); pix.append(q)
            xs = [p % w for p in pix]; ys = [p // w for p in pix]
            comps.append({'pix': pix, 'x0': min(xs), 'x1': max(xs),
                          'y0': min(ys), 'y1': max(ys), 'n': len(pix)})
    return comps

# ---------------- 单图形矢量化 ----------------
def process_cell(img, fg, w, h, cell, bg_col, tag, args):
    x0, y0, x1, y1 = cell
    layers_def = analyze_structure(img, fg, w, h, cell, bg_col, args.mode)
    if not layers_def:
        return None
    up = args.upscale
    uw, uh, upx = upsample(img, x0, y0, x1, y1, up)
    centers = [bg_col] + [c for z, c, role in layers_def]
    cls = [0]*(uw*uh)
    for i in range(uw*uh):
        c = (upx[i*3], upx[i*3+1], upx[i*3+2])
        if dist2(c, bg_col) > args.bg_dist*args.bg_dist:
            best = 0; bd = 1 << 30
            for ci in range(1, len(centers)):
                d = dist2(c, centers[ci])
                if d < bd:
                    bd = d; best = ci
            cls[i] = best
    min_area4 = args.min_area * up * up
    eps4 = args.eps * up
    layers = []
    for ci, (z, col, role) in enumerate(layers_def, start=1):
        m = bytearray(uw*uh)
        for i in range(uw*uh):
            if cls[i] == ci:
                m[i] = 1
        loops = trace_contours(m, uw, uh)
        polys = []
        for lp in loops:
            if loop_area(lp) < min_area4:
                continue
            s = simplify_loop(lp, eps4)
            if len(s) >= 3:
                polys.append([(px/up + x0, py/up + y0) for px, py in s])
        if polys:
            layers.append((z, col, polys))
        print("  %s %-6s %-8s %d 环" % (tag, role, hexc(col), len(polys)))
    if not layers:
        return None
    return {'layers': layers, 'x0': x0, 'y0': y0}

# ---------------- SVG 输出 ----------------
def emit_svg(path, res):
    layers = res['layers']
    xs = []; ys = []
    for z, col, polys in layers:
        for poly in polys:
            for px, py in poly:
                xs.append(px); ys.append(py)
    if not xs:
        return False
    vx0, vx1 = min(xs), max(xs); vy0, vy1 = min(ys), max(ys)
    dim = max(vx1-vx0, vy1-vy0)
    if dim <= 0:
        return False
    scale = 60.0/dim
    ox = 32 - scale*(vx0+vx1)/2
    oy = 32 - scale*(vy0+vy1)/2
    body = []
    for z, col, polys in sorted(layers, key=lambda t: t[0]):
        d = []
        for poly in polys:
            pts = [(ox + px*scale, oy + py*scale) for px, py in poly]
            d.append("M" + " ".join("%.2f %.2f" % p for p in pts) + "Z")
        body.append('<path fill="%s" fill-rule="evenodd" d="%s"/>' % (hexc(col), "".join(d)))
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" '
           'width="64" height="64">\n' + "\n".join(body) + "\n</svg>\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)
    return True

# ---------------- 预览 PNG ----------------
def write_png(path, w, h, rgb):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        raw += rgb[y*w*3:(y+1)*w*3]
    def chunk(typ, dat):
        c = struct.pack('>I', len(dat)) + typ + dat
        return c + struct.pack('>I', zlib.crc32(typ+dat) & 0xffffffff)
    out = b'\x89PNG\r\n\x1a\n'
    out += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    out += chunk(b'IDAT', zlib.compress(bytes(raw), 6))
    out += chunk(b'IEND', b'')
    open(path, 'wb').write(out)

def render_preview(res, bg_col, path, k=3):
    xs = []; ys = []
    for z, col, polys in res['layers']:
        for poly in polys:
            for px, py in poly:
                xs.append(px); ys.append(py)
    vx0, vy0 = min(xs)-1, min(ys)-1
    vx1, vy1 = max(xs)+1, max(ys)+1
    bw, bh = int((vx1-vx0)*k), int((vy1-vy0)*k)
    cv = bytearray(bytes((int(bg_col[0]), int(bg_col[1]), int(bg_col[2])))*(bw*bh))
    for z, col, polys in sorted(res['layers'], key=lambda t: t[0]):
        cov = bytearray(bw*bh)
        for poly in polys:
            P = [((px-vx0)*k, (py-vy0)*k) for px, py in poly]
            n = len(P)
            yys = [p[1] for p in P]
            yy0 = max(0, int(min(yys))); yy1 = min(bh-1, int(max(yys))+1)
            for y in range(yy0, yy1+1):
                yc = y + 0.5
                xxs = []
                j = n-1
                for i in range(n):
                    xa, ya = P[i]; xb, yb = P[j]
                    if (ya <= yc < yb) or (yb <= yc < ya):
                        xxs.append(xa + (yc-ya)*(xb-xa)/(yb-ya))
                    j = i
                xxs.sort()
                for kk in range(0, len(xxs)-1, 2):
                    sa, sb = int(xxs[kk]+0.5), int(xxs[kk+1]+0.5)
                    for x in range(max(0, sa), min(bw, sb+1)):
                        cov[y*bw+x] = 1
        for i in range(bw*bh):
            if cov[i]:
                j = i*3
                cv[j] = int(col[0]); cv[j+1] = int(col[1]); cv[j+2] = int(col[2])
    write_png(path, bw, bh, cv)

# ---------------- 主流程 ----------------
def main():
    ap = argparse.ArgumentParser(description="通用栅格转矢量工具")
    ap.add_argument("input", help="输入 PNG")
    ap.add_argument("-o", "--output", default="out",
                    help="输出 SVG 文件（单区域）或目录（多区域），默认 ./out")
    ap.add_argument("--regions", default="",
                    help='手动区域 "x0,y0,x1,y1;x0,y0,x1,y1"（默认全图自动切分）')
    ap.add_argument("--bg", default="", help="背景色 R,G,B（默认自动）")
    ap.add_argument("--bg-dist", type=float, default=BG_DIST)
    ap.add_argument("--upscale", type=int, default=UP)
    ap.add_argument("--eps", type=float, default=0.4, help="简化容差（原始像素）")
    ap.add_argument("--min-area", type=float, default=2.0, help="最小面积（原始像素²）")
    ap.add_argument("--mode", choices=["auto", "full"], default="auto")
    ap.add_argument("--names", default="", help="多区域输出文件名, 逗号分隔")
    ap.add_argument("--preview", action="store_true", help="输出 3x 预览 PNG")
    args = ap.parse_args()

    w, h, ch, buf = read_png(args.input)
    img = Img(w, h, ch, buf)
    print("source: %dx%d ch=%d" % (w, h, ch))

    # 背景色：全图最常见颜色
    if args.bg:
        bg_col = tuple(int(v) for v in args.bg.split(","))
    else:
        cc = Counter()
        step = max(1, w*h//400000)
        for i in range(0, w*h, step):
            j = i*img.ch
            cc[(img.buf[j], img.buf[j+1], img.buf[j+2])] += 1
        bg_col = cc.most_common(1)[0][0]
    print("bg = %s" % hexc(bg_col))

    # 前景掩码（全图）
    fg = bytearray(w*h)
    th = args.bg_dist*args.bg_dist
    for y in range(h):
        base = y*w
        for x in range(w):
            if dist2(img.rgb(x, y), bg_col) > th:
                fg[base+x] = 1

    # 区域
    if args.regions:
        regions = []
        for rs in args.regions.split(";"):
            x0, y0, x1, y1 = (int(v) for v in rs.split(","))
            regions.append((x0, y0, x1, y1, ""))
    else:
        regions = [(0, 0, w, h, "")]

    # 切分
    cells = []
    for (rx0, ry0, rx1, ry1, _) in regions:
        cells += split_cells(fg, w, h, rx0, ry0, rx1, ry1)
    print("cells: %d" % len(cells))
    for c in cells:
        print("  cell=(%d,%d)-(%d,%d)" % c)
    if not cells:
        print("未发现前景图形")
        return

    # 输出路径
    names = [n for n in args.names.split(",") if n]
    if len(cells) == 1:
        outdir = os.path.dirname(os.path.abspath(args.output))
        os.makedirs(outdir, exist_ok=True)
        paths = [args.output if args.output.lower().endswith(".svg")
                 else os.path.join(args.output, "shape_1.svg")]
    else:
        outdir = args.output
        os.makedirs(outdir, exist_ok=True)
        if names and len(names) >= len(cells):
            paths = [os.path.join(outdir, n) for n in names[:len(cells)]]
        else:
            stem = os.path.splitext(os.path.basename(args.input))[0]
            paths = [os.path.join(outdir, "%s_%d.svg" % (stem, i+1))
                     for i in range(len(cells))]

    ok = 0
    for i, cell in enumerate(cells):
        r = process_cell(img, fg, w, h, cell, bg_col, "#%d" % i, args)
        if r:
            if emit_svg(paths[i], r):
                ok += 1; print("wrote %s" % paths[i])
            if args.preview:
                pv = os.path.splitext(paths[i])[0] + "_prev.png"
                render_preview(r, bg_col, pv)
                print("preview %s" % pv)
    print("total: %d/%d" % (ok, len(cells)))

if __name__ == "__main__":
    main()
