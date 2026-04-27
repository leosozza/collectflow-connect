## Objetivo

Garantir que, em `/financeiro` (Acordos / Baixas Realizadas), o operador só veja os registros que ele mesmo originou. Admins (e usuários a quem o admin conceder permissão explícita) continuam vendo tudo.

## Situação atual

- **`/acordos`**: já aplica o filtro corretamente. Quando o usuário não tem a permissão de aprovar acordos, a query força `created_by = user.id` (linha 69 de `AcordosPage.tsx`). Nada a fazer aqui.
- **`/financeiro/aguardando-liberacao`**: já restrito a quem tem `canApproveAcordos`. Nada a fazer.
- **`/financeiro/baixas` (Baixas Realizadas)**: hoje qualquer usuário com permissão `financeiro.view` enxerga **todas** as baixas do tenant. Este é o ponto que precisa de correção.

## O que vamos mudar

### 1. Nova permissão granular no módulo `financeiro`

Em `usePermissions.ts`:

- Adicionar a ação `view_all` ao catálogo do módulo `financeiro` (junto às já existentes `view` e `manage`).
- Defaults por papel:
  - `super_admin`, `admin`, `gerente` → `["view", "manage", "view_all"]`
  - `supervisor`, `operador` → mantém como está (sem `view_all`; só veem as próprias baixas se o admin liberar `financeiro.view`).
- Expor `canViewAllFinanceiro = has("financeiro", "view_all")`.

Isso permite que o admin, na tela de Permissões existente, marque/desmarque "Visualizar (Todos)" no módulo Financeiro para qualquer usuário, exatamente como já faz em Dashboard, Analytics, Agendados, etc.

### 2. RPC `get_baixas_realizadas` — filtro por operador

Atualizar a função (migration nova) para receber o filtro `_operator_id uuid` e aplicar no `WHERE` final:

```sql
AND (_operator_id IS NULL OR operator_id = _operator_id)
```

A função continua retornando o mesmo shape; apenas ganha um parâmetro opcional.

### 3. Frontend — `BaixasRealizadasPage.tsx`

- Resolver o filtro efetivo no carregamento:
  - Se `canViewAllFinanceiro` → não envia `_operator_id` (vê tudo, e o seletor "Operador" continua disponível para filtrar manualmente).
  - Caso contrário → envia `_operator_id = user.id` (server-side lock) e **esconde** o seletor de operador, evitando confusão.
- Incluir `user.id` e a flag na `queryKey` para invalidar corretamente.

## Resumo do comportamento final

| Papel / permissão                              | /acordos        | /financeiro/baixas |
|------------------------------------------------|-----------------|--------------------|
| Admin / super_admin                            | Vê tudo         | Vê tudo            |
| Gerente (default com `view_all` no financeiro) | Vê tudo         | Vê tudo            |
| Operador / supervisor com `financeiro.view`    | Só os próprios  | Só os próprios     |
| Usuário a quem admin marcar `view_all`         | (acordos.approve controla) | Vê tudo  |

## Detalhes técnicos

- Arquivo: `src/hooks/usePermissions.ts` — adicionar `view_all` em `MODULE_ACTIONS.financeiro`, atualizar `ROLE_DEFAULTS` e expor `canViewAllFinanceiro`.
- Arquivo: `src/pages/financeiro/BaixasRealizadasPage.tsx` — passar `_operator_id` na chamada da RPC e ocultar o `Select` de operador quando o usuário não tem `view_all`.
- Migration nova: `CREATE OR REPLACE FUNCTION public.get_baixas_realizadas(...)` adicionando `_operator_id uuid DEFAULT NULL` como último parâmetro e aplicando o filtro na query final. Mantém a resolução de `operator_id` já implementada (profile.id → auth user_id para baixas manuais; `a.created_by` para portal/negociarie).
- Não há alteração no schema de tabelas, nem em RLS — apenas na RPC e no frontend.
- Nenhum impacto em `/acordos`, `/financeiro/aguardando-liberacao` ou no `AgreementsList`.