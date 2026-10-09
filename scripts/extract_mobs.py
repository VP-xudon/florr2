import re, json

html = open('wikimod.html', encoding='utf-8', errors='ignore').read()

# 取完整数据行：含 'Rock' 且内部有 <th>数字</th> 的 <tr>
rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.S)

RAR = ['普通', '罕见', '稀有', '史诗', '传奇', '神话', '究极', '超级', '永恒', '唯一']

def clean(c):
    return ' '.join(re.sub(r'<[^>]+>', ' ', c).split()).strip()

def grab_name(cell):
    ma = re.search(r'<a [^>]*title="([^"]*)"[^>]*>([^<]*)</a>', cell)
    if ma:
        t = (ma.group(2) or ma.group(1)).strip()
        return re.sub(r'（[^）]*）', '', t).strip()
    return clean(cell)

def num(s):
    s = s.strip()
    if not s:
        return 0
    m = re.search(r'\((\d[\d,]*)\)', s)
    if m:
        return int(m.group(1).replace(',', ''))
    m = re.search(r'([\d.]+)\s*([kKmM])', s)
    if m:
        v = float(m.group(1)); u = m.group(2).lower()
        return int(v * ({'k': 1e3, 'm': 1e6}[u]))
    m = re.search(r'(\d+)', s)
    return int(m.group(1)) if m else 0

mobs = []
for row in rows:
    if 'Rock' not in row and 'Cactus' not in row and 'Beetle' not in row:
        # 仍要抓所有行，但先快速跳过明显非生物行
        pass
    cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', row, re.S)
    if len(cells) < 11:
        continue
    # ID 在 cell[0]
    idm = re.fullmatch(r'\d+', clean(cells[0]))
    if not idm:
        continue
    rid = int(cells[0])
    en = clean(cells[1])
    zh = grab_name(cells[2])
    if not en or not zh:
        continue
    desc = clean(cells[4])
    spawn = clean(cells[5])
    # 每档稀有度：base = 7 + k*5
    rar = {}
    for k in range(len(RAR)):
        b = 7 + k * 5
        if b + 3 >= len(cells):
            break
        rar[RAR[k]] = {
            'hp': num(cells[b]),
            'dmg': num(cells[b + 1]),
            'exp': num(cells[b + 2]),
            'type': clean(cells[b + 3]),
        }
    base = rar.get('普通', {})
    mobs.append({
        'id': rid, 'en': en, 'zh': zh,
        'hp': base.get('hp', 0), 'dmg': base.get('dmg', 0),
        'type': base.get('type', ''), 'desc': desc, 'spawn': spawn,
        'rarities': rar,
    })

mobs.sort(key=lambda x: x['id'])
print('生物数量:', len(mobs))
ids = [m['id'] for m in mobs]
print('ID 范围 %d..%d  缺失(<max):' % (min(ids), max(ids)),
      [i for i in range(1, max(ids) + 1) if i not in ids][:40])
print('--- 前14 ---')
for m in mobs[:14]:
    print('%3d  %-12s %-5s hp=%-5s dmg=%-4s type=%s' % (
        m['id'], m['en'], m['zh'], m['hp'], m['dmg'], m['type']))

with open('scripts/mobs_real.json', 'w', encoding='utf-8') as f:
    json.dump(mobs, f, ensure_ascii=False, indent=1)
print('saved scripts/mobs_real.json')
