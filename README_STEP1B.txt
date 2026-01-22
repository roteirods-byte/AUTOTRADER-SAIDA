PASSO 1B (DEPLOY BLINDADO + HORA BRT + PAR ABÓBORA)

Mudanças:
1) server.js: adiciona /api/saida/version e /version
2) worker_saida_v2.py: updated_brt agora é BRT real (America/Sao_Paulo)
3) dist/saida.html: mostra BUILD no topo e mantém PAR em abóbora
4) .gitignore: evita versionar data/logs/cache

Aplicação (VM):
- reiniciar a API (node) e o worker depois de atualizar arquivos
- validar:
  curl -sS http://127.0.0.1:8096/api/saida/version
  curl -sS http://127.0.0.1:8096/api/saida/monitor | head -c 120

Observação:
Seu diretório /home/roteiro_ds/AUTOTRADER-SAIDA-V2 não é um repo git (sem .git).
Isso é normal se você fez deploy por ZIP/cópia.
Se quiser padronizar, depois a gente troca para "git clone" (PASSO 2).
