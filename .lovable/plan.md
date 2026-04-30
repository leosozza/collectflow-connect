
# Plano — Analytics, Super Admin (modo suporte) e regra de crédito de acordo quebrado

## FASE 0 — Resumo da auditoria

Migrations recentes:
- `20260430131040_*` — Reescreve `get_bi_revenue_summary` / `_by_period` somando `manual_payments (confirmed/approved)` + `portal_payments (paid)` + `negociarie_cobrancas (pago)` por **data de pagamento**. Receita está OK e segue como fonte de verdade.
- `20260430163427_*` — RPCs auxiliares de BI (já usam `is_super_admin`).
- `20260430171305_*` — RPCs `get_bi_channel_performance`, `get_bi_breakage_analysis`, `get_bi_breakage_by_operator`, `get_bi_recurrence_analysis`, `get_bi_response_time_by_channel`, `get_distinct_credores`. **Todas (exceto `response_time`) têm guard misto que aceita `profiles.role::text = 'super_admin'`.** `response_time` **não tem guard nenhum** — aceita `_tenant_id` arbitrário.
- `20260430181818_*` — Apenas hotfix de 1 linha em `clients` (status_cobranca_id de um CPF). Sem impacto.
- `20260430184537_*` — `get_dashboard_vencimentos` resolve `_tenant` via `tenant_users WHERE user_id = auth.uid() LIMIT 1`. Para Super Admin sem `tenant_users`, retorna vazio. Isso é OK por enquanto (Dashboard não está em escopo), mas registramos como limitação para o modo suporte.
- `20260430191607_*` — Adiciona `clients.valor_pago_origem` (jsonb) + cancelamento credita pagamentos no original. Lógica em `agreementService.ts` (cliente) usa `manual_payments.status = 'confirmed'` apenas, e **não inclui `portal_payments`**. Idempotência depende de leitura prévia em `client_events` (sujeito a race).

Onde `profiles.role = 'super_admin'` ainda aparece: somente em `supabase/migrations/20260430171305_*.sql` (6 RPCs). **Não há ocorrência em `src/`.**

Canais — problemas confirmados em `get_bi_channel_performance`:
- Acordos filtrados por `a.created_at` no período, mas pagamentos por `payment_date`. Acordo criado fora do período não atribui receita ao canal.
- Atribuição de canal só usa eventos: `whatsapp_*`, `message_sent`, `message_deleted`, `atendimento_opened`, `conversation_auto_closed`, `disposition`, `call_hangup`. **Não inclui `call`.**
- Eventos administrativos (`message_deleted`, `atendimento_opened`, `conversation_auto_closed`) inflam contagem de "interações" WhatsApp.

Quebras por operador — confirmado: numerador (`updated_at`) vs denominador (`created_at`) em janelas diferentes.

## FASE 1 — Helper central `can_access_tenant`

Migration nova criando:

```sql
CREATE OR REPLACE FUNCTION public.can_access_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _tenant_id IS NOT NULL
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.tenant_id = _tenant_id AND tu.user_id = auth.uid()
      )
    );
$$;
GRANT EXECUTE ON FUNCTION public.can_access_tenant(uuid) TO authenticated;
```

Sem qualquer referência a `profiles.role`.

## FASE 2 — Reescrever guards das RPCs do Analytics

Mesma migration (ou logo a seguir), `CREATE OR REPLACE` para as 6 RPCs preservando assinatura/retorno e **removendo o bloco `profiles.role::text = 'super_admin'`**:

- `get_bi_channel_performance`
- `get_bi_breakage_analysis`
- `get_bi_breakage_by_operator`
- `get_bi_recurrence_analysis`
- `get_bi_response_time_by_channel` (adiciona guard que hoje não existe)
- `get_distinct_credores`

Padrão do guard:
```sql
IF _tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatório'; END IF;
IF NOT public.can_access_tenant(_tenant_id) THEN
  RAISE EXCEPTION 'forbidden tenant';
END IF;
```

Não alteramos a lógica interna nesta fase (exceto Canais e Quebras nas Fases 5/8).

## FASE 3 — Escopo do Analytics no frontend

