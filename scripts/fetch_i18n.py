import urllib.request, os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'assets', 'i18n', 'en_US')
os.makedirs(OUT_DIR, exist_ok=True)

BASE = 'https://florr.io/static/i18n/en_US/'
FILES = ['achievements.txt','attributes.txt','changelog.txt','chat.txt','drops.txt',
         'commands.txt','format.txt','maps.txt','mobs.txt','petals.txt',
         'rarities.txt','talents.txt','tutorial.txt','ui.txt']
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

pack = {}
for fn in FILES:
    url = BASE + fn
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        raw = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
    except Exception as e:
        print('ERR', fn, e); continue
    # 保存原始 .txt
    with open(os.path.join(OUT_DIR, fn), 'w', encoding='utf-8') as f:
        f.write(raw)
    # 解析 key=value（# 开头为注释；按首个 = 切分）
    ns = fn[:-4]  # 去掉 .txt，作为命名空间前缀（与官方 key 风格一致）
    for line in raw.splitlines():
        s = line.strip()
        if not s or s.startswith('#'):
            continue
        if '=' not in s:
            continue
        k, v = s.split('=', 1)
        key = k.strip()
        if not key:
            continue
        # 带命名空间，避免不同文件 key 冲突（官方文件内 key 已含路径，这里再加文件前缀更稳）
        full = key if '/' in key else (ns + '/' + key)
        pack[full] = v

print('下载文件数:', len([f for f in FILES if os.path.exists(os.path.join(OUT_DIR, f))]))
print('总词条数:', len(pack))

# 写出 JS 包
js = 'window.I18N_EN = ' + json.dumps(pack, ensure_ascii=False, indent=0) + ';\n'
with open(os.path.join(OUT_DIR, 'en_US.js'), 'w', encoding='utf-8') as f:
    f.write(js)
print('已写出 assets/i18n/en_US/en_US.js')

# 打印几个用于映射的样例
for probe in ['rarities.txt', 'petals.txt', 'mobs.txt', 'ui.txt']:
    p = os.path.join(OUT_DIR, probe)
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            lines = [l for l in f.read().splitlines() if l.strip() and not l.startswith('#')]
        print('\n==== %s (前 12 条) ====' % probe)
        for l in lines[:12]:
            print('  ', l[:90])
