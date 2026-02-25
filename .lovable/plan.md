

## Plano: Corrigir bug no CurrencyInput que impede salvar valores

### Causa raiz

O bug esta na funcao `parseBRL` dentro de `src/components/ui/currency-input.tsx`, linha 24:

```text
Atual:   str.replace(/[^\\d,]/g, "")   ← \\d = literal backslash + 'd'
Correto: str.replace(/[^\d,]/g, "")    ← \d = classe de digitos
```

O `\\d` no regex literal nao representa digitos — representa um backslash literal seguido da letra 'd'. Isso faz com que a funcao remova TODOS os digitos da string, retornando sempre 0.

O componente **exibe** o valor corretamente (a funcao `maskCurrency` usa `/\D/g` que esta correto), mas o valor numerico passado para `onValueChange` e sempre 0. Isso afeta **todos os CurrencyInput** do sistema (metas de equipe, metas de operador, filtros de valor, etc).

### Evidencia

A equipe "Cobranca" tem `meta_mensal: 0` no banco, apesar do usuario ter digitado R$ 100.000,00 e recebido confirmacao "Salvo!".

### Correcao

**Arquivo: `src/components/ui/currency-input.tsx`**

- Linha 24: trocar `\\d` por `\d` na regex de `parseBRL`

```typescript
// De:
const clean = str.replace(/[^\\d,]/g, "");
// Para:
const clean = str.replace(/[^\d,]/g, "");
```

Uma unica linha. Corrige o problema em todas as telas que usam CurrencyInput.

