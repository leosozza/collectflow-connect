

## Adicionar cards de Acordos no Dashboard

### Objetivo
Adicionar dois novos StatCards ao Dashboard: **Acordos do Dia** (quantidade) e **Acordos do Mes** (quantidade), com filtragem por perfil:
- **Admin/Gerente/Supervisor** (view_all): mostra total de todos os operadores
- **Operador** (view_own): mostra apenas os acordos criados por ele

### Layout final dos cards
```text
Total Recebido | Total de Quebra | Pendentes | Acordos do Dia | Acordos do Mes
```

### Alteracoes tecnicas

**1. `src/pages/DashboardPage.tsx`**

- Importar `fetchAgreements` do `agreementService` (ou fazer query direta ao Supabase na tabela `agreements`)
- Adicionar um `useQuery` para buscar acordos da tabela `agreements`
- Calcular:
  - **Acordos do Dia**: filtrar por `created_at` = hoje. Se `canViewAllDashboard`, contar todos; senao, filtrar por `created_by === profile?.user_id`
  - **Acordos do Mes**: filtrar por `created_at` no mes/ano atual (ou respeitando filtros de ano/mes selecionados). Mesma logica de perfil
- Atualizar o grid de StatCards de 3 para 5 colunas (`sm:grid-cols-5`)
- Adicionar dois novos `StatCard` com `icon` adequado

**2. `src/components/StatCard.tsx`**

- Adicionar novo tipo de icone `"agreement"` nos mapas `iconMap`, `colorMap` e `bgMap`
- Usar o icone `FileText` (ja importado no DashboardPage) ou `Handshake` do lucide-react

### Detalhes da query de acordos

A tabela `agreements` ja possui RLS por tenant. A query sera:
```typescript
const { data: agreements = [] } = useQuery({
  queryKey: ["dashboard-agreements"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("agreements")
      .select("id, created_at, created_by, status");
    if (error) throw error;
    return data || [];
  },
});
```

Filtragem no frontend:
- **Dia**: `agreements.filter(a => a.created_at comeca com hoje)`
- **Mes**: `agreements.filter(a => created_at no mes atual)`
- **Perfil**: se `!canViewAllDashboard`, filtrar por `created_by === user.id`

### Resumo dos arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/pages/DashboardPage.tsx` | Query de agreements, calculo dos contadores, dois novos StatCards |
| `src/components/StatCard.tsx` | Novo tipo de icone "agreement" |

