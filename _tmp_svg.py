import re, io
for f in ['3', '4']:
    s = io.open('assets/mobs/%s.svg' % f, encoding='utf-8').read()
    print('=== ', f, len(s))
    print('viewBox', re.findall(r'viewBox="([^"]*)"', s))
    print('preserve', re.findall(r'preserveAspectRatio="([^"]*)"', s))
    for m in re.finditer(r'<([a-zA-Z]+)([^>]*)>', s):
        tag = m.group(1); at = m.group(2)
        if tag in ('svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'clipPath', 'defs', 'use'):
            tr = (re.findall(r'transform="([^"]*)"', at) or [''])[0]
            fill = (re.findall(r'fill="([^"]*)"', at) or [''])[0]
            d = re.findall(r'\sd="([^"]{0,30})', at)
            print('  ', tag, '|tr=', tr, '|fill=', fill, '|d=', d[0] if d else '')
