#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HTML="$ROOT/dist/saida.html"

echo "== AVP AUDIT START =="
echo "FILE: $HTML"

if [[ ! -f "$HTML" ]]; then
  echo "ERRO: dist/saida.html não existe."
  exit 1
fi

# Regra PRAZO: deploy falha se quebrado
grep -q "PRAZO:OK" "$HTML" || { echo "ERRO: PRAZO quebrado (PRAZO:OK ausente)."; exit 1; }

# Build stamp (garante que o arquivo novo está aqui)
grep -q "BUILD:2026-01-25_AVP1" "$HTML" || { echo "ERRO: BUILD stamp esperado não encontrado."; exit 1; }

# Erros do console que estavam no print
! grep -q "reFresh is not defined" "$HTML" || { echo "ERRO: string 'reFresh is not defined' encontrada."; exit 1; }
! grep -q "reFresh" "$HTML" || { echo "ERRO: 'reFresh' encontrado (deve ser refresh)."; exit 1; }
grep -q "window.refresh" "$HTML" || { echo "ERRO: window.refresh não está definido."; exit 1; }

# Painéis obrigatórios
grep -q "DADOS DE ENTRADA NA OPERAÇÃO" "$HTML" || { echo "ERRO: painel 1 não encontrado."; exit 1; }
grep -q "MONITORAMENTO DAS OPERAÇÕES" "$HTML" || { echo "ERRO: painel 2 não encontrado."; exit 1; }
grep -q "OPERAÇÕES REALIZADAS" "$HTML" || { echo "ERRO: painel 3 não encontrado."; exit 1; }

# Colunas oficiais (monitor)
grep -q "<th>DATA REG</th>" "$HTML" || { echo "ERRO: coluna DATA REG ausente."; exit 1; }
grep -q "<th>HORA REG</th>" "$HTML" || { echo "ERRO: coluna HORA REG ausente."; exit 1; }
grep -q "<th>DATA ATUAL</th>" "$HTML" || { echo "ERRO: coluna DATA ATUAL ausente."; exit 1; }
grep -q "<th>HORA ATUAL</th>" "$HTML" || { echo "ERRO: coluna HORA ATUAL ausente."; exit 1; }
grep -q "<th>SAIR</th>" "$HTML" || { echo "ERRO: coluna SAIR ausente."; exit 1; }
grep -q "<th>EXCLUIR</th>" "$HTML" || { echo "ERRO: coluna EXCLUIR ausente."; exit 1; }

echo "OK: auditoria interna passou."
