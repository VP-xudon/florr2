import re
html = open('wikipetal.html', encoding='utf-8', errors='ignore').read()

def clean(c):
    return ' '.join(re.sub(r'<[^>]+>', ' ', c).split()).strip()

tables = re.split(r'<table[^>]*>', html, re.S)
print('表数量(含分割):', len(tables)-1)
# 第一个表是花瓣表
t1 = tables[1]
rows = re.findall(r'<tr[^>]*>(.*?)</tr>', t1, re.S)
print('花瓣表 TR 数:', len(rows))
numeric=[]; special=[]
samples=[]
for row in rows:
    cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', row, re.S)
    if len(cells) < 5: continue
    rid = clean(cells[0])
    en = clean(cells[2])
    zh = clean(cells[1])
    if re.fullmatch(r'\d+', rid):
        numeric.append(int(rid))
        if len(samples) < 6:
            # 打印稀有度列内容
            rar = [clean(cells[i])[:18] for i in range(5, min(14,len(cells)))]
            samples.append((rid, zh, en, rar))
    else:
        special.append(rid)
print('数值ID数:', len(numeric), '特殊ID:', special[:20])
allids = sorted(numeric)
missing = [i for i in range(1, max(allids)+1) if i not in allids]
print('数值ID 范围 %d..%d, 缺失(<max):' % (min(allids), max(allids)), missing[:30])
print('--- 样本（ID, 中文, 英文, 各稀有度列）---')
for s in samples: print(s)
# 找一个稀有度列有内容的行
for row in rows:
    cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', row, re.S)
    if len(cells) < 14: continue
    rar = [clean(cells[i]) for i in range(5,14)]
    if any(rar):
        print('有数据行 ID=%s zh=%s en=%s' % (clean(cells[0]), clean(cells[1]), clean(cells[2])))
        for i,c in enumerate(rar): print('   rarity%d: %s' % (i, c[:40]))
        break
