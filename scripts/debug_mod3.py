import re
html = open('wikimod.html', encoding='utf-8', errors='ignore').read()
rows = re.findall(r'<tr[^>]*>\s*<t[hd][^>]*>(\d+)</t[hd]>(.*?)</tr>', html, re.S)
print('匹配数据行数:', len(rows))
# 取 ID=1 的行，打印前8个单元格原始内容
for rid, row in rows:
    if int(rid) == 1:
        cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', row, re.S)
        print('ID=1 单元格数:', len(cells))
        for i, c in enumerate(cells[:8]):
            print('  cell[%d] =' % i, repr(c[:120]))
        break
