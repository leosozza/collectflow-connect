

# Plano: Múltiplas Correções e Melhorias

## 1. Dashboard — Filtro por Operador + Renomear labels

**Arquivo:** `src/pages/DashboardPage.tsx`

- Adicionar query para buscar lista de operadores (profiles do tenant)
- Adicionar `MultiSelect` de operadores ao lado dos filtros de ano/mês (visível apenas para admin com `canViewAll`)
- Passar o `selectedOperator` para as RPCs `get_dashboard_stats` e `get_dashboard_vencimentos` via `_user_id`
- Renomear `allLabel` de "Todos Anos" → "Ano" e "Todos Meses" → "Mês"

## 2. Atribuir cliente ao operador ao formalizar acordo

**Arquivo:** `src/services/agreementService.ts`

- Na função `createAgreement`, após marcar títulos como "em_acordo", atualizar `operator_id` dos registros do CPF/credor para o `userId` que criou o acordo
- Buscar o `profile.id` do criador (pois `operator_id` usa `profiles.id`, não `auth.uid`) e fazer update nos clients correspondentes

## 3. Histórico — Nome do responsável + origem da ocorrência

**Arquivo:** `src/components/client-detail/ClientUpdateHistory.tsx`

- Fazer JOIN com `profiles` via `updated_by` para exibir o nome do responsável
- Quando `updated_by` é null e `source` indica ação automática, exibir label como "Ação da Régua", "Sistema", etc.
- Adicionar mapeamento de sources automáticas: `regua` → "Ação da Régua", `whatsapp_auto` → "WhatsApp Automático", `email_auto` → "E-mail Automático"

## 4. Acordos com entrada — Contabilização correta

**Arquivo:** `src/pages/AcordosPage.tsx` e `src/components/acordos/AgreementsList.tsx`

- Verificar e corrigir a exibição de valores quando há entrada: o `proposed_total` deve incluir entrada + parcelas
- Garantir que os cards de totais (Total de Acordos, valor) considerem `entrada_value` corretamente
- Validar que a listagem mostra formato "Entrada R$ X + Nx R$ Y" para todos os perfis

## Detalhes técnicos

### Dashboard — Operador filter
```typescript
// Nova query para operadores
const { data: operators = [] } = useQuery({
  queryKey: ["dashboard-operators", profile?.tenant_id],
  queryFn: async () => {
    const { data } = await supabase.from("profiles")
      .select("user_id, full_name")
      .eq("tenant_id", profile!.tenant_id);
    return (data || []).map(p => ({ value: p.user_id, label: p.full_name || "Sem nome" }));
  },
  enabled: !!profile?.tenant_id && canViewAll,
});

// Alterar rpcUserId para considerar operador selecionado
const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
const rpcUserId = canViewAll
  ? (selectedOperators.length === 1 ? selectedOperators[0] : null)
  : (profile?.user_id ?? null);
```

### Atribuição automática
```typescript
// Em createAgreement, após marcar títulos como em_acordo:
const { data: creatorProfile } = await supabase
  .from("profiles").select("id").eq("user_id", userId).single();
if (creatorProfile) {
  await supabase.from("clients")
    .update({ operator_id: creatorProfile.id })
    .eq("cpf", data.client_cpf)
    .eq("credor", data.credor);
}
```

### Histórico com nome
```typescript
// Buscar profiles para mapear updated_by → nome
const userIds = [...new Set(logs.filter(l => l.updated_by).map(l => l.updated_by))];
const { data: profiles } = await supabase.from("profiles")
  .select("user_id, full_name").in("user_id", userIds);
// Exibir nome ou label de origem automática
```

