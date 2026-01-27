#!/usr/bin/env bash
set -euo pipefail

SERVICE="autotrader-pro-v1-api.service"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${SRC_DIR}/systemd/${SERVICE}"
DST="/etc/systemd/system/${SERVICE}"

echo "=== FIX PRO DATA_DIR (safe) ==="
echo "Service: ${SERVICE}"
echo "Source : ${SRC}"

if [[ ! -f "${SRC}" ]]; then
  echo "ERRO: arquivo nao encontrado: ${SRC}"
  exit 1
fi

TS="$(date -u +%Y%m%d_%H%M%SUTC)"

if [[ -f "${DST}" ]]; then
  BK="${DST}.BKP_${TS}"
  echo "Backup: ${DST} -> ${BK}"
  sudo cp -a "${DST}" "${BK}"
else
  echo "Aviso: ${DST} nao existe ainda. Vai instalar novo."
fi

echo "Instalando service..."
sudo install -m 0644 "${SRC}" "${DST}"

echo "daemon-reload..."
sudo systemctl daemon-reload

echo "restart ${SERVICE}..."
sudo systemctl restart "${SERVICE}"

echo "Validando /api/pro..."
OUT="$(curl -s http://127.0.0.1:8095/api/pro | head -c 500 || true)"
echo "${OUT}"

# Checagem objetiva
if echo "${OUT}" | grep -q '"data_dir":"/home/roteiro_ds/AUTOTRADER-PRO/data"'; then
  echo "OK: DATA_DIR correto."
else
  echo "ERRO: DATA_DIR ainda incorreto (ou API nao respondeu)."
  exit 2
fi

echo "FIX OK"
