#!/usr/bin/env bash
set -e

echo "== Instalando servico da API (server.js) =="

install -m 0644 autotrader-saida-api.service /etc/systemd/system/autotrader-saida-api.service

systemctl daemon-reload
systemctl enable --now autotrader-saida-api.service

echo
echo "== Status =="
systemctl status autotrader-saida-api.service --no-pager | head -n 80 || true
