

## Plano — Remover coluna "Parcelas Pagas"

### Mudança
Remover a coluna **"Parcelas Pagas"** da tabela em `src/components/acordos/AgreementsList.tsx`:
- Remover `<TableHead>Parcelas Pagas</TableHead>` do header.
- Remover a `<TableCell>` correspondente (que renderiza `paid / total`) do body.
- Header da coluna existente continua como **"Parcela"** (mostra Entrada, 1ª, 2ª...).

### Impacto
- **Zero impacto funcional.** `_paidCount` e `_totalCount` continuam sendo calculados em `AcordosPage.tsx` (não vou tocar), apenas não serão renderizados.
- Nenhum outro componente lê esses campos da lista.
- Schema, RLS, services, classifier: intactos.

### Arquivo
- `src/components/acordos/AgreementsList.tsx` — remover 1 `<TableHead>` e 1 `<TableCell>`.

