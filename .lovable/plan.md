

## Auditoria de impacto das alterações da rodada anterior

### O que foi efetivamente aplicado

1. **Backfill `assigned_to` em conversas órfãs** (migration `20260422200918`).
   - Setou `assigned_to` para o operador único de instâncias com **um único** vínculo em `operator_instances`.
   - Inclui guarda: só atribui se a conversa tiver `client_id IS NULL` **ou** o cliente não estiver atribuído a outro operador.

2. **Auto-atribuição no envio manual** em `send-chat-message/index.ts` (passo 11): se a conversa estiver `assigned_to IS NULL`, grava `assigned_to = profile_id` do operador remetente após o envio.

### O que NÃO foi aplicado (e o plano previa)

3. **Extensão da RPC `get_visible_conversations` e `get_visible_conversation_counts`**
   Conferi `pg_get_functiondef` das duas overloads em produção: as cláusulas seguem na versão antiga, exigindo `c.client_id IS NULL` no fallback de instância. Ou seja, a regra para conversas com `client_id` mas cliente sem dono **continua ausente**.
   - Isso significa: para a maioria das instâncias dedicadas, a Sabrina (e equivalentes) só passa a enxergar as conversas **a partir do momento em que ela mesma envia uma mensagem manual** (passo 2 grava `assigned_to`) ou as que foram corrigidas no backfill (passo 1). Conversas novas vindas de campanha ainda nascem invisíveis até que alguém atue.

### Riscos da entrega parcial atual

- **Risco baixo de regressão geral.** O único ponto de mudança comportamental ativo é o auto-assign no envio manual e o backfill pontual; nada altera RLS, motor de envio, webhooks, mídia, transcrição ou campanhas.
- **Risco específico: instâncias compartilhadas (>1 operador em `operator_instances`).** O backfill ignorou (HAVING COUNT=1) — comportamento correto, sem risco de “roubar” conversa de operador errado.
- **Risco específico: clientes em outras carteiras.** O backfill respeita `clients.operator_id` — não atribui se o cliente já tem dono diferente. OK.
- **Risco operacional remanescente:** novas conversas geradas por campanha em instância dedicada continuarão **fora da inbox da operadora** até que ela envie a primeira mensagem ou um admin intervenha. É exatamente o sintoma original da Sabrina, mas só para conversas **futuras** (as antigas foram corrigidas pelo backfill).

### O que entregar nesta rodada para fechar o plano original com segurança

1. **Atualizar as duas overloads de `get_visible_conversations`** (e `get_visible_conversation_counts`) substituindo o atual fallback de instância por:
   - `c.assigned_to IS NULL`
   - **e** o operador está vinculado em `operator_instances` à instância da conversa (`COALESCE(c.endpoint_id, c.instance_id)`)
   - **e** (`c.client_id IS NULL` **ou** o `clients.operator_id` é `NULL` ou igual ao `_profile_id`)

   Nada mais é tocado: regras 1–4 (admin, assigned_to, carteira atribuída, transfer ativo, mar aberto) ficam idênticas. A nova cláusula é estritamente uma **expansão** — pode revelar conversas, nunca esconder.

2. **Validações pós-aplicação** (não destrutivas):
   - Logar como Sabrina → conversas geradas hoje pela campanha aparecem mesmo sem ela ter enviado nada.
   - Logar como operador de tenant **com** atribuição de carteira ativa para outra pessoa → conversas continuam ocultas (o `cl.operator_id <> _profile_id` continua barrando).
   - Logar como admin → comportamento idêntico (curto-circuito `_is_admin` no topo).
   - Conferir que os contadores do topo da inbox batem com a listagem.

### Avaliação geral de impacto no WhatsApp e funções relacionadas

- **Envio (send-chat-message, send-bulk-whatsapp, whatsapp-sender):** sem mudança funcional. O auto-assign roda **após** o envio bem-sucedido; em caso de falha, comportamento idêntico ao anterior.
- **Webhooks (whatsapp-webhook, gupshup-webhook):** intocados nesta rodada.
- **Mídia, áudio, transcrição, OGG remux, anexos:** intocados.
- **Campanhas, watchdog, dispatcher, anti-ban:** intocados.
- **RLS das tabelas (`conversations`, `chat_messages`, `clients`):** intacta. A RPC é `SECURITY DEFINER` e só amplia visibilidade para o próprio operador autenticado dentro do tenant correto (verificação de `tenant_users.role` no início da função).
- **Carteira / Mar Aberto / Atribuição:** preservados — a nova cláusula só dispara se `clients.operator_id` for `NULL` ou for o próprio operador.
- **Multi-tenant:** preservado — `WHERE c.tenant_id = _tenant_id` segue como primeiro filtro.

### Resumo

A rodada anterior é **segura, mas incompleta**. Nenhuma função do WhatsApp regride. Para fechar o plano e garantir que o sintoma original da Sabrina não volte para conversas novas, falta apenas atualizar as duas RPCs de visibilidade. A mudança proposta é puramente aditiva (amplia o conjunto visível sem mexer em nenhuma regra existente) e mantém intactas todas as garantias de Carteira, Mar Aberto, RLS e isolamento entre operadores.

