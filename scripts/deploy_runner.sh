#!/usr/bin/env bash
set -euo pipefail

# Deploy pensado para rodar DENTRO da VM via Self-hosted Runner.
# - sincroniza o workspace do runner -> pasta de produção
# - aplica fix opcional do PRO (se existir)
# - garante permissão de execução nos scripts (*.sh)
# - aplica, reinicia serviços e valida
#
# Variáveis (opcionais):
#   PROD_DIR=/home/roteiro_ds/AUTOTRADER-SAIDA

PROD_DIR="${PROD_DIR:-/home/roteiro_ds/AUTOTRADER-SAIDA}"

if [ -z "${GITHUB_WORKSPACE:-}" ]; then
  echo "ERRO: GITHUB_WORKSPACE vazio. Este script deve rodar no GitHub Actions (runner)."
  exit 2
fi

echo "=== DEPLOY (runner) ==="
echo "Workspace: ${GITHUB_WORKSPACE}"
echo "Prod dir : ${PROD_DIR}"

if [ ! -d "$PROD_DIR" ]; then
  echo "ERRO: pasta de produção não existe: $PROD_DIR"
  echo "Crie com: mkdir -p $PROD_DIR"
  exit 3
fi

echo "=== 1) Sync workspace -> prod (rsync) ==="
# --delete garante que a prod fique igual ao repo (sem lixo antigo)
rsync -a --delete --exclude ".git" "${GITHUB_WORKSPACE}/" "${PROD_DIR}/"

cd "$PROD_DIR"

echo "=== 1.5) Garantir permissões de execução nos scripts (*.sh) ==="
sudo chmod +x "$PROD_DIR"/scripts/*.sh 2>/dev/null || true

echo "=== 2) Fix PRO DATA_DIR (se existir) ==="
if [ -f "./scripts/fix_pro_datadir.sh" ]; then
  sudo bash ./scripts/fix_pro_datadir.sh || true
else
  echo "AVISO: scripts/fix_pro_datadir.sh não existe (ok)."
fi

echo "=== 3) Apply + restart + validate (localhost) ==="
bash ./scripts/apply_validate_vm.sh "$PROD_DIR"

echo "=== 4) NGINX reload (safe) ==="
sudo nginx -t
sudo systemctl reload nginx

echo "OK: deploy runner finalizado."
