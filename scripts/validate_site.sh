#!/usr/bin/env bash
set -euo pipefail

URL="${1:-https://saida1jorge.duckdns.org/saida}"
STAMP="BUILD:2026-01-25_AVP1"

echo "== VALIDATE SITE =="
echo "URL: $URL"
echo "STAMP: $STAMP"

HTML="$(curl -sS --max-time 10 "$URL" || true)"
if [[ -z "${HTML}" ]]; then
  echo "ERRO: site não respondeu (HTML vazio)."
  exit 1
fi

echo "$HTML" | grep -q "$STAMP" || {
  echo "ERRO: build stamp não encontrado no site. Deploy NÃO aplicou o dist/saida.html novo."
  exit 1
}

echo "OK: site está servindo a versão nova."
