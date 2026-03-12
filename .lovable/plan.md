

# Plano: Corrigir KPIs do Analytics (Total Recebido, Taxa de Recuperação, Ticket Médio)

## Problema Raiz

Os KPIs dependem de `agreement.status === "completed"`, mas **nenhum acordo jamais recebe esse status**. O sistema marca os clientes individuais como "pago" na tabela `clients` (via `markAsPaid`/`registerPayment`), porém nunca atualiza o status do acordo para "completed".

Dados reais confirmam: 7 acordos (3 approved, 3 pending, 1 cancelled), nenhum "completed". Porém existem pagamentos reais nos clientes vinculados (ex: acordo com R$1.800 pagos por clientes, mas acordo ainda "approved").

## Solução

### 1. Nova query para buscar pagamentos reais vinculados a acordos

Criar uma query que faz JOIN entre `agreements` e `clients` (via CPF + credor + tenant) para somar os `valor_pago` reais, respeitando os filtros selecionados.

```typescript
const { data: paymentData } = useQuery({
  queryKey: ["analytics-payments", tenant?.id],
  queryFn: async () => {
    // Buscar todos os acordos ativos com pagamentos dos clientes vinculados
    const { data } = await supabase.rpc('get_analytics_payments', { _tenant_id: tenant!.id });
    return data;
  }
});
```

### 2. Criar RPC `get_analytics_payments` no banco

Uma função SQL que cruza acordos com clientes e retorna por acordo: `agreement_id`, `created_by`, `credor`, `created_at`, `proposed_total`, `total_pago` (soma de valor_pago dos clientes vinculados).

```sql
CREATE FUNCTION get_analytics_payments(_tenant_id uuid)
RETURNS TABLE(
  agreement_id uuid, created_by uuid, credor text, 
  created_at timestamptz, proposed_total numeric, total_pago numeric
)
```

### 3. Recalcular KPIs com dados reais

| KPI | Antes (quebrado) | Depois (correto) |
|---|---|---|
| **Total Recebido** | `sum(proposed_total) where status=completed` → sempre 0 | `sum(valor_pago dos clientes vinculados a acordos)` |
| **Taxa de Recuperação** | `pagos / (pagos + cancelados)` → 0% | `totalRecebido / totalNegociado * 100` |
| **Ticket Médio** | `totalRecebido / pagos.length` → 0 | `totalRecebido / nº de acordos com pagamentos > 0` |
| **Taxa de Conversão** | `pagos / totalAtivos` → 0% | `acordos com pagamento total / totalAtivos * 100` |

### 4. Arquivo a modificar

| Arquivo | Alteração |
|---|---|
| Migration SQL | Criar RPC `get_analytics_payments` |
| `src/pages/AnalyticsPage.tsx` | Nova query para pagamentos reais; recalcular todos os KPIs; atualizar tooltips |

