
Objetivo: corrigir 3 pontos no fluxo do cliente em `/carteira/:cpf` sem alterar schema do banco.

1. Estabilizar o componente de alteração de data da parcela
- Diagnóstico: o problema agora parece vir menos do `Popover` e mais do ciclo do `DropdownMenu`. Em `AgreementInstallments.tsx`, o item “Editar Data” usa `onSelect + preventDefault + requestAnimationFrame`, o que tende a manter o menu “vivo” por mais tempo e conflitar com o calendário quando o cursor sai do menu.
- Implementação:
  - controlar a abertura do menu de ações por linha, sem depender do fechamento implícito;
  - remover o `preventDefault()` do fluxo de abrir o editor de data;
  - abrir o datepicker só depois do menu terminar de fechar;
  - manter o `Calendar` interativo com `pointer-events-auto` e fechar apenas em seleção de data, cancelar, ou clique fora real.
- Resultado esperado: o calendário abre, permanece aberto ao mover o cursor e só fecha quando o usuário realmente conclui ou cancela.

2. Fazer o acordo recalcular os números ao editar valor de parcela/entrada
- Diagnóstico:
  - hoje `updateInstallmentValue` atualiza apenas `custom_installment_values`;
  - os resumos de acordo continuam lendo `agreement.proposed_total`, `agreement.new_installment_value` e `agreement.entrada_value`;
  - além disso, o modal de edição usa um snapshot local (`editingAgreement`), então mesmo após refetch os números visíveis continuam antigos.
- Implementação:
  - criar um helper compartilhado para montar o “resumo efetivo” do acordo a partir de:
    - `entrada_value`
    - `new_installments`
    - `new_installment_value`
    - `custom_installment_values`
  - esse helper deve devolver:
    - entrada efetiva
    - lista/valores efetivos das parcelas
    - valor proposto efetivo (entrada + parcelas)
    - texto formatado do parcelamento
  - trocar os pontos da UI que hoje usam os campos crus para usar o resumo efetivo.
- Resultado esperado:
  - se a entrada mudar de R$ 5,00 para R$ 10,00, o “Valor Proposto” e o resumo do parcelamento passam a refletir isso imediatamente;
  - se o acordo for “entrada + 5 parcelas”, a UI deixa de mostrar só “5x de R$ 203,00” e passa a mostrar a composição correta.

3. Corrigir a exibição do resumo de parcelamento
- Implementação nas telas que mostram resumo:
  - `ClientDetailPage.tsx`: card do acordo e modal de edição;
  - `AgreementsList.tsx`: listagem de acordos;
  - manter o formato:
    - `Entrada R$ 10,00 + 5x de R$ 203,00`
  - se no futuro houver parcelas com valores diferentes entre si, preparar fallback como:
    - `Entrada R$ X + 5 parcelas com valores personalizados`
- Resultado esperado: o resumo textual fica coerente com o que foi editado nas parcelas.

4. Eliminar estado obsoleto no modal de edição do acordo
- Diagnóstico: `handleEditOpen` salva o acordo inteiro em `editingAgreement`, então o componente aninhado de parcelas recebe dados congelados.
- Implementação:
  - substituir o snapshot por uma referência por ID, ou sincronizar `editingAgreement` sempre que os dados refetchados mudarem;
  - garantir que o componente de parcelas e o topo do modal usem sempre o acordo mais recente.
- Resultado esperado: após editar data/valor/entrada, o cabeçalho e os números do acordo mudam sem precisar fechar e reabrir o modal.

5. Ajustar a edição de endereço no perfil do cliente
- Diagnóstico: a edição já existe em `ClientDetailHeader.tsx` no botão “Editar” do topo. O problema parece ser de descoberta, não de backend.
- Implementação:
  - manter o sheet atual de edição;
  - adicionar um atalho visível na seção de endereço (“Editar endereço”) para abrir o mesmo sheet;
  - opcionalmente destacar o botão quando a seção “Mais informações do devedor” estiver aberta.
- Resultado esperado: o usuário encontra a edição de endereço exatamente no bloco onde vê o endereço, sem precisar adivinhar que o botão geral do topo abre esse formulário.

Arquivos principais
- `src/components/client-detail/AgreementInstallments.tsx`
- `src/pages/ClientDetailPage.tsx`
- `src/components/acordos/AgreementsList.tsx`
- `src/components/client-detail/ClientDetailHeader.tsx`
- `src/lib/installmentUtils.ts`
- possivelmente `src/services/agreementService.ts` para devolver/sincronizar dados atualizados após edição

Detalhes técnicos
- Não precisa migration.
- O problema do endereço não está em `PerfilPage.tsx` / `PersonalDataTab.tsx`; esses arquivos tratam perfil de usuário, não o cadastro do devedor.
- O cálculo de resumo do acordo deve ser centralizado para evitar divergência entre:
  - tabela de parcelas,
  - card do acordo,
  - modal de edição,
  - listagem geral de acordos.
