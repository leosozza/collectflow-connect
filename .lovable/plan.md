

# Remover Relatórios, Analytics e Auditoria da Sidebar

## Contexto
Esses 3 itens foram adicionados recentemente à sidebar (`preContactItems`), mas o usuário prefere acessá-los de onde já estavam antes (provavelmente dentro de outras seções/páginas). As permissões continuam ativas — apenas os links na sidebar serão removidos.

## Alteração

### Arquivo: `src/components/AppLayout.tsx`

Remover as 3 linhas condicionais do array `preContactItems`:
- `...(permissions.canViewRelatorios ? [{ label: "Relatórios", ... }] : [])`
- `...(permissions.canViewOwnAnalytics ? [{ label: "Analytics", ... }] : [])`
- `...(permissions.canViewAuditoria ? [{ label: "Auditoria", ... }] : [])`

As rotas em `App.tsx` e as permissões em `usePermissions.ts` permanecem intactas — os usuários continuam podendo acessar `/relatorios`, `/analytics` e `/auditoria` diretamente ou pelos links internos existentes.

