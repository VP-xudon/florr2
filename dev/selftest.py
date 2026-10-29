#!/usr/bin/env python3
"""florr2 自测入口（零依赖，只用标准库）。

用法:
    python dev/selftest.py                      # 起 http.server:8080 + 无头 Chrome/Edge(CDP)
    python dev/selftest.py --port 8081
    python dev/selftest.py --browser edge
    python dev/selftest.py --mode dump          # 回退：virtual-time + --dump-dom（计时不可信）
    python dev/selftest.py --url http://127.0.0.1:8080/?selftest=1   # 复用已启动的服务器

流程: 启动静态服务器 -> 无头浏览器打开 ?selftest=1 -> 轮询页面写回的 JSON -> 打印明细并返回退出码。
CDP 模式用真实时间，performance.now 可信；dump 模式仅保证异步流程跑完（计时恒 0），用于排查页面崩溃。
"""

from __future__ import annotations

import argparse
import base64
import functools
import hashlib
import html
import http.server
import json
import os
import re
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESULT_RE = re.compile(r'id="selftest-result"[^>]*>(.*?)</script>', re.S | re.I)
RESULT_EXPR = (
    "(() => { const el = document.getElementById('selftest-result');"
    " return el ? el.textContent : ''; })()"
)

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
]


def find_browser(prefer: str | None) -> str:
    env = os.environ.get("FLORR_BROWSER")
    named = [prefer or env] if (prefer or env) else []
    for cand in named:
        if os.path.isfile(cand):
            return cand
        found = shutil.which(cand)
        if found:
            return found
    for cand in CHROME_CANDIDATES:
        if os.path.isfile(cand):
            return cand
    raise SystemExit(
        "未找到 Chrome/Edge。请用 --browser <可执行文件路径> 指定，或设置 FLORR_BROWSER。"
    )


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):  # 静默访问日志，避免淹没自测输出
        pass


def serve(directory: Path, port: int):
    handler = functools.partial(QuietHandler, directory=str(directory))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# ---------------------------------------------------------------- 最小 WebSocket 客户端
class WebSocket:
    """只实现 CDP 需要的最小子集：文本帧发送、文本/关闭/心跳帧接收。"""

    def __init__(self, url: str, timeout: float = 30.0):
        assert url.startswith("ws://"), url
        hostport, path = url[5:].split("/", 1)
        host, port = hostport.split(":")
        self.sock = socket.create_connection((host, int(port)), timeout=timeout)
        self.sock.settimeout(timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise RuntimeError("WebSocket 握手失败：连接被关闭")
            buf += chunk
        head, _, self._buf = buf.partition(b"\r\n\r\n")
        status = head.split(b"\r\n", 1)[0].decode(errors="replace")
        if " 101 " not in status:
            raise RuntimeError("WebSocket 握手失败: " + status)

    def _read_exact(self, n: int) -> bytes:
        while len(self._buf) < n:
            chunk = self.sock.recv(max(4096, n - len(self._buf)))
            if not chunk:
                raise RuntimeError("WebSocket 连接已关闭")
            self._buf += chunk
        out, self._buf = self._buf[:n], self._buf[n:]
        return out

    def send(self, obj: dict) -> None:
        data = json.dumps(obj).encode()
        header = bytearray([0x81])  # FIN + text
        mask = os.urandom(4)
        n = len(data)
        if n < 126:
            header.append(0x80 | n)
        elif n < 65536:
            header.append(0x80 | 126)
            header += struct.pack(">H", n)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", n)
        header += mask
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        self.sock.sendall(bytes(header) + masked)

    def recv(self) -> dict | None:
        payload = b""
        while True:
            b1, b2 = self._read_exact(2)
            fin = b1 & 0x80
            opcode = b1 & 0x0F
            masked = b2 & 0x80
            length = b2 & 0x7F
            if length == 126:
                length = struct.unpack(">H", self._read_exact(2))[0]
            elif length == 127:
                length = struct.unpack(">Q", self._read_exact(8))[0]
            mask = self._read_exact(4) if masked else None
            data = self._read_exact(length)
            if mask:
                data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
            if opcode == 0x8:      # close
                raise RuntimeError("WebSocket 被对端关闭")
            if opcode == 0x9:      # ping -> pong
                self.sock.sendall(bytes([0x8A, 0x80]) + os.urandom(4))
                continue
            if opcode == 0xA:      # pong
                continue
            payload += data
            if fin:
                break
        try:
            return json.loads(payload.decode())
        except Exception:
            return None

    def close(self) -> None:
        try:
            self.sock.close()
        except OSError:
            pass


class CDP:
    def __init__(self, ws: WebSocket):
        self.ws = ws
        self._id = 0

    def call(self, method: str, params: dict | None = None, timeout: float = 30.0):
        self._id += 1
        mid = self._id
        self.ws.send({"id": mid, "method": method, "params": params or {}})
        end = time.time() + timeout
        while time.time() < end:
            msg = self.ws.recv()
            if msg and msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method} 失败: {msg['error']}")
                return msg.get("result", {})
        raise TimeoutError(f"{method} 超时")

    def eval(self, expr: str):
        r = self.call("Runtime.evaluate", {
            "expression": expr, "returnByValue": True, "awaitPromise": False,
        }, timeout=20)
        res = r.get("result", {})
        if res.get("subtype") == "error":
            raise RuntimeError("脚本执行错误: " + str(res.get("description", "")))
        return res.get("value")


