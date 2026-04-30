## Problema

Cliente **Cleidson Gonçalves Rodrigues** (CPF `078.282.596-62`, credor `TESS MODELS`) aparece como **"Inadimplente"** no header (campo `Status do Cliente`), mas tem **acordo vigente** (`311f5d28`, status `pending`, criado em 16/04/2026).

### Causa raiz

1. O grupo CPF+Credor possui 12 linhas em `clients` com `status_cobranca_id` desalinhados:
   - 5× `Acordo Vigente`
   - 2× `Quitado`
   - **2× `Inadimplente`** (linha exibida na tela)
   - 2× `Quebra de Acordo`
2. A função `auto-status-sync` aplica a hierarquia por grupo `(cpf|credor)`, mas **não rodou** para esse cliente após a criação do acordo vigente (`updated_at` das linhas problemáticas é anterior ao acordo).
3. Acordos atuais não disparam sincronização do `status_cobranca_id` automaticamente — depende de cron ou ação manual em `/clientes` e `/carteira`.

## Correção (3 passos, sem impacto em produção)

### Passo 1 — Hotfix imediato no cliente afetado
Migration SQL única, idempotente, escopada por tenant+CPF+credor. Sobrescreve `status_cobranca_id` de **todas as 12 linhas** do grupo para `Acordo Vigente` (`9ffe808b-4346-4336-ba77-1fc9f56b7385`), pois há acordo `pending` ativo.

```sql
UPDATE public.clients
SET status_cobranca_id = '9ffe808b-4346-4336-ba77-1fc9f56b7385',
    updated_at = now()
WHERE tenant_id = '39a450f8-7a40-46e5-8bc7-708da5043ec7'
  AND regexp_replace(cpf, '\D', '', 'g') = '07828259662'
  AND credor = 'TESS MODELS PRODUTOS FOTOGRAFICOS LTDA';
```

Risco: zero — afeta apenas 12 linhas de um único CPF/credor/tenant.

### Passo 2 — Reexecutar `auto-status-sync` para o tenant
Disparar a edge function `auto-status-sync` em modo single-tenant (`{ tenant_id: '39a450f8-...' }`) para revalidar **todos os demais clientes** do tenant que possam estar com o mesmo desalinhamento (ex.: outros acordos criados sem cron desde a última execução).

Operação read-then-write controlada pela própria função existente; segue lógica já em produção. Sem alteração de schema.

### Passo 3 — Prevenir reincidências (opcional, recomendado)
Ajuste mínimo no fluxo de criação/aprovação/cancelamento de acordo para invocar `auto-status-sync({ tenant_id })` ao final, garantindo que o `status_cobranca_id` do grupo CPF/credor seja recalculado em tempo real.

Ponto de inserção: serviço/edge que finaliza criação de `agreements` (`agreementService.ts` lado client e/ou edge `agreement-create` se existir). Chamada não-bloqueante (`.catch(() => {})`) para não impactar UX.

## Validação pós-aplicação

1. Recarregar a página `/clientes/{id}` — header deve exibir **"Acordo Vigente"**.
2. Em `/financeiro/baixas` ou `/carteira`, filtrar pelo CPF — todas as 12 linhas com mesmo status.
3. Verificar query:
   ```sql
   SELECT status_cobranca_id, count(*) FROM clients
   WHERE cpf='07828259662' AND tenant_id='39a450f8-...'
   GROUP BY 1;
   ```
   Esperado: 1 linha, 12 contagens, id `9ffe808b-...`.

## O que NÃO será mexido

- Tabela `agreements` (acordo `311f5d28` permanece `pending`).
- Tabela `manual_payments` (pagamentos do caso anterior permanecem).
- RLS, RPCs, schema.
- Lógica de revenue/dashboards.
- Outros tenants.

## Detalhes técnicos

- Migração SQL: criada em `supabase/migrations/`.
- Edge function: invocada via `supabase.functions.invoke('auto-status-sync', { body: { tenant_id } })` ou via tool de teste.
- Hook de propagação (Passo 3): a definir após confirmação — inserir após `agreements.insert` e `agreements.update(status)`.

## Pergunta antes de executar

Você quer que eu execute apenas **Passo 1 + Passo 2** (correção pontual + revarredura do tenant) ou também o **Passo 3** (hook de propagação automática para evitar que isso volte a acontecer com outros clientes)?