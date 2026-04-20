

## Diagnóstico — Operador vê 0 conversas (Maria Eduarda)

A causa raiz é uma **falha SQL silenciosa** dentro das RPCs `SECURITY DEFINER` usadas para listar conversas de não-admins.

### O que foi descoberto

- A Maria Eduarda (`profile_id c176575c…`, role `operador`) está corretamente vinculada às 3 instâncias dela em `operator_instances`.
- Existem **211 conversas** nas instâncias dela. Mais especificamente, ao aplicar a regra de visibilidade no SQL:
  - 28 com `assigned_to = profile dela`
  - 46 via `clients.operator_id = profile dela`
  - 5 sem `assigned_to`/`client_id` mas na instância dela (regra `operator_instances`)
  - = ao menos ~79 deveriam ser visíveis.
- Mesmo assim, o painel mostra **Aberta 0 / Aguardando 0 / Fechada 0**.

### Causa raiz

Executando `SELECT * FROM get_visible_conversation_counts(...)` simulando a sessão dela, o Postgres retorna o erro:

```
42702: column reference "unread_count" is ambiguous
DETAIL: It could refer to either a PL/pgSQL variable or a table column.
```

A função tem `RETURNS TABLE(open_count, waiting_count, closed_count, unread_count)`. Dentro do corpo, o CTE `visible` faz `SELECT c.unread_count` e o filtro final usa `COUNT(*) FILTER (WHERE unread_count > 0)`. O PL/pgSQL trata `unread_count` como ambíguo entre a coluna do CTE e o OUT param.

A mesma colisão existe em `get_visible_conversations` (OUT params `status`, `unread_count`, `total_count` colidem com colunas do CTE).

Quando rodada via PostgREST/SDK, a função simplesmente "explode" e o cliente trata como retorno vazio → contador zero e lista vazia. Para o admin, o frontend usa query direta (não a RPC) → por isso só os operadores são afetados.

### Plano de correção

#### 1. Migração SQL — recriar as duas RPCs com aliases não ambíguos

`get_visible_conversation_counts`:
- Renomear o CTE `visible` mantendo as colunas com prefixo, ex.: `SELECT c.status AS conv_status, c.unread_count AS conv_unread`.
- Ajustar o `SELECT` final para `COUNT(*) FILTER (WHERE conv_status = 'open')` etc.
- Retornar a mesma assinatura (sem mudar tipos/ordem).

`get_visible_conversations`:
- Renomear todas as colunas internas do CTE para nomes diferentes dos OUT params (`conv_status`, `conv_unread_count`, `conv_total_count`, etc.).
- Fazer o `SELECT` externo mapear para os nomes públicos via aliases.
- Garantir que a `WHERE` da paginação/filters use os nomes internos.
- Manter assinatura idêntica para não quebrar o frontend.

Ambas continuam `SECURITY DEFINER`, `STABLE`, `search_path = public`. Sem alteração em RLS, schema ou permissões.

#### 2. Defesa no frontend — não engolir erro de RPC silenciosamente

Em `src/services/conversationService.ts`:
- `fetchConversations`: já lança `error`; ok. Adicionar `console.error` antes do throw para facilitar diagnóstico futuro.
- `fetchConversationCounts`: idem.

Em `WhatsAppChatLayout.tsx`:
- React Query já captura o erro mas não exibe — adicionar `onError` no `useInfiniteQuery` e no `useQuery` mostrando `toast.error("Falha ao carregar conversas: ...")` para que falhas semelhantes apareçam imediatamente em produção.

#### 3. Validação após deploy

1. Logar como Maria Eduarda → abrir `/contact-center/whatsapp`.
2. Confirmar que os contadores Aberta/Aguardando/Fechada deixam de ser 0 (deve mostrar ~79+ conversas distribuídas).
3. Confirmar paginação infinita funcionando (scroll).
4. Confirmar filtros (status, instância, "não lidas") aplicando corretamente.
5. Repetir com um admin para garantir que nada quebrou no caminho direto (sem RPC).

### Arquivos impactados

- **Migração SQL** (nova): recriação das funções `get_visible_conversation_counts` e `get_visible_conversations` com aliases internos.
- `src/services/conversationService.ts` — logging defensivo nos throws.
- `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` — `onError` nas duas queries para surfaçar erros.

### Sem impacto

- Schema, RLS, permissões e edge functions seguem inalterados.
- Caminho do admin (query direta) não é tocado.
- Fluxo do botão "Fechar/Abrir conversa" (ChatPanel) que estava na tarefa anterior continua pendente — fará parte do próximo step após confirmar que as conversas voltaram a aparecer.