Em `src/pages/AnalyticsPage.tsx`, parar de derivar `isOperator` de `profile.role !== "admin"`. Trocar por `usePermissions()`:

```ts
const { canViewAllAnalytics, canViewOwnAnalytics } = usePermissions();
const restrictToSelf = !canViewAllAnalytics && canViewOwnAnalytics;
const scopedRpcParams = f.rpcParams && restrictToSelf && profile?.user_id
  ? { ...f.rpcParams, _operator_ids: [profile.user_id] }
  : f.rpcParams;
```

Em `AnalyticsFiltersBar`, esconder o filtro de operadores quando `!canViewAllAnalytics`. A segurança real fica nas RPCs (Fase 2).

## FASE 4 — Modo suporte do Super Admin

Hoje o Super Admin não tem registro em `tenant_users` e o `useTenant()` cai em `/onboarding`. Estado atual: não há tenant switcher.

Implementação mínima (sem mexer em rotas existentes do `SuperAdminLayout`):

1. Novo hook `useImpersonatedTenant()` armazena `support_tenant_id` em `sessionStorage` (apaga ao sair).
2. Novo componente `SupportTenantSwitcher` no `SuperAdminLayout` — lista `tenants` (já acessível via RLS de super admin), permite escolher.
3. Novo wrapper `useEffectiveTenantId()`:
   - Se `isSuperAdmin && support_tenant_id` definido → retorna `support_tenant_id`.
   - Senão → `tenant?.id`.
4. `AnalyticsPage` (e demais páginas que entrarem no modo suporte) consome `useEffectiveTenantId()` em vez de `tenant?.id`.
5. Banner persistente: "Modo suporte — visualizando tenant <NOME>. Sair do modo suporte" enquanto ativo.
6. Auditoria: ao entrar em modo suporte e a cada mutação feita pelo super admin, gravar `audit_logs` com `action = 'support_mode_*'` e `tenant_id` alvo. (Já existe `auditService`; adicionar chamada nos pontos de entrada.)
7. Super Admin **não** é inserido em `tenant_users` — `can_access_tenant` já libera por `is_super_admin`.

Limitação documentada: `get_dashboard_vencimentos` continua usando `tenant_users LIMIT 1` (fora do escopo do Analytics; só anotamos para correção futura).

## FASE 5 — Corrigir `get_bi_channel_performance`

Reescrita preservando assinatura e nomes de colunas:

1. **Atribuição de receita por canal desacoplada de `agreements.created_at`.** Para cada pagamento (`manual_payments`/`portal_payments`/`negociarie_cobrancas`) no período, buscar o `agreement_id` correspondente e atribuir o canal a partir do **último evento de canal do CPF do acordo, anterior à data de pagamento**. Se acordo nulo, ignora.
2. **Filtro de credor/operador aplicado de forma uniforme** via JOIN com `agreements` (sem o `OR ap.agreement_id IS NULL` que vazava registros).
3. **Conjunto de eventos contabilizados como interação real**:
   - WhatsApp: `whatsapp_inbound`, `whatsapp_outbound`, `message_sent`.
   - Voz: `disposition`, `call_hangup`, **`call`** (novo).
   - Excluídos: `message_deleted`, `conversation_auto_closed`, `atendimento_opened`, `debtor_profile_changed`, qualquer evento de pagamento/boleto/pix/manual/negociarie, eventos de acordo/documento/telefone/score, **`previous_agreement_credit_applied`**, **`credit_overflow`**.
4. Atribuição de canal de acordos (para taxa de conversão) usa o mesmo conjunto reduzido + `call`.
5. Aplicar `_credor`/`_operator_ids` consistente em interações (via `client_events.metadata->>'credor'` quando disponível, senão pelo CPF→`agreements`) e em acordos/recebido.

## FASE 6 — Receita não pode duplicar via crédito

Validação (sem alteração de código necessária se passar):

- `get_bi_revenue_summary` soma somente `manual_payments`, `portal_payments`, `negociarie_cobrancas`. **Não lê `clients.valor_pago` nem `client_events`.** OK.
- Garantir que `previous_agreement_credit_applied` e `credit_overflow` permaneçam fora de qualquer RPC de receita/canais (Fase 5 já exclui da agregação de canais).
- Adicionar comentário SQL nas RPCs: "credito de acordo cancelado é abatimento, não receita".

