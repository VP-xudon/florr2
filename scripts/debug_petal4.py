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
# 仅数据行（首格像 ID）
def is_id(s):
    return bool(re.search(r'\d', s))
data = [(a,b,c) for (a,b,c) in rows if is_id(a)]
print('合并数据行总数:', len(data))
# 打印全部 raw id + en
for i,(a,b,c) in enumerate(data):
    mark = ''
    if not re.fullmatch(r'\d+', a.replace('\u200b','').replace(' ','')):
        mark = '  <-- 变体'
    print('%3d | %-12s | %-10s %s%s' % (i+1, a, c, b, mark))
