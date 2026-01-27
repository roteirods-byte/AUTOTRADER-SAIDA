#!/usr/bin/env bash
set -euo pipefail

SERVICE="autotrader-pro-v1-api.service"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${SRC_DIR}/systemd/${SERVICE}"
DST="/etc/systemd/system/${SERVICE}"
EXPECTED_DIR="/home/roteiro_ds/AUTOTRADER-PRO/data"

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

echo "Validando Environment do systemd..."
ENV_LINE="$(sudo systemctl show -p Environment --value "${SERVICE}" || true)"
echo "Environment=${ENV_LINE}"

if echo "${ENV_LINE}" | grep -q "DATA_DIR=${EXPECTED_DIR}"; then
  echo "OK: DATA_DIR no systemd correto."
else
  echo "ERRO: DATA_DIR no systemd NAO esta correto."
  exit 2
fi

echo "Validando arquivo pro.json existe na pasta esperada..."
if [[ -f "${EXPECTED_DIR}/pro.json" ]]; then
  echo "OK: ${EXPECTED_DIR}/pro.json existe."
else
  echo "ERRO: ${EXPECTED_DIR}/pro.json NAO existe."
  exit 3
fi

echo "Validando /api/pro (HTTP 200 + ok:true)..."
OUT="$(curl -s -w "\nHTTP_CODE:%{http_code}\n" http://127.0.0.1:8095/api/pro | head -c 1200 || true)"
echo "${OUT}"

if echo "${OUT}" | grep -q "HTTP_CODE:200" && echo "${OUT}" | grep -q '"ok":true'; then
  echo "OK: /api/pro respondeu."
else
  echo "ERRO: /api/pro nao respondeu como esperado."
  exit 4
fi

echo "FIX OK"
