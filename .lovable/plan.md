

# Plano: Corrigir erro ao cadastrar cliente

## Causa raiz

Na linha 120 de `clientService.ts`:
```typescript
const dataVenc = validated.data_vencimento || data.data_vencimento || new Date().toISOString().split("T")[0];
```

Quando o campo data de vencimento fica vazio:
- `validated.data_vencimento` = `null` (transform do schema converte `""` → `null`)
- `data.data_vencimento` = `""` (string vazia do formulário — **truthy em JS!**)
- Resultado: `dataVenc = ""`
- `generateInstallments` faz `new Date("T00:00:00")` → **Invalid Date** → erro no insert

## Correção

### `src/services/clientService.ts` — linha 120

Trocar `||` por checagem explícita de string não-vazia:

```typescript
const dataVenc = (validated.data_vencimento && validated.data_vencimento.length > 0)
  ? validated.data_vencimento
  : (data.data_vencimento && data.data_vencimento.length > 0)
    ? data.data_vencimento
    : new Date().toISOString().split("T")[0];
```

Isso garante que strings vazias `""` caiam no fallback para a data de hoje.

### Arquivo único a editar
- `src/services/clientService.ts` — fix na resolução de `dataVenc`

