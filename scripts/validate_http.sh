#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://127.0.0.1:8096}"
echo "=== HEALTH ==="
curl -sS --max-time 8 "$BASE/health"; echo

echo "=== VERSION ==="
curl -sS --max-time 8 "$BASE/api/saida/version"; echo

echo "=== MONITOR (200 chars) ==="
curl -sS --max-time 8 "$BASE/api/saida/monitor" | head -c 200; echo
