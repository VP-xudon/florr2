import os, re
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mobdir = os.path.join(ROOT, 'assets', 'mobs')
petdir = os.path.join(ROOT, 'assets', 'petals')

def load(p):
    with open(p, encoding='utf-8', errors='ignore') as f:
        return f.read()

def struct(s):
    ds = re.findall(r'd="([^"]*)"', s)
    norm = ''.join(re.sub(r'[-0-9.eE+ ]', '', d) for d in ds)
    fills = ''.join(re.findall(r'fill="([^"]*)"', s))
    return norm, fills

mobs = {int(os.path.splitext(n)[0]): os.path.join(mobdir, n)
        for n in os.listdir(mobdir) if n.endswith('.svg')}
pets = {int(os.path.splitext(n)[0]): os.path.join(petdir, n)
        for n in os.listdir(petdir) if n.endswith('.svg')}

M = {k: struct(load(v)) for k, v in mobs.items()}
P = {k: struct(load(v)) for k, v in pets.items()}

def sim(a, b):
    ca, cb = Counter(a[0]), Counter(b[0])
    inter = sum((ca & cb).values())
    uni = sum((ca | cb).values())
    return inter / uni if uni else 0

# 重点：petal 4(Rock) / 6(Cactus) 最相似的 mob
for pk in [4, 6]:
    scored = sorted(((sim(P[pk], M[mk]), mk) for mk in M), reverse=True)[:5]
    print('petal', pk, '-> top mobs:', scored)

# 全部高相似配对（阈值0.7）
print('--- all pairs sim>0.7 ---')
for pk in sorted(P):
    best = max(((sim(P[pk], M[mk]), mk) for mk in M), default=(0, None))
    if best[1] is not None and best[0] > 0.7:
        print('petal', pk, '~ mob', best[1], round(best[0], 3))
