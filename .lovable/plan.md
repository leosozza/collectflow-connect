## Diagnóstico

### Problema 1 — "Instância não encontrada" ao enviar (inclui emoji)

No `WhatsAppChatLayout.tsx` (linhas 707–718), o envio depende de localizar a instância no estado local `instances`:

```ts
const getInstanceForConv = () =>
  instances.find((i) => i.id === selectedConv.instance_id) || null;
```

Esse array pode estar **filtrado** (operador sem atribuição em `operator_instances`) ou **incompleto** (instância recente). Quando a busca falha, o frontend bloqueia o envio com toast `"Instância não encontrada"` — afetando qualquer envio (texto, emoji, mídia), não só emojis. O usuário percebeu durante o envio de emoji, mas a causa não é o emoji em si.

A própria edge function `send-chat-message` já faz o lookup correto (`endpoint_id || instance_id`) com mensagem específica. O gate no front é redundante e mais restritivo do que precisa ser.

### Problema 2 — Nome do arquivo aparecendo embaixo da imagem

Dois pontos cooperam para isso:

1. **Frontend** (`src/services/conversationService.ts`, linha 297): `sendMediaMessage` envia `content: fileName` para a edge function — então o nome do arquivo vira "texto da mensagem".
2. **Edge function** (`supabase/functions/send-chat-message/index.ts`, linha 213): monta o payload do provedor com `caption: content || safeFileName || ""` — se o operador não digitou legenda, manda o nome do arquivo como caption ao WhatsApp.

Resultado: o destinatário vê uma legenda com o nome do arquivo (ex.: `colado-1739.jpg`) e nossa própria UI também renderiza essa string como caption (`ChatMessage.tsx` linhas 198/248).

Para **documentos** (PDF, etc.) o nome do arquivo deve continuar sendo exibido — é o comportamento nativo do WhatsApp e da nossa UI (`ChatMessage.tsx` linha 256).

## Plano de correção

### 1. `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx`

- Em `handleSend` e `handleSendMedia`/`handleSendAudio`, **remover o bloqueio** baseado em `getInstanceForConv()`. A edge function valida e devolve erro claro caso falte instância.
- Manter `selectedInstance` (linha 900) como info visual (badge no cabeçalho) — não bloqueante. Se não achar local, exibir o nome a partir de `selectedConv` via fallback simples (ou nada).

### 2. `src/services/conversationService.ts` — `sendMediaMessage`

- Trocar `content: fileName` por `content: mediaType === "document" ? fileName : ""` no body do POST e no objeto retornado (otimista). Assim:
  - Documentos continuam exibindo o nome.
  - Imagens, vídeos e áudios não exibem legenda automática.

### 3. `supabase/functions/send-chat-message/index.ts` (linha 213)

- Trocar:
  ```ts
  caption: content || safeFileName || ""
  ```
  por:
  ```ts
  caption: content || ""
  ```
  Apenas a legenda digitada pelo operador é enviada ao WhatsApp. `fileName` permanece sendo enviado em `media.fileName` (necessário para documentos).

### Resultado esperado

- Envio de emoji (e qualquer texto) deixa de falhar com "Instância não encontrada" mesmo se o array local de instâncias estiver desatualizado/filtrado — a edge function continua sendo a fonte de verdade.
- Imagens/vídeos/áudios chegam sem o nome do arquivo como legenda, tanto no destinatário quanto na própria interface; documentos seguem mostrando o nome.

Sem alterações de banco, sem mexer em outros provedores ou módulos.