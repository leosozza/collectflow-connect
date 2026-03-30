

# Plano: Substituir Etiquetas por Tabulações WhatsApp no sidebar de conversa

## Resumo

Remover o sistema de etiquetas (TagManager) do sidebar direito da conversa e substituir por um seletor de tabulações WhatsApp (`call_disposition_types` com `channel='whatsapp'`). CPC e CPE aparecem primeiro e são mutuamente exclusivos. Demais tabulações podem ser selecionadas livremente.

---

## 1. Migração: tabela `conversation_disposition_assignments`

```sql
CREATE TABLE public.conversation_disposition_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  disposition_type_id uuid NOT NULL REFERENCES call_disposition_types(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, disposition_type_id)
);
ALTER TABLE public.conversation_disposition_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage disposition assignments"
  ON public.conversation_disposition_assignments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

---

## 2. Novo componente: `DispositionSelector.tsx`

**Arquivo**: `src/components/contact-center/whatsapp/DispositionSelector.tsx`

- Busca `call_disposition_types` onde `channel='whatsapp'` e `active=true`, ordenado por `sort_order`
- Busca `conversation_disposition_assignments` para a conversa atual
- Exibe as tabulações como lista de botões/badges clicáveis
- **CPC e CPE aparecem no topo**, separados visualmente (seção "Identificação do Contato")
- **Regra de exclusividade**: ao selecionar CPC, remove CPE automaticamente (e vice-versa)
- Demais tabulações (Acordo Formalizado, Em Negociação, etc.) ficam abaixo, sem restrição
- Toggle: clique para atribuir, clique novamente para remover
- Cores vêm do campo `color` da `call_disposition_types`

---

## 3. Atualizar ContactSidebar

**Arquivo**: `src/components/contact-center/whatsapp/ContactSidebar.tsx`

- Remover import do `TagManager`
- Remover state `assignedTags` e função `loadTags`
- Remover o Card "Etiquetas" inteiro (linhas 256-272)
- Adicionar o novo `DispositionSelector` no mesmo local, com título "Tabulação"
- Props: `conversationId`, `tenantId`

---

## 4. Limpar WhatsAppChatLayout

**Arquivo**: `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`

- Remover carregamento de `conversation_tags` e `conversation_tag_assignments` (linhas 63-74)
- Remover states `tags` e `tagAssignments`
- Remover passagem de `tags`/`tagAssignments` como props para `ConversationList`
- ConversationList continua funcionando — filtro de etiquetas na lista será removido ou adaptado em task futura

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Nova tabela `conversation_disposition_assignments` |
| `DispositionSelector.tsx` | **Novo**: seletor de tabulações com exclusividade CPC/CPE |
| `ContactSidebar.tsx` | Remover TagManager, usar DispositionSelector |
| `WhatsAppChatLayout.tsx` | Remover carregamento de conversation_tags |

## O que NÃO muda
- `TagManager.tsx` (preservado no código, apenas desvinculado)
- `conversation_tags` / `conversation_tag_assignments` (tabelas preservadas)
- `CallDispositionTypesTab.tsx` e `DispositionTabsWrapper.tsx`
- Filtro de etiquetas no ConversationList (será adaptado separadamente)

