
# Correções de Analytics + Modo Suporte do Super Admin

Mudanças cirúrgicas em produção. Sem DROP, sem DML em massa, sem refator de telas. Dashboard/Receita validados ficam intocados (RPCs `get_bi_revenue_*` não serão alteradas).

## Fonte canônica do Super Admin (FASE 0)

Confirmado durante a auditoria:
- Fonte oficial: `public.is_super_admin(uid) = tenant_users.role='super_admin'` (já é assim no DB).
- `can_access_tenant(_tid)` libera para super admin **OU** membro do tenant — correto.
- Conflito atual: super admin **não tem** linha em `tenant_users` para um tenant alvo, então `useTenant.get_my_tenant_id()` retorna NULL e o `ProtectedRoute(requireTenant)` redireciona para `/admin`. Resultado: super admin **não consegue abrir `/analytics`** mesmo com tenant de suporte selecionado. Isso é o bug central do modo suporte e será corrigido na Fase 1.

Decisão: identificação do super admin global continua exclusivamente via `is_super_admin`. `useTenant.isSuperAdmin` segue como espelho dessa RPC. Não usar `profiles.role` em lugar nenhum.

---

## FASE 1 — Modo Suporte do Super Admin

Arquivos: `src/components/ProtectedRoute.tsx`, `src/components/AppLayout.tsx` (apenas montar banner se super admin), `src/components/SupportTenantSwitcher.tsx` (já existe), `src/hooks/useImpersonatedTenant.ts` (já existe).

1. `ProtectedRoute`:
   - Remover o redirect `if (requireTenant && isSuperAdmin) return <Navigate to="/admin" />`.
   - Substituir por: se `requireTenant && isSuperAdmin`:
     - se houver `support_tenant_id` na sessão → liberar render (modo suporte ativo).
     - senão → redirecionar para `/admin` (comportamento atual).
   - Usuário comum: lógica intacta. `support_tenant_id` em sessionStorage **não tem efeito** se `isSuperAdmin=false` (já garantido por `useEffectiveTenantId`, que só considera o impersonated id quando `isSuperAdmin`).
2. `SupportTenantSwitcher` deve ficar visível também no `AppLayout` (não só no `SuperAdminLayout`) **somente** quando `isSuperAdmin=true`. Isso permite ao SA entrar/sair do modo suporte enquanto navega no app do tenant.
3. Banner amber persistente: já existe em `AnalyticsPage` e `SuperAdminLayout`. Adicionar o mesmo banner no topo do `AppLayout` quando `isSuperAdmin && support_tenant_id` (visível em qualquer página tenant-scoped).
4. Auditoria: `SupportTenantSwitcher` já chama `logAction({action:'support_mode_enter'/'support_mode_exit', entity_type:'tenant', entity_id, details})`. Vamos garantir que o `details` inclua `{ actor_user_id, target_tenant_id, mode:'support_admin_global' }`. `actor_user_id` o `auditService` já injeta via `auth.uid()`, mas adicionamos explicitamente em `details` para queryability.
5. Não cria linha em `tenant_users` em momento algum. `useImpersonatedTenant` continua usando `sessionStorage` (escopo aba).

## FASE 2 — Permissões do AnalyticsPage

Arquivo: `src/pages/AnalyticsPage.tsx`.

Lógica nova (substitui o cálculo atual de `restrictToSelf`):

```text
- Super admin com support_tenant_id selecionado → libera, escopo "todos do tenant" (sem _operator_ids).
- Super admin sem suporte ativo → mostra mensagem "Selecione um tenant…" (já existe).
- canViewAllAnalytics → libera, escopo "todos do tenant".
- canViewOwnAnalytics (sem all) → libera, _operator_ids = [profile.user_id].
- Sem all e sem own → renderiza tela de "Sem permissão para Analytics" (novo).
```

Nunca cair em "ver tudo" quando o usuário só tem `view_own`. Nunca liberar quem não tem nenhuma das duas.

## FASE 3 — Canais (Performance por Canal e Tempo de Resposta)

Migração: nova RPC versionada substituindo `get_bi_channel_performance` e `get_bi_response_time_by_channel` via `CREATE OR REPLACE` (mantém a mesma assinatura — sem DDL destrutiva, sem mudar contrato com o front).

