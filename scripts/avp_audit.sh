#!/usr/bin/env bash
set -euo pipefail

# Auditoria simples (não altera nada):
# 1) verifica se a API responde
# 2) verifica se o arquivo de dados existe
# 3) mostra a "idade" do JSON em segundos

BASE_URL="${BASE_URL:-http://127.0.0.1:${PORT:-8096}}"
DATA_DIR="${DATA_DIR:-/root/AUTOTRADER-SAIDA/data}"
MONITOR_JSON="${MONITOR_JSON:-$DATA_DIR/monitor.json}"

echo "== API =="
curl -sS "$BASE_URL/api/version" || true
echo
curl -sS "$BASE_URL/api/health" || true
echo

echo "== DADOS =="
if [ ! -f "$MONITOR_JSON" ]; then
  echo "ERRO: nao achei $MONITOR_JSON"
  exit 1
fi

now=$(date +%s)
mtime=$(stat -c %Y "$MONITOR_JSON" 2>/dev/null || stat -f %m "$MONITOR_JSON")
age=$((now - mtime))
echo "OK: $MONITOR_JSON"
echo "IDADE(seg): $age"
