import re, pathlib, math

# 把 mob-shapes.js 里蜈蚣【头节/身体节】的外形改写成【圆】。
# 单节蜈蚣的碰撞箱就该是圆（或近似圆）：按贴图像素轮廓取会带出腿脚等凹凸，
# 且 12_h/12_b 的内容在素材里比例不同，像素轮廓连大小都对不齐。
# 坐标 = viewBox 归一化 [0,1]，圆内接于正方形：圆心 (0.5,0.5)、半径 0.5。

N = 32
pts = []
for i in range(N):
    a = i * 2 * math.pi / N
    pts.append([round(0.5 + math.cos(a) * 0.5, 5), round(0.5 + math.sin(a) * 0.5, 5)])

p = pathlib.Path('e:/SynthOOPDeveloping/florr2/assets/mob-shapes.js')
src = p.read_text(encoding='utf-8')
body = '[' + ','.join('[%.5f,%.5f]' % (x, y) for x, y in pts) + ']'

for key in ('12_h', '12_b'):
    new = "  '%s': { vb: [0.0, 0.0, 1.0, 1.0], circle: true, pts: %s }," % (key, body)
    pat = re.compile(r"^  '%s': \{.*?\},$" % re.escape(key), re.M | re.S)
    if pat.search(src):
        src = pat.sub(lambda m: new, src, count=1)
        print('replaced', key)
    else:
        # 不存在就插到最后一条之后
        src = src.rstrip()
        assert src.endswith('};')
        src = src[:-2].rstrip().rstrip(',') + '\n' + new + '\n};\n'
        print('inserted', key)

p.write_text(src, encoding='utf-8')
print('done')
