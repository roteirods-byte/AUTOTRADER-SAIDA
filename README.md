# AUTOTRADER-SAÍDA (repo limpo)

Arquitetura fixa:
1) Worker (worker_saida_v2.py) escreve dados (fora do Git)
2) API (server.js) lê dados e expõe /api/saida/*
3) Painel (dist/saida.html) consome a API

Proibido: .github, deploy automático, secrets.
