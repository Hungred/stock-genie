#!/usr/bin/env python3
"""從 Fugle tickers API 抓台股清單，POST 到 /api/stocks/seed"""

import urllib.request
import json
import os
import sys
import subprocess
import tempfile

FUGLE_KEY = os.environ.get('FUGLE_API_KEY', '')
API_URL = os.environ.get('API_URL', '')
CRON_SECRET = os.environ.get('CRON_SECRET', '')

if not FUGLE_KEY:
    print('ERROR: FUGLE_API_KEY not set', file=sys.stderr)
    sys.exit(1)

def fetch_tickers(exchange):
    url = f'https://api.fugle.tw/marketdata/v1.0/stock/intraday/tickers?type=EQUITY&exchange={exchange}&isNormal=true'
    req = urllib.request.Request(url, headers={'X-API-KEY': FUGLE_KEY})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
        items = data.get('data', [])
        print(f'{exchange}: {len(items)} stocks')
        return [{'code': s['symbol'], 'name': s['name'], 'exchange': exchange} for s in items if s.get('symbol') and s.get('name')]
    except Exception as e:
        print(f'ERROR fetching {exchange}: {e}', file=sys.stderr)
        return []

stocks = fetch_tickers('TWSE') + fetch_tickers('TPEx')
print(f'Total: {len(stocks)} stocks')

if not stocks:
    print('No stocks fetched, exiting', file=sys.stderr)
    sys.exit(1)

# 批次分批 POST（每批 500 筆）
batch_size = 500
total_seeded = 0
for i in range(0, len(stocks), batch_size):
    batch = stocks[i:i + batch_size]
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        json.dump(batch, f)
        tmp_path = f.name
    try:
        result = subprocess.run([
            'curl', '-s', '-X', 'POST',
            f'{API_URL}/api/stocks/seed',
            '-H', 'Content-Type: application/json',
            '-H', f'x-cron-secret: {CRON_SECRET}',
            '-d', f'@{tmp_path}',
            '-w', '\nHTTP %{http_code}'
        ], capture_output=True, text=True)
        print(f'Batch {i//batch_size + 1}: {result.stdout.strip()}')
        if 'HTTP 200' not in result.stdout and 'HTTP 201' not in result.stdout:
            print(f'WARN: unexpected response', file=sys.stderr)
        else:
            total_seeded += len(batch)
    finally:
        os.unlink(tmp_path)

print(f'Done: {total_seeded} stocks seeded')
