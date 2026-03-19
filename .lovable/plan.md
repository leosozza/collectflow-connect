
Do I know what the issue is? Yes.

O que eu testei:
- Entrei no preview com o usuário do Vitor e abri a tela `/contact-center/telefonia`.
- Validei no backend que o Vitor está vinculado ao agente `100707`.
- Testei diretamente as actions do proxy:
  - `agent_available_campaigns` para o agente `100707` retornou campanhas válidas.
  - `login_agent_to_campaign` retornou `status: 204`.
  - `connect_agent` retornou `status: 204`.
- Depois disso, consultei `agents_status` novamente e o Vitor mudou de `status: 0` para `status: 1`.

Problema exato:
1. O backend está chamando a 3CPlus, mas o proxy trata respostas `204 No Content` como erro porque espera JSON em todos os casos.
2. Para `agent/login` e `agent/connect`, a 3CPlus aparentemente usa `204` como sucesso sem corpo.
3. O dropdown do operador ainda usa `list_campaigns` em vez de `agent_available_campaigns`, então o fluxo da tela não está alinhado com o fluxo correto por agente.
4. O frontend não confirma o estado real do agente após login/conexão; ele decide com base na resposta bruta do proxy.

Arquivos a ajustar:
- `supabase/functions/threecplus-proxy/index.ts`
- `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

Plano de correção:
1. Corrigir o proxy para tratar `204` como sucesso
   - Antes do parse JSON, se a resposta vier com `status === 204`, retornar um JSON normalizado como:
   ```ts
   { status: 204, success: true, no_content: true }
   ```
   - Aplicar isso especialmente ao fluxo de:
     - `login_agent_to_campaign`
     - `connect_agent`
     - `logout_agent_self`
     - `pause_agent`
     - `unpause_agent`
     - `hangup_call`

2. Trocar a origem das campanhas do operador
   - Na tela do operador, usar `agent_available_campaigns` quando houver `threecplus_agent_id`.
   - Manter `list_campaigns` apenas para visão administrativa.
   - Isso garante que o Vitor veja só campanhas realmente disponíveis para ele.

3. Ajustar o fluxo do botão “Entrar na Campanha”
   - Sequência:
     - buscar campanhas do agente
     - `login_agent_to_campaign`
     - `connect_agent`
     - refetch de `agents_status`
   - Só mostrar erro se:
     - o proxy devolver `status >= 400`, ou
     - o agente continuar `status: 0` após a tentativa.

4. Melhorar feedback da tela
   - Se `204` vier do backend, tratar como sucesso silencioso.
   - Mostrar mensagens mais específicas:
     - “Campanha conectada com sucesso”
     - “Agente entrou na campanha, mas o SIP ainda está offline”
   - Não exibir mensagem de erro genérica para resposta vazia bem-sucedida.

5. Adicionar logs temporários de diagnóstico no proxy
   - Logar:
     - `agent_id`
     - `campaign_id`
     - upstream status
     - endpoint chamado (`/agent/login`, `/agent/connect`)
   - Isso ajuda a confirmar se a 3CPlus está respondendo com `204` consistentemente.

Resultado esperado após implementar:
- O fluxo do Vitor deixa de interpretar sucesso `204` como falha.
- A tela passa a listar campanhas corretas do agente.
- O estado online/SIP passa a refletir o retorno real da 3CPlus.
- Fica possível distinguir “login feito com sucesso” de “SIP ainda não registrou”.

Observação importante do teste:
- O indício mais forte é que, após o teste direto, o Vitor passou para `status: 1`.
- Isso mostra que o problema principal não é mais “não chamou a 3CPlus”, e sim “a aplicação está interpretando e exibindo o resultado de forma errada no fluxo do operador”.