def http_json(url: str, timeout: float = 2.0):
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def wait_cdp(port: int, timeout: float = 25.0):
    end = time.time() + timeout
    while time.time() < end:
        try:
            return http_json(f"http://127.0.0.1:{port}/json/list")
        except Exception:
            time.sleep(0.2)
    return None


def run_cdp(browser: str, url: str, budget_ms: int) -> tuple[dict | None, str]:
    """用 CDP 驱动真实时间运行，轮询页面写回的结果。返回 (report, 诊断信息)。"""
    port = free_port()
    budget = max(1.0, budget_ms / 1000.0)
    # ignore_cleanup_errors：Windows 上 Chrome 退出后 Crashpad 还会短暂占着 profile 里的文件，
    # 清不掉会抛 PermissionError 把【已经跑完的】结果一起吞掉（表现为"自测卡在清理阶段"）。
    with tempfile.TemporaryDirectory(prefix="florr2-selftest-", ignore_cleanup_errors=True) as profile:
        proc = subprocess.Popen(
            [
                browser, "--headless=new", "--disable-gpu", "--no-sandbox",
                "--no-first-run", "--no-default-browser-check", "--disable-extensions",
                "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
                "--mute-audio", "--hide-scrollbars",
                "--remote-allow-origins=*",
                f"--remote-debugging-port={port}",
                f"--user-data-dir={profile}",
                "about:blank",
            ],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        ws = None
        try:
            targets = wait_cdp(port)
            if not targets:
                return None, "CDP 端口未就绪（浏览器可能启动失败）"
            page = next((t for t in targets if t.get("type") == "page"), None)
            if not page:
                return None, "未找到可用的 page target"
            ws = WebSocket(page["webSocketDebuggerUrl"])
            cdp = CDP(ws)
            cdp.call("Page.enable")
            cdp.call("Runtime.enable")
            cdp.call("Page.navigate", {"url": url})

            end = time.time() + budget
            while time.time() < end:
                try:
                    raw = cdp.eval(RESULT_EXPR)
                except Exception:
                    raw = ""
                if raw:
                    return json.loads(raw), ""
                time.sleep(0.25)

            # 超时：尽量给出可排查的现场
            try:
                diag = cdp.eval(
                    "JSON.stringify({title: document.title, ready: document.readyState,"
                    " hasGame: !!window.__game, errors: (window.__selftestErrors||[]).slice(0,5)})"
                )
            except Exception as e:
                diag = "读取诊断失败: " + str(e)
            return None, f"等待结果超时 {budget:.0f}s；现场: {diag}"
        finally:
            if ws:
                ws.close()
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()


def run_dump(browser: str, url: str, budget_ms: int, timeout: int) -> tuple[dict | None, str]:
    """回退路径：virtual-time + --dump-dom。能跑完流程，但 performance.now 被虚拟化。"""
    with tempfile.TemporaryDirectory(prefix="florr2-selftest-") as profile:
        cmd = [
            browser, "--headless=new", "--disable-gpu", "--no-sandbox",
            "--no-first-run", "--no-default-browser-check", "--disable-extensions",
            "--disable-background-timer-throttling", "--mute-audio", "--hide-scrollbars",
            "--user-data-dir=" + profile,
            f"--virtual-time-budget={budget_ms}",
            "--dump-dom", url,
        ]
        p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=timeout)
    m = RESULT_RE.search(p.stdout or "")
    if not m:
        return None, (p.stderr or "").strip()[-1500:]
    try:
        return json.loads(html.unescape(m.group(1)).strip()), ""
    except json.JSONDecodeError as e:
        return None, f"结果 JSON 解析失败: {e}"


