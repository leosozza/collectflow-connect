

## Corrigir valores de Recebido e Progresso em Metas

### Diagnóstico

A aba **Metas** mostra valores muito menores que o dashboard porque a RPC `recalculate_operator_gamification_snapshot` usa **fonte de verdade errada**:

| Fonte | Valor mês atual | Onde é usado |
|---|---|---|
| `clients.valor_pago` (com `data_quitacao` no mês) | R$ 6.617 | Gamificação (atual — errado) |
| `client_events.metadata.valor_pago` em `payment_confirmed` / `manual_payment_confirmed` | R$ 84.982 | Dashboard "Total Recebido" (correto) |

Além disso, a atribuição ao operador está em `clients.operator_id` (carteira), mas o pagamento real costuma vir de um acordo cujo dono é `agreements.created_by` (quem negociou). Operadores que negociam carteira de outro nunca são creditados.

### Solução

Padronizar a gamificação para usar a **mesma fonte de verdade do dashboard** (`client_events` + `agreements.created_by`), eliminando a divergência.

### Mudanças

**1. Nova migration SQL — substituir `recalculate_operator_gamification_snapshot`**

Recalcular `total_received` e `payments_count` a partir de `client_events`, atribuindo ao operador via `agreements.created_by`:

```sql
SELECT
  COUNT(*),
  COALESCE(SUM(COALESCE(
    (ce.metadata->>'valor_pago')::numeric,
    (ce.metadata->>'amount_paid')::numeric,
    0
  )), 0)
INTO _payments_count, _total_received
FROM public.client_events ce
JOIN public.agreements a
  ON a.id = (ce.metadata->>'agreement_id')::uuid
WHERE ce.tenant_id = _tenant_id
  AND ce.event_type IN ('payment_confirmed', 'manual_payment_confirmed')
  AND ce.created_at >= _month_start
  AND ce.created_at < _next_month
  AND a.created_by = _operator_user_id;
```

- Mantém `agreements_count` e `breaks_count` como já estão (já usam `created_by`).
- Mantém `goal` lendo de `operator_goals`.
- Mantém fórmula de pontos.
- Resultado: o "Realizado" da gamificação passa a bater exatamente com o card "Total Recebido" do dashboard quando filtrado pelo mesmo operador.

**2. Garantir recálculo ao abrir a aba Metas**

`src/components/gamificacao/GoalsTab.tsx` já chama `recalculateMySnapshot` / `recalculateTenantSnapshot` no `useEffect`. Apenas validar que o `invalidateQueries` está acionando o refetch após o recálculo (adicionar `await` antes do invalidate, se necessário) para evitar exibir valores cacheados antes da RPC concluir.

**3. Card de Metas no Dashboard (`DashboardMetaCard.tsx`)**

Já usa `stats.total_recebido` direto da RPC do dashboard — **não precisa mudar nada**. Continuará correto e agora ficará coerente com a aba Metas da Gamificação.

### Resultado esperado

| Tela | Antes | Depois |
|---|---|---|
| Dashboard → Metas (gauge) | R$ 84.982 (correto) | R$ 84.982 (mantido) |
| Gamificação → Metas (operador) | R$ 6.617 (errado) | bate com o que o operador realmente recebeu |
| Gamificação → Metas (admin, total) | subestimado | soma real do mês por tenant |
| Progresso (%) | distorcido | recalculado corretamente sobre o `target_amount` |

### Arquivos alterados

- nova migration SQL substituindo `recalculate_operator_gamification_snapshot`
- `src/components/gamificacao/GoalsTab.tsx` (apenas garantir await/refetch após recálculo)

### Não incluído

- Sem mudança de schema (apenas corpo da função).
- Sem alteração no `DashboardMetaCard` nem em `gamificationService.ts`.
- Histórico mensal anterior será naturalmente recalculado da próxima vez que cada tela abrir.

