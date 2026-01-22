# AUTOTRADER-SAIDA V2

- FUTUROS USDT (Binance FAPI + Bybit Linear)
- Entrada manual: PAR + SIDE + ENTRADA + ALAV
- Worker calcula: ATUAL + ALVO + PNL% + ETA + SITUAÇÃO

## Rodar (local/VM)

```bash
npm i
PORT=8096 node server.js
```

Abrir: `http://IP:8096/saida`

## Worker (manual)

```bash
python3 worker_saida_v2.py
cat data/saida_monitor.json | head
```

## Systemd (opcional)

Arquivos em `systemd/`.
