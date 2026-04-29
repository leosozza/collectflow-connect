## Diagnóstico

A cliente **Joceane Reis Silva** (CPF 44012770829, credor TESS MODELS) tem:

- Acordo `5626c317...` com status **`pending`** (vigente, em dia)
- Entrada de R$ 138,70 confirmada em 02/04/2026
- Primeira parcela (`:2`) vence em **30/04/2026** (amanhã) — nada está vencido
- Mas o cadastro do cliente está com `status_cobranca_id` = **"Acordo Atrasado"** desde o último update (22/04/2026)

O acordo já foi corrigido para `pending` (provavelmente pelo `auto-expire-agreements` após a confirmação da entrada), mas o status do cliente **nunca foi recalculado** porque o cron `auto-status-sync-daily` está quebrado.

### Causa raiz

A edge function `auto-status-sync` exige `tenant_id` no body e retorna **400** quando recebe `{}`. O cron job `auto-status-sync-daily` chama a função **sem `tenant_id`**:

```sql
-- cron.job atual
body := '{}'::jsonb
```

Resultado: todos os dias desde a criação o cron envia `{}`, a função retorna 400, e **nenhum tenant é sincronizado**. O `cron.job_run_details` mostra "succeeded" porque só verifica o HTTP POST — não o status code.

Por isso clientes ficam com status defasado: quando o acordo passa por `pending → overdue → pending`, o `auto-status-sync` deveria reverter o cliente de "Acordo Atrasado" para "Acordo Vigente", mas isso nunca acontece.

## Solução

### 1. Refatorar `auto-status-sync` para suportar modo cron multi-tenant

Em `supabase/functions/auto-status-sync/index.ts`:

- Quando chamado **sem `tenant_id`** (modo cron), buscar todos os tenants ativos em `tenants` e iterar a sincronização para cada um, em vez de retornar 400.
- Quando chamado **com `tenant_id`**, manter o comportamento atual (modo on-demand).
- Retornar resumo agregado `{ tenants_processed, total_updated, ... }` no modo cron.

Estrutura proposta:

```text
Deno.serve:
  if (tenant_id) → syncTenant(tenant_id)
  else → for each tenant in tenants table → syncTenant(tenant.id)
```

Refatorar a lógica atual em uma função `syncTenant(tenant_id)` reutilizada por ambos os modos.

### 2. Re-executar a sincronização agora

Após o deploy, disparar `auto-status-sync` (sem tenant_id) uma única vez para corrigir **todos os clientes desatualizados** dos tenants — incluindo Joceane, que voltará automaticamente para "Acordo Vigente".

### 3. Validação

- Confirmar via SQL que Joceane (`cpf=44012770829`, credor TESS MODELS) está com `status_cobranca_id` apontando para "Acordo Vigente" após o sync.
- Verificar o resumo retornado pela função (contadores por papel).

## Arquivos a editar

- `supabase/functions/auto-status-sync/index.ts` — adicionar modo cron multi-tenant
- (sem migrations — o cron job atual já funciona; só estávamos retornando 400 sem motivo)

## Por que não mexer no cron job

O cron job já está agendado e ativo. Basta a função aceitar body vazio e processar todos os tenants. Isso também garante que futuros tenants criados sejam automaticamente incluídos sem precisar mexer em SQL.
