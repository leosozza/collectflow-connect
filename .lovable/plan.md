

# Ajuste visual + lógica de cheque devolvido

## Alterações

### 1. Frontend — `src/pages/ClientDetailPage.tsx`

**Tabela de Títulos em Aberto (linhas 257-295):**

- Adicionar coluna `<TableHead>Devolução</TableHead>` após "Saldo Devedor"
- Adicionar `<TableCell>` correspondente com `formatDate(c.data_devolucao)` ou "—"
- Alterar lógica do Badge de status (linhas 270-279): se `c.data_devolucao` estiver preenchido, forçar label "Cheque Devolvido" com classe vermelha (`bg-destructive/10 text-destructive border-destructive/30`), independente do valor de `c.status`

### 2. Edge Function — `supabase/functions/maxlist-import/index.ts`

**Regra de status (linhas 239-253):** Mover a verificação de `rawReturnDate` para ANTES da verificação de `hasPagamento`, tornando-a prioritária:

```
if (rawIsCancelled) → "cancelado_maxlist"
else if (rawReturnDate) → "vencido"          ← nova posição, antes de hasPagamento
else if (hasPagamento) → "pago"
else → "pendente"
```

Isso garante que mesmo parcelas com data de pagamento preenchida sejam forçadas para "vencido" se houver devolução.

**Exceção PROTECTED_FIELDS (linhas 432-438):** Adicionar `data_devolucao` na mesma exceção, permitindo que tanto `status_cobranca_id` quanto `data_devolucao` sejam atualizados quando `rec.status === "vencido"`:

```typescript
if (PROTECTED_FIELDS.has(field)) {
  if ((field === "status_cobranca_id" || field === "data_devolucao") && rec.status === "vencido") {
    updatePayload[field] = rec[field];
  }
  continue;
}
```

(Nota: `data_devolucao` não está em `PROTECTED_FIELDS` atualmente, então já passa. Mas `status_cobranca_id` está e a exceção existente já o cobre.)

**Deploy** da edge function após as alterações.

### Resultado

- Interface mostra "Cheque Devolvido" em vermelho para qualquer parcela com `data_devolucao`, mesmo que status no banco seja "pago"
- Coluna "Devolução" visível na tabela de títulos
- Backend prioriza `rawReturnDate` sobre `hasPagamento`, forçando status correto na origem

