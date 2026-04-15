
Diagnóstico
- O áudio já está sendo salvo no storage antes do envio. O log de rede mostra `mediaUrl` apontando para `chat-media/...webm`.
- O problema real é o formato: no fluxo oficial, o recorder gerou `audio/webm;codecs=opus` e o Gupshup recebeu uma URL `.webm`. A API aceita a requisição inicial, mas a entrega falha depois.
- Hoje o `gupshup-webhook` só marca `failed`; ele não grava o motivo no `metadata`, e o `ChatMessage` ainda não mostra esse erro no hover.

Plano de correção
1. Normalizar áudio oficial para MP3 antes do upload
   - Adicionar uma etapa de conversão client-side para MP3 no fluxo oficial.
   - Aplicar isso apenas quando a instância selecionada for oficial.
   - Tanto áudio gravado quanto áudio anexado deverão virar `audio/mpeg` com extensão `.mp3` antes de subir para `chat-media`.
   - Resultado esperado: no oficial, a URL enviada ao Gupshup será sempre `...mp3`, nunca `...webm`.

2. Manter oficial e não oficial separados
   - Não mexer no fluxo não oficial.
   - A conversão para MP3 ficará restrita ao branch oficial (`provider_category` oficial / `provider === "gupshup"`).
   - O sender do Gupshup continua usando apenas `{ type: "audio", url: "..." }`; o que muda é o arquivo salvo.

3. Criar validação defensiva no backend oficial
   - Em `send-chat-message`, se chegar áudio oficial ainda em formato incompatível (ex.: `webm`), bloquear antes de chamar o provider.
   - Persistir a mensagem como `failed` com erro claro no `metadata` e registrar em `webhook_logs`.
   - Isso evita falso “enviado” quando o arquivo já nasce inválido para o oficial.

4. Exibir o motivo da falha no chat
   - Em `gupshup-webhook`, ao receber `failed/error`, salvar reason/code/details do callback em `chat_messages.metadata`.
   - Em `ChatMessage`, mostrar tooltip no ícone de status com `metadata.send_error` / erro do provider ao passar o mouse.

5. Preservar o restante do módulo
   - Não alterar campanhas, automação, waiting/open, SLA, reply, filtros, `/atendimento` ou outros blocos.
   - Não mexer no fluxo de imagem, vídeo e PDF além do necessário para manter estabilidade.
   - Transcrição continua como está; apenas passará a usar o arquivo oficial já salvo em MP3.

Arquivos a ajustar
- `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` — converter/normalizar áudio oficial antes do upload
- `src/components/contact-center/whatsapp/AudioRecorder.tsx` e/ou `ChatInput.tsx` — estado de conversão/envio no fluxo oficial
- `src/components/contact-center/whatsapp/ChatMessage.tsx` — tooltip do erro no status
- `supabase/functions/send-chat-message/index.ts` — trava defensiva + persistência de erro para áudio oficial incompatível
- `supabase/functions/gupshup-webhook/index.ts` — salvar motivo do failed/error em `metadata`
- novo util frontend para conversão de áudio para MP3

Critérios de aceite
- Conta oficial salva áudio outbound em `chat-media` como `.mp3` / `audio/mpeg`
- Gupshup recebe URL de MP3 no payload de áudio
- Conta não oficial continua sem alteração de comportamento
- Falhas passam a aparecer no hover do ícone de status
- Histórico, transcrição e renderização do chat permanecem consistentes
- Sem regressão no restante do bloco de WhatsApp
