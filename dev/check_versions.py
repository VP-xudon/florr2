#!/usr/bin/env python3
"""静态一致性检查（零依赖）：拆分/重构后最容易踩的三类坑。

1. index.html 引用的脚本/样式是否都存在、是否有重复引用；
2. 跨文件顶层声明是否重名 —— 经典脚本共享全局词法环境，
   两个文件都写 `const X` 会直接 SyntaxError（`function X` 则是静默覆盖）；
3. index.html 的 ?v= 与 js/util.js 的 ASSET_VER 是否被改动（配合 git status 提示）。

用法:
    python dev/check_versions.py
    python dev/check_versions.py --strict   # 把 warning 也当失败
"""

from __future__ import annotations

import argparse
import io
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT_RE = re.compile(r'<script[^>]+src="([^"?]+)(?:\?v=(\d+))?"', re.I)
LINK_RE = re.compile(r'<link[^>]+href="([^"?]+)(?:\?v=(\d+))?"', re.I)
# 只认行首声明：IIFE / 方法体内的缩进行为不算全局
TOP_DECL_RE = re.compile(r'^(const|let|class|function)\s+([A-Za-z_$][\w$]*)', re.M)

errors: list[str] = []
warns: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warns.append(msg)


def read(path: Path) -> str:
    with io.open(path, "r", encoding="utf-8", newline="") as f:
        return f.read()


def check_index() -> list[Path]:
    index = ROOT / "index.html"
    html = read(index)
    refs: list[tuple[str, str | None]] = SCRIPT_RE.findall(html) + LINK_RE.findall(html)
    seen: dict[str, int] = {}
    scripts: list[Path] = []
    for ref, ver in refs:
        if ref.startswith(("http://", "https://", "//")):
            continue
        p = (ROOT / ref).resolve()
        if not p.is_file():
            err(f"index.html 引用了不存在的文件: {ref}")
            continue
        if ref.endswith(".js"):
            scripts.append(p)
        seen[ref] = seen.get(ref, 0) + 1
        if not ver:
            warn(f"{ref} 没有 ?v= 缓存版本号")
    for ref, n in seen.items():
        if n > 1:
            err(f"index.html 重复引用: {ref}（{n} 次）")
    return scripts


def check_globals(scripts: list[Path]) -> None:
    lexical: dict[str, str] = {}     # const/let/class -> 文件
    funcs: dict[str, str] = {}
    for path in scripts:
        rel = path.relative_to(ROOT).as_posix()
        text = read(path)
        # 去掉块注释，避免注释里的 "function xxx" 误判
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
        for kind, name in TOP_DECL_RE.findall(text):
            if kind == "function":
                if name in funcs and funcs[name] != rel:
                    warn(f"全局函数重名（后者静默覆盖前者）: {name}  [{funcs[name]} -> {rel}]")
                funcs[name] = rel
            else:
                if name in lexical and lexical[name] != rel:
                    err(f"顶层 {kind} 重名（会直接 SyntaxError）: {name}  [{lexical[name]} 与 {rel}]")
                lexical[name] = rel


def check_i18n(scripts: list[Path]) -> None:
    # 官方语言包 + 项目自建增量包（js/i18n-extra.js）都算"已定义"
    packs = list((ROOT / "assets" / "i18n").glob("*/*.js"))
    extra = ROOT / "js" / "i18n-extra.js"
    if extra.is_file():
        packs = packs + [extra]
    pack_text = "".join(read(p) for p in packs if p.is_file())
    if not pack_text:
        warn("未找到语言包，跳过 i18n key 检查")
        return
    used: dict[str, str] = {}
    for path in scripts:
        rel = path.relative_to(ROOT).as_posix()
        text = read(path)
        for key in re.findall(r"I18N\.(?:t|tf|opt)\(\s*'([^']+)'", text):
            if key.endswith("/"):
                continue      # 运行时拼接的前缀（'Petals/' + slug），无法静态校验
            used.setdefault(key, rel)
    missing = [k for k in used if f"'{k}'" not in pack_text and f'"{k}"' not in pack_text]
    # UI 里存在少量"运行时拼接"的键，这里只提示不报错
    for k in missing[:20]:
        warn(f"i18n 键未在语言包中找到: {k}  ({used[k]})")
    if len(missing) > 20:
        warn(f"...另有 {len(missing) - 20} 个未匹配的 i18n 键")


def check_asset_ver() -> None:
    util = ROOT / "js" / "util.js"
    if not util.is_file():
        return
    m = re.search(r"ASSET_VER\s*=\s*(\d+)", read(util))
    if m:
        print(f"[info] ASSET_VER = {m.group(1)}")


def check_git() -> None:
    """提醒：改过的 js/css 是否同时改了 index.html 的版本号。"""
    try:
        out = subprocess.run(
            ["git", "status", "--porcelain"], cwd=str(ROOT),
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15
        ).stdout
    except Exception:
        return
    changed = []
    for line in out.splitlines():
        path = line[3:].strip().strip('"')
        if path.endswith((".js", ".css")) and not path.startswith("dev/"):
            if path != "index.html":
                changed.append(path)
    if changed and "index.html" not in out:
        warn("有 js/css 改动但 index.html 未改动，确认是否漏 bump ?v=")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true", help="warning 也视为失败")
    args = ap.parse_args()

    scripts = check_index()
    check_globals(scripts)
    check_i18n(scripts)
    check_asset_ver()
    check_git()

    for w in warns:
        print("[WARN] " + w)
    for e in errors:
        print("[FAIL] " + e)
    print(f"\n检查完成: {len(scripts)} 个脚本，{len(errors)} 个错误，{len(warns)} 个警告")
    if errors:
        return 1
    return 1 if (args.strict and warns) else 0


if __name__ == "__main__":
    sys.exit(main())
