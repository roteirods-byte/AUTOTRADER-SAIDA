# AUTOTRADER-SAÍDA (repo limpo)

## Mapa do projeto
- `dist/saida.html` → **painel publicado**
- `server.js` → **API** + entrega do painel em `/` e `/saida`
- `worker_saida_v2.py` → **worker** que atualiza preços e grava `data/monitor.json`
- `ops/` → exemplos de configuração (cron, nginx, env)
- `scripts/` → utilitários (audit e runner do worker)

## Fluxo (simples)
1) Worker escreve `data/monitor.json`
2) API lê o JSON e responde `/api/*`
3) Painel lê a API e mostra as tabelas

## Rotas principais
- Painel: `/saida`
- API: `/api/version` | `/api/health` | `/api/saida/monitor` | `/api/saida/realizadas`

## Arquivos “vivos” (não entram no GitHub)
- `data/*.json`
- `logs/*`
- `.env`

## Verificação rápida
1) API está no ar:
   - abrir `/api/version`
2) Dados existem:
   - arquivo `data/monitor.json`
3) Painel está lendo:
   - abrir `/saida`

## Regras do projeto
- Proibido: `.github`, deploy automático, secrets.
