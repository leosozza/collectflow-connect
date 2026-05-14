## Auditoria 360º — RIVO CONNECT (Y.BRASIL)

Escopo: varredura ampla em todas as abas do sidebar, listando **apenas quebras potenciais ou divergência de fonte de verdade** (não inclui melhorias estéticas/refatorações). Validado contra dados reais do tenant `39a450f8-…` (Y.BRASIL).

---

### 🔴 CRÍTICO 1 — Gráfico de "Total Recebido" diverge da headline (Dashboard)

**Aba:** Dashboard
**Arquivo:** `src/components/dashboard/TotalRecebidoCard.tsx` (L154) + RPC `get_financial_received_by_day`
**Sintoma:** O **número grande** de "Recebido em R$" e a aba **Baixas Realizadas** lêem da UNION `manual_payments + portal_payments + negociarie_cobrancas` (correto, SSOT contábil). Mas o **gráfico diário** abaixo do mesmo card lê `SUM(agreement_installments.paid_amount)` — fonte derivada (apoio para status), não verdade contábil.

**Evidência (Y.BRASIL, mês corrente):**
```
SSOT agreement_installments → R$ 62.932,17
UNION manual+portal+negociarie → R$ 64.201,37
Δ = R$ 1.269,20 (só em maio/2026)
```

**Causa raiz:** o RPC `get_financial_received_by_day` (migração `20260513140343`) viola a regra core de memória `Recebido em R$ = Baixas Realizadas (verdade)`. Sempre que `rebuild_agreement_installments` perde uma cobrança (caso Maraíza), o gráfico subnotifica — e divergiu da headline.

**Correção planejada (próximo loop):** reescrever `get_financial_received_by_day` para agrupar a mesma UNION por dia (manual.payment_date / portal.updated_at::date / negociarie.data_pagamento), mantendo assinatura idêntica para não quebrar a UI.

---

### 🔴 CRÍTICO 2 — `get_baixas_realizadas` ignora Super Admin Support Mode

**Aba:** Baixas Realizadas (Financeiro)
**Arquivo:** RPC `get_baixas_realizadas` (resolve tenant via `tenant_users + auth.uid()` apenas).
**Impacto:** Quebra a regra core "Tenant access guard usa `can_access_tenant`". Super admin em modo de suporte (`sessionStorage tenant switcher`) **vê os dados do próprio tenant ou nada**, em vez do tenant assistido. Inconsistente com Analytics/Dashboard que já usam `can_access_tenant`.

**Correção planejada:** aceitar `_tenant_id uuid` opcional e validar via `public.can_access_tenant(_tenant_id)` (mesmo padrão de `get_dashboard_stats_v2` derivado, ou de `get_dashboard_vencimentos_v2`).

---

### 🟠 ALTO 3 — Fallback legado de Vencimentos ainda ativo

**Aba:** Dashboard (lista "Vencimentos")
**Arquivo:** `src/pages/DashboardPage.tsx` L80-88
**Risco:** v2 (SSOT em `agreement_installments`) tem fallback automático para `get_dashboard_vencimentos` legado, que voltou a apresentar caso "pago aparecendo como vencido" (Aline/Maraíza). Se v2 falhar silenciosamente (timeout, RLS), a UI volta para a lógica antiga sem alerta visual.

**Correção planejada:** trocar fallback por toast de erro + telemetria; manter apenas fallback em casos de erro 5xx, não em erros de schema/auth.

---

### 🟠 ALTO 4 — Aguardando Liberação / Confirmação de Pagamento sem RPC

**Aba:** Aguardando Liberação, Confirmação de Pagamento
**Constatação:** não existem RPCs `get_aguardando_liberacao` / `get_pagamentos_pendentes_confirmacao` — as páginas montam a lógica via queries cliente. Em tenants grandes, isso colide com o limite de 1000 linhas do PostgREST e com a regra core "Never use fetchAllRows".

**Correção planejada:** auditar essas duas páginas para confirmar uso de `.range()` ou criar RPCs server-side similares ao padrão `get_baixas_realizadas`.

---

### 🟡 MÉDIO — Itens a confirmar (sem reprodução de quebra ainda)

Listados para varredura no próximo loop, sem ação imediata:

1. **Acordos / AgreementInstallments**: lê `negociarie_cobrancas` em paralelo com SSOT `agreement_installments`. Já existe regra `Cobrança Lookup Anti-Leak`, mas hoje há dois loops de matching (entrada=`:1` vs `:entrada`) — caso Maraíza foi único, mas reincidência possível se Negociarie reemitir cobrança.
2. **Carteira → Status Hierarchy**: existem múltiplos pontos que escrevem `clients.status` (triggers + edge functions). Validar que nenhum bypassa a hierarquia QUITADO > ACORDO VIGENTE > … (já há memória, mas sem teste automatizado).
3. **Relatórios → Aging**: `Reports Aging Bounds` define faixas; confirmar que `RelatoriosPage` usa as mesmas faixas que `AnalyticsPage` (potencial divergência cosmética que vira divergência numérica).
4. **WhatsApp / Campanhas**: `campaignService.ts` já usa a UNION correta de pagamentos para conversão — ok. Validar apenas que `dispatch-scheduled-campaigns` não conta `agreement_installments` em métricas de ROI.
5. **Automação**: nodes ReactFlow disparam por `client_events`. Confirmar que não há leitura paralela de `clients.history_text` legado.
6. **Gamificação**: `operator_points` dispara em `portal_payments` — confirmar se também dispara em `manual_payments confirmed` (senão pontos saem só de pagamento via portal, gerando ranking enviesado).

---

### Plano de execução proposto (próximo loop)

Quando você aprovar este plano, implemento na seguinte ordem:

1. **Reescrever `get_financial_received_by_day`** para usar a UNION SSOT (resolve CRÍTICO 1 — divergência reproduzida).
2. **Adicionar `_tenant_id` + `can_access_tenant` em `get_baixas_realizadas`** (CRÍTICO 2).
3. **Endurecer fallback em `DashboardPage`** (ALTO 3).
4. **Auditar paginação em Aguardando Liberação / Confirmação** (ALTO 4) — só corrijo se detectar `.select()` sem `.range()` real.

Os itens MÉDIOS ficam para uma segunda rodada — me confirma se quer que eu já mergulhe neles também ou se prefere ir só com os 4 críticos primeiro.