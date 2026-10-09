import re
html = open('wikimod.html', encoding='utf-8', errors='ignore').read()
print('file size:', len(html))
m = re.search(r'id="mw-content-text"', html)
body = html[m.start():] if m else html
print('content start found:', bool(m))

# 表格表头（th）
ths = re.findall(r'<th[^>]*>(.*?)</th>', body, re.S)
ths_clean = [re.sub(r'<[^>]+>', '', t).strip() for t in ths]
print('--- 表头列(前30) ---')
print(ths_clean[:30])

# 所有 <tr> 中第一格为数字的行
rows = re.findall(r'<tr[^>]*>\s*<td[^>]*>(\d+)</td>(.*?)</tr>', body, re.S)
print('行数(第一格为数字):', len(rows))

def clean(td):
    t = re.sub(r'<[^>]+>', ' ', td)
    return ' '.join(t.split()).strip()

print('--- 前6行各列 ---')
for rid, row in rows[:6]:
    tds = re.findall(r'<td[^>]*>(.*?)</td>', row, re.S)
    print('ID', rid)
    for j, td in enumerate(tds):
        print('   [%d]' % j, clean(td)[:70])
    print()
