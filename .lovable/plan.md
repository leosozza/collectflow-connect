

# Fix: Indicadores de Não Lidas e Horário Não Aparecem

## Diagnóstico

O código dos indicadores (horário verde + badge) **existe** no arquivo, mas não aparece visualmente. A captura de tela confirma: nenhuma conversa mostra horário ou badge à direita.

**Causa raiz**: O layout da conversa não reserva espaço suficiente para o lado direito. O conteúdo do nome e mensagem ocupa 100% da largura, empurrando o horário e badge para fora da área visível (cortado pelo `overflow-hidden`).

## Solução

**Arquivo:** `src/components/contact-center/whatsapp/ConversationList.tsx`

### Mudanças

1. **Linha do nome + horário (linha 395-404)**: Garantir que o horário tenha `shrink-0` e `ml-auto` para sempre ficar visível à direita. O nome deve ter `min-w-0` e `truncate` para encolher quando necessário.

2. **Linha da mensagem + badge (linha 405-458)**: Mesma lógica — a mensagem deve truncar, e o grupo de indicadores (status dot + badge) deve ter `shrink-0` para nunca ser cortado.

3. **Forçar largura mínima nos indicadores**: Adicionar `min-w-fit` ao container dos indicadores à direita para que nunca sejam comprimidos.

4. **Corrigir o `TooltipTrigger` sem ref (warning no console)**: O `ConversationAvatar` usa `TooltipTrigger asChild` passando ref para um `<div>`, mas o warning indica que um function component está recebendo ref. Envolver o ícone em `forwardRef` ou remover `asChild`.

### Resultado esperado
Cada conversa mostrará:
- Horário relativo à direita (verde se não lida, cinza se lida)
- Badge verde com contagem de não lidas abaixo do horário
- Tudo visível mesmo com nomes longos

