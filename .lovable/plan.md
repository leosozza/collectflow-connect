# Correções de lógica do Dashboard (sem mudar visual)

## Achados da auditoria

| Tópico | Estado atual | Impacto |
|---|---|---|
| Quebra | Conta só `auto_expired` (8 acordos). Existem 32 cancelados `manual` ignorados. | Subestima quebra |
| Parcelas Programadas | Marca como `paid` só porque `agreement.status='approved'` | Falsos quitados em parcelas futuras |
| Total Recebido (KPI) | Usa `client_events` (R$ 90.453 no mês) | Diverge do gráfico |
| Total Recebido (gráfico) | Filtra `manual_payments.status='approved'` — **mas o status real é `confirmed`** → gráfico zerado | Gráfico vazio hoje |
| Filtro multi-operador | RPCs aceitam só 1 uuid; UI já permite multi-seleção mas envia null quando >1 | Filtro ignorado |
| `portal_payments` | Tabela vazia hoje, mas existe e é fonte oficial | Manter por compat |

## Decisões aplicadas

1. **Total de Quebra** → incluir `cancellation_type IN ('auto_expired','manual')`. `rejected` continua fora (nem entra: status filtrado por `cancelled`).
2. **Parcelas Programadas** → remover a regra "`a.status='approved'` ⇒ paid". Parcela só é `paid` se houver `manual_payments.status='confirmed'` OU `negociarie_cobrancas.status='pago'` para aquela parcela específica.
3. **Total Recebido** → unificar fonte: `manual_payments(status='confirmed')` + `portal_payments(status='paid')`, agrupado por `payment_date` / `updated_at`. Mesma fonte usada no gráfico (`TotalRecebidoCard`). `client_events` deixa de ser usado para esse KPI.
4. **Filtro multi-operador** → adicionar parâmetro novo `_user_ids uuid[] DEFAULT NULL`. Mantém `_user_id uuid` por compatibilidade. Lógica: `(_user_ids IS NULL AND _user_id IS NULL) OR created_by = _user_id OR created_by = ANY(_user_ids)`. `DashboardPage.tsx` envia `_user_ids` quando há ≥2 operadores; envia `_user_id` quando há exatamente 1; nenhum dos dois quando lista vazia (= todos).

## Migration (segura, sem destruir nada)

`CREATE OR REPLACE FUNCTION` para as 3 RPCs. **Nenhuma** das alterações abaixo:
- não dropa função/coluna/tabela
- não cria tabela
- não toca em RLS, grants, policies
- não altera dados (só DDL de função)
- mantém assinaturas antigas funcionando

### `get_dashboard_stats(_user_id uuid, _year int, _month int, _user_ids uuid[] DEFAULT NULL)`
- Substitui filtro `(_user_id IS NULL OR a.created_by = _user_id)` por helper `(_user_ids IS NULL AND _user_id IS NULL) OR a.created_by = _user_id OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))`.
- Bloco `_quebra` / `_quebra_mes_ant`: `cancellation_type IN ('auto_expired','manual')`.
- Bloco `_recebido` / `_recebido_mes_ant`: trocar agregação de `client_events` por:
  ```sql
  SELECT COALESCE(SUM(amount_paid),0) FROM manual_payments mp
   JOIN agreements a ON a.id = mp.agreement_id
   WHERE mp.tenant_id=_tenant AND mp.status='confirmed'
     AND mp.payment_date BETWEEN _month_start AND _month_end
     AND (filtro_operador em a.created_by)
  ```
  + soma de `portal_payments` (status `paid`, `updated_at` no range, join em agreements para filtro de operador).

### `get_dashboard_vencimentos(_target_date date, _user_id uuid, _user_ids uuid[] DEFAULT NULL)`
- Remover ramo `WHEN a.status = 'approved' THEN 'paid'` da entrada e da parcela regular.
- Mantém os EXISTS de `manual_payments` (`installment_number=0` para entrada, `i+2/i+1` para regulares) e `negociarie_cobrancas`.
- Aplica novo filtro multi-operador.

### `get_acionados_hoje(_user_id uuid, _tenant_id uuid, _user_ids uuid[] DEFAULT NULL)`
- Aplica filtro multi-operador em `user_activity_logs.user_id` e em `agreements.created_by`.

## Frontend — `src/pages/DashboardPage.tsx`

Único arquivo tocado. Mudanças cirúrgicas:
- Recalcular params:
  ```ts
  const rpcUserIds = canViewAll && selectedOperators.length > 1 ? selectedOperators : null;
  const rpcUserId  = canViewAll
    ? (selectedOperators.length === 1 ? selectedOperators[0] : null)
    : (profile?.user_id ?? null);
  ```
- Em cada chamada RPC: enviar `_user_ids` quando `rpcUserIds` truthy; senão `_user_id`.
- Incluir `rpcUserIds` na `queryKey` dos 3 useQuery.
- **Zero mudança visual / nomes / ordem dos cards / KPIs.**

## Validação pós-migration (vou rodar e te enviar)

| Métrica | Antes | Depois esperado |
|---|---|---|
| Quebra (count base) | 8 | 40 |
| Total Recebido KPI (mês) | R$ 90.453,12 (events) | soma `manual_payments.confirmed` + `portal_payments.paid` (= mesmo valor do gráfico) |
| Parcelas Programadas futuras com status `paid` sem pagamento | existem | zero |
| Filtro com 2+ operadores | retorna tudo | filtra corretamente |
| Filtro vazio | retorna tudo | retorna tudo (compat) |
| Filtro 1 operador via `_user_id` | funciona | funciona (compat) |

Vou rodar `SELECT * FROM get_dashboard_stats(...)` e `get_dashboard_vencimentos(CURRENT_DATE)` antes/depois e te mandar print comparativo + confirmação de que `DashboardPage.tsx` carrega sem erro.

## Fora de escopo
- Nenhuma renomeação de cards, nenhuma remoção de KPI, nenhum ajuste visual.
- Não mexer em RLS / permissões / outras tabelas.
- Não alterar `TotalRecebidoCard.tsx` (a query dele já casa com a nova lógica do KPI — ambos passam a usar `manual_payments` + `portal_payments`). Observação: o filtro do card hoje usa `status='approved'` para `manual_payments`; se você quiser eu corrijo para `'confirmed'` no mesmo passo (recomendado, senão o gráfico continua zerado). Aguardo confirmação rápida nesse ponto antes de implementar.
