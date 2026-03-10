

# Fix: Bugs Críticos no Fluxo de Criação de Tenant

## Bugs Encontrados

### 1. Bug Crítico — `onboard_tenant` RPC (WHERE errado)
A linha `UPDATE public.profiles SET tenant_id = ... WHERE id = _user_id` está errada. A coluna `id` na tabela `profiles` é um UUID auto-gerado, diferente de `user_id`. O UPDATE nunca atualiza nenhuma linha, fazendo com que o perfil do novo admin fique sem `tenant_id`.

**Fix**: Trocar `WHERE id = _user_id` por `WHERE user_id = _user_id`.

### 2. Função duplicada — Existem 2 versões de `onboard_tenant`
- Versão com 3 params (sem CNPJ, sem tokens) — obsoleta
- Versão com 4 params (com CNPJ e tokens) — atual

A versão antiga pode ser chamada acidentalmente. Deve ser removida.

### 3. Mensagem de boas-vindas incorreta
O toast pós-criação diz "Bem-vindo ao CollectFlow Connect" em vez de "Rivo Connect".

## Plano de Correção

### Migration SQL
```sql
-- Remover função antiga (3 params)
DROP FUNCTION IF EXISTS public.onboard_tenant(text, text, uuid);

-- Recriar função corrigida (4 params)
CREATE OR REPLACE FUNCTION public.onboard_tenant(...)
  -- Fix: WHERE user_id = _user_id (em vez de WHERE id = _user_id)
  -- Adicionar verificações de segurança (user já tem tenant, slug duplicado)
```

### Arquivo: `src/pages/OnboardingPage.tsx`
- Corrigir mensagem de "CollectFlow Connect" para "Rivo Connect"

| Arquivo | Ação |
|---|---|
| Migration SQL | DROP old 3-param function, fix WHERE clause |
| `src/pages/OnboardingPage.tsx` | Fix welcome message |

