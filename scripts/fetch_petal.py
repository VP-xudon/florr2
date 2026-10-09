import urllib.request, re, os

base = 'https://florrio.fandom.com/zh/wiki/%E4%BA%8C/%E6%96%B0%E8%8A%B1%E7%93%A3%E5%9B%BE%E9%89%B4/%E8%8A%B1%E7%93%A3ID%E5%88%86%E9%85%8D%E5%88%97%E8%A1%A8'
urls = [base + '?action=raw', base]
out = []
for url in urls:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        data = urllib.request.urlopen(req, timeout=20).read()
        html = data.decode('utf-8', 'ignore')
        out.append('==== ' + url + ' len=' + str(len(html)) + ' ====')
        # 提取形如 "1 Leaf" / "|1|Leaf" / "1=Leaf" 的行
        for line in html.splitlines():
            if re.search(r'\b(\d{1,4})\b', line) and re.search(r'[A-Za-z\u4e00-\u9fff]{2,}', line):
                out.append(line.strip()[:200])
    except Exception as e:
        out.append('ERR ' + repr(e))

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(root, 'scripts', 'petal_raw.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
print('done')
