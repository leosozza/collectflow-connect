

## Plano: Fixar card "Total de Acordos" independente do filtro

### Problema
O card "Total de Acordos" (linha 220) usa `activeAgreements`, que é derivado de `filteredAgreements` — ou seja, muda conforme o filtro de status selecionado. O correto é mostrar sempre o total real de acordos ativos, independente do filtro.

### Correção

**`src/pages/AcordosPage.tsx`**:
- Criar uma variável `totalActiveAgreements` baseada em `agreements` (sem filtro de status), excluindo apenas `cancelled` e `rejected`
- Usar essa variável no card "Total de Acordos"
- Manter `activeAgreements` (filtrado) para os cards "Pendentes" e "Pagos"

```typescript
// Novo: total real independente do filtro
const totalActiveCount = useMemo(() => 
  agreements.filter(a => a.status !== "cancelled" && a.status !== "rejected").length,
  [agreements]
);

// Card usa totalActiveCount em vez de activeAgreements.length
<StatCard title="Total de Acordos" value={String(totalActiveCount)} icon="agreement" />
```

| Arquivo | Alteração |
|---|---|
| `src/pages/AcordosPage.tsx` | Separar contagem total dos acordos do filtro ativo |

