## Plano

Duas mudanças independentes no Dashboard.

---

### 1. Tooltips explicativos em cada card (hover)

Adicionar tooltip (shadcn `Tooltip`) ao **título/ícone** de cada card, explicando exatamente o que ele soma.

**Textos propostos:**

| Card | Tooltip |
|---|---|
| **Acionados Hoje** | "Quantidade de CPFs únicos que tiveram interação registrada hoje (carteira ou atendimento) e ainda **não fecharam acordo**." |
| **Acordos do Dia** | "Acordos criados hoje, excluindo os cancelados e rejeitados." |
| **Acordos do Mês** | "Acordos criados no mês selecionado, excluindo os cancelados e rejeitados." |
| **Total de Quebra** | "Soma das parcelas do mês com vencimento há mais de **10 dias** e não pagas. Considera tanto acordos cancelados (auto/manual) quanto acordos vivos com parcelas não pagas além do prazo de tolerância." |
| **Pendentes** | "Parcelas do mês que ainda vão vencer ou venceram nos últimos 3 dias e não estão pagas. Após 3 dias de atraso, a parcela sai de Pendentes." |
| **Colchão de Acordos** | "Soma das parcelas projetadas para o mês originadas de acordos criados em meses anteriores (entrada e parcelas mensais)." |
| **Total Recebido** | "Soma de todos os pagamentos confirmados no mês — confirmações manuais, portal de pagamento e Negociarie." |
| **Total Negociado (mês)** | "Valor total dos acordos criados no mês, somando entrada + 1ª parcela ou apenas a 1ª parcela quando não há entrada." |
| **Total Projetado** | "Parcelas com vencimento no mês originadas de acordos vivos criados em meses anteriores." |
| **Agendamentos Hoje** | "Callbacks/retornos agendados pelos operadores para a data de hoje." |
| **Parcelas Programadas** | "Parcelas com vencimento futuro previsto, agrupadas por mês." |
| **Meta / Gauge** | "Progresso do total recebido no mês frente à meta cadastrada." |

Usar `<TooltipProvider>` + `<Tooltip>` com `<TooltipTrigger asChild>` envolvendo o ícone/título de cada Tile/Card. Cursor `cursor-help`. Sem alteração visual além de um leve `?` ou hover state já existente.

---

### 2. Quebra: tolerância de 10 dias (parcelas vencidas e não pagas)

**Diagnóstico do estado atual**
- `get_dashboard_stats` hoje só conta como **Quebra** parcelas de acordos com `status='cancelled'` (`auto_expired` ou `manual`).
- Você reduziu o cadastro de `30 → 10 dias` para auto-cancelamento, mas o job só roda periodicamente. Resultado: parcelas que já passaram dos 10 dias de atraso ficam num limbo — saíram de "Pendentes" (regra de 3 dias) mas ainda **não** entraram em "Quebra" porque o agreement ainda não foi marcado `cancelled`.

**Nova regra de Quebra (per-installment, dinâmica)**

Uma parcela soma em Quebra do mês quando **todas** as condições abaixo são verdadeiras:

1. Vencimento está dentro do mês alvo (entrada ou parcela 1..N).
2. **Não está paga** (sem registro confirmado em `manual_payments` / `negociarie_cobrancas` para aquele `installment_key`).
3. Pelo menos **uma** das duas condições:
   - **(a)** Acordo está `cancelled` com `cancellation_type IN ('auto_expired','manual')` E vencimento ≤ data de cancelamento (lógica antiga, mantida para histórico). **OU**
   - **(b)** Vencimento está atrasado há **mais de 10 dias** (ou seja, `due_date < CURRENT_DATE - 10`), independentemente do status do acordo (pega os casos onde o auto-cancel ainda não rodou ou o operador não cancelou manualmente).

**Efeito**:
- Parcelas de Abril com vencimento ≤ 20/abr não pagas entram em Quebra hoje (30/abr).
- A regra fica consistente com Pendentes: vencimento futuro → Pendente; até 3 dias de atraso → Pendente; 4 a 10 dias de atraso → "limbo" (não conta em nenhum); >10 dias → Quebra.

> Observação importante: existe um **gap de 4 a 10 dias** entre Pendentes (até 3 dias) e Quebra (após 10 dias). Se você quiser eliminar o gap, posso alinhar Pendentes para "até 10 dias de atraso" — me confirme depois.

**Mês anterior (para variação +/-%)**: aplica a mesma regra usando `CURRENT_DATE` como referência (snapshot atual do passado).

**Migration**: `CREATE OR REPLACE FUNCTION public.get_dashboard_stats(...)` ajustando apenas os blocos `_quebra` e `_quebra_mes_ant`. Demais métricas inalteradas.

---

### Arquivos

- `src/components/dashboard/KpisGridCard.tsx` — tooltips nos 6 tiles
- `src/components/dashboard/TotalRecebidoCard.tsx` — tooltip no título
- `src/components/dashboard/DashboardMetaCard.tsx` / `MetaGaugeCard.tsx` / `MetaRadialCard.tsx` — tooltip no título (apenas o que estiver em uso)
- `src/components/dashboard/AgendamentosHojeCard.tsx` — tooltip no título
- `src/components/dashboard/ParcelasProgramadasCard.tsx` — tooltip no título
- `supabase/migrations/<timestamp>_dashboard_quebra_10day_tolerance.sql` — nova lógica de Quebra