QA: comparar `get_bi_revenue_summary` com Dashboard (`get_dashboard_*`) antes/depois — devem permanecer iguais.

## FASE 7 — Blindar regra de crédito (server-side)

Mover a lógica de `creditPaymentsToOriginalDebt` + `cancelAgreement (credit branch)` para uma RPC transacional `apply_agreement_credit_on_cancel(_agreement_id uuid)`:

```text
BEGIN
  SELECT ... FOR UPDATE  -- lock no agreement
  IF já existe client_event 'previous_agreement_credit_applied' com source_agreement_id THEN RETURN
  somar manual_payments WHERE status IN ('confirmed','approved')
  somar portal_payments WHERE status = 'paid'
  somar negociarie_cobrancas WHERE status = 'pago'
  distribuir FIFO em clients (lock por linha) atualizando valor_pago + valor_pago_origem
  inserir client_events 'previous_agreement_credit_applied' (+ 'credit_overflow' se aplicável)
  inserir audit_logs
  COMMIT
END
```

Mudanças derivadas:
- `agreementService.ts` → `cancelAgreement` apenas faz `UPDATE agreements SET status='cancelled'` e chama `supabase.rpc('apply_agreement_credit_on_cancel', { _agreement_id: id })`.
- Fonte de pagamentos passa a usar `('confirmed','approved')` em `manual_payments` (alinhado a `get_bi_revenue_summary`) e inclui `portal_payments status='paid'`.
- Idempotência real via `FOR UPDATE` + checagem dentro da transação.
- Sem backfill — RPC só roda quando chamada por novo cancelamento.

## FASE 8 — `get_bi_breakage_by_operator`

Definir como "Quebras criadas no período / Acordos criados no período" com janela única:
- Numerador: `agreements WHERE status='cancelled' AND created_at` no período (não `updated_at`).
- Denominador: `agreements WHERE created_at` no período.
- `valor_perdido` continua somando `proposed_total` dos cancelados.

Mesma correção em `get_bi_breakage_analysis` (alinhar janela). Comentário na RPC explicando a regra.

## FASE 9 — QA

- `bun run build` (typecheck/lint disparados pela harness).
- Smoke manual via `supabase--read_query`:
  - `SELECT public.can_access_tenant('<tenant_alheio>')` como usuário comum → false.
  - Receita pré/pós migration deve ser idêntica.
  - Canais: ligações com `call` aparecem; `message_deleted` some.
- Conferir `usePermissions` para `operador` força `_operator_ids = [self]`.
- Conferir banner de modo suporte some quando super admin sai dele.

## Arquivos a alterar/criar

- `supabase/migrations/<novo>_can_access_tenant_and_bi_guards.sql` (Fases 1, 2, 5, 8 — RPCs e helper)
- `supabase/migrations/<novo>_apply_agreement_credit_on_cancel.sql` (Fase 7)
- `src/services/agreementService.ts` (Fase 7 — chamar RPC)
- `src/pages/AnalyticsPage.tsx` (Fase 3 — usar `usePermissions` e `useEffectiveTenantId`)
- `src/components/analytics/AnalyticsFiltersBar.tsx` (Fase 3 — esconder operador quando `!view_all`)
- `src/hooks/useImpersonatedTenant.ts` (novo, Fase 4)
- `src/hooks/useEffectiveTenantId.ts` (novo, Fase 4)
- `src/components/SupportTenantSwitcher.tsx` (novo, Fase 4)
- `src/components/SuperAdminLayout.tsx` (Fase 4 — montar switcher + banner)
- `mem://` — atualizar memórias de Analytics e da regra de crédito.

## Não-objetivos

- Não tocar em Dashboard, Financeiro, Acordos UI, Baixas, WhatsApp, Discador.
- Não mexer em `get_dashboard_vencimentos` agora (fica registrado como dívida).
- Sem backfill dos 8 acordos antigos.
- Sem alteração em `get_bi_revenue_summary` se a validação confirmar paridade com Dashboard.
