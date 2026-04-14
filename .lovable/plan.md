

# Auditoria das Alterações de Hoje — Inconsistências Encontradas

## Resumo das Mudanças do Dia
1. ✅ Remoção de Relatórios, Analytics e Auditoria da sidebar
2. ✅ Remoção do `auto-status-sync` no mount da CarteiraPage
3. ✅ Otimização do webhook Gupshup (O(1))
4. ✅ Hook `recalcScoreForCpf` criado
5. ✅ Integração do recálculo no `agreementService`
6. ⚠️ Trigger SQL para recálculo automático de score
7. ⚠️ Imports não utilizados no AppLayout

---

## 🔴 CRÍTICO: Trigger de Score Automático NÃO Funciona

**O problema:** O trigger SQL (`trg_recalc_score_on_event`) chama a Edge Function `calculate-propensity` via `pg_net` usando o **service_role key**. Porém, a função valida autenticação assim:

```text
anonClient.auth.getUser(service_role_token)  →  FALHA (não é um user JWT)
→  retorna 401 Unauthorized
→  score NUNCA é calculado via trigger
```

O `service_role_key` é uma chave de serviço, não um token de usuário. A função tenta resolver o `user.id` para encontrar o `tenant_id`, mas com service_role não há usuário associado.

**Evidência:** Os logs mostram muitos ciclos de boot/shutdown sem nenhum log de processamento real — a função recebe a chamada, falha no auth e retorna 401 silenciosamente.

**Correção necessária:** Modificar a Edge Function `calculate-propensity` para aceitar dois modos de autenticação:
1. **User JWT** (modo atual, do frontend) — resolve tenant via `user.id → tenant_users`
2. **Service Role + tenant_id no body** (modo trigger) — quando chamado pelo banco, o body deve incluir `tenant_id` junto com `cpf`, e a função reconhece o service_role key sem tentar `getUser()`

O trigger SQL também precisa ser atualizado para incluir `tenant_id` no body da requisição.

---

## 🟡 MENOR: Imports Não Utilizados no AppLayout

Após a remoção dos links de Relatórios, Analytics e Auditoria, 3 ícones ficaram órfãos no import:
- `BarChart3` (era Analytics)
- `FileBarChart` (era Relatórios)
- `ShieldCheck` (era Auditoria)

Não causa erro, mas é código morto que deve ser limpo.

---

## Plano de Correção

### Arquivo 1: `supabase/functions/calculate-propensity/index.ts`
- Após verificar o `authHeader`, checar se o token é o `SUPABASE_SERVICE_ROLE_KEY`
- Se for service_role: extrair `tenant_id` diretamente do body (sem chamar `getUser`)
- Se for user JWT: manter fluxo atual (resolve tenant via `tenant_users`)
- Isso permite que tanto o frontend quanto o trigger SQL funcionem

### Arquivo 2: Migration SQL — Atualizar trigger
- Alterar a função `trigger_score_recalc()` para incluir `tenant_id` no JSON body:
  ```sql
  body := jsonb_build_object('cpf', _clean_cpf, 'tenant_id', NEW.tenant_id)
  ```

### Arquivo 3: `src/components/AppLayout.tsx`
- Remover imports de `BarChart3`, `FileBarChart`, `ShieldCheck`

### Resultado
- Score operacional será recalculado automaticamente via trigger (a cada evento)
- Frontend continua funcionando normalmente
- Código limpo sem imports órfãos

