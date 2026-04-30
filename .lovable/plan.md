## Problema confirmado

Operador enviou foto `edcbc178-5ac1-4072-9de1-0e31fd0dc39d.jfif` para Keite Raniele em **29/04 19:51** e novamente em **30/04 17:56**. Ambas ficaram com status apenas `sent` (1 ✓), nunca evoluiram para `delivered`/`read`. A cliente respondeu **"estou esperando desde ontem"** e só recebeu quando o operador reenviou a mesma imagem como `.png` (que ficou `read`, ✓✓ azul, 17:57).

### Causa raiz

O fluxo de upload em `WhatsAppChatLayout.handleSendMedia` (linhas 747–776) preserva a **extensão original** do arquivo (`.jfif`) ao salvar no bucket `chat-media`. O envio para o Evolution API usa essa URL/fileName com extensão `.jfif`. O cliente WhatsApp do destinatário **não considera `.jfif` extensão de imagem inline válida** — embora o conteúdo seja JPEG legítimo, a renderização falha silenciosamente. Mesma lógica afeta extensões obscuras (`.jpe`, `.pjpeg`, `.bmp` quando o tipo MIME indica imagem).

Adicionalmente, o upload não passa `contentType` explícito ao Supabase Storage; para `.jfif` o storage cai em `application/octet-stream`, o que agrava o problema.

## Correção (3 camadas defensivas, sem impacto em produção)

### 1. Front-end — normalizar extensão e contentType no upload
Arquivo: `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` (`handleSendMedia`).

Antes do upload:
- Se `file.type === "image/jpeg"` ou `file.type === "image/jpg"`, forçar a extensão do filename salvo no storage para `.jpg` (independente do nome original).
- Aplicar mapa de normalização para outros formatos problemáticos: `.jfif`, `.jpe`, `.pjpeg`, `.pjp` → `.jpg`.
- Passar `{ contentType: file.type, upsert: false }` no `.upload()` para evitar fallback genérico.
- O `fileName` enviado ao Evolution API também passa pela mesma normalização (mantendo nome original do usuário, mas com extensão segura).

Pseudo-código:
```ts
const PROBLEMATIC_IMAGE_EXTS = ["jfif", "jpe", "pjpeg", "pjp"];
const normalizeImageName = (name: string, mimeType: string) => {
  if (!mimeType.startsWith("image/jpeg") && !mimeType.startsWith("image/jpg")) return name;
  return name.replace(/\.(jfif|jpe|pjpeg|pjp)$/i, ".jpg");
};
const safeName = normalizeImageName(rawSafe, file.type);
// upload com contentType: file.type
```

### 2. Edge function — defesa em profundidade no `send-chat-message`
Arquivo: `supabase/functions/send-chat-message/index.ts` (logo após linha 143, dentro do bloco `if (mediaUrl && mediaType)`).

Mesma normalização aplicada à URL e ao `fileName` antes de enviar ao Evolution/Wuzapi:
- Se `mediaType === "image"` e `mimeType` indica JPEG, garantir que `media.fileName` termine em `.jpg` (não `.jfif`).
- Se a `mediaUrl` já está no storage como `.jfif`, gerar URL alternativa renomeando — **mas apenas reescrever o `fileName` enviado ao provider**, sem mover o arquivo (o Evolution baixa pela URL e respeita o `fileName` do payload para o WhatsApp). Não toca arquivos antigos.

Isso protege contra qualquer outra origem que chame essa função (campanhas em massa, automações).

### 3. Migração leve do `safeName` no front (sem efeito retroativo)
Mensagens já enviadas (`sent` mas não `delivered`) **não serão tocadas** — o histórico permanece como está. Só novos uploads são afetados.

## O que NÃO será mexido

- Tabela `chat_messages` (mensagens antigas intactas).
- Storage `chat-media` (arquivos `.jfif` antigos permanecem; ninguém precisa mais abrir).
- Conversas em andamento — a funcionalidade segue idêntica para todos os outros formatos (`.png`, `.jpg`, `.mp4`, `.pdf`, `.ogg`).
- Esquema de DB, RLS, RPCs.
- `whatsapp-webhook` (recebimento de inbound). Não há regressão possível.

## Validação pós-correção

1. Operador anexa imagem `.jfif` no chat → upload no storage cria `*.jpg` → Evolution recebe payload com `fileName="...jpg"`.
2. WhatsApp do destinatário renderiza inline como foto.
3. Status evolui de `sent` → `delivered` → `read` normalmente.
4. Caso de fallback: imagens `.png`/`.jpg` continuam funcionando exatamente como antes (zero regressão).

## Recomendação adicional (apenas relatório, fora deste plano)

- Adicionar uma flag de **alerta operacional**: se uma mensagem outbound ficar `sent` por > 30 minutos sem evoluir para `delivered`, marcar visualmente no chat (badge "⚠ Não confirmado"). Isso evita futuras situações em que o operador acha que entregou e o cliente não recebeu. Posso preparar separadamente caso queira.

## Quer que eu execute?

Correção pequena (1 arquivo do front + 1 ajuste defensivo no edge), zero risco para produção. Aguardo aprovação para aplicar.