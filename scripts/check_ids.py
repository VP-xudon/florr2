import re
html = open('wikipetal.html', encoding='utf-8', errors='ignore').read()
m = re.search(r'id="mw-content-text"', html)
body = html[m.start():]
ids = []
for r in re.finditer(r'<tr[^>]*>\s*<td[^>]*>(\d+)</td>', body):
    ids.append(int(r.group(1)))
ids = sorted(set(ids))
print('页面出现的全部ID数量:', len(ids))
print('是否有 19:', 19 in ids, ' 是否有 43:', 43 in ids, ' 是否有 21:', 21 in ids)
print('缺失的<100的ID(前若干):', [i for i in range(1, 100) if i not in ids][:40])
print('ID最大值(正常<1000):', max(i for i in ids if i < 1000),
      ' 大编号最小:', min(i for i in ids if i >= 1000))
