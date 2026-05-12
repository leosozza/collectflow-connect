# Plano — Fechar a lacuna que faz a Barbara ver "Nenhuma instância" / spinner infinito

## Diagnóstico (resumo)

- `useTenant` só resolve `tenant.id` via RPC `get_my_tenant_id()` (que depende de `auth.uid()` no JWT atual).
- Se a RPC retornar `null` em alguma janela de carga (ex.: JWT expirado em refresh, race no `onAuthStateChange`), `tenant` fica `null`.
- Todas as queries da página `/configuracoes/integracao` usam `enabled: !!tenant?.id`. Sem `tenant.id`:
  - `BaylersInstancesList` (Evolution) e `GupshupInstancesList` ficam **eternamente em "Carregando..."** (react-query em pending com `enabled:false`).
  - `IntegracaoPage` mostra `hasEvolution=false` / `hasGupshup=false`.
- Raul (super_admin) **não sente** o problema porque a RLS de `whatsapp_instances` tem o ramo `is_super_admin(auth.uid())` que mascara qualquer instabilidade — mas mesmo o super_admin só veria os cards via `tenant?.id` na UI; a diferença real é que ele cai em `/admin` antes (não passa pela tela tenant).
- A Barbara não tem nenhum caminho de fuga.

## Mudanças

### 1) `src/hooks/useTenant.tsx` — fallback + logs

Em `fetchTenantData`, depois de chamar `supabase.rpc("get_my_tenant_id")`:

- Se `tenantId` vier `null/undefined` **e** `user?.id` existir, fazer um SELECT direto:
  ```ts
  const { data: tu } = await supabase
    .from("tenant_users")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  ```
  Se vier `tu?.tenant_id`, usar esse valor como `tenantId` e seguir o fluxo normal (`is_super_admin` / `is_tenant_admin` / fetch tenant + plan).
- Se ainda assim ficar sem tenant, logar `console.warn("[useTenant] Sem tenant após fallback", { userId: user.id, rpcError })` e seguir para o `setLoading(false)` atual.
- Adicionar `console.warn` quando o fallback **for** acionado (`"[useTenant] RPC retornou null, usando fallback direto em tenant_users"`) para deixar o sintoma rastreável em produção.
- Manter os `setX(prev => ...)` estáveis que já existem.

Por que isso é seguro: a tabela `tenant_users` tem RLS que permite o próprio usuário ler sua linha (políticas existentes referenciam `user_id = auth.uid()`). O fallback não bypassa nada — apenas evita o caminho da RPC em caso de instabilidade.

### 2) (opcional, mesma alteração) Forçar refresh de sessão antes de desistir

Antes do fallback, se a primeira RPC vier `null`, executar `await supabase.auth.refreshSession()` uma única vez e refazer a RPC. Se ainda vier `null`, cair no fallback acima. Custo: ~1 round-trip extra **só** no cenário de falha — em condições normais a primeira RPC já resolve e nada muda.

### 3) Sem mudanças de banco / RLS / edge functions

Nenhuma migração. Nenhuma policy. Nada de roles. As policies atuais (`tenant_id = get_my_tenant_id()`) continuam corretas — o fallback alimenta o mesmo `tenant.id` que a UI já usa para filtrar.

## O que NÃO muda

- Nada nos componentes `IntegracaoPage`, `EvolutionTab`, `GupshupTab`, `BaylersInstancesList`, `GupshupInstancesList`, `whatsappInstanceService`.
- Nada nas roles do Raul / Barbara (já estão corretas).
- Nada nos fluxos de super_admin / `support_tenant_id` / `ProtectedRoute`.

## Validação

1. Logar com a Barbara em produção, abrir `/configuracoes/integracao`.
2. Esperado: cards "WhatsApp Não Oficial" e "WhatsApp Oficial" mostram a contagem real de instâncias do Y.BRASIL (em vez de "Carregando..." ou "Nenhuma instância").
3. Em DevTools → Console, se aparecer o warn `"[useTenant] RPC retornou null, usando fallback…"`, confirma que a hipótese era correta e o fallback consertou. Se não aparecer, o fallback ficou de prevenção mas o caminho normal continua funcionando.
4. Logar com Raul (`raul@temisconsultoria.com.br`) → deve continuar caindo em `/admin` direto (comportamento inalterado).
5. Logar com `raulsjunior579@gmail.com` (admin do Y.BRASIL) → deve ver as mesmas instâncias da Barbara, sem bypass de RLS (mesmo caminho).

## Detalhes técnicos (resumo)

- Arquivo único alterado: `src/hooks/useTenant.tsx`.
- Sem novas dependências.
- Sem mudança de tipo público do hook (`tenant`, `tenantUser`, `plan`, `isSuperAdmin`, etc. permanecem).
- Logs apenas com `console.warn` (sem PII além de `user.id`).
