# -*- coding: utf-8 -*-
# 第二遍：清理行内 unique 键（subCount / 蜂数因子 / segCount / 掉落寿命）与 _craftOrder
import io, re, pathlib
ROOT = pathlib.Path(r'd:/VP-xudon/florr2')

def patch(path, pairs, regexes=()):
    p = ROOT / path
    s = io.open(p, encoding='utf-8').read()
    for a, b in pairs:
        if a not in s:
            print('  !! 未命中:', path, repr(a[:70]))
        s = s.replace(a, b)
    for pat, rep in regexes:
        s, n = re.subn(pat, rep, s)
        if n: print('  regex', path, pat[:40], '->', n, '处')
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print(path, 'ok')

patch('js/data.js', [], [
    (r', unique: \d+(?:\.\d+)?', ''),          # subCount / 蜂数因子
    (r', unique: \[[^\]]*\]', ''),             # segCount
])

patch('js/sim/drops.js', [], [
    (r', unique: \w+', ''),
])

patch('js/ui.js', [
    ("""  _craftOrder(target) {
    // unique 与 eternal 同档（时长/粒子数都以 eternal 计）
    return (target === 'unique') ? 'eternal' : target;
  },
""", ""),
    ("const i = Math.max(0, order.indexOf(this._craftOrder(target)));",
     "const i = Math.max(0, order.indexOf(target));"),
])
