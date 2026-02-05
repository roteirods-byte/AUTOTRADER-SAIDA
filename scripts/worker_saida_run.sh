#!/usr/bin/env bash
set -euo pipefail

# Runner do worker (exemplo).
# Use no cron para atualizar o monitor.json.

REPO_DIR="${REPO_DIR:-/root/AUTOTRADER-SAIDA}"
PY="${PY:-python3}"

cd "$REPO_DIR"
$PY worker_saida_v2.py >> "$REPO_DIR/logs/worker_saida.log" 2>&1
