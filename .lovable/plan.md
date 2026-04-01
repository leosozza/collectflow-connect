

# Plano: Corrigir upsert de tenant_users (onConflict errado)

## Erro exato anterior

```
"there is no unique or exclusion constraint matching the ON CONFLICT specification"
```

A linha 263 usa `onConflict: "user_id"`, mas a tabela `tenant_users` **não tem** constraint UNIQUE em `user_id` sozinho. A constraint real é `UNIQUE (tenant_id, user_id)`.

## Validações realizadas

| Tabela | Constraint real | onConflict atual | Status |
|---|---|---|---|
| `tenant_users` | `UNIQUE (tenant_id, user_id)` | `"user_id"` | **ERRADO** → corrigir para `"tenant_id,user_id"` |
| `profiles` | `UNIQUE (user_id)` | `"user_id"` | ✅ Correto |

- **Tenant ID:** A lógica já resolve corretamente — admin usa seu próprio tenant, super_admin pode usar `body.tenant_id`.
- **Vitor no auth:** Nenhum registro encontrado. Criação será do zero, sem conflito.

## Correção

**Arquivo:** `supabase/functions/create-user/index.ts`

**Única mudança:** Linhas 258-271 — trocar `onConflict: "user_id"` por `onConflict: "tenant_id,user_id"` e adicionar logs detalhados antes/depois do upsert.

```typescript
// ANTES (linha 263):
{ onConflict: "user_id" }

// DEPOIS:
{ onConflict: "tenant_id,user_id" }
```

Adicionar logs:
```typescript
log("tenant_users_upsert_start", { tenant_id, user_id, role });
// ... upsert ...
log("tenant_users_upsert_ok", { tenant_id, user_id, role });
// ou em caso de erro:
log("tenant_users_failed", { error, hint, code });
```

## Após a correção

Testar via `curl_edge_functions` a criação do Vitor para confirmar sucesso.

