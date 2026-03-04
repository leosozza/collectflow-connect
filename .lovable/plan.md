

## Plano: Dividir banner principal e adicionar "Total Negociado no Mês"

### O que muda

No `DashboardPage.tsx`, o banner laranja "Total Projetado no Mês" (que ocupa 100% da largura) será dividido em dois cards lado a lado (grid 2 colunas):

1. **Total Projetado no Mês** — mantém o cálculo atual (`totalProjetado`)
2. **Total Negociado no Mês** — novo card que soma `proposed_total` de todos os acordos criados no mês corrente (usando `filteredAgreements` filtrado pelo mês atual)

### Cálculo do novo valor

```typescript
const totalNegociado = useMemo(() => {
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  return filteredAgreements
    .filter(a => { const d = new Date(a.created_at); return d >= monthStart && d <= monthEnd; })
    .reduce((sum, a) => sum + Number(a.proposed_total || 0), 0);
}, [filteredAgreements]);
```

Obs: `proposed_total` já é retornado na query de `agreements` existente — basta adicioná-lo ao `select`.

### Layout

Trocar o div único por um grid de 2 colunas:
```
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div className="rounded-2xl gradient-orange p-6 text-center shadow-lg">
    Total Projetado no Mês: {totalProjetado}
  </div>
  <div className="rounded-2xl gradient-orange p-6 text-center shadow-lg">
    Total Negociado no Mês: {totalNegociado}
  </div>
</div>
```

### Arquivos

| Arquivo | Alteração |
|---|---|
| `src/pages/DashboardPage.tsx` | Adicionar `proposed_total` ao select de agreements, calcular `totalNegociado`, dividir banner em grid 2 colunas |

