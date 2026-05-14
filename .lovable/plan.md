## Auditoria 360º — Round 2 (resultado)

### ✅ Já estavam resolvidos (verificados nesta rodada)

1. **Gamificação multi-fonte** — `recalculate_operator_gamification_snapshot` já lê das 3 fontes (manual_payments, portal_payments, negociarie_cobrancas).
2. **Aging Relatórios vs Analytics** — Analytics não usa aging por dias-em-atraso (usa score buckets 0-20…81-100). Sem divergência.
3. **Negociarie cobrança lookup anti-leak** — `rebuild_agreement_installments` já implementa `v_used` array + prioridade `data_vencimento` exato (P1/P2 antes de fallback sem data).
4. **Automação `clients.history_text`** — grep retornou 0 matches em `src/components/automacao/` e `supabase/functions/`.
5. **Campanhas ROI** — grep por `agreement_installments` em `dispatch-scheduled-campaigns` retornou 0 matches.

### 🆕 Aplicado nesta rodada

**Trigger `enforce_client_status_hierarchy`** em `clients` (BEFORE UPDATE OF status_cobranca_id):
- Bloqueia silenciosamente downgrade saindo de QUITADO (preserva o status anterior + RAISE WARNING).
- Permite override explícito via `SET LOCAL app.force_status_override = 'true'`.
- Protege o caso crítico "uma vez quitado, sempre quitado" sem quebrar fluxos legítimos de mudança.

### Fechamento

Todas as fontes de verdade financeiras (Dashboard headline, gráfico Total Recebido, Baixas, Gamificação, Acordos, Relatórios) agora consomem a UNION canônica `manual_payments + portal_payments + negociarie_cobrancas`. Os números devem bater exatos entre as telas.
