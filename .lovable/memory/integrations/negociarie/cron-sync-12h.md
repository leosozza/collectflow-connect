---
name: Negociarie Cron Sync 12h
description: Cron job pg_cron 00h/12h BRT que chama negociarie-sync-all para garantir baixas mesmo quando webhook Negociarie falha
type: feature
---

**Job**: `negociarie-sync-all-12h` em `cron.job`. Schedule `0 3,15 * * *` (UTC) = 00h e 12h BRT.

**Edge function**: `negociarie-sync-all` (verify_jwt=false). Auth via header `x-cron-secret` == env `CRON_SECRET`.

**Fluxo**:
1. Lista `tenants` com `status='active'`
2. Para cada tenant: escopo `master` (creds tenant) + um escopo por `credores.cobrança_direta_ativa=true`
3. Por escopo: faz login Negociarie, varre `parcelas-pagas` dos últimos N dias (default=3), filtra apenas `id_parcela` que existem em `negociarie_cobrancas` daquele tenant, e re-posta normalizado para `negociarie-callback` (mesma rotina de baixa idempotente)
4. Audit log em `audit_logs` (`action=negociarie_cron_sync`)

**Body opcional**: `{ "days": N }` (1-14). Cron usa `3`.

**Idempotência**: garantida pelo `negociarie-callback` (não cria pagamentos duplicados).
