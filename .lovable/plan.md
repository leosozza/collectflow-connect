

# Correção de build errors + deploy da Edge Function

## Problemas identificados

1. **Edge Function (`maxlist-import/index.ts`)**: Variável `result` na linha 641 não existe — o objeto foi declarado como `report` na linha 620. Trocar `result` por `report`.

2. **`paymentMethodsService.ts`**: Queries usando `as any` mas o retorno não tem cast adequado. Adicionar `as any` nos retornos das linhas 38 e 71.

3. **`customFieldsService.ts`**: Tipo excessivamente profundo na query. Já tem `as unknown as CustomField[]` — confirmar que está ok ou ajustar o cast.

## Alterações

### `supabase/functions/maxlist-import/index.ts`
- Linha 641: `JSON.stringify(result)` → `JSON.stringify(report)`

### `src/services/paymentMethodsService.ts`  
- Linha 38: `return data || [];` → `return (data || []) as any as PaymentMethod[];`
- Linha 71: `return data || [];` → `return (data || []) as any as PaymentMapping[];`

### `src/services/customFieldsService.ts`
- Linha 22: adicionar cast `as any` na query para evitar inferência recursiva de tipo

## Deploy

Após as correções, deploy automático da edge function `maxlist-import` via ferramenta de deploy.

## Resultado

- Build passa sem erros
- Edge function com `getVal` e bloco `debug` funcionando
- Frontend logando `[MaxList Debug]` no console

