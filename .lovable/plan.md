Hipótese nova: o ajuste anterior adicionou `apikey`, mas a chamada do watchdog continua como `fetch` solto; a função `dispatch-scheduled-campaigns` responde antes do request sair com garantia, então ela registra `watchdogReinvoked=1`, mas o worker `send-bulk-whatsapp` não processa a fila.

Evidências encontradas:
- A campanha ainda tem 55 destinatários `pending` e permanece em `sending`.
- Executei o dispatcher e ele respondeu `watchdogReinvoked: 1`, ou seja, ele acha que reativou a campanha.
- No código, as chamadas para `send-bulk-whatsapp` em `dispatch-scheduled-campaigns` usam `fetch(...).catch(...)` sem `await`/`waitUntil`, então a execução pode terminar antes da chamada realmente completar.
- Além disso, o fluxo inicial `dispatchOneShot` ainda está sem o header `apikey`, então campanhas novas também podem falhar no primeiro disparo.

Plano de correção seguro:

1. Centralizar a invocação interna do worker
- Criar um helper local em `supabase/functions/dispatch-scheduled-campaigns/index.ts` para chamar `send-bulk-whatsapp` sempre com:
  - `Content-Type`
  - `Authorization: Bearer SERVICE_ROLE_KEY`
  - `apikey: SERVICE_ROLE_KEY`
- Reutilizar esse helper nos 3 pontos: disparo único, recorrente e watchdog.

2. Garantir que a chamada saia antes da função encerrar
- Trocar o `fetch` solto por uma chamada aguardada com timeout curto.
- Aguardar apenas a resposta HTTP inicial do gateway, não o processamento completo da campanha.
- Registrar no log status HTTP/erro por campanha, para diferenciar “watchdog tentou” de “worker realmente foi chamado”.

3. Não alterar regra de negócio da campanha
- Não mudar anti-ban, delay, roteamento de instâncias, seleção de destinatários, template, status final ou cálculo de métricas.
- Manter a trava `try_lock_campaign` como proteção contra disparo duplicado.

4. Recuperar a campanha da Maria Eduarda
- Depois do deploy, limpar somente a trava/orfãos dessa campanha se necessário.
- Reinvocar o dispatcher e validar que os 55 pendentes começam a sair de `pending` para `sent`, `delivered`, `read` ou `failed`.

5. Validação final
- Verificar logs do `dispatch-scheduled-campaigns` mostrando status da chamada ao worker.
- Verificar logs do `send-bulk-whatsapp` com início do processamento da campanha.
- Conferir contagem dos destinatários para confirmar que saiu do estado parado.