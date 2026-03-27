
Objetivo: corrigir a regra que mantém o acordo como “Vencido” mesmo quando não existe nenhuma parcela em atraso, fazendo o sistema voltar para “Em dia” automaticamente sem mexer no fluxo de boletos.

Diagnóstico
- O badge do acordo no perfil usa `agreement.status` como fonte de verdade.
- Hoje a função de backend `auto-expire-agreements` faz transição só de ida: `pending -> overdue`.
- Ela não recalcula acordos que já estão `overdue`, então um acordo pode ficar “preso” em vencido mesmo após pagamento/regularização.
- Além disso, essa função monta a agenda virtual sem considerar `custom_installment_dates` e `custom_installment_values`, o que pode gerar leitura errada em acordos com parcelas personalizadas.
- A tela de parcelas (`AgreementInstallments`) já calcula corretamente cada parcela localmente, por isso pode mostrar tudo em aberto/pago enquanto o badge geral do acordo continua “Vencido”.

O que vou ajustar
1. Corrigir a função de backend `auto-expire-agreements`
- Recalcular acordos em ambos os sentidos:
  - `pending -> overdue` quando existir parcela vencida não coberta pelo valor pago acumulado
  - `overdue -> pending` quando não existir mais nenhuma parcela vencida em aberto
- Incluir no cálculo:
  - `entrada_date`
  - `custom_installment_dates`
  - `entrada_value`
  - `custom_installment_values`
- Manter a lógica baseada em parcelas virtuais + `clients.valor_pago`, que é o padrão atual do sistema.

2. Preservar a nomenclatura interna
- Não criar novos status no banco.
- Internamente o acordo continua usando:
  - `pending` para acordo ativo sem atraso
  - `overdue` para acordo com atraso
- Na interface do perfil do cliente, o rótulo exibido para `pending` será ajustado para “Em dia” onde fizer sentido operacional.

3. Ajustar a exibição no perfil do cliente
- Em `src/pages/ClientDetailPage.tsx`, trocar o label visual de `pending` de “Vigente” para “Em dia” no badge do acordo.
- Manter `overdue` como “Vencido”.
- Assim a UI fica alinhada com a regra que você definiu: sem parcela vencida = “Em dia”.

4. Garantir reflexo nas telas que dependem do status
- Como `/acordos`, dashboard e demais visões leem `agreement.status`, ao corrigir a função de backend a informação volta a se propagar corretamente.
- Se necessário, deixo a listagem de `/acordos` com filtro “Vigentes” como está, mas com status correto no dado-base; não vou mexer na organização operacional sem necessidade.

Arquivos a ajustar
- `supabase/functions/auto-expire-agreements/index.ts`
  - tornar o recálculo bidirecional
  - usar datas/valores personalizados do acordo
- `src/pages/ClientDetailPage.tsx`
  - exibir `pending` como “Em dia” no badge do acordo

Resultado esperado
- Se nenhuma parcela do acordo estiver vencida, o acordo deixa de aparecer como “Vencido”.
- O Raul passa a aparecer como “Em dia” no perfil.
- As telas que dependem do status do acordo deixam de carregar estado antigo incorreto.
- Nada do fluxo de geração de boleto ou callback será alterado nesta correção.

Observação técnica
- Não pretendo alterar o componente de parcelas, porque ele já está coerente; o problema principal está na reconciliação do status geral do acordo.
- Também não há necessidade de mexer em nomenclaturas internas, tabelas novas ou no fluxo da Negociarie.
