

# Plano: Corrigir edição de data da parcela que não reflete na UI

## Problema raiz (dois bugs)

1. **Query invalidation não bate**: Após salvar a data, o componente invalida `["client-agreements"]`, mas o query real em `ClientDetailPage.tsx` usa `["client-agreements", cpf]`. Como as keys não batem, o React Query não refaz o fetch e a UI continua mostrando a data antiga.

2. **Key da Entrada divergente**: Ao salvar a data da entrada, o código passa `0` como número da parcela (que vira key `"0"` no JSON), mas ao ler o componente usa `customKey = "entrada"`. Resultado: salva em `"0"`, lê de `"entrada"` → nunca encontra o valor salvo.

## Correção

**Arquivo**: `src/components/client-detail/AgreementInstallments.tsx`

1. Na função `handleSaveDateEdit`, trocar a chamada de:
   ```ts
   await updateInstallmentDate(agreementId, inst.isEntrada ? 0 : inst.number, dateStr);
   ```
   para usar `inst.customKey` diretamente (que já é `"entrada"` ou o número correto como string).

2. Ajustar `updateInstallmentDate` em `agreementService.ts` para aceitar `string` como chave (em vez de `number`), já que a key no JSON é sempre string.

3. Corrigir todas as invalidações de query para usar a key completa:
   ```ts
   queryClient.invalidateQueries({ queryKey: ["client-agreements", cpf] });
   ```
   Isso afeta tanto `handleSaveDateEdit` quanto `handleEditValue`.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/client-detail/AgreementInstallments.tsx` | Usar `inst.customKey` na edição de data; corrigir query keys nas invalidações |
| `src/services/agreementService.ts` | Alterar tipo do parâmetro `installmentNumber` para `string` em `updateInstallmentDate` |

