

# Plano: Menu de Contexto na Lista de Conversas do WhatsApp

## O que será feito

Adicionar um menu de contexto (clique direito) em cada item da lista de conversas do WhatsApp, com as seguintes opções:

1. **Marcar como Aberta / Aguardando / Fechada** — alterar status da conversa
2. **Excluir conversa** — visível apenas para usuários com `role === "admin"`

## Alterações

### 1. `ConversationList.tsx`
- Importar `ContextMenu` do shadcn/ui e `AlertDialog` para confirmação de exclusão
- Envolver cada item de conversa com `<ContextMenu>` + `<ContextMenuTrigger>` + `<ContextMenuContent>`
- Opções do menu:
  - Alterar status (3 opções, destacando o status atual)
  - Separador
  - "Excluir conversa" (apenas se `isAdmin === true`, com estilo destrutivo vermelho)
- Ao clicar "Excluir", abrir `AlertDialog` de confirmação antes de executar

### 2. `ConversationList.tsx` — Props
- Adicionar props: `onStatusChange(convId, status)` e `onDelete(convId)`
- O componente pai (`WhatsAppChatLayout`) passará as callbacks

### 3. `WhatsAppChatLayout.tsx`
- Criar função `handleDeleteConversation` que deleta `chat_messages` e depois a `conversation` do banco
- Se a conversa excluída for a selecionada, limpar a seleção
- Recarregar lista após exclusão

### 4. `conversationService.ts`
- Adicionar função `deleteConversation(id)` que deleta mensagens associadas e a conversa

## Segurança
- A exclusão só aparece no menu para `isAdmin === true` (verificado via `usePermissions` no layout pai)
- RLS existente nas tabelas `conversations` e `chat_messages` já protege no backend

