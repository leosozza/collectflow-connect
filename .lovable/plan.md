## Plano da Fase 5.4 — Shadow-check diário (auditoria SSOT)

### Objetivo

Detectar automaticamente, todos os dias, qualquer divergência entre a SSOT (`agreement_installments` + `agreements.paid_count`) e fontes secundárias (`manual_payments`, `negociarie_cobrancas`, `clients.status`). Sem reprocessar nada — apenas registrar para revisão. Garante que se uma trigger falhar ou um caminho legado escapar, descobrimos em ≤ 24h em vez de ouvirmos do usuário.

### Componentes

**1. Tabela `ssot_shadow_checks` (nova)**

Armazena resultados de cada execução. Colunas relevantes (além de id/created_at):
- `tenant_id uuid`
- `run_at timestamptz`
- `check_type text` — `paid_count_mismatch | carteira_status_mismatch | orphan_paid_source | overdue_agreement_not_broken`
- `entity_id uuid` — id do acordo/cliente afetado
- `entity_label text` — `cpf|credor|nº acordo` para humano achar
- `expected jsonb` — o que a SSOT diz
- `actual jsonb` — o que a fonte secundária diz
- `severity text` — `info | warn | error`
- `resolved_at timestamptz nullable`

RLS: SELECT só para admins do tenant; INSERT só via SECURITY DEFINER (a função do shadow-check).

**2. RPC `run_ssot_shadow_check(_tenant_id uuid)` (nova)**

`SECURITY DEFINER`, percorre 4 verificações por tenant:

| # | Check | Detecta |
|---|---|---|
| 1 | `paid_count_mismatch` | `agreements.paid_count` ≠ `COUNT(agreement_installments WHERE paid AND NOT cancelled)` para o mesmo `agreement_id` |
| 2 | `carteira_status_mismatch` | `clients.status` (par CPF/Credor consolidado por hierarquia legada) ≠ `map_canonical_to_legacy_status(get_client_consolidated_status(...))` |
| 3 | `orphan_paid_source` | `manual_payments` ou `negociarie_cobrancas` marcado como pago/quitado mas a `agreement_installments` correspondente está `paid=false` (trigger falhou) |
| 4 | `overdue_agreement_not_broken` | acordo com parcela vencida há > 30 dias mas `status='approved'` (deveria ter sido marcado `cancelled` por algum fluxo de quebra) |

Cada divergência insere uma linha em `ssot_shadow_checks`. Antes de inserir, se já existe uma linha não-resolvida idêntica (`tenant_id+check_type+entity_id`), apenas atualiza `run_at` para evitar enxurrada de duplicatas.

Após o run, retorna um sumário (`{ checks_run, mismatches_found, by_type }`).

**3. Edge Function `ssot-shadow-check` (nova)**

- `verify_jwt = false` (chamada por cron)
- Valida secret `SHADOW_CHECK_SECRET` no header
- Lista todos os tenants ativos
- Para cada um, chama `run_ssot_shadow_check(tenant_id)` com `service_role_key`
- Loga sumário no `console.log` (visível em Edge Function logs)
- Retorna `{ tenants_processed, total_mismatches }`

**4. Cron diário**

`pg_cron` agenda `ssot-shadow-check` para rodar 1x/dia às 03:00 BRT (06:00 UTC). Usa `pg_net` + secret no header. SQL via insert tool (não migration — contém URL específica do projeto).

**5. UI mínima (opcional, não bloqueante)**

Aba `Configurações > Diagnóstico SSOT` para admin: lista as últimas 100 entradas não-resolvidas, com botão "Marcar resolvido". Read-only para o resto. **Decisão:** entregar nesta fase apenas se simples (uma página enxuta sem novos componentes pesados); caso contrário, entregar só backend e expor via Lovable Cloud para consulta direta.

### Mudanças

**Banco (1 migration)**
- `CREATE TABLE ssot_shadow_checks` + índices em `(tenant_id, check_type, resolved_at)` e `(tenant_id, run_at DESC)`
- RLS: policy de SELECT para `has_role(auth.uid(), 'admin')` no mesmo tenant
- `CREATE FUNCTION run_ssot_shadow_check(uuid)` SECURITY DEFINER
- Trigger `update_updated_at_column` na tabela

**Edge Function**
- `supabase/functions/ssot-shadow-check/index.ts` — handler com validação de secret, loop de tenants, chamada da RPC

**Secret**
- `SHADOW_CHECK_SECRET` (gerado pelo usuário) para autenticar o cron → edge function

**Cron** (via insert tool, não migration)
- `cron.schedule('ssot-shadow-check-daily', '0 6 * * *', $$ SELECT net.http_post(...) $$)`

**Memória**
- Atualizar `installment-key-canonical.md` registrando a Fase 5.4 e o nome da tabela de auditoria
- Atualizar Core memory adicionando "shadow-check diário audita SSOT"

### Validação pós-deploy

1. Trigger manual da edge function com curl + secret → deve responder com sumário e popular `ssot_shadow_checks`
2. Conferir que `paid_count_mismatch` retorna 0 linhas (Fase 4 já garantiu)
3. Conferir que `carteira_status_mismatch` retorna número compatível com a amostra da Fase 5.3 (~0,5% das pares)
4. Aguardar 24h e verificar que cron rodou (via `cron.job_run_details`)

### Risco

Muito baixo. Tudo read-only. Nenhuma mudança em RPCs já em produção. Reversível com `DROP TABLE ssot_shadow_checks CASCADE` + `cron.unschedule(...)` + delete da edge function.

### Performance

Run completo em 1 tenant (~ 700 acordos, ~ 430k clients) estimado < 30s usando queries com JOIN agregado. Roda fora do horário de pico.

---

Posso executar a Fase 5.4 agora? Se sim, vou pedir para criar o secret `SHADOW_CHECK_SECRET` antes de subir o código.