PASSO 1B2 (corrige hora + botões + cor do PAR)

O que este pacote faz:
1) Mostra o PAR em abóbora (no painel e na tabela).
2) O campo US ENTRADA aceita vírgula (ex: 1,23).
3) Se o servidor bloquear o envio, o site mostra mensagem clara.
4) O worker passa a gravar no monitor: worker_build e worker_src (para confirmar a revisão no ar).
5) Inclui um bloco pronto do NGINX para liberar os botões (ADD/EXCLUIR e VERSION).

A) COPIAR ARQUIVOS (na VM)
1) Abra o SSH (Google Cloud) e rode:

cd /home/roteiro_ds/AUTOTRADER-SAIDA-V2 || exit 1

2) Substitua estes arquivos pelos do zip:
- dist/saida.html
- worker_saida_v2.py
- server.js

B) REINICIAR (na VM)
Rode:

sudo systemctl restart autotrader-saida-v2-api.service
sudo systemctl restart autotrader-saida-v2.service

C) LIBERAR OS BOTÕES (NGINX)
1) Descobrir o arquivo do domínio:

sudo nginx -T 2>/dev/null | grep -n "server_name saida1jorge.duckdns.org" -n

2) Abra o arquivo que aparecer (o caminho vai aparecer no começo do output do nginx -T).
3) Cole o conteúdo de nginx/saida_api_proxy.conf DENTRO do bloco server { }.
4) Teste e reinicie:

sudo nginx -t && sudo systemctl restart nginx

D) TESTES (na VM)
1) Versão (tem que voltar JSON e NÃO HTML):

curl -sS http://127.0.0.1:8096/api/saida/version; echo
curl -sS https://saida1jorge.duckdns.org/api/saida/version; echo

2) Hora (tem que bater com o servidor -03):

date
python3 - <<'PY'
import json
print(json.load(open('data/saida_monitor.json','r',encoding='utf-8')).get('updated_brt'))
PY

Se algum teste acima não bater, me mande o output (copie e cole).
