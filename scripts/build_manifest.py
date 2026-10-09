import os, json, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
TILES_DIR = os.path.join(ASSETS, 'static', 'tiles')
MOB_DIR = os.path.join(ASSETS, 'mobs')
PETAL_DIR = os.path.join(ASSETS, 'petals')
MANIFEST_JSON = os.path.join(ASSETS, 'manifest.json')

# 从 wikipetal.html 提取的真实花瓣表：list of {id,en,zh,fanmade}（按 dump 文件号索引）
PETALS_REAL = []
pj = os.path.join(ROOT, 'scripts', 'petals_real.json')
if os.path.exists(pj):
    with open(pj, encoding='utf-8') as f:
        PETALS_REAL = json.load(f)

# 从 wikimod.html 提取的生物表：list of {id,en,zh,hp,dmg,type,desc,spawn,rarities}
MOBS_REAL = []
mj2 = os.path.join(ROOT, 'scripts', 'mobs_real.json')
if os.path.exists(mj2):
    with open(mj2, encoding='utf-8') as f:
        MOBS_REAL = json.load(f)

# 已知战斗数值（按英文名匹配，与位置无关）：dmg, hp, spd
STATS_BY_EN = {
    'Leaf': (6, 6, 16), 'Stinger': (15, 0, -4), 'Rose': (24, -4, -12),
    'Rock': (2, 45, -16), 'Bubble': (0, 28, 0), 'Cactus': (11, 16, -6),
    'Web': (4, 12, -2), 'Peas': (13, 0, 0), 'Pincer': (19, 0, -2),
    'Wing': (0, -2, 44), 'Salt': (0, 6, 0), 'Honey': (0, 10, 0),
    'Dandelion': (0, 0, 0), 'Antennae': (0, 0, 0), 'Iris': (30, 0, -14),
}
KIND_BY_EN = {
    'Leaf': 'light', 'Stinger': 'attack', 'Rose': 'attack', 'Rock': 'tank',
    'Bubble': 'shield', 'Cactus': 'thorn', 'Web': 'control', 'Peas': 'attack',
    'Pincer': 'attack', 'Wing': 'light', 'Iris': 'attack', 'Salt': 'tank',
    'Honey': 'shield', 'Dandelion': 'utility', 'Antennae': 'utility',
}


def ids_in(d):
    return sorted(int(os.path.splitext(f)[0]) for f in os.listdir(d) if f.endswith('.svg'))


petal_ids = ids_in(PETAL_DIR)   # 1..116
mob_ids = ids_in(MOB_DIR)       # 1..83

petals = []
for i in petal_ids:
    # dump 文件 i 对应 petals_real.json 的第 i-1 项（已按真实ID精确映射，二创取池补充）
    if i - 1 < len(PETALS_REAL):
        rec = PETALS_REAL[i - 1]
        en, zh, rid = rec['en'], rec['zh'], rec['id']
        fanmade = rec.get('fanmade', False)
        base = STATS_BY_EN.get(en, (0, 0, 0))
        ws = rec.get('stat', {}) or {}
        # 优先采用 wikipetal.html 普通(Common)稀有度的真实数值；缺失则回退硬编码表
        wd = ws.get('dmg', 0) or 0
        wh = ws.get('dur', 0) or 0
        dmg = wd if wd else base[0]
        hp = wh if wh else base[1]
        spd = base[2]
        kind = KIND_BY_EN.get(en, 'misc')
        petals.append({
            'id': i, 'file': 'assets/petals/%d.svg' % i,
            'name': en, 'zh': zh, 'realId': rid, 'kind': kind,
            'fanmade': fanmade,
            'stats': {'dmg': dmg, 'hp': hp, 'spd': spd},
            'wiki': {'common': ws},   # 保留原始 wiki 数据备查
            'identified': True,
            'note': '二创(fanmade)' if fanmade else ''
        })
    else:
        petals.append({
            'id': i, 'file': 'assets/petals/%d.svg' % i,
            'name': '', 'zh': '', 'realId': None, 'kind': 'misc',
            'fanmade': True,
            'stats': {'dmg': 0, 'hp': 0, 'spd': 0},
            'identified': False, 'note': 'TODO: 未登记，待手填'
        })

# 生物：按 dump 文件号 = 页面生物ID 映射（wikimod.html，纯表格，真实ID序）
def mob_behavior(typ):
    t = typ or ''
    if '障碍' in t:
        return {'speed': 0,  'aggro': False, 'chase': False, 'flee': False}
    if '被动' in t:
        return {'speed': 35, 'aggro': False, 'chase': False, 'flee': True}
    if '中立' in t:
        return {'speed': 45, 'aggro': False, 'chase': False, 'flee': False, 'retaliate': True}
    if '敌对' in t:
        return {'speed': 60, 'aggro': True,  'chase': True,  'flee': False}
    if '召唤' in t:
        return {'speed': 30, 'aggro': False, 'chase': False, 'flee': False, 'summoned': True}
    return {'speed': 45, 'aggro': False, 'chase': False, 'flee': False}

