# -*- coding: utf-8 -*-
"""粗略 JS 括号配平检查（跳过字符串/注释/正则）。

不是完整解析器，但足以发现 replace 造成的多余/缺失大括号 —— 这类错误
在浏览器里就是整份脚本解析失败（后续所有全局符号都不存在 -> 黑屏）。
"""
import io
import sys
import pathlib

OPEN = {'{': '}', '(': ')', '[': ']'}
CLOSE = {'}': '{', ')': '(', ']': '['}


def scan(path):
    s = io.open(path, encoding='utf-8').read()
    i, n = 0, len(s)
    line = 1
    stack = []
    while i < n:
        c = s[i]
        if c == '\n':
            line += 1
            i += 1
            continue
        # 行注释
        if c == '/' and i + 1 < n and s[i + 1] == '/':
            while i < n and s[i] != '\n':
                i += 1
            continue
        # 块注释
        if c == '/' and i + 1 < n and s[i + 1] == '*':
            i += 2
            while i + 1 < n and not (s[i] == '*' and s[i + 1] == '/'):
                if s[i] == '\n':
                    line += 1
                i += 1
            i += 2
            continue
        # 字符串
        if c in '\'"`':
            q = c
            i += 1
            while i < n:
                if s[i] == '\\':
                    i += 2
                    continue
                if s[i] == q:
                    i += 1
                    break
                if s[i] == '\n':
                    line += 1
                i += 1
            continue
        # 正则字面量：粗略判断（前一个有效字符是 = ( , : [ ! & | ? { } ; return 等）
        if c == '/':
            j = i - 1
            while j >= 0 and s[j] in ' \t':
                j -= 1
            prev = s[j] if j >= 0 else ''
            if prev in '(,=:[!&|?{};+' or prev == '':
                i += 1
                in_cls = False
                while i < n:
                    if s[i] == '\\':
                        i += 2
                        continue
                    if s[i] == '[':
                        in_cls = True
                    elif s[i] == ']':
                        in_cls = False
                    elif s[i] == '/' and not in_cls:
                        i += 1
                        break
                    elif s[i] == '\n':
                        break
                    i += 1
                continue
        if c in OPEN:
            stack.append((OPEN[c], line))
        elif c in CLOSE:
            if not stack:
                print('  %s:%d 多余的 %s' % (path, line, c))
                return False
            want, ln = stack.pop()
            if want != c:
                print('  %s:%d 期望 %s（对应第 %d 行）却遇到 %s' % (path, line, want, ln, c))
                return False
        i += 1
    if stack:
        want, ln = stack[-1]
        print('  %s 未闭合：第 %d 行打开的 %s' % (path, ln, want))
        return False
    return True


ok = True
for p in sys.argv[1:]:
    if scan(p):
        print('  OK  %s' % p)
    else:
        ok = False
sys.exit(0 if ok else 1)
