import re
html = open('wikipetal.html', encoding='utf-8', errors='ignore').read()

def clean(c):
    return ' '.join(re.sub(r'<[^>]+>', ' ', c).split()).strip()

blocks = re.findall(r'<table[^>]*>.*?</table>', html, re.S)
print('完整<table>块数:', len(blocks))
for bi, block in enumerate(blocks):
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', block, re.S)
    print('--- 表 %d: TR数=%d ---' % (bi, len(rows)))
    # 打印前3行单元格数 & 首格
    for row in rows[:3]:
        cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', row, re.S)
        print('   cells=%d first=%s' % (len(cells), clean(cells[0])[:20] if cells else ''))

# 重点分析表2（6列：ID,中文名,英文名,图片,英文简介,中文简介）
if len(blocks) >= 2:
    t2 = blocks[1]
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', t2, re.S)
    numeric=[]; special=[]
    alldata=[]
    for row in rows:
        cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', row, re.S)
        if len(cells) < 4: continue
        rid = clean(cells[0])
        zh = clean(cells[1])
        en = clean(cells[2])
        img = re.search(r'src="([^"]+)"', cells[3])
        img = img.group(1) if img else clean(cells[3])[:20]
        if re.fullmatch(r'\d+', rid):
            numeric.append(int(rid))
            alldata.append((int(rid), zh, en, img))
        else:
            if rid not in ('ID','中文名称'): special.append(rid)
    numeric.sort()
    print('\n表2 数值ID数:', len(numeric), '特殊ID样例:', special[:15])
    print('数值ID范围 %d..%d 缺失(<max):' % (min(numeric),max(numeric)), [i for i in range(1,max(numeric)+1) if i not in numeric][:40])
    print('前12:', alldata[:12])
    print('后6:', alldata[-6:])