def compare_baseline(report: dict, path: str) -> None:
    try:
        base = json.loads(Path(path).read_text(encoding="utf-8"))
        base = base.get("report", base)
    except Exception as e:
        print(f"[baseline] 读取失败: {e}")
        return
    cur, old = report.get("perf") or {}, base.get("perf") or {}
    for kind in ("update", "updateRender"):
        a, b = old.get(kind), cur.get(kind)
        if not a or not b:
            continue
        delta = ((b["p95Ms"] - a["p95Ms"]) / a["p95Ms"] * 100) if a["p95Ms"] else 0.0
        arrow = "↑" if delta > 0 else "↓"
        print(f"[baseline] {kind} p95 {a['p95Ms']}ms -> {b['p95Ms']}ms ({arrow}{abs(delta):.1f}%)")
    sa, sb = base.get("stats") or {}, report.get("stats") or {}
    for key in ("mobs", "drops", "petals"):
        if key in sa and key in sb:
            print(f"[baseline] {key} {sa[key]} -> {sb[key]}")


def print_report(report: dict) -> None:
    checks = report.get("checks") or []
    failed = [c for c in checks if not c.get("ok")]
    for c in checks:
        mark = "PASS" if c.get("ok") else "FAIL"
        detail = f"  ({c['detail']})" if c.get("detail") else ""
        print(f"[{mark}] {c.get('name')}{detail}")

    env = report.get("env") or {}
    if env:
        print("[ENV] " + json.dumps(env, ensure_ascii=False))

    perf = report.get("perf") or {}
    for kind, label in (("update", "update-only"), ("updateRender", "update+render")):
        p = perf.get(kind)
        if p:
            print(
                f"[PERF] {label}: frames={p['frames']} avg={p['avgMs']}ms "
                f"p50={p['p50Ms']}ms p95={p['p95Ms']}ms max={p['maxMs']}ms"
            )

    stats = report.get("stats") or {}
    if stats:
        print("[STATS] " + json.dumps(stats, ensure_ascii=False))
    after = report.get("statsAfter") or {}
    if after:
        print("[STATS:after] " + json.dumps(after, ensure_ascii=False))

    for e in (report.get("errors") or [])[:10]:
        print(f"[ERROR] {e}")

    print(f"\n结果: {'PASS' if report.get('ok') and not failed else 'FAIL'} "
          f"({len(checks) - len(failed)}/{len(checks)} 项通过)")


def main() -> int:
    ap = argparse.ArgumentParser(description="florr2 页面自测")
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--browser", default=None, help="浏览器可执行文件或命令名")
    ap.add_argument("--url", default=None, help="复用已有服务器时直接给完整 URL")
    ap.add_argument("--mode", choices=["cdp", "dump"], default="cdp")
    ap.add_argument("--budget", type=int, default=60000, help="页面预算毫秒")
    ap.add_argument("--timeout", type=int, default=180, help="dump 模式的进程超时秒数")
    ap.add_argument("--json", default=None, help="把完整报告写入文件（用于建立基线）")
    ap.add_argument("--baseline", default=None, help="与已有报告对比性能与统计")
    args = ap.parse_args()

    browser = find_browser(args.browser)
    httpd = None
    if args.url:
        url = args.url
    else:
        try:
            httpd = serve(ROOT, args.port)
        except OSError as e:
            print(f"无法监听 127.0.0.1:{args.port} ({e})；换 --port，或自行启动服务器后用 --url。",
                  file=sys.stderr)
            return 2
        url = f"http://127.0.0.1:{args.port}/?selftest=1"

    print(f"[selftest] browser={browser}")
    print(f"[selftest] url={url}  mode={args.mode}")
    started = time.time()
    try:
        if args.mode == "cdp":
            report, diag = run_cdp(browser, url, args.budget)
        else:
            report, diag = run_dump(browser, url, args.budget, args.timeout)
    finally:
        if httpd is not None:
            httpd.shutdown()
            httpd.server_close()

    elapsed = time.time() - started
    if report is None:
        print(f"未拿到自检结果（耗时 {elapsed:.1f}s）。{diag}")
        return 3

    print_report(report)
    if args.baseline:
        compare_baseline(report, args.baseline)
    if args.json:
        out = Path(args.json)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[selftest] 报告已写入 {out}")
    ok = bool(report.get("ok")) and all(c.get("ok") for c in report.get("checks") or [])
    print(f"[selftest] 耗时 {elapsed:.1f}s")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
