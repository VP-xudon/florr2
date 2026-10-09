import re

html = open('wikipetal.html', encoding='utf-8', errors='ignore').read()

# 定位正文区域
m = re.search(r'id="mw-content-text"', html)
start = m.start() if m else 0
body = html[start:]

# 找几个已知花瓣名，在正文中打印上下文
for name in ['Leaf', 'Stinger', 'Rock', 'Bubble', 'Cactus', 'Web',
             'Peas', 'Pincer', 'Wing', 'Orange', 'Lotus', 'Iris',
             'Dandelion', 'Honey', 'Jelly', 'Bone', 'Moon', 'Heart',
             'Fin', 'Claw', 'Scale', 'Salt', 'Pepper', 'Egg', 'Antennae']:
    i = body.find(name)
    if i != -1:
        seg = body[max(0, i-160): i+160]
        # 去掉换行便于看
        seg = ' '.join(seg.split())
        print('=== %s ===' % name)
        print(seg)
        print()
