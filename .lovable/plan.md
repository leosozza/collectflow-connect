

# Fix: Timestamps e Badges Invisíveis na Lista de Conversas

## Diagnóstico

Os elementos existem no DOM (confirmado via browser extract: timestamp "agora" e badge "2" estão lá), mas são empurrados para fora da área visível.

**Causa raiz**: O `<button>` (linha 386-390) é um flex child dentro do `ContextMenuTrigger`. Buttons em flexbox têm `min-width: auto` por padrão, o que impede que encolham abaixo do tamanho do conteúdo. Mesmo com `overflow-hidden`, o conteúdo interno expande além dos 360px do container pai, empurrando timestamp e badge para fora.

## Solução

**Arquivo:** `src/components/contact-center/whatsapp/ConversationList.tsx`

### Mudança única
Adicionar `min-w-0` ao `<button>` (linha 388) para quebrar o `min-width: auto` implícito do flexbox:

```
className={`w-full text-left px-3 py-[10px] border-b ... overflow-hidden min-w-0 ${...}`}
```

Isso permite que a cadeia `min-w-0` funcione desde o container raiz até os spans de texto, forçando o truncamento com `...` e liberando espaço para o timestamp e badge à direita.

### Verificação
- Nenhum outro arquivo alterado
- Nenhuma mudança de backend
- Layout ficará igual ao WhatsApp: nome truncado + horário à direita (verde se não lida), mensagem truncada + badge à direita

