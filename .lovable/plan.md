

# Plano: Parcela vencida importada deve ser "Vencido", não "Quebrado"

## Causa raiz

Em `src/services/importService.ts` (linha 255-256), quando uma parcela importada tem pagamento parcial (`valorPago > 0 && valorPago < valorParcela`), o status é definido como `"quebrado"`. Isso está errado — parcelas importadas com pagamento parcial devem permanecer `"pendente"`, e a interface já exibe "Vencido" automaticamente quando `status === "pendente"` e a data de vencimento é anterior a hoje.

**"Quebrado" deve ser reservado exclusivamente para acordos formalizados no RIVO que não foram honrados.**

## Correções

### 1. `src/services/importService.ts` — Remover atribuição automática de "quebrado" na importação

Linha 255-256: trocar `status = "quebrado"` por manter `"pendente"`. Pagamento parcial na importação não significa quebra de acordo.

```typescript
// DE:
} else if (valorPago > 0 && valorPago < valorParcela) {
  status = "quebrado";
}

// PARA:
// Pagamento parcial mantém "pendente" — será exibido como "Vencido" se a data passou
```

### 2. Corrigir dados existentes no banco

Executar UPDATE para todos os tenants: parcelas com `status = 'quebrado'` que **não** estão vinculadas a nenhum acordo devem voltar para `'pendente'`.

```sql
UPDATE clients
SET status = 'pendente'
WHERE status = 'quebrado'
  AND id NOT IN (
    SELECT DISTINCT unnest(title_ids) FROM agreements
    WHERE status IN ('vigente', 'vencido', 'pago', 'cancelado')
  );
```

### 3. Nenhuma mudança na exibição

A lógica de exibição em `ClientDetailPage.tsx` (linha 205-207) já está correta:
- `pendente` + data passada → mostra **"Vencido"** (laranja)
- `pendente` + data futura → mostra **"Em Aberto"** (verde)
- `quebrado` → mostra **"Quebrado"** (cinza) — reservado para quebra de acordo

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/services/importService.ts` | Remover linhas 255-256 (não atribuir "quebrado" por pagamento parcial) |
| Banco de dados | UPDATE para corrigir parcelas "quebrado" sem acordo vinculado |

