## Problema

A Bárbara (admin) não consegue ver as baixas realizadas porque o perfil de permissão **"Admin Padrão"** do tenant dela tem apenas `["view", "manage"]` no módulo `financeiro` — **falta a ação `view_all`**.

A página `BaixasRealizadasPage` aplica esta regra:
- Sem `financeiro.view_all` → filtra server-side por `operator_id = user.id` (mostra só as baixas em que ela mesma operou).
- Como ela nunca foi operadora direta de acordos, a tabela vem vazia.

Importante: o perfil de permissão **sobrescreve** os defaults do role `admin` (em `usePermissions.ts`, `permProfile.permissions` tem prioridade sobre `ROLE_DEFAULTS["admin"]`). Por isso "ser admin" sozinho não basta — o perfil atribuído precisa ter `view_all`.

Isso afeta TODOS os perfis "Admin Padrão" criados via seed antigo (a constante `ROLE_DEFAULTS.admin` no código tem `view_all`, mas perfis já persistidos no banco não foram atualizados).

## Plano de correção

### 1. Corrigir os perfis "Admin Padrão" existentes no banco
Migration que atualiza todos os `permission_profiles` com `base_role = 'admin'` e `is_default = true`, garantindo que `permissions->'financeiro'` contenha `view`, `view_all` e `manage`.

Fazer o mesmo para `gerente` (defaults também incluem `financeiro: [view, view_all, manage]`).

```sql
UPDATE permission_profiles
SET permissions = jsonb_set(
  permissions,
  '{financeiro}',
  '["view","view_all","manage"]'::jsonb
)
WHERE base_role IN ('admin','gerente')
  AND is_default = true
  AND NOT (permissions->'financeiro' ? 'view_all');
```

### 2. Validar que a Bárbara passa a ver tudo
Após a migration, a Bárbara (que está nesse perfil) automaticamente terá `financeiro.view_all = true`, a query usará `lockedOperatorId = null` e ela verá todas as baixas do tenant.

### 3. (Opcional, futuro) Sincronização de perfis default
Considerar uma rotina/edge function que reaplica `ROLE_DEFAULTS` aos perfis com `is_default = true` quando há divergência — evita esse tipo de drift quando novos módulos/ações são adicionados ao código sem atualizar perfis já criados. Não vou incluir agora para manter o escopo focado.

## Resumo

Uma migration única corrige o perfil "Admin Padrão" do tenant da Bárbara (e qualquer outro tenant na mesma situação), adicionando `view_all` em `financeiro`. Sem mexer no código frontend.