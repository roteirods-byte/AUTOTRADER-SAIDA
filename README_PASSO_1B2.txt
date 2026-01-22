PASSO 1B2 — corrigir 4 pontos: HORA + BOTÕES (ADICIONAR/EXCLUIR) + MOEDAS ABÓBORA

O que este pacote muda (já pronto):
1) Tela (dist/saida.html)
   - PAR (moeda) aparece em abóbora.
   - Aceita vírgula ou ponto no preço (ex: 2900,5 ou 2900.5).
   - Se o servidor bloquear o envio, mostra uma mensagem clara.
2) Worker (worker_saida_v2.py)
   - updated_brt passa a sair em horário Brasil.
   - monitor.json passa a mostrar: worker_build e worker_src.
3) NGINX (nginx/saida_api_proxy.conf)
   - Libera o envio (POST) para ADD/DEL e libera VERSION/ALVO.

IMPORTANTE
- Você vai copiar/colar comandos. Não precisa editar código "na mão".

A) COPIAR OS ARQUIVOS DO PACOTE PARA A VM
PLATAFORMA: SSH (VM)
1) Coloque o ZIP no seu PC e envie para a VM (mesmo jeito que você já usa).
2) No SSH, rode (copie/cole):

cd /home/roteiro_ds/AUTOTRADER-SAIDA-V2 || exit 1
mkdir -p /tmp/saida_step1b2
cd /tmp/saida_step1b2 || exit 1

# ajuste o nome do zip se necessário
unzip -o ~/AUTOTRADER-SAIDA-V2_STEP1B2.zip

# copiar arquivos para o projeto
cp -f dist/saida.html /home/roteiro_ds/AUTOTRADER-SAIDA-V2/dist/saida.html
cp -f worker_saida_v2.py /home/roteiro_ds/AUTOTRADER-SAIDA-V2/worker_saida_v2.py
cp -f server.js /home/roteiro_ds/AUTOTRADER-SAIDA-V2/server.js
cp -f nginx/saida_api_proxy.conf /home/roteiro_ds/AUTOTRADER-SAIDA-V2/nginx_saida_api_proxy.conf

B) LIBERAR O ENVIO (ADICIONAR/EXCLUIR) NO SERVIDOR
PLATAFORMA: SSH (VM)
1) Descobrir qual arquivo do NGINX está usando seu domínio:

sudo nginx -T 2>/dev/null | grep -n "server_name saida1jorge.duckdns.org" -n

2) Agora rode (copie/cole) para mostrar o bloco completo do seu domínio:

sudo nginx -T 2>/dev/null | sed -n '1,260p'

3) Quando você localizar o bloco do domínio "saida1jorge.duckdns.org", você vai COLAR dentro dele o conteúdo do arquivo:

/home/roteiro_ds/AUTOTRADER-SAIDA-V2/nginx_saida_api_proxy.conf

Para facilitar, rode este comando que mostra o conteúdo pronto:

cat /home/roteiro_ds/AUTOTRADER-SAIDA-V2/nginx_saida_api_proxy.conf

4) Depois que colar no NGINX, rode:

sudo nginx -t && sudo systemctl restart nginx

C) REINICIAR O SITE E O WORKER
PLATAFORMA: SSH (VM)
1) Reiniciar a API do site:

sudo systemctl restart autotrader-saida-v2-api.service

2) Reiniciar o worker (o que atualiza a tabela):

sudo systemctl restart autotrader-saida-v2.service
sudo systemctl start autotrader-saida-v2.timer

D) TESTES RÁPIDOS (para confirmar)
PLATAFORMA: SSH (VM)
1) Ver versão (agora tem que funcionar):

curl -sS http://127.0.0.1:8096/api/saida/version; echo

2) Ver monitor (agora tem que mostrar updated_brt com hora Brasil):

python3 - <<'PY'
import json
print(json.load(open('data/saida_monitor.json','r',encoding='utf-8')).get('updated_brt'))
print('worker_build:', json.load(open('data/saida_monitor.json','r',encoding='utf-8')).get('worker_build'))
PY

3) Testar ADD e DEL pelo domínio (simula o botão do site):

# ADD
curl -sS -X POST https://saida1jorge.duckdns.org/api/saida/add \
  -H "Content-Type: application/json" \
  -d '{"par":"BTC","side":"LONG","entrada":2900.0,"alav":10}'; echo

# pegar último ID e DEL
LAST_ID=$(python3 - <<'PY'
import json
ops=json.load(open('data/saida_ops.json','r',encoding='utf-8')).get('ops',[])
print(ops[-1]['id'] if ops else '')
PY
)
echo "ID: $LAST_ID"
curl -sS -X POST https://saida1jorge.duckdns.org/api/saida/del \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$LAST_ID\"}"; echo

E) CHECAGEM NO SITE (tela)
PLATAFORMA: NAVEGADOR
1) Recarregue a página.
2) A hora em "Atualizado" deve bater com seu horário Brasil.
3) Digite ENTRADA com vírgula (ex: 2900,5) e clique ADICIONAR.
4) Clique EXCLUIR.

Se algum item acima falhar, me mande:
- o resultado do comando: sudo nginx -T 2>/dev/null | grep -n "saida1jorge.duckdns.org" -n
- e o resultado do comando: curl -i https://saida1jorge.duckdns.org/api/saida/version | head -n 20
