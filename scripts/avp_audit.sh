#!/usr/bin/env bash
set -euo pipefail

echo "=== AVP AUDIT (Correção Definitiva) ==="

fail(){ echo "FALHA: $1" >&2; exit 1; }

# 1) arquivos mínimos
[ -f "dist/saida.html" ] || fail "dist/saida.html não existe"
[ -f "server.js" ] || fail "server.js não existe"
[ -f "worker_saida_v2.py" ] || fail "worker_saida_v2.py não existe"
[ -d "data" ] || fail "pasta data não existe"

# 2) checagens do HTML (pontos que já quebraram)
grep -q "function renderTable" dist/saida.html || fail "HTML sem renderTable"
grep -q "window.refresh" dist/saida.html || fail "HTML sem window.refresh (evita 'refresh is not defined')"
grep -q "/api/saida/alvo" dist/saida.html || fail "HTML não chama /api/saida/alvo"
grep -q "MONITORAMENTO DAS OPERAÇÕES" dist/saida.html || fail "HTML sem painel de monitoramento"
grep -q "OPERAÇÕES REALIZADAS" dist/saida.html || fail "HTML sem painel de realizadas"
grep -q "DADOS DE ENTRADA NA OPERAÇÃO" dist/saida.html || fail "HTML sem painel de entrada"

# 3) checagens da API (endpoints obrigatórios)
grep -q "app.get('/api/saida/alvo'" server.js || fail "server.js sem /api/saida/alvo"
grep -q "app.post('/api/saida/add'" server.js || fail "server.js sem /api/saida/add"
grep -q "app.post('/api/saida/sair'" server.js || fail "server.js sem /api/saida/sair"
grep -q "app.post('/api/saida/delete'" server.js || fail "server.js sem /api/saida/delete"
grep -q "app.get('/api/saida/monitor'" server.js || fail "server.js sem /api/saida/monitor"
grep -q "app.get('/api/saida/realizadas'" server.js || fail "server.js sem /api/saida/realizadas"

# 4) sintaxe do node (não executa o servidor)
node --check server.js >/dev/null

# 5) sintaxe do python
python3 -m py_compile worker_saida_v2.py >/dev/null

echo "OK: auditoria passou."
