

## Análise e correções dos ajustes de WhatsApp

Revisei o código implementado. Encontrei **2 bugs reais** que precisam ser corrigidos antes de validar com o operador. O resto está consistente: menu de ações com ícone hover, confirmação de exclusão, dialog de edição, badge "editada" com tooltip do texto original, ícone Trash2 nos deletados, realtime UPDATE escutando, restrição admin para excluir conversa, e bypass de edição em instâncias oficiais.

### Bug 1 — Botão "Excluir para o cliente" pode ficar habilitado em mensagens inbound

`ChatMessage.tsx` linhas 90-96:

```ts
const canDelete =
  isOutbound && !isInternal && !isDeleted && !isOptimistic &&
  message.status !== "failed" &&
  !!(message as any).provider_message_id || !!message.external_id;
```

Por precedência (`&&` antes de `||`), basta `external_id` existir para o item ficar habilitado, ignorando todas as guardas anteriores. Falta um parêntese envolvendo o teste de id do provider.

**Correção**: trocar para `(... provider_message_id || ... external_id)`. Isso restaura a guarda real (apenas outbound, não interna, não deletada, não otimista, não falhada).

### Bug 2 — `original_content` é perdido em uma 2ª edição

`supabase/functions/manage-chat-message/index.ts`:

- Linha 57: o `SELECT` na tabela `chat_messages` **não inclui** as colunas `original_content` nem `edited_at`.
- Linha 181: `original_content: msg.original_content || msg.content` — como `msg.original_content` é sempre `undefined` (não foi selecionado), o fallback vai para `msg.content`, que na 2ª edição já é o texto editado da 1ª edição. O texto original é perdido.

**Correção**:
1. Adicionar `original_content, edited_at` ao SELECT da linha 57.
2. Manter o fallback `msg.original_content || msg.content` — agora funciona corretamente: se já existe original_content gravado (1ª edição), preserva; senão grava o atual.

### Validação após as correções

Após aplicar, vou validar no preview com o usuário logado:

1. Abrir uma conversa com mensagens **inbound** → confirmar que o menu MoreVertical **não aparece** (já controlado por `showActionsMenu = isOutbound`).
2. Abrir uma conversa com mensagem **outbound de texto recente** → menu aparece com Responder, Editar, Excluir; clicar Editar abre dialog, salvar, ver badge "editada" e tooltip mostrando o original.
3. Editar a mesma mensagem **uma 2ª vez** e conferir que o tooltip ainda mostra o **texto original verdadeiro**, não a 1ª edição.
4. Outbound de **áudio** → menu aparece, "Editar" desabilitado (não é texto), "Excluir" habilitado; após excluir, o player de áudio fica esmaecido, ícone Trash2 aparece no rodapé com tooltip de data/hora.
5. Em instância **Gupshup oficial** → "Editar" aparece desabilitado com tooltip "Edição não suportada nas instâncias oficiais (Meta)".
6. Logar como **operador comum** → menu de contexto da conversa não tem "Excluir conversa".

### Arquivos a editar

1. `src/components/contact-center/whatsapp/ChatMessage.tsx` — parênteses no `canDelete`.
2. `supabase/functions/manage-chat-message/index.ts` — incluir `original_content, edited_at` no SELECT.

