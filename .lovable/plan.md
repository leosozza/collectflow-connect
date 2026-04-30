# Disparo WhatsApp em Lote — Rodapé sempre visível

## Problema
No `WhatsAppBulkDialog` (passo 1), quando o operador cola uma mensagem longa o `Textarea` cresce (resize nativo) e o bloco de Preview também aumenta, empurrando o `DialogFooter` (botões "Cancelar" / "Próximo") para fora da viewport. O `DialogContent` não tem altura máxima nem área de rolagem interna.

## Solução
Tornar o `DialogContent` uma coluna flex com altura máxima (ex.: `max-h-[85vh]`), com header e footer fixos e o **conteúdo do passo** rolando internamente. Adicionalmente, travar o resize do `Textarea` e dar uma altura máxima para o bloco de Preview, para que o usuário role dentro do campo em vez de expandir o modal.

## Mudanças (arquivo único)
`src/components/carteira/WhatsAppBulkDialog.tsx`

1. `DialogContent` (linha 883): adicionar `max-h-[85vh] flex flex-col p-0 overflow-hidden` e mover paddings para os filhos. Header e Footer ficam `shrink-0`; criar um wrapper rolável entre eles para o indicador de etapas, o badge de "X clientes selecionados" e os `renderStepN()`.

   Estrutura nova:
   ```text
   DialogContent (flex col, max-h-[85vh])
     DialogHeader (shrink-0, px/pt)
     div.flex-1.overflow-y-auto.px-6 (área rolável)
       renderStepIndicator()
       badge "N clientes selecionados"
       renderStep1/2/3/4()
     DialogFooter (shrink-0, px/pb, border-t)
   ```

2. `Textarea` da mensagem personalizada (linha 506): adicionar `className="resize-none max-h-48"` e manter `rows={4}`. Assim o campo ganha rolagem interna em vez de empurrar o layout. (Tamanho continua confortável; a área já é rolável dentro do dialog também.)

3. Bloco de Preview (linha 531): adicionar `max-h-40 overflow-y-auto` para que mensagens muito longas no preview não estourem a área.

## Detalhes técnicos
- `DialogContent` do shadcn já é posicionado fixo e centralizado; aplicar `max-h-[85vh]` com `flex flex-col` é o padrão recomendado para modais com rodapé persistente.
- Não há mudança em `renderStep2/3/4` além de herdarem o novo wrapper rolável — isso também corrige potenciais estouros em telas pequenas nos demais passos.
- Sem alterações em estado, lógica de envio ou serviços. Mudança puramente visual/layout.

## Critérios de aceite
- Ao colar uma mensagem longa (centenas de linhas), o textarea passa a rolar internamente e o botão "Próximo" continua visível.
- Em viewports pequenas (≤716px de altura, como o preview atual), o rodapé permanece fixo enquanto o conteúdo rola.
- Nenhuma regressão visual nos passos 2, 3 e 4.