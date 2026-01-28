#!/usr/bin/env bash
set -euo pipefail

# Script seguro: backup -> atualiza VERSION -> instala deps -> reinicia -> valida.
# Uso:
#   ./scripts/apply_validate_vm.sh /home/roteiro_ds/AUTOTRADER-SAIDA-V2
#   ./scripts/apply_validate_vm.sh   (usa a pasta atual)

APP_DIR="${1:-$(pwd)}"
cd "$APP_DIR"

echo "=== A) BACKUP (código) ==="
BK="/tmp/autotrader_saida_backup_$(date -u +%Y%m%d_%H%M%SUTC).tar.gz"
tar -czf "$BK" \
  server.js package.json VERSION \
  dist/saida.html \
  systemd scripts 2>/dev/null || true

echo "OK: backup em $BK"

echo

echo "=== B) BUILD ID (VERSION) ==="
bash bash ./scripts/bump_build.sh

echo

echo "=== C) NPM (dependências) ==="
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

echo

echo "=== D) RESTART (se existir) ==="
if systemctl list-unit-files 2>/dev/null | grep -q "^autotrader-saida-v2-api\.service"; then
  sudo systemctl restart autotrader-saida-v2-api.service
  echo "OK: restart api"
else
  echo "AVISO: autotrader-saida-v2-api.service ainda não instalado (passo 2)."
fi

if systemctl list-unit-files 2>/dev/null | grep -q "^autotrader-saida-v2\.timer"; then
  sudo systemctl restart autotrader-saida-v2.timer || true
  echo "OK: restart timer"
else
  echo "AVISO: autotrader-saida-v2.timer não encontrado."
fi

echo

echo "=== E) VALIDAR (localhost) ==="
./scripts/validate_http.sh "http://127.0.0.1:8096"

echo

echo "FIM. Se algo falhar, restaure com:"
echo "  sudo tar -xzf $BK -C \"$APP_DIR\""
