

## Corrigir formatação WhatsApp para texto colado em emojis/símbolos

### Problema

Na screenshot, a mensagem `🚨*ATENÇÃO*🚨 Quebra de acordo` aparece com `*ATENÇÃO*` literal em vez de **ATENÇÃO** em negrito.

Causa: em `src/lib/whatsappFormat.tsx`, as funções `isBoundaryBefore`/`isBoundaryAfter` só aceitam fronteira quando o caractere adjacente é espaço, parênteses, aspas etc. Como o caractere antes do `*` é um emoji (🚨), a verificação falha e o marcador é tratado como literal.

O WhatsApp real considera como fronteira **qualquer caractere que não seja letra/dígito/underscore** — inclui emojis, símbolos e pontuação.

### Mudanças

**`src/lib/whatsappFormat.tsx`** — relaxar as duas funções de fronteira:

```ts
function isBoundaryBefore(prev: string | undefined): boolean {
  if (prev === undefined) return true;
  // Qualquer coisa que não seja letra/dígito/underscore vale como fronteira (inclui emojis)
  return !/[\p{L}\p{N}_]/u.test(prev);
}
function isBoundaryAfter(next: string | undefined): boolean {
  if (next === undefined) return true;
  return !/[\p{L}\p{N}_]/u.test(next);
}
```

E atualizar a regex em `stripWhatsAppMarkers` com a mesma lógica para previews:

```ts
.replace(/(^|[^\p{L}\p{N}_])\*([^*\n]+?)\*(?=$|[^\p{L}\p{N}_])/gu, "$1$2")
.replace(/(^|[^\p{L}\p{N}_])_([^_\n]+?)_(?=$|[^\p{L}\p{N}_])/gu, "$1$2")
.replace(/(^|[^\p{L}\p{N}_])~([^~\n]+?)~(?=$|[^\p{L}\p{N}_])/gu, "$1$2")
```

### Validação

1. `🚨*ATENÇÃO*🚨` → 🚨**ATENÇÃO**🚨
2. `*Olá* mundo` → **Olá** mundo (continua funcionando)
3. `foo*bar*baz` → permanece literal (cercado por letras, sem fronteira)
4. `(_itálico_)` → (*itálico*)
5. `Custa R$ 5*` → literal (sem fechamento)
6. Preview da lista de conversas exibe `🚨ATENÇÃO🚨 Quebra…` sem os asteriscos.

Sem alterações em outros arquivos. O runtime error reportado é resíduo de build anterior — desaparece no próximo rebuild.

