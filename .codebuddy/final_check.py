# -*- coding: utf-8 -*-
import xml.etree.ElementTree as ET
import re
P = r'e:\SynthOOPDeveloping\florr2\assets\petals\44.svg'
s = open(P, encoding='utf-8', newline='').read()
ET.fromstring(s)   # 不是合法 XML 会抛异常
print('[OK] XML 合法')

m = re.search(r'translate\((-?[\d.]+), (-?[\d.]+)\) scale\(([\d.]+)\)', s)
T = (float(m.group(1)), float(m.group(2))); S = float(m.group(3))
print('外层变换: translate(%g, %g) scale(%g)' % (T[0], T[1], S))

# 用已知内容包围盒复核
lx0, ly0, lx1, ly1 = 43.141424, 43.456393, 67.427852, 67.742616
cx, cy = S*(lx0+lx1)/2 + T[0], S*(ly0+ly1)/2 + T[1]
w, h = S*(lx1-lx0), S*(ly1-ly0)
print('渲染后中心: (%.4f, %.4f)' % (cx, cy))
print('渲染后尺寸: %.4f x %.4f' % (w, h))
print('原始中心  : (402.6478, 255.5779)')
print('原始尺寸  : 226.0046 x 226.0027')
print('中心偏差  : (%.6f, %.6f)' % (abs(cx-402.6478), abs(cy-255.5779)))
print('尺寸比例  : %.6f' % (w/226.0046))
