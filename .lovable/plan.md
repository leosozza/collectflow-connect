

## Correção: Parcelas vencidas não aparecem ao formalizar acordo

### Problema identificado

No arquivo `src/components/client-detail/AgreementCalculator.tsx`, linha 50:

```typescript
const pendentes = clients.filter((c) => c.status === "pendente");
```

Este filtro exclui parcelas com status `"vencido"`. O cliente Alexandre dos Santos tem parcela vencida (24/12/2025), que foi marcada como `"vencido"` pelo sistema — logo ela não aparece na lista de seleção do acordo.

### Correção

Alterar o filtro para incluir tanto `"pendente"` quanto `"vencido"`:

```typescript
const pendentes = clients.filter((c) => c.status === "pendente" || c.status === "vencido");
```

Isso também deve ser aplicado em qualquer lugar que use o mesmo padrão para listar parcelas elegíveis para acordo.

### Arquivo a modificar
- `src/components/client-detail/AgreementCalculator.tsx` — linha 50, incluir status `"vencido"` no filtro

### Impacto
- Parcelas vencidas passarão a aparecer na seleção ao formalizar acordo
- Não afeta a lógica de criação do acordo (que já aceita status `"vencido"` no `agreementService.ts` linha de `.in("status", ["pendente", "vencido", "quebrado"])`)

