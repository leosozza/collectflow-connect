## Objetivo

Fazer as **linhas do card "Total Recebido"** aparecerem (mês atual em área azul + mês anterior pontilhada cinza), batendo com o número grande do KPI.

## Causa-raiz confirmada

O componente `TotalRecebidoCard.tsx` consulta apenas 2 fontes:
- `manual_payments` com status **`approved`** (deveria ser `confirmed` OU `approved`)
- `portal_payments` com status `paid`

A RPC oficial `get_dashboard_stats` (que produz o KPI grande) usa **3 fontes**, incluindo **`negociarie_cobrancas`** com status `pago` — que o card ignora.

Validação no banco confirmou:
- `manual_payments approved` no mês atual + anterior: **0 registros**
- `portal_payments paid`: **0 registros**
- `negociarie_cobrancas pago` (ignorada pelo card): **74 pagamentos = R$ 17.410,05** ← toda a receita

Por isso o KPI mostra valor mas as linhas ficam zeradas.

## Mudanças

### 1. `src/components/dashboard/TotalRecebidoCard.tsx`

Refatorar a função `fetchDailyTotals` para incluir as 3 fontes alinhadas com a RPC oficial:

- Trocar `.eq("status", "approved")` por `.in("status", ["confirmed", "approved"])` em `manual_payments`.
- Manter a query atual de `portal_payments`.
- **Adicionar nova query** em `negociarie_cobrancas`:
  - `select("valor_pago, data_pagamento, status, tenant_id")`
  - `.eq("tenant_id", tenantId)` + `.eq("status", "pago")`
  - intervalo via `data_pagamento` (mesma janela do mês)
  - somar `valor_pago` no bucket do dia (`new Date(data_pagamento).getDate()`)

Resultado: o gráfico passa a refletir exatamente as mesmas fontes do KPI, e os 74 pagamentos da Negociarie aparecem distribuídos por dia.

### 2. RPC `get_dashboard_recebido_diario` (próxima etapa)

A versão definitiva ideal seria criar uma RPC SQL que faz a mesma união em backend (igual ao padrão de `get_dashboard_stats`), retornando `[{period, day, total}]` para mês atual e anterior. Isso garante consistência permanente e respeita filtro de operador.

**Status:** A ferramenta de migration de banco não está disponível neste turno. A correção client-side (item 1) já resolve 100% do sintoma visual e usa exatamente as mesmas tabelas/filtros da RPC oficial. Quando você quiser, abrimos um turno separado só para criar a RPC e migrar o card para chamada única.

## Resultado esperado

Após o ajuste, no preview/dashboard você verá:
- Linha azul (mês atual) com pontos nos dias 25, 27 etc., onde houve recebimento.
- Linha cinza pontilhada (mês anterior) com a distribuição diária de março.
- O comparativo "+X% vs mês anterior" passa a calcular corretamente.