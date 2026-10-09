import re
html = open('wikimod.html', encoding='utf-8', errors='ignore').read()

# 找所有 <tr ...>...</tr> 原始块，打印前3个
trs = re.findall(r'<tr[^>]*>.*?</tr>', html, re.S)
print('总 <tr> 数:', len(trs))
for k in range(min(3, len(trs))):
    print('==== TR %d (前900字符) ====' % k)
    print(trs[k][:900])
    print()

# 在所有 td 里找“ID”列附近的数值：先列出表头行的 th 文本顺序
# 找到第一个含 'ID' 的 th 行，定位列
for tr in trs:
    ths = re.findall(r'<th[^>]*>(.*?)</th>', tr, re.S)
    if ths and any('ID' in re.sub(r'<[^>]+>','',t) for t in ths):
        print('--- 表头行 th 原文 ---')
        for t in ths:
            print('  TH:', re.sub(r'<[^>]+>',' ',t).strip()[:40])
        break
