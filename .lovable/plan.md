# Plano: Dashboard fix + Módulo FINANCEIRO + Baixas Realizadas

## Descobertas relevantes

- O `_recebido` atual da `get_dashboard_stats` **já usa** `manual_payments` (`confirmed`) + `portal_payments` (`paid`). Está faltando `negociarie_cobrancas` (`pago`) e o status `approved` em `manual_payments`.
- **Não existe tabela `agreement_installments`** — as parcelas são virtuais, geradas a partir de `agreements.first_due_date + new_installments` e `custom_installment_values`/`custom_installment_dates`. O "pagamento" da parcela vive em 3 fontes:
  - `manual_payments` (campos: `agreement_id`, `installment_number`, `installment_key`, `amount_paid`, `status`, `payment_date`, `payment_method`, `receiver`).
  - `portal_payments` (campos: `agreement_id`, `amount`, `status`, `payment_method`, `payment_data`, `updated_at`).
  - `negociarie_cobrancas` (campos: `agreement_id`, `installment_key`, `valor_pago`, `data_pagamento`, `status`).
- A tela de "Aguardando Liberação" e "Confirmação de Pagamento" hoje são **abas** dentro de `/acordos` (`statusFilter = 'pending_approval' | 'payment_confirmation'`). Vamos transformá-las em rotas próprias reaproveitando os mesmos componentes.
- Sidebar é hand-coded em `src/components/AppLayout.tsx` (não usa shadcn sidebar).

---

## FASE 1 — Migration: corrigir `_recebido` em `get_dashboard_stats`

Nova migration que faz `CREATE OR REPLACE` da função (mantém assinatura `(_user_id, _year, _month, _user_ids)`, sem dropar nada). Substitui só o bloco do `_recebido` e do `_recebido_mes_ant`:

```sql
-- Mês corrente
_recebido :=
  COALESCE((SELECT SUM(mp.amount_paid)
    FROM manual_payments mp JOIN agreements a ON a.id = mp.agreement_id
    WHERE mp.tenant_id = _tenant
      AND mp.status IN ('confirmed','approved')
      AND mp.payment_date BETWEEN _month_start AND _month_end
      AND (_no_op_filter OR a.created_by = _user_id
           OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))), 0)
  + COALESCE((SELECT SUM(pp.amount)
    FROM portal_payments pp JOIN agreements a ON a.id = pp.agreement_id
    WHERE pp.tenant_id = _tenant
      AND pp.status = 'paid'
      AND pp.updated_at >= _month_start::timestamptz
      AND pp.updated_at <  (_month_end + 1)::timestamptz
      AND (_no_op_filter OR a.created_by = _user_id
           OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))), 0)
  + COALESCE((SELECT SUM(nc.valor_pago)
    FROM negociarie_cobrancas nc JOIN agreements a ON a.id = nc.agreement_id
    WHERE nc.tenant_id = _tenant
      AND nc.status = 'pago'
      AND nc.data_pagamento BETWEEN _month_start AND _month_end
      AND (_no_op_filter OR a.created_by = _user_id
           OR a.created_by = ANY(COALESCE(_user_ids,'{}'::uuid[])))), 0);
```
Mesmo bloco replicado para `_recebido_mes_ant` com `_prev_month_start/_prev_month_end`.

Garantias: não dropa, não muda assinatura, não toca dados.

---

## FASE 2 — Sidebar: agrupador FINANCEIRO

Edição em `src/components/AppLayout.tsx`:

1. Remover o item topo `Acordos` da lista `preContactItems`.
2. Adicionar um novo `<Collapsible>` "Financeiro" (ícone `Banknote` ou `HandCoins`) com filhos:
   - **Acordos** → `/acordos` (visível se `permissions.canViewAcordos`)
   - **Baixas Realizadas** → `/financeiro/baixas` (visível se `canViewAcordos`)
   - **Aguardando Liberação** → `/financeiro/aguardando-liberacao` (apenas se `permissions.canApproveAcordos` ou role admin/super_admin)
   - **Confirmação de Pagamento** → `/financeiro/confirmacao-pagamento` (apenas se `permissions.canApproveAcordos` ou admin)
3. Estado `financeiroOpen` controlado, abre automaticamente quando rota começa com `/acordos` ou `/financeiro`.

Roteamento em `src/App.tsx` (dentro do `AppLayout`):
- `acordos` continua mas com URL search default `?status=vigentes` (mantém abas atuais Pagos/Vigentes/Vencidos/Aguardando/Cancelados/Confirmação) — **as abas continuam existindo na página** para uso interno; o sidebar apenas adiciona atalhos diretos.
- `financeiro/baixas` → nova `<BaixasRealizadasPage />`.
- `financeiro/aguardando-liberacao` → renderiza `AcordosPage` com prop/initial filter `pending_approval` (ou navega com `?status=pending_approval` e oculta o seletor de abas).
- `financeiro/confirmacao-pagamento` → mesmo padrão com `?status=payment_confirmation`.

