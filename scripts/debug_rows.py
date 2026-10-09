import re
html = open('wikipetal.html', encoding='utf-8', errors='ignore').read()
m = re.search(r'id="mw-content-text"', html)
body = html[m.start():]
rows = re.findall(r'<tr[^>]*>\s*<td[^>]*>(\d+)</td>(.*?)</tr>', body, re.S)
for rid, row in rows:
    if int(rid) in (19, 21, 43, 95, 94):
        print('==== ID', rid, '====')
        # 打印所有 td 的文本（去标签）
        for td in re.findall(r'<td[^>]*>(.*?)</td>', row, re.S):
            txt = ' '.join(re.sub(r'<[^>]+>', ' ', td).split()).strip()
            if txt:
                print('  TD:', txt[:80])
        print()
