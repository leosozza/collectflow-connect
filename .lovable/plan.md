## Objetivo
Não exibir nenhum texto/legenda no balão de mensagens de imagem enviadas pelo operador (outbound). Hoje, em alguns casos o nome do arquivo (ex.: "Ciliegie con fiocchetto bordeaux.png") aparece como caption abaixo da imagem.

## Causa
Em `src/components/contact-center/whatsapp/ChatMessage.tsx` (linhas 198-202), o `case "image"` renderiza um `<p>` com `message.content` sempre que ele existe. Quando o registro veio com o nome do arquivo gravado em `content` (histórico antigo ou normalização do backend), esse texto aparece no chat.

No envio atual (`sendMediaMessage` em `conversationService.ts`, linha 297) já mandamos `content: ""` para imagens, então a correção é apenas de renderização — sem mexer em backend nem em edge functions.

## Mudança
Arquivo: `src/components/contact-center/whatsapp/ChatMessage.tsx` (case `"image"`, ~linha 187-204)

- Remover o bloco `{message.content && (<p>...</p>)}` apenas para mensagens **outbound** de imagem.
- Manter o caption para mensagens **inbound** (cliente pode mandar imagem com legenda real que queremos exibir).

Resultado: imagens enviadas pelo operador aparecem só com a thumbnail (e horário/ticks no rodapé já existentes), sem texto algum.

## Fora de escopo
- Nenhuma alteração em `sendMediaMessage`, edge functions, schema, ou em outros tipos (`video`, `audio`, `document`).
- Sem mudança em mensagens inbound.
