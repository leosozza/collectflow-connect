

# Gravador de Áudio com Pausar, Retomar e Preview

## O que será feito

Reescrever o `AudioRecorder.tsx` para ter 3 estados:

1. **Gravando** — botão pausar + botão descartar (lixeira)
2. **Pausado** — botão retomar + botão preview/enviar
3. **Preview** — player de áudio para ouvir antes de enviar + botão enviar + botão descartar

### Fluxo do usuário

```text
[Mic] → clica → GRAVANDO (timer pulsando, pausar, descartar)
                    ↓ pausa
              PAUSADO (retomar, ouvir/finalizar, descartar)
                    ↓ finalizar
              PREVIEW (player <audio>, enviar, descartar)
                    ↓ enviar
              onRecorded(blob) → volta ao estado inicial
```

## Mudanças

**Arquivo:** `src/components/contact-center/whatsapp/AudioRecorder.tsx`

- Adicionar estados: `"idle" | "recording" | "paused" | "preview"`
- Usar `MediaRecorder.pause()` / `MediaRecorder.resume()` (suportado em todos os navegadores modernos)
- No estado "preview": criar `URL.createObjectURL(blob)` e renderizar `<audio controls src={...} />`
- Botões:
  - Gravando: **Pausar** (Pause icon) + **Descartar** (Trash icon)
  - Pausado: **Retomar** (Mic icon) + **Parar e ouvir** (Play icon)
  - Preview: **Enviar** (Send icon) + **Descartar** (Trash icon)
- `onRecorded(blob)` só é chamado quando o usuário clica "Enviar" no preview
- Timer pausa junto com a gravação
- Revogar `objectURL` ao descartar ou enviar

**Ícones adicionais:** `Pause, Play, Trash2, Send` do lucide-react

Nenhuma mudança em outros arquivos — a interface `onRecorded(blob)` permanece igual.

