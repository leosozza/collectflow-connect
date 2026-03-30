

# Plano: Identificação visual de conversas sem cliente vinculado + ações para números externos

## Resumo

Adicionar indicador visual na lista de conversas para contatos sem cliente vinculado, e incluir opção "Ignorar" no menu de contexto (além do "Excluir" já existente para admins).

---

## 1. Indicador visual na lista de conversas

**Arquivo**: `src/components/contact-center/whatsapp/ConversationList.tsx`

No avatar da conversa, quando `conv.client_id` for `null`:
- Adicionar um pequeno ícone de alerta (Link2Off ou AlertTriangle) no canto do avatar
- Aplicar borda amarela/laranja no avatar para destacar visualmente
- Adicionar tooltip: "Cliente não vinculado"

No nome da conversa, quando `conv.client_id` for `null`:
- Exibir badge discreto "Não vinculado" ao lado do nome

---

## 2. Filtro por vinculação

**Arquivo**: `src/components/contact-center/whatsapp/ConversationList.tsx`

Adicionar novo filtro na área de filtros:
- Select com opções: "Todos" / "Vinculados" / "Não vinculados"
- Default: "Todos"
- Filtrar por `conv.client_id !== null` (vinculados) ou `conv.client_id === null` (não vinculados)

---

## 3. Opção "Ignorar" no menu de contexto

**Arquivo**: `src/components/contact-center/whatsapp/ConversationList.tsx`

No ContextMenu, adicionar item "Ignorar conversa" que:
- Muda o status da conversa para `"closed"` via `onStatusChange`
- Disponível para todos os operadores (não apenas admins)
- Ícone: `EyeOff` ou `BanIcon`

O "Excluir" já existe e é restrito a admins — permanece como está.

---

## 4. Garantir que props estão disponíveis

O campo `client_id` já faz parte da interface `Conversation` e é retornado pelo `fetchConversations`. Nenhuma mudança no service ou banco.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `ConversationList.tsx` | Indicador visual no avatar, badge "Não vinculado", filtro de vinculação, item "Ignorar" no context menu |

## O que NÃO muda
- Banco de dados (sem migrações)
- ContactSidebar (vinculação de cliente permanece igual)
- ChatPanel, serviços, edge functions

