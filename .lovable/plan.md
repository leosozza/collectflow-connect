

## Plano: conversas “sumindo” para a Sabrina mesmo enviando pelo Rivo

### Diagnóstico

A Sabrina (`profile_id c734c47b…`, role `operador`) está vinculada à instância `Y.BRASIL - Acordos Sabrina` (`a91214ab-fe5e-40e8-b535-47f2174822fe`). Essa instância tem dezenas de conversas ativas hoje, mas a `useInfiniteQuery` da inbox não retorna nenhuma para ela. A causa está na RPC `get_visible_conversations` (regra de visibilidade do operador). Conversa só fica visível se uma destas condições bater:

1. `assigned_to = profile_id` da Sabrina, **ou**
2. `client_id` aponta para um cliente cujo `clients.operator_id = profile_id` da Sabrina, **ou**
3. há um `conversation_transfer` ativo para a Sabrina, **ou**
4. o cliente da conversa está num status listado em `tenants.settings->whatsapp_visibility->open_statuses` (modo “mar aberto”), **ou**
5. **(fallback de instância)** `assigned_to IS NULL` **e** `client_id IS NULL` **e** existe vínculo em `operator_instances`.

Verificações no banco do tenant `39a450f8…`:

- `tenants.settings->whatsapp_visibility` = **NULL** → a regra 4 (mar aberto) não aplica.
- 0 conversas com `assigned_to = Sabrina` → regra 1 não aplica para a maioria.
- Praticamente todas as conversas da instância da Sabrina têm `client_id` preenchido (vêm de campanha de carteira, todas `client.operator_id = NULL` → carteira não atribuída). Como `client_id` **não é NULL**, a regra 5 (fallback por instância) **é desativada**, e como `clients.operator_id` ≠ Sabrina, a regra 2 também falha. **Resultado: a conversa é filtrada e some da inbox dela.**

Exemplo: conversa `ed239799…` com `Mari may`, instância da Sabrina, `client_id` setado, `client.operator_id = NULL`, `assigned_to = NULL` → invisível pela RPC. Só uma única conversa (`75fbd497… Libia`) aparece, justamente porque o `client.operator_id` é a Sabrina.

Ou seja: **enquanto o operador dispara pelo Rivo, a conversa nasce com `client_id` mas sem `assigned_to`. A regra de visibilidade exige carteira atribuída ao operador OU mar aberto OU assigned_to OU transfer. Sem nada disso, a conversa some** — mesmo sendo a instância exclusiva da operadora.

### Correção

Trabalho concentrado na RPC `get_visible_conversations` e na irmã `get_visible_conversation_counts`, sem mexer em RLS, sem novos campos, sem alterar UI nem o motor de envio.

#### 1. Estender o fallback de instância para cobrir o caso “tem `client_id` mas o cliente não pertence a ninguém”

Adicionar uma cláusula nova ao `WHERE` da CTE `visible`:

> A conversa é visível se `assigned_to IS NULL` **e** o operador está vinculado, em `operator_instances`, à instância da conversa (`COALESCE(c.endpoint_id, c.instance_id)`), **e** o cliente da conversa (quando houver) **não está atribuído a outro operador** (`clients.operator_id IS NULL OR clients.operator_id = _profile_id`).

Isso preserva o comportamento de “Atribuição” da Carteira (clientes atribuídos a outro operador continuam invisíveis), mas devolve para o dono da instância todas as conversas “órfãs” que nascem no canal dela. É exatamente o cenário do disparo da Sabrina hoje.

#### 2. Mesma extensão na contagem

Replicar a regra acima em `get_visible_conversation_counts`, para que os contadores no topo da inbox (Aberto/Esperando/Fechado/Não lidas) reflitam o número real e fiquem consistentes com a listagem.

#### 3. Auto-atribuição opcional no envio (defesa em profundidade)

Pequeno reforço em `send-chat-message`: quando o operador envia uma mensagem manual e a conversa está `assigned_to IS NULL`, gravar `assigned_to = profile_id` do operador. Garante que, daquele ponto em diante, a regra 1 já cobre, mesmo que a regra de instância acima venha a ser revisada no futuro.

Não mexe em campanhas (essas continuam nascendo `assigned_to = NULL` para não “travar” a carteira).

#### 4. Migração de coerência (one-shot)

Para destravar imediatamente as conversas hoje invisíveis da Sabrina e demais operadoras com instância dedicada:

- Identificar conversas com `assigned_to IS NULL`, `instance_id` que tenha **exatamente um** operador vinculado em `operator_instances` e cujo `client.operator_id` seja `NULL` → setar `assigned_to` para esse operador.

Isso não muda a lógica em vigor; só corrige o estado atual. Conversas em instâncias compartilhadas continuam livres (passam a depender do fix #1 acima).

### Validação pós-deploy

1. Logar como Sabrina e abrir `/contact-center/whatsapp` → as conversas das últimas horas (Mari may, MaxFama, Sempre Deus, etc.) reaparecem na lista.
2. Contadores no topo (Aberto/Esperando) batem com o que a Sabrina enxerga.
3. Admin continua vendo tudo (regra `_is_admin` intacta).
4. Em outro tenant onde existe atribuição de carteira por operador, verificar que as conversas de clientes atribuídos a *outros* operadores **não aparecem** para quem não é dono — comportamento da Carteira preservado.
5. Disparar uma nova mensagem manual pela Sabrina numa conversa nova → checar que `assigned_to` foi gravado automaticamente.

### Arquivos alterados

- Migração SQL: redefinir `get_visible_conversations` e `get_visible_conversation_counts` com a nova cláusula de fallback por instância considerando `client.operator_id`.
- Migração SQL one-shot: corrigir `assigned_to` das conversas órfãs em instâncias dedicadas.
- `supabase/functions/send-chat-message/index.ts`: gravar `assigned_to` no envio manual quando ainda estiver vazio.

### Fora de escopo

- Mudar a tela da Carteira ou a lógica “Mar Aberto vs Atribuição”.
- Reescrever a lógica de campanha ou o motor de envio.
- Atribuir clientes em massa para a Sabrina (decisão operacional do gestor).

