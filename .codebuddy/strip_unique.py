# -*- coding: utf-8 -*-
# 一次性清理：移除代码中所有 unique 稀有度的残留（用户口径：本项目没有 unique 档）
import io, re, pathlib
ROOT = pathlib.Path(r'd:/VP-xudon/florr2')

ROW = re.compile(r'^\s*unique\s*:.*$')

def clean_lines(path, extra=None):
    p = ROOT / path
    s = io.open(p, encoding='utf-8').read()
    lines = s.split('\n')
    out = []
    removed = 0
    for ln in lines:
        if ROW.match(ln):
            removed += 1
            continue
        out.append(ln)
    s = '\n'.join(out)
    if extra:
        for a, b in extra:
            if a not in s:
                print('  !! 未命中:', path, repr(a[:60]))
            s = s.replace(a, b)
    io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
    print(path, 'removed rows:', removed)

clean_lines('js/data.js', [
    # 魔法变种的稀有度映射（unique: 'super'）
    (", unique: 'super'", ''),
    # registry 解析里的 unique 特例
    ("if (rk !== 'unique' && RARITY_ORDER.indexOf(rk) < 0) continue;   // Unique 可作为扩展档登记，但不进入当前档位序列",
     "if (RARITY_ORDER.indexOf(rk) < 0) continue;"),
    ("if (rk !== 'unique' && RARITY_ORDER.indexOf(rk) < 0) continue;",
     "if (RARITY_ORDER.indexOf(rk) < 0) continue;"),
    # Basil 百分比注释
    ("Mythic 45% → Unique 60%", "Mythic 45% → Eternal 60%"),
])

clean_lines('js/sim/constants.js', [
    ("  eternal: [0.92, 0.08], unique: [0.92, 0.08]", "  eternal: [0.92, 0.08]"),
])

clean_lines('js/sim/drops.js', [
    ("const DROP_FX_CONT = new Set(['ultra', 'super', 'eternal', 'unique']);",
     "const DROP_FX_CONT = new Set(['ultra', 'super', 'eternal']);"),
])

clean_lines('js/sim/mob-shape.js', [
    ("const order = ['common', 'unusual', 'rare', 'epic', 'legendary', 'mythic', 'ultra', 'super', 'eternal', 'unique'];",
     "const order = ['common', 'unusual', 'rare', 'epic', 'legendary', 'mythic', 'ultra', 'super', 'eternal'];"),
])

clean_lines('js/ui.js', [
    ("    ultra: 0.02, super: 0.01, eternal: 0.001, unique: 0.001",
     "    ultra: 0.02, super: 0.01, eternal: 0.001"),
    ("  // unique 与 eternal 同档（时长/粒子数都以 eternal 计）\n  return (target === 'unique') ? 'eternal' : target;",
     "  return target;"),
])

clean_lines('js/chat.js', [
    ("rarity 为官方稀有度（common..unique）", "rarity 为官方稀有度（common..eternal）"),
])

clean_lines('js/sim/player.js', [
    ("// ultra / super / eternal / unique 顺势等比。", "// ultra / super / eternal 顺势等比。"),
])