Forma mais simples: criar 2 wrappers finos `AguardandoLiberacaoPage.tsx` e `ConfirmacaoPagamentoPage.tsx` que importam `AcordosPage` passando um `lockedStatus` prop. Ajustar `AcordosPage` para aceitar `lockedStatus?: StatusFilter` e, quando presente, esconder os chips de status.

Guarda de rota (dentro dos wrappers):
```tsx
if (!permissions.canApproveAcordos) return <Navigate to="/acordos" replace />;
```

---

## FASE 3 — Página "Baixas Realizadas"

### Backend: nova RPC `get_baixas_realizadas`

```sql
CREATE OR REPLACE FUNCTION public.get_baixas_realizadas(
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _credor text DEFAULT NULL,
  _local text DEFAULT NULL,        -- 'credora' | 'cobradora' | NULL
  _payment_method text DEFAULT NULL
) RETURNS TABLE (
  source text,                     -- 'manual' | 'portal' | 'negociarie'
  payment_id uuid,
  agreement_id uuid,
  client_cpf text,
  client_name text,
  credor text,
  installment_number int,          -- parcela X
  total_installments int,          -- de Y
  installment_key text,
  valor_original numeric,          -- da parcela (custom_installment_values ou new_installment_value)
  juros numeric,                   -- best-effort: do payment_data jsonb se existir, senão 0
  multa numeric,
  honorarios numeric,
  valor_pago numeric,
  payment_date date,
  payment_method text,
  local_pagamento text             -- 'cobradora' p/ manual+portal+negociarie por padrão; 'credora' se receiver/payment_data indicar
) ...
```

Lógica:
- UNION ALL das 3 fontes filtradas por status pago, `tenant_id` resolvido por `auth.uid()` → `tenant_users`.
- `installment_number`/`total_installments` derivados do JOIN com `agreements` (`new_installments`, e installment_key/installment_number).
- `local_pagamento`: `manual_payments.receiver` mapeia para `credora` quando = 'credora'/'creditor'; portal+negociarie default `cobradora` (ajustável).
- `valor_original` = `COALESCE(custom_installment_values->>installment_number, new_installment_value)`; para entrada, `entrada_value`.
- `juros/multa/honorarios`: não há colunas dedicadas hoje — extraímos do `portal_payments.payment_data` (jsonb) quando disponível; `manual_payments` não persiste breakdown, então retornamos `0` para esses campos e exibimos "—" no front. *Decisão de produto: aceitar best-effort agora; uma evolução futura adicionaria colunas `interest_amount/penalty_amount/fees_amount` em `manual_payments`.*

Filtros aplicados via parâmetros; tudo opcional.

### Frontend: `src/pages/financeiro/BaixasRealizadasPage.tsx`

- Header com filtros (shadcn): `DateRangePicker` (Data de pagamento), `Select` Credor, `Select` Local (Credora/Cobradora/Todos), `Select` Meio de Pagamento (Pix/Boleto/Cartão/Outros), botão "Limpar".
- Default: período = mês corrente (`startOfMonth`..`endOfMonth`).
- Lista renderizada como tabela responsiva agrupada por mês (cabeçalho "Outubro/2025", "Novembro/2025"...).
- Colunas: Devedor (nome + CPF), Credor, Parcela ("3 de 6"), Valor original, Juros, Multa, Honorários, Valor pago, Data, Meio, Local.
- Total no rodapé do grupo (soma de valor pago).
- Export para Excel reutilizando `exportToExcel` de `src/lib/exportUtils.ts`.

### Permissões
Visível para todo usuário com `canViewAcordos`. Sem restrição extra além de tenant.

---

## Arquivos a criar/editar

**Criar:**
- `supabase/migrations/<ts>_fix_recebido_negociarie.sql` (Fase 1).
- `supabase/migrations/<ts>_baixas_realizadas_rpc.sql` (Fase 3).
- `src/pages/financeiro/BaixasRealizadasPage.tsx`.
- `src/pages/financeiro/AguardandoLiberacaoPage.tsx` (wrapper).
- `src/pages/financeiro/ConfirmacaoPagamentoPage.tsx` (wrapper).

**Editar:**
- `src/components/AppLayout.tsx` (sidebar: novo grupo Financeiro, remove Acordos do topo).
- `src/App.tsx` (3 novas rotas dentro do `AppLayout`).
- `src/pages/AcordosPage.tsx` (aceitar prop opcional `lockedStatus` para esconder chips).

## Validação pós-implementação

1. SQL: `SELECT total_recebido FROM get_dashboard_stats(NULL,2025,11,NULL);` antes/depois.
2. UI: navegar `/dashboard` (KPI Total Recebido), `/acordos`, `/financeiro/baixas`, `/financeiro/aguardando-liberacao`, `/financeiro/confirmacao-pagamento`.
3. Permissões: usuário sem `canApproveAcordos` não vê os 2 últimos itens do menu nem acessa as rotas (redireciona).
4. Sidebar collapsible mantém-se aberto quando rota ativa começa com `/acordos` ou `/financeiro`.
