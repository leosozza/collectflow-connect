## Objetivo

Ajustar a lógica de **Quebra** e **Pendentes** no Dashboard (`get_dashboard_stats`) para refletir a regra de negócio correta:

- **Quebra do mês X** = somente a parcela do **mês X** que não foi paga e cujo acordo está cancelado. Parcelas futuras (após o mês de quebra) não entram. Parcelas anteriores já pagas também não entram.
- **Pendentes do mês X** = somente parcelas com vencimento no mês X que ainda não foram pagas, em acordos vivos (`pending`/`approved`/`overdue`). A subtração precisa ser por parcela, não por agregado mensal.

Receita / Total Recebido / Negociado / Acordos do Dia/Mês **não serão alterados**.

## Regra de negócio (alinhada com o exemplo do usuário)

Cliente fez acordo em abril com 6 parcelas (abril → setembro). Pagou abril, não pagou maio → acordo quebra:

- Em **maio**: aparece a parcela de maio em **Quebra** (e some de Pendentes).
- Em **junho/julho/...**: as parcelas seguintes **não entram** em Quebra nem em Pendentes (acordo já está cancelado e essas parcelas não são mais devidas dentro do acordo).
- Em **abril**: a parcela de abril não entra em Quebra (foi paga).

Tradução técnica:

- **Quebra(mês X)** = soma de parcelas do mês X de acordos `cancelled` (`auto_expired`/`manual`) **onde a parcela não foi paga** **e** o vencimento da parcela é **≤ data de cancelamento do acordo** (`updated_at` do cancelamento). Isso elimina automaticamente as parcelas futuras pós-quebra.
- **Pendente(mês X)** = soma de parcelas do mês X de acordos vivos (`pending`/`approved`/`overdue`) **onde aquela parcela específica não foi paga**, parcela por parcela.

## Mudanças

Migração nova alterando apenas a RPC `public.get_dashboard_stats` (mesma assinatura, mesmo retorno). Sem DROP, sem alteração de schema, sem DML.

### 1. Quebra (substitui blocos `_quebra` e `_quebra_mes_ant`)

Para cada parcela virtual do acordo cancelado (entrada + 1..N), incluir somente se:

1. `a.status = 'cancelled'` e `cancellation_type IN ('auto_expired','manual')`.
2. Vencimento da parcela cai dentro do mês alvo.
3. Vencimento da parcela é **≤ `a.updated_at::date`** (data efetiva do cancelamento) — corta as parcelas futuras pós-quebra.
4. **Parcela não foi paga**: não existe `manual_payments` confirmado/aprovado **nem** `negociarie_cobrancas` `pago` **nem** `portal_payments` `paid` casando aquela parcela específica do acordo.

Casamento da parcela específica:
- Entrada: `installment_key = 'entrada'` (ou `installment_number = 0` legado).
- Parcela i: `installment_key = i::text` (ou `installment_number = i` legado).

### 2. Pendente (substitui blocos `_pendente` e `_pendente_mes_ant`)

Para cada parcela virtual do acordo vivo:

1. `a.status IN ('pending','approved','overdue')`.
2. Vencimento da parcela cai no mês alvo.
3. Aquela parcela específica **não foi paga** (mesma checagem de `manual_payments` / `negociarie_cobrancas` / `portal_payments` por `installment_key`/`installment_number`).

Remover a subtração agregada `_pendente := GREATEST(_pendente - _recebido, 0)` — agora o filtro é por parcela.

### 3. Inalterado

`_projetado`, `_negociado`, `_negociado_mes`, `_recebido`, `_dia`, `_mes`, `_acionados_ontem` e suas versões `_mes_ant` correspondentes: **sem mudança**. Garantia: receita de Y.BRASIL e demais tenants permanece idêntica.

### 4. KPI Card (frontend)

`KpisGridCard.tsx` e `DashboardPage.tsx`: nenhuma mudança de UI/labels. Apenas os números passam a refletir a regra correta.

## Validação

1. Rodar `get_dashboard_stats` antes e depois para 2-3 tenants e comparar:
   - `total_recebido`, `total_negociado`, `acordos_*`: **devem ser idênticos**.
   - `total_quebra`: tende a **diminuir** (some parcelas futuras de acordos quebrados, somem entradas já pagas).
   - `total_pendente`: tende a **diminuir** (parcelas pagas individualmente saem; antes só saíam pelo agregado).
2. Caso de teste manual: acordo de 6 parcelas abril→set, pago abril, cancelado em maio.
   - Mês = abril → Quebra: 0, Pendente: 0 (paga).
   - Mês = maio → Quebra: valor da parcela de maio, Pendente: 0.
   - Mês = junho → Quebra: 0, Pendente: 0.
3. Filtros por operador e por mês continuam funcionando.
4. Sem vazamento entre tenants (mantém `tenant_id = _tenant` em todos os SELECTs).

## Arquivos

- Nova migração: `supabase/migrations/<timestamp>_dashboard_quebra_pendente_per_installment.sql` (apenas `CREATE OR REPLACE FUNCTION public.get_dashboard_stats`).

Sem alteração em código TS/React.

## Riscos

- **Performance**: a checagem por parcela usa `NOT EXISTS` em `manual_payments` / `negociarie_cobrancas` / `portal_payments`. Mantemos os mesmos `WHERE tenant_id` e índices existentes. Se latência subir, podemos materializar em CTE.
- **Pagamentos legados sem `installment_key`**: o casamento usa `installment_key` com fallback para `installment_number` (entrada=0, parcela i=i), igual à lógica já existente em `agreementInstallmentClassifier.ts`.
- **Cancelamentos manuais retroativos**: o filtro `vencimento ≤ updated_at` assume que `updated_at` reflete a data de cancelamento. Já é a convenção usada em `get_bi_breakage_analysis`.
