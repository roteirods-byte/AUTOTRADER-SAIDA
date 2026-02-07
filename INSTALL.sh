#!/usr/bin/env bash
set -e

echo "== Instalando agendamento do worker =="

install -m 0644 autotrader-saida-worker.service /etc/systemd/system/autotrader-saida-worker.service
install -m 0644 autotrader-saida-worker.timer   /etc/systemd/system/autotrader-saida-worker.timer

systemctl daemon-reload
systemctl enable --now autotrader-saida-worker.timer

echo
echo "== OK. Status do timer =="
systemctl status autotrader-saida-worker.timer --no-pager || true
echo
echo "== Proximas execucoes =="
systemctl list-timers --all | grep -i autotrader-saida-worker || true
