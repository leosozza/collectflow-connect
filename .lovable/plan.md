

# Plano: Separação Clara Super Admin (RIVO) vs Tenant Admin

## Situação atual

Existem dois contextos de criação de usuários:

1. **`UsersPage.tsx`** (tenant admin) — cria usuários herdando o `tenant_id` do caller automaticamente via Edge Function. **Funciona corretamente.**

2. **`AdminUsuariosPage.tsx`** (super admin) — permite criar usuários com seletor de tenant. **Problema**: quando `selectedTenantId = "none"`, a Edge Function (linha 78-81) faz fallback para o tenant do próprio super admin. Ou seja, **não existe conceito de criar usuário SEM tenant** para gestão do RIVO.

3. **Edge Function `create-user`** (linha 78-81): `effectiveTenantId = callerRole === "super_admin" && body.tenant_id ? body.tenant_id : callerTenantUser.tenant_id`. Sempre vincula a algum tenant.

## Problemas identificados

| # | Problema |
|---|---|
| 1 | Super admin criando com "Nenhuma" empresa vincula ao tenant do próprio super admin |
| 2 | `AdminUsuariosPage` não diferencia claramente entre "criar para gestão RIVO" vs "criar para tenant cliente" |
| 3 | Falta validação: ao criar para um tenant, `tenant_id` deve ser obrigatório |

## Correções

### 1. `AdminUsuariosPage.tsx` — Separar os dois fluxos

Redesenhar o formulário com duas opções claras:

- **"Equipe RIVO"** — cria usuário vinculado ao tenant do super admin (gestão interna)
- **"Usuário de Tenant"** — exige seleção de um tenant cliente (obrigatório)

Quando "Equipe RIVO" for selecionado:
- Não mostrar seletor de tenant
- Não enviar `body.tenant_id` (Edge Function usa o tenant do super admin — correto)
- Roles disponíveis: `admin`, `super_admin`

Quando "Usuário de Tenant" for selecionado:
- Seletor de tenant obrigatório (sem opção "Nenhuma")
- Enviar `body.tenant_id` explícito
- Roles disponíveis: `operador`, `supervisor`, `gerente`, `admin`

### 2. `UsersPage.tsx` — Sem alteração

O fluxo do tenant admin já está correto: herda o `tenant_id` do caller, cria dentro do tenant, gera convite com `tenant.id`. Nenhuma alteração necessária.

### 3. Edge Function `create-user` — Sem alteração

A lógica atual (linha 78-81) já funciona corretamente para ambos os cenários quando o frontend envia os dados corretos. O problema é exclusivamente de UX no `AdminUsuariosPage`.

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/pages/admin/AdminUsuariosPage.tsx` | Separar "Equipe RIVO" vs "Usuário de Tenant", tornar tenant obrigatório no segundo caso |

## Sem alteração de banco

Não há migration.

