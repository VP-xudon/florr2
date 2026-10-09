import re, json
html = open('wikipetal.html', encoding='utf-8', errors='ignore').read()

def clean(c):
    return ' '.join(re.sub(r'<[^>]+>', ' ', c).split()).strip()

# 表头每“稀有度”4 列：伤害 / 耐久 / 其他 / 冷却时间；前 5 列为 ID/英文/中文/图像/描述
# 因此普通(Common)稀有度的数值位于 cells[5..8]
PREFIX = 5
COMMON_DMG, COMMON_DUR, COMMON_OTHER, COMMON_CD = 5, 6, 7, 8

blocks = re.findall(r'<table[^>]*>.*?</table>', html, re.S)
rows = []
for b in blocks:
    for r in re.findall(r'<tr[^>]*>(.*?)</tr>', b, re.S):
        cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', r, re.S)
        if len(cells) >= 9:
            rows.append([clean(c) for c in cells])

main = {}          # 纯整数ID(1..116) -> (en, zh, common_stats)
fanmade_pool = []  # 二创（变体/大编号）按顺序 -> (en, zh)
seen_variant = set()

def parse_num(s):
    # 取首个数字（兼容 "2.4k(2430)" -> 2430 中的括号值，普通级一般为纯整数）
    m = re.search(r'\((\d+(?:\.\d+)?)\)', s)
    if m: return float(m.group(1))
    m = re.search(r'(\d+(?:\.\d+)?)', s)
    return float(m.group(1)) if m else 0.0

for cells in rows:
    a = cells[0].replace('\u200b', '').strip()
    en, zh = cells[1], cells[2]
    stat = {
        'dmg': parse_num(cells[COMMON_DMG]) if cells[COMMON_DMG] else 0.0,
        'dur': parse_num(cells[COMMON_DUR]) if cells[COMMON_DUR] else 0.0,
        'other': cells[COMMON_OTHER],
        'cd': cells[COMMON_CD],
    }
    m = re.fullmatch(r'\d+', a)
    if m:
        n = int(m.group(0))
        if 1 <= n <= 116:
            if n not in main:
                main[n] = (en, zh, stat)
            continue
        else:
            fanmade_pool.append((en, zh))
    else:
        if '94' in a:
            fanmade_pool.append((en, zh))  # Fragment / 碎片

# 生成 116 条（按 dump 文件号 1..116）
result = []
pool_i = 0
for N in range(1, 117):
    if N in main:
        en, zh, stat = main[N]
        result.append({'id': N, 'en': en, 'zh': zh, 'fanmade': False,
                       'stat': stat})
    else:
        if pool_i < len(fanmade_pool):
            en, zh = fanmade_pool[pool_i]; pool_i += 1
            result.append({'id': None, 'en': en, 'zh': zh, 'fanmade': True,
                           'stat': {'dmg': 0, 'dur': 0, 'other': '', 'cd': ''}})
        else:
            result.append({'id': None, 'en': '', 'zh': '', 'fanmade': True,
                           'stat': {'dmg': 0, 'dur': 0, 'other': '', 'cd': ''}})

with open('scripts/petals_real.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=1)

identified = sum(1 for r in result if r['en'])
fanmade = sum(1 for r in result if r['fanmade'])
print('花瓣总数(=dump文件):', len(result), ' 已命名:', identified, ' 二创:', fanmade)
for N in [1, 2, 3, 5, 6, 11, 13, 20, 22, 44]:
    r = result[N - 1]
    s = r['stat']
    print('  dump %d -> %s(%s) 普通: 伤害=%s 耐久=%s 冷却=%s' % (N, r['en'], r['zh'], s['dmg'], s['dur'], s['cd']))
print('二创样本:', [result[i-1]['en'] for i in [94, 96, 100, 110, 116]])
