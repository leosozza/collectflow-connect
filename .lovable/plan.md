

# Reabrir Parcelas Pagas para Formalização de Acordo

## Problema

Clientes importados do MaxList chegam com todas as parcelas com status `pago`. Nesse estado, não é possível formalizar um acordo pois não há títulos em aberto. É necessário uma opção para "reabrir" parcelas pagas, mudando seu status para `pendente`/`vencido` conforme a data de vencimento.

## Solução

### 1. Botão "Reabrir Parcela" na aba Títulos (`ClientDetailPage.tsx`)

- Adicionar uma coluna "Ações" na tabela de títulos
- Para parcelas com status `pago`, exibir botão com ícone `RotateCcw` ("Reabrir")
- Suportar seleção múltipla: checkbox em cada linha `pago` + botão "Reabrir Selecionadas" no topo
- AlertDialog de confirmação antes de executar

### 2. Lógica de reabertura

Ao reabrir uma parcela:
- Se `data_vencimento < hoje` → status = `vencido`
- Se `data_vencimento >= hoje` → status = `pendente`
- Zerar `valor_pago` (já que está sendo reaberta para negociação)

```typescript
const handleReopenParcelas = async (clientIds: string[]) => {
  for (const id of clientIds) {
    const client = clients.find(c => c.id === id);
    const newStatus = new Date(client.data_vencimento) < new Date() ? "vencido" : "pendente";
    await supabase.from("clients").update({ status: newStatus, valor_pago: 0 }).eq("id", id);
  }
  // Recalc score
  recalcScoreForCpf(cpf);
  refetch();
};
```

### 3. Recálculo automático de status do CPF

Após reabrir parcelas, chamar `recalcScoreForCpf` que aciona a Edge Function `calculate-propensity`, e o trigger `auto-status-sync` recalcula o status global do CPF/Credor (de `QUITADO`/`EM DIA` para `INADIMPLENTE`).

### 4. Registro de auditoria

Registrar no `audit_logs` a ação de reabertura de parcelas com os IDs afetados.

## Arquivos alterados

- `src/pages/ClientDetailPage.tsx` — checkbox de seleção, botão "Reabrir Parcelas", AlertDialog de confirmação, handler de reabertura

