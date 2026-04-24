# Análise — Duplicação de conversas (Nara Regina Nunes Barboza)

## Diagnóstico

A cliente tem **2 conversas abertas na mesma instância**, ambas vinculadas ao mesmo `client_id` e `endpoint_id`:

| Conversa | `remote_phone` | Criada em | Mensagens |
|---|---|---|---|
| `ca5795fb…` | `5551995719793` (13 díg., E.164 correto) | 24/04 13:35 | 2 outbound |
| `e9b32e87…` | `555195719793` (12 díg., **sem o "9"**) | 24/04 13:36 | 4 (in/out) |

A Evolution mandou o número do mesmo contato em formatos diferentes — o sistema criou uma segunda conversa em vez de reaproveitar a existente.

## Causa raiz

Na RPC `ingest_channel_event` (linhas 24 e 47):

```sql
_clean_phone := regexp_replace(_remote_phone, '\D', '', 'g');  -- só remove não-dígitos
...
WHERE remote_phone = _clean_phone   -- busca exata sem normalizar
```

A **resolução de cliente** (linha 35) usa `normalize_phone_br()` corretamente, mas a **busca/criação da conversa** usa o telefone cru. Resultado: qualquer variação de formato (com/sem DDI 55, com/sem 9º dígito) abre conversa nova.

Verificação no banco: **211 grupos** de conversas duplicadas no mesmo (client_id, endpoint_id) — problema sistêmico, não isolado.

## Plano de correção

### 1. Corrigir a RPC `ingest_channel_event` (causa raiz)
- Substituir `_clean_phone` pelo resultado de `normalize_phone_br(_remote_phone)` antes de buscar/criar a conversa.
- Manter fallback por `RIGHT(digits, 8)` quando `normalize_phone_br` retornar NULL ou houver legado.
- Buscar conversa existente também por `phone_last8` para casar com gravações antigas em formato variado.

### 2. Backfill: normalizar `conversations.remote_phone`
- Migração SQL: `UPDATE conversations SET remote_phone = normalize_phone_br(remote_phone) WHERE normalize_phone_br(remote_phone) IS NOT NULL AND remote_phone <> normalize_phone_br(remote_phone);`
- Tratar conflito de unicidade (caso já exista a versão normalizada): identificar pares e mesclar.

### 3. Mesclar conversas duplicadas
Para cada grupo `(tenant_id, endpoint_id, client_id)` com >1 conversa:
- Manter a conversa **mais antiga** (preserva histórico inicial) OU a com `last_message_at` mais recente — escolher pela **mais recente** para evitar quebrar a inbox atual do operador.
- Mover `chat_messages` das conversas perdedoras (`UPDATE chat_messages SET conversation_id = <vencedora>`).
- Recalcular `unread_count`, `last_message_at`, `last_message_content`, `last_interaction_at` na vencedora.
- Excluir as conversas perdedoras (após mover mensagens, tags, dispositions, transfers).

### 4. Restrição de unicidade
- Criar índice único parcial: `CREATE UNIQUE INDEX conversations_tenant_endpoint_phone_uniq ON conversations (tenant_id, endpoint_id, remote_phone) WHERE endpoint_id IS NOT NULL;`
- Garante que a RPC nunca mais consiga inserir duplicata mesmo em race condition.

### 5. Validação
- Re-rodar a query de duplicatas → deve retornar 0.
- Conferir conversa unificada da Nara (deve manter as 6 mensagens cronologicamente).

## Arquivos / objetos afetados

- RPC `public.ingest_channel_event` (migração SQL)
- Tabela `public.conversations` (backfill + índice único)
- Tabela `public.chat_messages` (re-vinculação por conversation_id)
- Tabelas auxiliares: `conversation_tag_assignments`, `conversation_disposition_assignments`, `conversation_transfers` (re-vinculação)

## Risco

- Mesclagem altera histórico visível na Inbox — operadores verão a conversa unificada.
- Backup automático do Supabase cobre rollback se algo der errado.
- Índice único impede regressão futura.

Posso prosseguir com os 5 passos?
