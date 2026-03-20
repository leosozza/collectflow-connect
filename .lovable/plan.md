

# Plano: Corrigir cadastro de cliente + auto-gerar ID Externo

## Problema raiz

O console mostra `createClient` falhando com `[object Object]`. Analisando o fluxo:

1. **`data_vencimento` é opcional no schema** mas `generateInstallments` exige uma data válida. Quando o usuário não preenche a data, `validated.data_vencimento` é `undefined`, causando `new Date("undefinedT00:00:00")` → data inválida → erro no insert.

2. **`external_id` vazio não é auto-gerado** — o formulário envia `undefined` e o service envia `null`. Se o campo for necessário para lógica de upsert, falta um fallback.

3. **Erro genérico sem detalhes** — o `handleServiceError` loga `[object Object]` sem stringify, e o `onError` mostra apenas "Erro ao cadastrar cliente" sem detalhes do que falhou.

## Correções

### 1. `src/services/clientService.ts` — createClient

- Se `data_vencimento` estiver vazio/undefined, usar a data de hoje como default
- Se `external_id` estiver vazio, gerar automaticamente um ID único (ex: `MAN-{timestamp}-{random}`)
- Melhorar log de erro para incluir `JSON.stringify(error)` no catch

```typescript
// Antes da chamada a generateInstallments:
const dataVenc = validated.data_vencimento || new Date().toISOString().split("T")[0];
const extId = data.external_id || `MAN-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
```

### 2. `src/lib/validations.ts` — clientSchema

- Tornar `data_vencimento` realmente opcional com fallback (não quebrar se vazio)
- O schema já aceita `optional().nullable()`, mas o `.regex()` falha com string vazia `""`. Adicionar `.or(z.literal(""))` ou tratar no transform.

### 3. `src/components/clients/ClientForm.tsx`

- Remover campo "ID Externo" do formulário visível (será gerado automaticamente)
- Ou mantê-lo como opcional com placeholder "Gerado automaticamente se vazio"

### 4. `src/lib/errorHandler.ts` — melhorar log

- Logar `JSON.stringify(error)` em vez de `error` direto para evitar `[object Object]`

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/services/clientService.ts` | Default para `data_vencimento` e auto-gerar `external_id` |
| `src/lib/validations.ts` | Aceitar string vazia em `data_vencimento` (transformar para null/undefined) |
| `src/components/clients/ClientForm.tsx` | Tornar ID Externo informativo ("gerado se vazio") |
| `src/lib/errorHandler.ts` | Stringify error no log |

