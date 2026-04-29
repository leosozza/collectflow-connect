
## Análise da auditoria

Verifiquei cada item nos arquivos atuais. Todos os problemas relatados existem de fato:

- `agreementService.ts`: vários `update("clients")` sem `.eq("tenant_id", ...)` (linhas 243-248, 258-262, 566-589, 945-950) e `cancelAgreement` descobre tenant via "primeiro client do credor" (linha 538). `registerAgreementPayment`/`reverseAgreementPayment` (linhas 991-1101) recebem só `cpf+credor` e fazem update sem tenant nem CPF formatado.
- `asaas-webhook/index.ts`: token só é validado quando o header existe (linha 57 `if (asaasAccessToken)`). Sem header → passa direto, mesmo para `platform_billing_subscriptions`.
- `auto-status-sync/index.ts`: aceita `tenant_id` no body sem auth (linhas 268-288); `.neq("status","inactive")` pega `deleted/suspended`; agrupamento por `c.cpf` cru (linha 180); ordenação de acordos por UUID (linha 132).
- `campaign_celebration_views`: policies usam `operator_id = auth.uid()`, mas o hook insere `profile.id` (hook linha 149).
- `get_dashboard_vencimentos` (migração 20260429151411): para parcelas regulares, a chave do `custom_installment_values` usa `i+1`, mas a checagem em `manual_payments` usa `installment_number = (i+2 quando há entrada)`. Isso já está correto para manual_payments, porém só considera `status = 'confirmed'` (precisa também `'approved'` se ambos existirem) e não há fallback por `installment_key` em manual_payments.
- `payment_records` no financeiro do tenant: `PaymentHistoryCard` e `fetchPaymentRecords` listam tudo, incluindo `payment_type='subscription'` (mensalidade SaaS).
- `clients-api /whatsapp/send|bulk`: não valida que o telefone pertence ao credor da API key escopada.

---

## Correções

### 1. `src/services/agreementService.ts` — tenant_id explícito em todos os updates de `clients`

Mudanças cirúrgicas, mantendo CPF raw + formatado:

- `createAgreement` → "mark em_acordo" (≈ linhas 243-248): adicionar `.eq("tenant_id", tenantId)`.
- `createAgreement` → "auto-assign operator" (≈ linhas 258-262): adicionar `.eq("tenant_id", tenantId)` e usar `.or(cpf.eq.${rawCpf},cpf.eq.${fmtCpf})` em vez de `.eq("cpf", data.client_cpf)`.
- `cancelAgreement` (≈ linhas 537-590): remover o lookup `refClient`/`tenantIdLookup`. Usar `agreement.tenant_id` direto (já vem do `select("client_cpf, credor, tenant_id")`). Adicionar `.eq("tenant_id", agreement.tenant_id)` em todos os 3 updates (`status: "pendente"`, `Em dia`, `Inadimplente`). O `fetchByPapel` passa a usar `agreement.tenant_id`.
- `reopenAgreement` (≈ linhas 945-950): adicionar `.eq("tenant_id", agreement.tenant_id)`.
- `registerAgreementPayment` e `reverseAgreementPayment`: adicionar parâmetro `tenantId: string` na assinatura. Atualizar callers:
  - `src/components/acordos/PaymentConfirmationTab.tsx:96/98` → passar `agr.tenant_id` (já disponível no agreement).
  - `src/services/manualPaymentService.ts:282` → passar `tenantId` (já é parâmetro da função do serviço).
  Dentro das funções: `.eq("tenant_id", tenantId)` no SELECT inicial e nos UPDATEs por `id`. Trocar `.eq("cpf", cpf)` por `.or("cpf.eq.${raw},cpf.eq.${fmt}")`.

Não alterar lógica de distribuição/reversão — apenas escopo.

### 2. `supabase/functions/asaas-webhook/index.ts` — token obrigatório para mensalidade da plataforma