Correções:

1. **Eliminar "boleto" como canal.** Canal é origem de interação comercial, não método de pagamento. Mapeamento final:
   - `whatsapp_inbound`, `whatsapp_outbound`, `message_sent` → `whatsapp`
   - `disposition`, `call_hangup`, `call` → `voice`
   - Demais eventos administrativos → ignorados (já são).
   - Nada de `boleto`/`pix`/`manual`/`portal` como canal. Hoje já não existe esse mapeamento direto, mas vamos travar isso no SQL e adicionar comentário; se aparecer no UI é porque o array `_channel` está vindo com esses valores — vamos sanitizar (ver item 5).
2. **Atribuição de pagamento ao canal**: o último evento `whatsapp/voice` antes da data de pagamento. Mantido. Sem mudança de regra.
3. **Filtro por operador** (corrige distorção):
   - Hoje `(_operator_ids IS NULL OR evt_operator IS NULL OR evt_operator = ANY(_operator_ids))` deixa eventos sem operador entrarem no recorte do operador. Mudar para: quando `_operator_ids IS NOT NULL`, exigir `evt_operator = ANY(_operator_ids)` (sem o "OU NULL"). Eventos sem operador só entram quando `_operator_ids IS NULL` (visão geral).
   - Mesma regra para a CTE `pay_filt` e `ag` (`a.created_by`): hoje já filtra duro por `a.created_by = ANY(_operator_ids)` — manter.
4. **Coerência interações × clientes únicos × acordos × recebido**: garantir que todas as CTEs (interações, pagamentos, acordos) apliquem **o mesmo conjunto de filtros** (`_credor`, `_operator_ids`, `_channel`). Hoje `recebido`/`ag_ch` filtra por `_channel` mas a sub-query de atribuição busca em `ev_raw` sem o filtro de canal — isso é correto (atribuição precisa olhar todos eventos para escolher o último). Mantido.
5. **Sanitização do parâmetro `_channel`** no início da função: `_channel := ARRAY(SELECT unnest WHERE unnest IN ('whatsapp','voice'))` quando não for NULL. Se sobrar vazio, tratar como NULL. Bloqueia `boleto/pix/cartao` na fonte.
6. **Tempo de Resposta por Canal** (`get_bi_response_time_by_channel`): aplicar o mesmo filtro estrito de operador (`evt_operator = ANY(_operator_ids)` quando informado, sem fallback NULL). O resto da lógica fica igual.
7. **Validação de coerência**: por construção, com o filtro estrito, a soma por operador ≤ total geral. Se quiser, deixar visão geral mostrar uma linha extra "Não atribuído" — **fora de escopo agora**, só remoção de boleto e ajuste de filtro.

UI (`ChannelsTab.tsx`): nenhuma mudança. Continua exibindo `whatsapp` e `voice` que vier da RPC.

## FASE 4 — Quebras & Risco

Migração: `CREATE OR REPLACE FUNCTION get_bi_breakage_analysis(...)`.

Hoje a função filtra `a.status='cancelled' AND created_at no período`. Isso é **safra** (cohort), não "quebras no período".

Mudança:

1. Renomear semanticamente: a função passa a usar a **data efetiva da quebra** = `a.cancelled_at` quando existir, senão `a.updated_at` (com `status='cancelled'`). Verificar antes da migração se a coluna `cancelled_at` existe; se não existir, usar `updated_at` e documentar no comentário do SQL: "data aproximada por updated_at filtrando status=cancelled".
2. Filtro: `WHERE a.status='cancelled' AND COALESCE(a.cancelled_at, a.updated_at)::date BETWEEN _date_from AND _date_to`.
3. Se a UI tiver outro card chamado "Cohort de acordos criados no período" — não existe hoje — pode ser criado depois. Por ora, só corrigir o significado de "quebras no período".

Antes de aplicar a migração, vou rodar leitura em `pg_attribute` para checar se `agreements.cancelled_at` existe e ajustar o SQL conforme.

## FASE 5 — `apply_agreement_credit_on_cancel` (crédito de cancelamento)

