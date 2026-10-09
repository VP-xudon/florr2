import re
html = open('wikimod.html', encoding='utf-8', errors='ignore').read()
# 取第一个 <tr> 数据行（含数字ID），打印全部单元格
rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.S)
def clean(c):
    return ' '.join(re.sub(r'<[^>]+>', ' ', c).split()).strip()
for row in rows:
    # 找含 'Rock' 的行（ID=1）
    if 'Rock' in row and re.search(r'<th[^>]*>\d+</th>', row):
        cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', row, re.S)
        print('单元格总数:', len(cells))
        for i, c in enumerate(cells):
            t = clean(c)
            print('%2d | %s' % (i, t[:50]))
        break
