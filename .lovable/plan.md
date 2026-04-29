## Problema

Ao enviar mensagem no WhatsApp do Contact Center:

1. **Demora ~3s perceptíveis** entre apertar Enter e a mensagem "sumir" do campo de digitação.
2. **Foco é perdido**: o operador precisa clicar de novo no textarea para escrever a próxima mensagem.

## Causa raiz

No `WhatsAppChatLayout.tsx → handleSend`:
```ts
setSending(true);
try {
  await sendTextMessage(...)  // ~3s aguardando edge function + WhatsApp API
} finally {
  setSending(false);
}
```

Esse `sending=true` é propagado até `ChatInput`:
```tsx
<ChatInput disabled={sending || conversation.status === "waiting"} ... />
```

E o `<Textarea disabled={disabled}>` faz o navegador **remover o foco** do input enquanto está desabilitado. Quando libera, o foco não volta sozinho.

Já existe **optimistic UI** (a mensagem aparece imediatamente no chat com status "sending"), então **não há motivo para bloquear o input** enquanto a edge function processa em segundo plano.

Adicionalmente, o `ChatInput.handleSend` limpa o texto **depois** de chamar `onSend`, e como a chamada é assíncrona no caminho real, há um pequeno delay extra antes do textarea ficar vazio.

## Solução

### 1. `ChatInput.tsx`

- **Limpar o texto e voltar o foco imediatamente**, antes de invocar `onSend`. Como o envio é fire-and-forget pela ótica do componente, a UI fica responsiva instantaneamente.
- Adicionar `requestAnimationFrame` + `textareaRef.current?.focus()` após o envio para garantir que o cursor permaneça no campo (Enter já está dentro do textarea, mas após o disabled toggling do pai o foco era perdido).

```tsx
const handleSend = () => {
  const trimmed = text.trim();
  if (!trimmed) return;
  setText("");                         // limpa AGORA
  const wasInternal = isInternalMode;
  setIsInternalMode(false);
  if (wasInternal && onSendInternalNote) onSendInternalNote(trimmed);
  else onSend(trimmed);
  requestAnimationFrame(() => textareaRef.current?.focus());
};
```

### 2. `ChatPanel.tsx` — desacoplar `disabled` do `sending`

Hoje:
```tsx
<ChatInput disabled={sending || conversation.status === "waiting"} ... />
```

Como há optimistic UI, **não precisamos travar o input durante o `sending`**. Basta travar quando a conversa está em `waiting` (estado real onde o operador não pode responder). Mantemos o `sending` apenas para outros indicadores (ex.: spinner em botões de mídia, se houver).

```tsx
<ChatInput disabled={conversation.status === "waiting"} ... />
```

Botões de anexo/áudio podem continuar usando `sending` se necessário, mas isso é separado e pode ser mantido como está sem impacto no campo de texto.

### 3. `WhatsAppChatLayout.tsx → handleSend` — não aguardar bloqueando UX

A função continua `async` (precisamos do `try/catch` para marcar mensagem como falha), mas removemos `setSending(true/false)` do redor da chamada de texto. O estado de erro é refletido na própria mensagem otimista (status `failed`), que é o padrão do WhatsApp.

Para mídia/áudio (que dependem de upload e não têm UI otimista equivalente), `setSending` permanece — esses fluxos justificam o bloqueio temporário.

```ts
const handleSend = async (text, replyToMessageId) => {
  // ... constrói optimisticMsg e adiciona ao state
  try {
    await sendTextMessage(...);
  } catch (err) {
    setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "failed" } : m));
    toast.error(err.message || "Erro ao enviar mensagem");
  }
  // sem setSending
};
```

## Resultado esperado

- Pressionar Enter: o texto desaparece do campo **imediatamente**, a mensagem aparece no chat com status "sending" (relógio), e o cursor permanece no textarea pronto para a próxima mensagem.
- O envio real à edge function continua acontecendo em background; quando o Realtime entrega a confirmação, a mensagem otimista é substituída pela real (status "sent"/"delivered").
- Se falhar, a mensagem otimista vira "failed" no chat e um toast aparece.

## Arquivos afetados

- `src/components/contact-center/whatsapp/ChatInput.tsx` — limpar texto + focus antes do `onSend`.
- `src/components/contact-center/whatsapp/ChatPanel.tsx` — remover `sending` do `disabled` do `ChatInput`.
- `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` — remover `setSending(true/false)` em `handleSend` (apenas no envio de texto). Manter para mídia e áudio.
