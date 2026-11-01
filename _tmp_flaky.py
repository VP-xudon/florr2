# -*- coding: utf-8 -*-
import json
import os
import subprocess

for f in ('_tmp_r8340.json', '_tmp_r8341.json', '_tmp_r8342.json'):
    if os.path.exists(f):
        os.remove(f)

fails = {}
for port in (8350, 8351, 8352, 8353):
    subprocess.run(
        ['python', 'dev/selftest.py', '--port', str(port), '--json', f'_tmp_r{port}.json'],
        capture_output=True, timeout=300)
    d = json.load(open(f'_tmp_r{port}.json', encoding='utf-8'))
    for c in d.get('checks', []):
        if not c.get('ok'):
            fails.setdefault(c['name'], 0)
            fails[c['name']] += 1
    print(port, 'ok=', d.get('ok'), 'checks=', len(d.get('checks', [])))
for k, v in fails.items():
    print('FLAKY', v, k.encode('unicode_escape').decode('ascii')[:60])
