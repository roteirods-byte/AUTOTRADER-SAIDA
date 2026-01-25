# AUTOTRADER-SAIDA – AVP FIX (Correção Definitiva)

## O que foi corrigido (com base nos prints)
- Erro no console: `refresh is not defined` (agora existe `window.refresh` e o loop não quebra).
- Erro HTTP 400 em `/api/saida/alvo` quando PAR vazio (agora só chama a API quando PAR existe e sempre manda `par` + `side`).
- Colunas do MONITORAMENTO voltaram para o padrão oficial do projeto.
- Criado o 3º painel: **OPERAÇÕES REALIZADAS**.
  - Clique em **SAIR** move a operação do Monitoramento para Realizadas (snapshot congelado).
  - Realizadas não atualiza automaticamente.
  - Realizadas tem botão **EXCLUIR** (apaga do histórico local).

## Regra do projeto – auditoria interna antes de liberar
Rode no repo (raiz):

```bash
./scripts/avp_audit.sh
```

Se falhar, NÃO faça deploy.

## Verificar se o deploy aplicou
Depois do deploy, rode:

```bash
./scripts/validate_site.sh "https://saida1jorge.duckdns.org/saida"
```

Se falhar, significa que o `dist/saida.html` não foi publicado no site (pipeline/cache/rota).
