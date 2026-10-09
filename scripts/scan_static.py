import os, re, json, xml.dom.minidom as M
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILE = os.path.join(ROOT, 'assets', 'static', 'tiles')

files = sorted(f for f in os.listdir(TILE) if f.endswith('.svg'))
empty, broken, ok = [], [], []
for f in files:
    p = os.path.join(TILE, f)
    sz = os.path.getsize(p)
    if sz < 40:
        empty.append((f, sz)); continue
    try:
        M.parse(p)
        ok.append(f)
    except Exception as e:
        broken.append((f, str(e)[:60]))

print('瓦片SVG总数:', len(files), ' 正常:', len(ok), ' 空白(<40B):', len(empty), ' 非法XML:', len(broken))
print('--- 空白文件 ---')
for f, s in empty: print('  ', f, s)
print('--- 非法XML ---')
for f, e in broken: print('  ', f, e)

# 校验 garden.js 引用的瓦片文件都存在
gj = os.path.join(ROOT, 'assets', 'static', 'maps', 'garden.json')
missing = []
if os.path.exists(gj):
    with open(gj, encoding='utf-8') as fh:
        g = json.load(fh)
    for key, src in g['assets']:
        if not os.path.exists(os.path.join(ROOT, src)):
            missing.append(src)
print('garden 引用瓦片缺失:', missing if missing else '无')

# 全仓搜索疑似按钮/UI 资源
print('--- 疑似 UI/按钮 文件 ---')
hits = []
for dp, _, fs in os.walk(os.path.join(ROOT, 'assets')):
    for f in fs:
        fl = f.lower()
        if 'button' in fl or fl.startswith('btn') or 'ui' in fl or 'icon' in fl or 'arrow' in fl or 'close' in fl or 'menu' in fl:
            hits.append(os.path.relpath(os.path.join(dp, f), ROOT))
for h in hits[:40]:
    print('  ', h)
if not hits:
    print('  （未找到明显的按钮/UI 资源）')