mobs = []
for i in mob_ids:
    rec = next((r for r in MOBS_REAL if r['id'] == i), None)
    if rec:
        b = mob_behavior(rec['type'])
        hp = rec['hp']; dmg = rec['dmg']
        size = 16 + min(22, hp // 8)
        mobs.append({
            'id': i, 'file': 'assets/mobs/%d.svg' % i,
            'name': rec['en'], 'zh': rec['zh'], 'biome': '',
            'hp': hp, 'dmg': dmg, 'speed': b['speed'], 'size': size,
            'tier': 1, 'boss': False, 'color': '#bbbbbb',
            'type': rec['type'], 'desc': rec['desc'], 'spawn': rec['spawn'],
            'rarities': rec['rarities'],
            'ai': {'aggro': b['aggro'], 'chase': b['chase'], 'flee': b['flee'],
                   'retaliate': b.get('retaliate', False),
                   'summoned': b.get('summoned', False)},
            'drops': {}, 'identified': True, 'note': ''
        })
    else:
        mobs.append({
            'id': i, 'file': 'assets/mobs/%d.svg' % i,
            'name': '', 'zh': '', 'biome': '',
            'hp': 20, 'dmg': 5, 'speed': 45, 'size': 20,
            'tier': 1, 'boss': False, 'color': '#888888',
            'type': '', 'desc': '', 'spawn': '', 'rarities': {},
            'ai': {}, 'drops': {}, 'identified': False,
            'note': 'TODO: 页面无此ID，待手填'
        })

# 瓦片：解析 tileset.tsj (id -> image)
with open(os.path.join(TILES_DIR, 'tileset.tsj'), encoding='utf-8') as f:
    tsj = json.load(f)
tiles = []
for t in tsj.get('tiles', []):
    tid = t['id']
    img = t['image']
    cat = re.split(r'[_\.]', img)[0]
    props = {p['name']: p['value'] for p in t.get('properties', [])}
    tiles.append({
        'id': tid, 'image': img,
        'file': 'assets/static/tiles/' + img,
        'category': cat, 'props': props, 'tileset': 'tileset'
    })

# 地图
with open(MANIFEST_JSON, encoding='utf-8-sig') as f:
    mj = json.load(f)
maps = [{'name': fn.replace('.tmj', ''), 'file': 'assets/static/tiles/' + fn}
        for fn in mj['categories']['maps']['files']]

# 同名实体关联（生物 <-> 同名卡片）：按英文名在花瓣/生物序中定位
def pos_of(en):
    for idx, rec in enumerate(PETALS_REAL):
        if rec['en'] == en:
            return idx + 1
    return None

def mob_pos_of(en):
    for r in MOBS_REAL:
        if r['en'] == en:
            return r['id']
    return None

links = [
    {'name': 'Rock',   'en': 'Rock',   'zh': '岩石',
     'petalId': pos_of('Rock'),   'mobId': mob_pos_of('Rock')},
    {'name': 'Cactus', 'en': 'Cactus', 'zh': '仙人掌',
     'petalId': pos_of('Cactus'), 'mobId': mob_pos_of('Cactus')},
]

registry = {
    'version': 2,
    'source': 'petals: wikipetal.html (Florr.io中文维基 新花瓣图鉴); '
              'mobs: wikimod.html (纯表格, 按真实ID序); tiles/maps: florr.io-Resources',
    'idNote': 'dump 的 petals/N.svg 与 mobs/N.svg 均按各自来源的真实ID升序排列：'
              '文件 N = 来源表中“真实ID=N”的实体（花瓣 1..93 与真实ID一致，94=真实95，'
              '95..116 为二创大编号留空；生物 1..83 与页面ID一致）。'
              'realId(Petal)/id(Mob) 字段记录来源中的真实编号。',
    'note': '生物数值(HP/伤害/类型/各稀有度)已据 wikimod.html 登记；speed/size/tier/color/ai/drops '
            '为基于类型的推算与预留接口，待手填。links 记录“同名生物<->卡片”关联。',
    'petals': petals,
    'mobs': mobs,
    'tiles': tiles,
    'maps': maps,
    'links': links,
}

out = os.path.join(ASSETS, 'registry.js')
with open(out, 'w', encoding='utf-8') as f:
    f.write('// registry.js — 资源登记表（由 scripts/build_manifest.py 生成，可手改）\n')
    f.write('// 花瓣按 wikipetal.html 真实ID升序登记；生物按 wikimod.html 真实ID序登记。\n')
    f.write('// ai / drops 为生物自定义AI与掉落物表预留接口；links 为同名生物<->卡片关联。\n')
    f.write('window.REGISTRY = ')
    f.write(json.dumps(registry, ensure_ascii=False, indent=1))
    f.write(';\n')

print('wrote', out)
print('petals=%d (identified=%d, blanks=%d)  mobs=%d  tiles=%d  maps=%d' % (
    len(petals), sum(1 for p in petals if p['identified']),
    sum(1 for p in petals if not p['identified']), len(mobs), len(tiles), len(maps)))
# 抽查几个关键映射
for chk in [1, 3, 6, 11, 13, 20, 22, 44]:
    p = next((x for x in petals if x['id'] == chk), None)
    if p:
        print('petals/%d.svg -> realId=%s %s(%s)' % (chk, p['realId'], p['name'], p['zh']))
print('mobs=%d (identified=%d, blanks=%d)' % (
    len(mobs), sum(1 for m in mobs if m['identified']),
    sum(1 for m in mobs if not m['identified'])))
for chk in [1, 2, 3, 10, 11]:
    m = next((x for x in mobs if x['id'] == chk), None)
    if m:
        print('mobs/%d.svg -> %s(%s) hp=%s dmg=%s type=%s' % (
            chk, m['name'], m['zh'], m['hp'], m['dmg'], m['type']))
print('links:', links)
print('links:', links)
