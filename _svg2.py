# -*- coding: utf-8 -*-
import io
base = 'e:/SynthOOPDeveloping/florr2/assets/petals/'
for n in [1, 6]:
    t = io.open(base + str(n) + '.svg', encoding='utf-8').read()
    print('===== petal', n, 'len=%d' % len(t), '=====')
    print(t[:1600])
    print('...')
