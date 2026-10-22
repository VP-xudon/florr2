# -*- coding: utf-8 -*-
import io, re
base = 'e:/SynthOOPDeveloping/florr2/assets/petals/'
for n in [1, 2, 5, 6, 7, 8, 10]:
    p = base + str(n) + '.svg'
    try:
        t = io.open(p, encoding='utf-8').read()
    except Exception as e:
        print(n, 'ERR', e); continue
    m = re.search(r'<svg[^>]*>', t)
    head = m.group(0) if m else '(no svg tag)'
    # 只看 width/height/viewBox
    attrs = re.findall(r'(width|height|viewBox)="([^"]*)"', head)
    print(n, dict(attrs))
