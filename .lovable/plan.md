

# Plano: Corrigir RLS de `whatsapp_templates`

## Causa Raiz

A policy `tenant_isolation` usa `profiles.id = auth.uid()`, mas `profiles.id` é o UUID auto-gerado do perfil, **não** o `user_id`. O correto é `profiles.user_id = auth.uid()`. Como nenhum registro de `profiles` tem `id` igual ao `auth.uid()`, o subselect nunca retorna resultados e **todo INSERT/SELECT/UPDATE/DELETE é bloqueado**.

## Policy Atual vs Corrigida

```text
ANTES (incorreta):
  tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
                                                  ^^^ ERRADO

DEPOIS (correta):
  tenant_id = get_my_tenant_id()
```

Usar a RPC `get_my_tenant_id()` (SECURITY DEFINER) é mais seguro, performático e alinhado com o padrão do projeto (ex: `quick_replies` já usa esse padrão).

## Correção

**Migration SQL** — uma única migração:

1. DROP a policy antiga `tenant_isolation`
2. Criar 4 policies separadas por operação, usando `get_my_tenant_id()`:
   - **SELECT**: `tenant_id = get_my_tenant_id()` para `authenticated`
   - **INSERT**: `WITH CHECK (tenant_id = get_my_tenant_id())` para `authenticated`
   - **UPDATE**: `USING + WITH CHECK (tenant_id = get_my_tenant_id())` para `authenticated`
   - **DELETE**: `USING (tenant_id = get_my_tenant_id())` para `authenticated`

**Frontend** — nenhuma alteração necessária. O `WhatsAppTemplatesTab.tsx` já envia `tenant_id: tenant.id` corretamente no payload de criação.

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| Nova migration SQL | Drop policy antiga + criar 4 policies corretas |

Nenhum arquivo de código frontend/backend precisa ser alterado.

