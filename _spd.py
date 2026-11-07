# -*- coding: utf-8 -*-
"""读 registry 里各花瓣的 stats.spd（判断 spd 的本义：花瓣自身速度 vs 玩家加成）。"""
import io
import json
import re

s = io.open('assets/registry.js', encoding='utf-8').read()
data = json.loads(re.search(r'window\.REGISTRY\s*=\s*(\{.*\})\s*;?\s*$', s, re.S).group(1)) \
    if re.search(r'window\.REGISTRY\s*=\s*(\{.*\})\s*;?\s*$', s, re.S) else None
if data is None:
    # 退化：直接找 "name": "X" 前后的 stats
    for name in ('Wing', 'Faster', 'Basic', 'Rose', 'Stinger', 'Antennae', 'Missile'):
        for m in re.finditer(r'"name":\s*"' + name + r'"', s):
            seg = s[m.start():m.start() + 900]
            spd = re.search(r'"spd":\s*(-?[\d.]+)', seg)
            rid = re.findall(r'"id":\s*(\d+)', s[max(0, m.start() - 400):m.start()])
            print('%-10s id=%-4s spd=%s' % (name, rid[-1] if rid else '?',
                                            spd.group(1) if spd else 'none'))
        print('---')
else:
    for p in data.get('petals', []):
        print(p.get('id'), p.get('name'), (p.get('stats') or {}).get('spd'))
