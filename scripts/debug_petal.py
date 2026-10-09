import re
html = open('wikipetal.html', encoding='utf-8', errors='ignore').read()
print('文件大小', len(html))
# 表头结构
ths = re.findall(r'<th[^>]*>(.*?)</th>', html, re.S)
print('TH 数量', len(ths))
print('前 30 个 TH 文本:')
for t in ths[:30]:
    txt = ' '.join(re.sub(r'<[^>]+>', ' ', t).split()).strip()
    print('  ', txt[:40])
# 表数量
tables = re.findall(r'<table[^>]*>', html)
print('TABLE 数量', len(tables))
# 第一个数据行样本
rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.S)
print('TR 数量', len(rows))
# 找含 'Basic' 或 'Leaf' 的行
for row in rows[:5]:
    cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', row, re.S)
    print('  行单元格数', len(cells), [ ' '.join(re.sub(r"<[^>]+>"," ",c).split()).strip()[:12] for c in cells[:8]])
