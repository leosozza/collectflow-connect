

# Correção: PDF não chega pela API Oficial (Gupshup)

## Causa raiz

O log mostra claramente o problema. Quando o Gupshup envia um PDF, o payload chega com `type: "file"`:

```text
type: "file", payload: { name: "Cotação Sagrada Familia.pdf", url: "https://filemanager.gupshup.io/...", contentType: "application/pdf" }
```

Porém, o código no `gupshup-webhook` (linha 105) faz:

```typescript
const canonicalType = ["text", "image", "audio", "video", "document"].includes(msgType) ? msgType : "text";
```

Como `"file"` **não está na lista**, ele cai no fallback `"text"`. Resultado:
- `canonicalType = "text"` → a mensagem é salva como texto
- A condição `mediaUrl && canonicalType !== "text"` impede a persistência da mídia
- O `content` fica vazio (não há `text` nem `caption` no payload de arquivo)
- **Só aparece o horário** — exatamente o que você viu no screenshot

## Correção

**Arquivo:** `supabase/functions/gupshup-webhook/index.ts`

### 1. Mapear `"file"` para `"document"` (linha ~105)

```typescript
// Normalizar tipo — Gupshup usa "file" para documentos
const rawType = msgType === "file" ? "document" : msgType;
const canonicalType = ["text", "image", "audio", "video", "document"].includes(rawType) ? rawType : "text";
```

### 2. Extrair nome do arquivo como content (linha ~61)

Adicionar fallback para `payload.name` quando o tipo for file/document:

```typescript
const content = msgPayload.payload?.text 
  || msgPayload.payload?.caption 
  || (msgType === "file" ? msgPayload.payload?.name : null)
  || payload.payload?.text 
  || "";
```

### 3. Extrair `media_mime_type` do payload Gupshup (linha ~109)

O Gupshup envia `contentType` no payload. Usar como fallback para o mime type se a persistência falhar:

```typescript
let finalMimeType: string | null = msgPayload.payload?.contentType || null;
```

Assim, mesmo que o download falhe, o mime type é preservado.

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/gupshup-webhook/index.ts` | 3 correções pontuais (~5 linhas alteradas) |

Nenhuma mudança no banco, frontend ou outros edge functions necessária. O `ChatMessage.tsx` já renderiza documentos corretamente — o problema era exclusivamente o webhook não reconhecer `"file"` como documento.

