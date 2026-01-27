# Self-hosted Runner (autotrader-vm)

Este projeto usa deploy via **Self-hosted Runner** na VM, para eliminar SSH-action e Secrets.

Resumo:
- Frontend chama **sempre** `/api/...`
- NGINX roteia `/api/` para a API
- Deploy = checkout + `scripts/deploy_runner.sh`

Consulte o passo-a-passo enviado pelo ChatGPT para instalar o runner e configurar sudoers.
