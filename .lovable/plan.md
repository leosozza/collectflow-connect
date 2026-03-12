

# Plano: Corrigir Gamificação + Analytics (Total Pendente e Distribuição de Status)

## Problemas Identificados

### 1. Gamificação não atualiza quando acordos são feitos
O hook `useGamification` define `checkAndGrantAchievements`, mas **nenhum código no sistema o invoca**. Quando um acordo é criado (`createAgreement`), nada dispara a atualização de pontos, conquistas ou ranking.

### 2. Analytics — "Total Pendente" mostra apenas acordos, não a carteira toda
O card "Total Pendente" soma `proposed_total` apenas de **acordos** com status pendente/vigente/vencido. O usuário espera ver o **saldo devedor total da empresa** (tabela `clients`), não apenas o que foi negociado.

### 3. Analytics — "Distribuição de Status" busca dados de onde?
O gráfico de pizza "Distribuição de Status" usa **apenas os status dos acordos** (`agreements.status`): Pagos, Vigentes, Pendentes, Vencidos, Cancelados. Não reflete a distribuição da carteira de clientes.

---

## Solução

### 1. Gamificação — Disparar atualização ao criar acordo

**Arquivo:** `src/services/agreementService.ts`

Após criar o acordo com sucesso, calcular e atualizar `operator_points` diretamente no service (sem depender do hook React que precisa de contexto de componente):

```typescript
// Ao final de createAgreement, após marcar títulos:
// Contar acordos e valores do operador no mês e fazer upsert em operator_points
const now = new Date();
const year = now.getFullYear();
const month = now.getMonth() + 1;
const monthStart = `${year}-${String(month).padStart(2,'0')}-01`;
const monthEnd = // último dia do mês

// Buscar contadores reais do operador no mês
const { count: agreementsCount } = await supabase
  .from("agreements")
  .select("*", { count: "exact", head: true })
  .eq("created_by", userId)
  .eq("tenant_id", tenantId)
  .gte("created_at", monthStart)
  .lte("created_at", monthEnd)
  .not("status", "in", "(cancelled,rejected)");

const { data: cancelledData } = await supabase
  .from("agreements")
  .select("id")
  .eq("created_by", userId)
  .eq("tenant_id", tenantId)
  .eq("status", "cancelled")
  .gte("created_at", monthStart);

// Upsert operator_points com dados reais
await supabase.from("operator_points").upsert({
  tenant_id: tenantId,
  operator_id: userId, // profile.id do criador
  year, month,
  payments_count: agreementsCount,
  breaks_count: cancelledData.length,
  total_received: totalRecebidoNoMes,
  points: calculatedPoints,
  updated_at: new Date().toISOString()
}, { onConflict: "tenant_id,operator_id,year,month" });
```

### 2. Analytics — "Total Pendente" deve somar a carteira inteira

**Arquivo:** `src/pages/AnalyticsPage.tsx`

Adicionar uma query separada para buscar o saldo devedor total da tabela `clients` (registros com status pendente/vencido/em_acordo):

```typescript
const { data: totalCarteiraData } = useQuery({
  queryKey: ["analytics-carteira-pendente", tenant?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from("clients")
      .select("valor_atualizado, saldo_devedor")
      .eq("tenant_id", tenant!.id)
      .in("status", ["pendente", "vencido", "em_acordo"]);
    return (data || []).reduce((sum, c) => sum + Number(c.saldo_devedor || c.valor_atualizado || 0), 0);
  },
  enabled: !!tenant?.id,
});
// Usar este valor no card "Total Pendente" ao invés de somar acordos
```

O tooltip será atualizado: "Soma do saldo devedor de toda a carteira cadastrada."

### 3. Distribuição de Status — Esclarecer e manter

A "Distribuição de Status" continuará baseada nos **acordos** (pois a página é de Analytics de acordos), mas o tooltip será ajustado para deixar claro:
- "Distribuição dos status dos acordos formalizados no período selecionado."

---

## Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/services/agreementService.ts` | Adicionar lógica de upsert em `operator_points` ao criar acordo |
| `src/pages/AnalyticsPage.tsx` | Nova query para saldo devedor da carteira; usar no card "Total Pendente"; ajustar tooltip da Distribuição |

