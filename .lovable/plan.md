## Auditoria 360º — Round 2 (itens MÉDIOS)

Objetivo: zerar divergências numéricas restantes para que **todos os totais batam exatos** entre Dashboard, Baixas, Acordos, Relatórios, Analytics e Gamificação.

---

### 1. 🟠 Gamificação — pontos só disparam em `portal_payments`
**Arquivo:** `src/services/gamificationService.ts` + triggers em `portal_payments`
**Problema:** ranking enviesado — operadores cujos clientes pagam por boleto manual (`manual_payments confirmed`) ou via Negociarie não pontuam.
**Correção:** estender trigger/serviço para também disparar em:
- `manual_payments` quando `status` vira `confirmed`/`approved`
- `negociarie_cobrancas` quando `status` vira `pago`
Usar a mesma fórmula de pontos da `portal_payments` (valor pago × multiplicador). Idempotência via chave `(source, source_id)`.

---

### 2. 🟠 Relatórios vs Analytics — faixas de aging divergentes
**Arquivos:** `src/components/relatorios/AgingReport.tsx`, `src/pages/AnalyticsPage.tsx` (+ tabs)
**Problema:** memória `Reports Aging Bounds` define faixas oficiais; verificar se Analytics usa as mesmas. Se divergir, o mesmo cliente aparece em faixas diferentes nos dois módulos.
**Correção:** centralizar faixas em `src/lib/agingBuckets.ts` (constantes + helper `bucketFor(daysOverdue)`) e consumir nos dois módulos.

---

### 3. 🟠 Negociarie cobrança lookup — anti-leak duplo loop
**Arquivo:** `src/services/agreementService.ts` (matching `entrada=:1` vs `:entrada`)
**Problema:** memória `Cobrança Lookup Anti-Leak` já mitigou o caso Maraíza, mas há dois loops de matching que podem reincidir se Negociarie reemitir cobrança para o mesmo `id_parcela`.
**Correção:** unificar em um único loop com `usedCobrancaIds` Set + prioridade por `data_vencimento` exato; logar warning quando duas parcelas competem pela mesma cobrança.

---

### 4. 🟠 Carteira → Status Hierarchy — sem garantia server-side
**Arquivos:** triggers que escrevem `clients.status`
**Problema:** múltiplos pontos (triggers + edge functions) gravam `status`; nada impede um trigger menor sobrescrever `QUITADO` por `INADIMPLENTE`.
**Correção:** criar função `enforce_client_status_hierarchy()` como BEFORE UPDATE trigger em `clients` que rejeita downgrade (QUITADO > ACORDO VIGENTE > ACORDO ATRASADO > QUEBRA > INADIMPLENTE > EM DIA) a menos que campo `_force_status_override` esteja setado em sessão.

---

### 5. 🟡 Automação — confirmar zero leitura de `clients.history_text`
**Arquivos:** `src/components/automacao/*`, `supabase/functions/automation-*`
**Problema:** SSOT é `client_events`; legado `clients.history_text` ainda existe e pode ser lido por nodes antigos.
**Correção:** grep em nodes/edge functions de automação por `history_text`; se encontrado, migrar para `client_events`. Se não encontrado, marcar como verificado no plan.md.

---

### 6. 🟡 Campanhas ROI — confirmar UNION SSOT
**Arquivo:** `supabase/functions/dispatch-scheduled-campaigns/*`
**Correção:** grep por `agreement_installments` em métricas de ROI; se aparecer, trocar pela UNION `manual+portal+negociarie` (mesma já usada em `campaignService.ts`).

---

### Ordem de execução

1. **Faixas aging unificadas** (#2) — sem migração, só refactor frontend.
2. **Negociarie lookup unificado** (#3) — só TS, sem migração.
3. **Trigger status hierarchy** (#4) — migration.
4. **Gamificação multi-fonte** (#1) — migration (trigger) + serviço.
5. **Verificações #5 e #6** — grep + relatório no plan.md (correções só se encontrar).

Cada passo termina com query SQL de validação reproduzindo os totais Y.BRASIL para confirmar zero divergência.
