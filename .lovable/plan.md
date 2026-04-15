

# Download de Áudio no Chat WhatsApp

## O que será feito

Adicionar um botão de download ao lado do player de áudio nas mensagens do chat, permitindo que o operador baixe o arquivo de áudio localmente. O comportamento será idêntico ao já existente para documentos (`handleDocumentDownload`).

## Mudança

### `src/components/contact-center/whatsapp/ChatMessage.tsx`

No bloco `case "audio"` (linha 73-97), adicionar um botão `Download` ao lado do `<audio>`:

- Envolver o `<audio>` e o botão em um `flex` horizontal
- Reutilizar a função `handleDocumentDownload` já existente no componente
- Usar o ícone `Download` (já importado) com estilo compacto
- O filename será `audio.mp3` (ou extraído da URL se possível)

```tsx
case "audio":
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <audio src={message.media_url || ""} controls className="max-w-[250px]" />
        {message.media_url && (
          <button
            type="button"
            onClick={() => handleDocumentDownload(message.media_url!, "audio")}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex-shrink-0"
            title="Baixar áudio"
          >
            <Download className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
      {/* transcrição permanece igual */}
    </div>
  );
```

Nenhum outro arquivo será alterado.

