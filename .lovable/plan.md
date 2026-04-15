

# Correção: Áudio reproduzível no WhatsApp via Gupshup

## Problema

O remuxer WebM→OGG produz um arquivo OGG tecnicamente aceito pelo Gupshup, mas o WhatsApp não consegue reproduzir — mostra "Este áudio não está mais disponível". O arquivo OGG gerado tem problemas estruturais (pre-skip=0, cálculo de duração de frame possivelmente incorreto).

## Diagnóstico

O codec dentro do WebM e do OGG é o mesmo (Opus). Porém o remuxer customizado em TypeScript puro tem limitações:
- Pre-skip definido como 0 (deveria ser ≥312 para inicialização correta do decoder Opus)
- Assume frame de 960 samples (20ms) sem parsear o TOC byte real do Opus
- Qualquer erro no parsing EBML ou na construção das páginas OGG resulta em arquivo não-reproduzível

## Solução: Corrigir o remuxer com pre-skip correto e parsing do TOC byte

### 1. `supabase/functions/_shared/webm-to-ogg.ts`

Duas correções críticas:

**a) Pre-skip = 312** (valor padrão para encoder Opus, equivalente a 6.5ms de delay):
```typescript
headView.setUint16(10, 312, true); // pre-skip = 312 samples (standard Opus encoder delay)
```

**b) Parsear duração real do frame a partir do TOC byte de cada pacote Opus** ao invés de assumir 960 fixo:
```typescript
function getOpusFrameDuration(packet: Uint8Array): number {
  if (packet.length === 0) return 960;
  const toc = packet[0];
  const config = (toc >> 3) & 0x1F;
  // Mapping config → frame size in samples at 48kHz
  const frameSizes = [480,960,1920,2880, 480,960,1920,2880,
                      480,960,1920,2880, 480,960,
                      480,960, 120,240,480,960,
                      120,240,480,960, 120,240,480,960,
                      120,240,480,960];
  const baseSize = frameSizes[config] || 960;
  const c = toc & 0x03;
  if (c === 0) return baseSize;
  if (c === 1 || c === 2) return baseSize * 2;
  // c === 3: variable — read frame count from byte 1
  if (packet.length < 2) return baseSize;
  const frameCount = packet[1] & 0x3F;
  return baseSize * frameCount;
}
```

E no loop de construção de páginas, usar a duração real:
```typescript
for (let i = 0; i < opusPackets.length; i++) {
  granulePos += BigInt(getOpusFrameDuration(opusPackets[i]));
  // ...build page...
}
```

### 2. Sem outras alterações

- O `send-chat-message/index.ts` já chama o remuxer corretamente
- O `whatsapp-sender.ts` já envia como tipo `audio` com a URL do OGG
- O frontend já grava e faz upload normalmente

### Resultado esperado

- OGG com pre-skip correto e granule positions precisas → WhatsApp consegue reproduzir inline
- Sem re-encoding, apenas troca de container (operação rápida e leve)
- Se o remuxer falhar, o fallback existente envia como `document` (arquivo baixável)

