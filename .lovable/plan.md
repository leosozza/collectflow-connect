## Resposta rápida
Sim — o item de menu, o banner no dashboard e a página `/setup` só aparecem para usuários com papel **admin do tenant** (`isTenantAdmin`). Operadores não enxergam.

## Alteração solicitada
Renomear o rótulo do menu de **"Setup do tenant"** para apenas **"Setup"**.

### Arquivo afetado
- `src/components/AppLayout.tsx`
  - Linha 146: `title={collapsed ? "Setup do tenant" : undefined}` → `"Setup"`
  - Linha 155: `<span className="truncate">Setup do tenant</span>` → `Setup`

Nenhuma outra mudança (rota, permissões, banner, documentação) — apenas o texto visível do item de navegação.