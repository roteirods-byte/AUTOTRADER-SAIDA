# MAPA OFICIAL — AUTOTRADER-SAÍDA (NÃO MEXER FORA DISSO)

Este arquivo é a REGRA FIXA do projeto.
Qualquer revisão futura deve seguir este mapa, ou será considerada inválida.

## OBJETIVO
- Painel funciona 100% em PC e celular
- Sem instabilidade (revisão não pode quebrar outra parte)
- Sem arquivos “fantasmas” e sem múltiplas versões do site
- Sem .github / sem deploy automático / sem secrets

---

# ARQUITETURA OFICIAL (3 PARTES)

## PARTE 1 — DADOS (Worker / Banco)
Regra:
- Worker só escreve arquivos de DADOS:
  - monitor.json
  - ops_active.json
  - ops_realizadas.json
  - pro.json (quando existir)
  - top10.json (quando existir)
  - audit.json (quando existir)
- Sempre gerar também: build.json com:
  - { "version", "commit", "generated_at", "updated_brt", "worker_build" }

PROIBIDO no Worker:
- Mexer em API (server.js)
- Mexer no Painel (dist/)

## PARTE 2 — API (server.js)
Regra:
- API só LÊ JSON (ou DB se um dia mudar) e entrega rotas fixas.
- Nunca faz cálculo pesado.
- Se não achar JSON válido: responde ERRO EM JSON (nunca HTML).

ROTAS OBRIGATÓRIAS:
- GET /api/saida/health   -> {ok:true,...}
- GET /api/saida/version  -> {ok:true, version: (lida do arquivo VERSION), ...}
- GET /api/saida/monitor  -> {updated_brt,..., ops:[...]}
- GET /api/saida/alvo?par=XXX&side=LONG|SHORT -> {ok:true, alvo: number}
- GET /api/saida/pdf/monitor  (ou rota oficial de PDF)
- GET /api/saida/pdf/realizadas

## PARTE 3 — PAINEL (dist/)
Regra:
- Painel só consome a API.
- Painel NUNCA lê arquivo local do servidor.
- Painel não “adivinha” campos: só usa o contrato da API.

ARQUIVO OFICIAL DO PAINEL:
- dist/saida.html

---

# CONTRATOS OBRIGATÓRIOS (para não quebrar)
- Todo JSON deve ter: schema_version
- A API mantém compatibilidade:
  - se schema_version antigo aparecer, a API adapta
- O painel só usa campos do contrato (sem hacks)

---

# PROIBIDO (REGRA FIXA)
- NÃO usar pasta .github
- NÃO usar GitHub Actions / Secrets / deploy automático
- NÃO criar outro site em outra pasta (sem site2/, public2/, v2/, etc.)
- NÃO versionar dados vivos no Git:
  - data/monitor.json, ops_active.json, ops_realizadas.json, pro.json, top10.json, audit.json, build.json
  Esses arquivos são RUNTIME (fora do repo).

---

# CHECKLIST OBRIGATÓRIO DE REVISÃO (TEM QUE PASSAR)
## A) Visual/Layout
1) Moedas na cor abóbora
2) Tirar barras de rolagem DENTRO das caixas ENTRADA e ALAV
3) Caixa ALVO: deve permitir editar quando for modo manual (quando existir)
4) Após adicionar operação: todas as caixas limpam e voltam ao padrão

## B) Função/Operação
5) Baixar PDF abre o PDF real (não redireciona para “site estranho”)
6) Botão ADICIONAR funciona SEMPRE e adiciona IMEDIATO (sem atraso)
7) Zero erros no console do navegador

## C) API/Conectividade (teste via navegador)
- /api/saida/health retorna JSON ok:true (não pode dar Cannot GET)
- /api/saida/alvo existe (não pode 404) e retorna alvo numérico
- /api/saida/monitor retorna JSON (nunca HTML)
- /api/saida/version mostra version do arquivo VERSION (não ficar travado em 1.0.0 do package.json)

Se qualquer item falhar: revisão NÃO pode ser publicada.
