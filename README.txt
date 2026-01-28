PATCH_SAIDA_STABLE_API
Arquivos:
- server.js (substituir o server.js do repositório AUTOTRADER-SAIDA)

Objetivo:
- Eliminar ReferenceError (readVersion / extractAlvoFromPro)
- Adicionar rota /api/saida/version
- Proteger PDF (title.replace)
- Error handler sempre JSON
- Padronizar PRO_JSON_FILE (/home/roteiro_ds/AUTOTRADER-PRO/data/pro.json)

Como aplicar (GitHub):
1) Substitua server.js pelo deste ZIP
2) Commit no main
3) Na VM: git pull + restart autotrader-saida-v2-api.service
