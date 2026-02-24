

## Corrigir erro "Cannot read properties of null (reading 'trim')"

### Problema
O campo `COD_CONTRATO` de alguns registros do MaxSystem vem como `null`. O codigo atual chama `.trim()` diretamente sem verificar, causando o crash.

### Correcao

**Arquivo:** `src/pages/MaxListPage.tsx`

Duas linhas precisam de null-safe:

1. **Linha 368** (coleta de contratos unicos):
```text
// De:
item.COD_CONTRATO.trim()
// Para:
(item.COD_CONTRATO || "").trim()
```

2. **Linha 382** (lookup no cache de enderecos):
```text
// De:
item.COD_CONTRATO.trim()
// Para:
(item.COD_CONTRATO || "").trim()
```

Tambem verificar se outros campos como `NOME_DEVEDOR`, `CPF_CNPJ`, etc. podem ser null e aplicar o mesmo padrao defensivo nas linhas seguintes do `map`.

| Arquivo | Mudanca |
|---|---|
| `src/pages/MaxListPage.tsx` | Adicionar null-safe em todos os `.trim()` do `handleSendToCRM` |