Refatorar `updatePlatformSubscription`:
- Após localizar `platformSubscription`, **sempre** carregar `platform_billing_accounts.webhook_token`.
- Se `platformAccount?.webhook_token` existir e (`!asaasAccessToken` OR `webhook_token !== asaasAccessToken`) → retornar `{ forbidden: true }`.
- Manter retorno 401 já existente nos dois pontos de chamada (linhas 91-96 e 140-145), e **não inserir** `payment_records` quando forbidden (já é o caso pois retornamos antes do INSERT).
- Fluxo de `token_purchase` continua sem exigir o header (mantém compatibilidade), mas mensalidade da plataforma agora é estrita.

### 3. `supabase/functions/auto-status-sync/index.ts`

- Single-tenant: exigir `Authorization`. Decodificar usuário com `supabase.auth.getUser(jwt)`. Permitir se:
  - Header `apikey === SUPABASE_SERVICE_ROLE_KEY` (chamada interna/cron manual), OU
  - Usuário autenticado é super_admin (via `super_admins` table, se existir; senão via `has_role(auth.uid(),'admin')` global), OU
  - Usuário é `admin/gerente/supervisor` daquele `tenant_id` em `tenant_users`.
  Caso contrário → 401.
- Cron mode (linha 294): trocar `.neq("status","inactive")` por `.eq("status","active")`.
- Agrupamento (linhas 178-195): a ordenação por `cpf` cru ainda funciona (postgres ordena strings), mas o **agreementKey** já normaliza CPF (`rawCpf|credor`). O bug é que `cur[0].cpf === c.cpf` compara CPF cru. Corrigir comparando por CPF normalizado:
  ```ts
  const norm = (s) => (s||"").replace(/\D/g,"");
  if (cur.length === 0 || (norm(cur[0].cpf) === norm(c.cpf) && cur[0].credor === c.credor)) ...
  ```
  E `processGroup` usa `clients[0].cpf` em rawCpf — mantém. Para o ordering ficar correto entre formatado/não, adicionar segundo SELECT ordenando por `regexp_replace(cpf,'\D','','g')` não é trivial via PostgREST; manter ordering atual mas a comparação normalizada protege contra mistura.
- "Último acordo cancelado" (linha 132): trocar por `.sort((a,b) => new Date(b.created_at||b.updated_at) - new Date(a.created_at||a.updated_at))`. Adicionar `created_at, updated_at` ao SELECT da linha 59.
- Updates em `clients` já têm `.eq("tenant_id", tenant_id)` — confirmar que **todos** os 3 pontos (`flushUpdates`, expirar negociação, etc.) mantêm. Já estão OK.

### 4. Nova migration: RLS de `campaign_celebration_views`

Nova migration substituindo as policies (mantendo a tabela):

```sql
DROP POLICY IF EXISTS "Operators view own celebration views" ON public.campaign_celebration_views;
DROP POLICY IF EXISTS "Operators insert own celebration views" ON public.campaign_celebration_views;

CREATE POLICY "Operators view own celebration views"
  ON public.campaign_celebration_views FOR SELECT TO authenticated
  USING (operator_id = public.get_my_profile_id() AND tenant_id = public.get_my_tenant_id());

CREATE POLICY "Operators insert own celebration views"
  ON public.campaign_celebration_views FOR INSERT TO authenticated
  WITH CHECK (operator_id = public.get_my_profile_id() AND tenant_id = public.get_my_tenant_id());
```

Hook `useCampaignCelebrations.ts` continua igual (já usa `profile.id`).

### 5. Nova migration: `get_dashboard_vencimentos` aceitar `confirmed`+`approved`

Substituir a função (sem alterar a interface/retorno) trocando todos os `mp.status = 'confirmed'` por `mp.status IN ('confirmed','approved')`. Adicionar fallback por `installment_key` em manual_payments (quando a coluna existir):

```sql
WHEN EXISTS (
  SELECT 1 FROM manual_payments mp
  WHERE mp.agreement_id = a.id
    AND (
      mp.installment_key = a.id::text || ':' || (i+1)::text
      OR mp.installment_number = (CASE WHEN a.entrada_value > 0 THEN i+2 ELSE i+1 END)
    )
    AND mp.status IN ('confirmed','approved')
) THEN 'paid'
```

