# AUTOTRADER-SAIDA — Rebuild AVP (GitHub-first)

Este pacote entrega uma versão **nova e limpa** do painel **/saida** + API, com:

- **Entrada da operação (ADD)** usando **ALVO do PRO congelado**
- **Monitoramento** (tabela automática)
- **Operações Realizadas** (histórico): ao clicar **SAIR**, copia a linha completa e para de monitorar
- **Auditoria AVP** no GitHub Actions (bloqueia deploy se quebrar)

## Arquivos principais
- `dist/saida.html` (frontend)
- `server.js` (API + /saida)
- `worker_saida_v2.py` (atualiza `data/monitor.json`)
- `scripts/avp_audit.sh` + `.github/workflows/avp_audit.yml`

## Variáveis de ambiente (opcionais)
- `PORT` (padrão: 8096)
- `DATA_DIR` (padrão: ./data)
- `ENTRADA_PRO_JSON` (caminho do JSON do PRO com alvos, se existir)

## Rotas
- `GET /saida`
- `GET /api/saida/alvo?par=ADA&side=LONG`
- `POST /api/saida/add`
- `GET /api/saida/monitor`
- `POST /api/saida/sair`
- `GET /api/saida/realizadas`
- `POST /api/saida/delete`

