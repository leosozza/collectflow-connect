

## Plano — Exibir parcelas de acordos quitados

### Causa
Em `src/pages/ClientDetailPage.tsx` (linha 64):
```ts
const installmentStatuses = ["pending", "pending_approval", "approved", "overdue"];
```
Quando o acordo vira `completed` (quitado), a condição `installmentStatuses.includes(agreement.status)` (linha 672) fica falsa e o componente `<AgreementInstallments />` não é renderizado — por isso some o detalhamento de parcelas, datas e valores pagos.

### Mudança
Adicionar `"completed"` (e por simetria `"cancelled"`, já que ele também tem parcelas marcadas como quebra que vale visualizar) à lista, para que o histórico de parcelas continue acessível mesmo após a quitação.

```ts
const installmentStatuses = ["pending", "pending_approval", "approved", "overdue", "completed", "cancelled"];
```

### Comportamento resultante
- Acordo quitado: card aparece normalmente, ao expandir mostra todas as parcelas com datas, valores, status "Pago" e data de baixa.
- O `AgreementInstallments` já lida internamente com parcelas pagas (renderiza badge de pago, data, valor) — nenhuma alteração lá dentro é necessária.
- Botões inline (gerar boleto, reemitir) continuam respeitando suas próprias regras internas.

### Arquivo
- `src/pages/ClientDetailPage.tsx` — 1 linha alterada (linha 64).

### Sem alteração
Schema, RLS, services, `AgreementInstallments.tsx`, lógica de quitação, demais abas.

