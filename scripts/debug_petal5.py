import re
html = open('wikipetal.html', encoding='utf-8', errors='ignore').read()
def clean(c):
    return ' '.join(re.sub(r'<[^>]+>', ' ', c).split()).strip()
blocks = re.findall(r'<table[^>]*>.*?</table>', html, re.S)
rows = []
for b in blocks:
    for r in re.findall(r'<tr[^>]*>(.*?)</tr>', b, re.S):
        cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', r, re.S)
        if len(cells) >= 3:
            rows.append((clean(cells[0]), clean(cells[1]), clean(cells[2])))
byid = {}
for a,b,c in rows:
    m = re.fullmatch(r'\d+', a.replace('\u200b','').strip())
    if m:
        n = int(m.group(0))
        if 1 <= n <= 116:
            byid.setdefault(n, (a,b,c))
present = sorted(byid)
missing = [i for i in range(1,117) if i not in byid]
print('ID在1..116且纯数值的条目数:', len(present))
print('缺失(1..116):', missing)
for i in [1,2,3,4,5,6,7,11,22,44,90,91,94,95,100,116]:
    if i in byid: print('  ID',i,'->',byid[i][2], byid[i][1])
    else: print('  ID',i,'-> 缺失')
