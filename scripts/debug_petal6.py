import re
html = open('wikipetal.html', encoding='utf-8', errors='ignore').read()
def clean(c):
    return ' '.join(re.sub(r'<[^>]+>', ' ', c).split()).strip()
blocks = re.findall(r'<table[^>]*>.*?</table>', html, re.S)
seq = []
for b in blocks:
    for r in re.findall(r'<tr[^>]*>(.*?)</tr>', b, re.S):
        cells = re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', r, re.S)
        if len(cells) < 3: continue
        a = clean(cells[0])
        m = re.fullmatch(r'\d+', a.replace('\u200b','').strip())
        if m:
            seq.append((int(m.group(0)), clean(cells[2])))
print('纯整数行数:', len(seq))
print('ID集合是否连续 1..', max(i for i,_ in seq))
ids = [i for i,_ in seq]
# 找出不在1..116但出现的大ID
big = [x for x in ids if x>116]
print('大于116的ID:', big)
# 打印前100的ID序列看是否有跳跃
print('前 100 行的 (序号, ID, 名):')
for idx,(i,n) in enumerate(seq[:100],1):
    print('%3d -> ID=%s %s' % (idx, i, n))