Migração: `CREATE OR REPLACE` da função (assinatura mantida, idempotência preservada via `previous_agreement_credit_applied` em `client_events`).

Mudanças mínimas:

1. Loop FIFO atual: `status IN ('pendente','em_acordo')`. Alterar para `status IN ('pendente','em_acordo','vencido')`. Status `'pago'` continua excluído. Status `'quitado'` (caso exista em outros tenants) também ficará de fora — manter conjunto explícito.
2. Ordenação `data_vencimento ASC` mantida. Vencido entra no FIFO junto com pendente.
3. Idempotência: nada muda. Mesmo guard via `previous_agreement_credit_applied`.
4. Não rodar nenhum cancelamento real. Validação por leitura: depois do deploy, faço `EXPLAIN`/`SELECT` simulado em uma CTE de teste read-only para um agreement já cancelado historicamente (sem executar a função), apenas para confirmar que a query de seleção pega títulos vencidos.

## FASE 6 — Validações (read-only, antes de fechar)

Vou rodar SELECTs (sem mutar nada):

1. `get_bi_revenue_summary` para Y.BRASIL no período Abril → conferir Receita Total = R$ 95.705,33.
2. Comparar `get_bi_channel_performance` antes/depois para o mesmo período Y.BRASIL: total recebido por canal ≤ receita total.
3. Listar `DISTINCT channel` que sai da função: deve ser apenas `whatsapp` e `voice`.
4. Para um operador específico do tenant: chamar `get_bi_channel_performance` com `_operator_ids=[uid]` e validar `qtd_interacoes <=` o total geral do mesmo período.
5. `get_bi_breakage_analysis` para período onde houve cancelamentos depois do fim do período de criação → confirmar que entram (antes não entravam).
6. Cross-tenant: chamar RPCs com `_tenant_id` de outro tenant usando token de operador comum → deve retornar `forbidden tenant`.
7. Front: simular `sessionStorage.support_tenant_id='<outro>'` num usuário comum → `useEffectiveTenantId` ignora (já ignora por design). Confirmar.
8. Super admin: selecionar tenant no switcher → conseguir abrir `/analytics` (Fase 1).
9. Usuário sem `view_own` nem `view_all` em analytics → ver tela de "Sem permissão" (novo).

## FASE 7 — Entrega

No final, devolvo:
- Lista de arquivos alterados.
- Lista de RPCs alteradas com diff resumido.
- O que foi corrigido em cada fase.
- Resultado dos SELECTs de validação.
- Riscos residuais (ex.: se `agreements.cancelled_at` não existir, a Fase 4 usa `updated_at` como aproximação, com nota no SQL).

---

## Resumo dos detalhes técnicos

**Arquivos front a alterar:**
- `src/components/ProtectedRoute.tsx` — liberar SA quando há `support_tenant_id`.
- `src/components/AppLayout.tsx` — montar `SupportTenantSwitcher` + banner quando `isSuperAdmin`.
- `src/pages/AnalyticsPage.tsx` — gating de permissão (all / own / sem permissão).
- `src/components/SupportTenantSwitcher.tsx` — enriquecer `details` do audit log.

**Migrações SQL (todas `CREATE OR REPLACE`, sem DROP, sem ALTER de tabela):**
- `get_bi_channel_performance` — sanitiza `_channel`, filtro estrito por operador.
- `get_bi_response_time_by_channel` — filtro estrito por operador.
- `get_bi_breakage_analysis` — usa `COALESCE(cancelled_at, updated_at)` para a janela.
- `apply_agreement_credit_on_cancel` — inclui `vencido` no FIFO.

**Não mexer**: `get_bi_revenue_*` (Receita validada), Dashboard, schemas de tabela, RLS, WhatsApp/Financeiro/Acordos fora dos pontos acima.

**Riscos residuais conhecidos:**
- Se `agreements.cancelled_at` não existir, Fase 4 usará `updated_at` (validado contra `status='cancelled'`) — aproximação aceitável conforme orientação.
- Mudança de filtro em Canais pode reduzir números exibidos quando filtra operador (comportamento correto, antes inflava com eventos sem operador).