Análogo para entrada (`installment_key = a.id || ':0'` OR `installment_number = 0`). Filtro `cancelled_installments` permanece. Card UI não muda.

### 6. Filtrar mensalidade da plataforma em telas tenant

- `src/components/financeiro/PaymentHistoryCard.tsx` (query linhas 33-43): adicionar `.neq("payment_type","subscription")` e `.or("metadata->platform_billing.is.null,metadata->platform_billing.eq.false")`.
- `src/services/tokenService.ts:fetchPaymentRecords` (linha 181): mesmo filtro.
- `src/pages/admin/AdminFinanceiroPage.tsx:57` (Super Admin tenant-facing? checar): se for página tenant, aplicar filtro; se for SuperAdmin, manter.
- `AdminDashboardPage.tsx:141` é Super Admin → manter sem filtro.

### 7. `clients-api` — validação por credor em /whatsapp/send e /whatsapp/bulk

Helper novo (no topo do arquivo) `phoneBelongsToCredor(tenantId, credorNome, phone) → boolean`:

```ts
async function phonesByCredor(tenantId, credorNome, phones: string[]) {
  const norm = phones.map(p => p.replace(/\D/g,""));
  const { data } = await supabaseAdmin.from("clients")
    .select("phone").eq("tenant_id", tenantId).eq("credor", credorNome)
    .in("phone", norm); // + variações se necessário
  return new Set((data||[]).map(r => r.phone.replace(/\D/g,"")));
}
```

- `/whatsapp/send`: se `auth.credorId` (escopada) → validar phone; se não pertencer → `403 { error: "Telefone não pertence ao credor desta API key" }`.
- `/whatsapp/bulk`: se escopada, computar set válido em uma query e rejeitar lote inteiro com 403 listando os phones inválidos (mais seguro e simples que filtrar — auditoria mandou "rejeitar lote com telefones não pertencentes").
- Chave global (sem `credorId`): comportamento atual.

---

## Detalhes técnicos adicionais

- Convenção CPF: usar helper inline `(rawCpf, fmtCpf)` já presente em vários pontos do `agreementService.ts`. Não importar nova lib.
- Migrations criadas (NÃO editar antigas): 2 novas — `..._fix_celebration_views_rls.sql` e `..._fix_dashboard_vencimentos_manual_pay.sql`.
- `tenant_users.role` já tem `admin/gerente/supervisor/operador` — usar `.in("role", ["admin","gerente","supervisor"])` na auth do auto-status-sync.
- Não existe `super_admins` table dedicada; usar `has_role(auth.uid(), 'admin')` global + match em tenant_users.

## Validação ao final

Após implementar:
1. Build automático do harness (TS/Vite).
2. `bunx vitest run` para testes existentes.
3. `supabase--linter` para confirmar que as novas policies não introduzem warnings.
4. Smoke manual via tool calls: `read_query` em `pg_policies` para confirmar nomes; `curl_edge_functions` no asaas-webhook (sem token → 401, com token errado → 401, com token correto → 200).

Reportarei exatamente o que foi validado, com saídas dos comandos.

## Arquivos alterados

- `src/services/agreementService.ts`
- `src/components/acordos/PaymentConfirmationTab.tsx`
- `src/services/manualPaymentService.ts`
- `src/services/tokenService.ts`
- `src/components/financeiro/PaymentHistoryCard.tsx`
- `src/pages/admin/AdminFinanceiroPage.tsx` (apenas filtro se for view tenant)
- `supabase/functions/asaas-webhook/index.ts`
- `supabase/functions/auto-status-sync/index.ts`
- `supabase/functions/clients-api/index.ts`
- 2 novas migrations em `supabase/migrations/`

## Fora de escopo (não alterado)

- Layout/identidade visual do dashboard e do PaymentHistoryCard (apenas filtro de query).
- Estrutura das tabelas `campaign_celebration_views`, `payment_records`, `agreements`, `clients`.
- Migrations antigas.
- Lógica de cálculo de gamificação e de distribuição de pagamentos.
