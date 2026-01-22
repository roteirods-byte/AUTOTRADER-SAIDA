# AUTOTRADER-SAIDA-V2

Painel web de **SAÍDA** (monitoramento) + API + Worker (timer a cada 5 min).

## Rotas
- Painel: `https://saida1jorge.duckdns.org/saida`
- Health: `/health`
- Version/Build: `/api/saida/version` (mostra BUILD para validar deploy)
- API monitor: `/api/saida/monitor`
- API cadastrar operação: `POST /api/saida/ops` (JSON: `{par, side, entrada, alav}`)

## Arquivos de dados (gerados automaticamente)
- `data/saida_ops.json` — operações cadastradas
- `data/saida_monitor.json` — tabela pronta para o painel
- `data/saida_worker_err.log` — log quando alguma operação der erro (não trava o painel)

## Deploy rápido (VM / SSH)
> Ajuste apenas o caminho da pasta se você usar outro.

### 1) Colocar o projeto na VM
**SSH (VM):**
```bash
cd /home/roteiro_ds || exit 1
rm -rf AUTOTRADER-SAIDA-V2
# opção A: git clone (recomendado)
# git clone <SEU_REPO_GITHUB> AUTOTRADER-SAIDA-V2

# opção B: unzip do pacote (se você subir o zip)
# unzip -o AUTOTRADER-SAIDA-V2-FRESH.zip -d AUTOTRADER-SAIDA-V2
```

### 2) Instalar dependências do Node
```bash
cd /home/roteiro_ds/AUTOTRADER-SAIDA-V2 || exit 1
npm install
```

### 3) Instalar/atualizar systemd
```bash
cd /home/roteiro_ds/AUTOTRADER-SAIDA-V2 || exit 1
sudo cp -a systemd/*.service systemd/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now autotrader-saida-v2-api.service
sudo systemctl enable --now autotrader-saida-v2.timer
```

### 4) Teste rápido
```bash
curl -sS http://127.0.0.1:8096/health ; echo
curl -sS http://127.0.0.1:8096/api/saida/monitor | head -c 300 ; echo
```

## Observação importante
Se alguma operação der erro no worker, ela **continua aparecendo** no painel com “ERRO — ver log”, e o detalhe fica em `data/saida_worker_err.log`.


## Build (evitar confusão de revisão)
- O arquivo `VERSION` define o BUILD.
- O painel exibe o BUILD e a API retorna em `/api/saida/version`.
- Para atualizar o build e validar rápido: `./scripts/apply_validate_vm.sh`.
