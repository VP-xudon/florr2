# -*- coding: utf-8 -*-
"""把 js/net.js 的 _solveChains / _trailAt 原样搬过来做逐帧仿真。

场景：头先直走 240px，再以 R=90 转 30°，再直走 240px。
输出相邻连杆夹角：全 0 = 刚性直杆；转弯期间应出现明显夹角（= 身体在沿路径弯过去）。
"""
import math

GAP = 24.0
GLUE = 0.92
TRAIL_MIN = 1.0
N = 12


def trail_at(trail, dist, frm):
    if not trail or not frm:
        return None
    ax, ay = frm
    acc = 0.0
    for b in trail:
        d = math.hypot(b[0] - ax, b[1] - ay)
        if d > 1e-6 and acc + d >= dist:
            t = (dist - acc) / d
            return (ax + (b[0] - ax) * t, ay + (b[1] - ay) * t,
                    math.atan2(b[1] - ay, b[0] - ax) + math.pi)
        acc += d
        ax, ay = b
    b = trail[-1]
    ux, uy = b[0] - ax, b[1] - ay
    d = math.hypot(ux, uy)
    if d < 1e-6:
        ux, uy, d = 1.0, 0.0, 1.0
    extra = max(0.0, dist - acc)
    return (b[0] + ux / d * extra, b[1] + uy / d * extra, math.atan2(uy, ux) + math.pi)


def solve(head, segs, trail):
    # 1) 采样
    s0 = trail[0] if trail else None
    if not s0 or math.hypot(head[0] - s0[0], head[1] - s0[1]) >= TRAIL_MIN:
        trail.insert(0, (head[0], head[1]))

    need = GAP * len(segs)

    # 2) 补足（从头量起）
    total = 0.0
    ax, ay = head
    for p in trail:
        total += math.hypot(p[0] - ax, p[1] - ay)
        ax, ay = p
    want = need + 40
    if not trail:
        L = want + 40
        trail.append((head[0] - math.cos(0) * L, head[1] - math.sin(0) * L))
    elif total < want:
        tail = trail[-1]
        prev = trail[-2] if len(trail) >= 2 else (head[0] - 1.0, head[1])
        ux, uy = tail[0] - prev[0], tail[1] - prev[1]
        d = math.hypot(ux, uy) or 1.0
        ux, uy = ux / d, uy / d
        remain = want - total
        while remain > 1e-3:
            step = min(8.0, remain)
            tail = (tail[0] + ux * step, tail[1] + uy * step)
            trail.append(tail)
            remain -= step

    # 3) 摆放
    out = []
    acc = 0.0
    for _ in range(len(segs)):
        acc += GAP
        hit = trail_at(trail, acc, head)
        if hit is None:
            break
        out.append((hit[0], hit[1]))

    # 4) 裁剪（从头量起）
    max_len = acc + 320
    s = 0.0
    keep = len(trail)
    ax, ay = head
    for i, p in enumerate(trail):
        s += math.hypot(p[0] - ax, p[1] - ay)
        ax, ay = p
        if s > max_len:
            keep = i + 1
            break
    del trail[keep:]
    return out, trail


def joints(head, segs):
    pts = [head] + segs
    ang = [math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])
           for i in range(1, len(pts))]
    out = []
    for i in range(1, len(ang)):
        d = ang[i] - ang[i - 1]
        while d > math.pi:
            d -= 2 * math.pi
        while d <= -math.pi:
            d += 2 * math.pi
        out.append(math.degrees(d))
    return out


def run(spawn_arc=True):
    curve = 0.11 if spawn_arc else 0.0
    head = [0.0, 0.0]
    segs = []
    px, py, dr = 0.0, 0.0, math.pi
    for _ in range(N):
        segs.append((px, py))
        px += math.cos(dr) * GAP
        py += math.sin(dr) * GAP
        dr += curve
    trail = list(segs)
    ex, ey, ed = segs[-1][0], segs[-1][1], dr
    for _ in range(120):
        ex += math.cos(ed) * 8
        ey += math.sin(ed) * 8
        ed += curve * 0.6
        trail.append((ex, ey))
    trail.insert(0, tuple(head))

    R = 90.0
    turn = math.radians(30)
    speed = 40.0 / 60.0
    hx, hy, hd = 0.0, 0.0, 0.0
    frame, phase, arc_done = 0, 'straight1', 0.0
    print('\n--- spawn_arc=%s ---' % spawn_arc)
    while frame < 1400:
        if phase == 'straight1':
            hx += math.cos(hd) * speed; hy += math.sin(hd) * speed
            if math.hypot(hx, hy) >= 240:
                phase = 'arc'
        elif phase == 'arc':
            hd += speed / R; arc_done += speed / R
            hx += math.cos(hd) * speed; hy += math.sin(hd) * speed
            if arc_done >= turn:
                phase = 'straight2'
        else:
            hx += math.cos(hd) * speed; hy += math.sin(hd) * speed
        head = [hx, hy]
        segs, trail = solve(head, segs, trail)
        frame += 1
        if frame in (200, 400, 430, 500, 700, 1000):
            d = joints(head, segs)
            print('  frame %-5d %-10s joints: %s  max=%.1f'
                  % (frame, phase, ' '.join('%5.1f' % x for x in d), max(abs(x) for x in d)))


run(True)
run(False)
