

## Plano: Padronizar identidade visual do Super Admin

### Problema
O `SuperAdminLayout` usa cores e estilo próprios (amber, Shield icon, `bg-[hsl(222,47%,11%)]`), divergindo do padrão do sistema usado no `AppLayout` (gradient-dark, cores primary/orange, logo Rivo Connect).

### Alterações em `src/components/SuperAdminLayout.tsx`

1. **Sidebar**: trocar `bg-[hsl(222,47%,11%)]` por `gradient-dark` (mesma classe do AppLayout)
2. **Logo**: trocar ícone Shield pelo logo `rivo_connect.png` (mesmo do AppLayout), mantendo subtítulo "Super Admin"
3. **Bordas do sidebar**: trocar `border-white/10` por `border-sidebar-border`
4. **Nav ativo**: trocar `bg-amber-500/20 text-amber-400 border border-amber-500/30` por `bg-primary text-primary-foreground` (sem border extra)
5. **Nav inativo**: trocar `text-white/70 hover:bg-white/10 hover:text-white` por `text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`
6. **Footer texto**: trocar `text-amber-400/80` por `text-primary/80`
7. **Avatar fallback**: trocar `bg-amber-500/10 text-amber-600` por `bg-primary/10 text-primary`
8. **Role label no header**: trocar `text-amber-600` por `text-primary`

### Arquivo alterado
- `src/components/SuperAdminLayout.tsx`

