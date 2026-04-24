## Refinamento — TotalRecebidoCard: linha pontilhada não cai a zero

Pequeno ajuste para evitar que a linha tracejada do mês anterior caia bruscamente para zero nos dias inexistentes (ex: dia 29-31 quando o mês anterior é Fevereiro).

### Alteração

Arquivo: `src/components/dashboard/TotalRecebidoCard.tsx`

1. **`ChartPoint.prevValue`**: tipo `number` → `number | null`.
2. **Loop de montagem da série**: usar `null` para dias além do tamanho do mês anterior.

```typescript
const prevDays = getDaysInMonth(subMonths(today, 1));
const totalDays = Math.max(getDaysInMonth(today), prevDays);

for (let d = 1; d <= totalDays; d++) {
  points.push({
    day: d,
    label: String(d).padStart(2, "0"),
    value: d <= todayDay ? Number(currentMap[d] || 0) : null,
    prevValue: d <= prevDays ? Number(prevMap[d] || 0) : null,
  });
}
```

3. **`hasData`**: ajustar para tratar `prevValue` possivelmente nulo: `(p.prevValue ?? 0) > 0`.
4. **`<Line dataKey="prevValue">`**: já usa `connectNulls` por padrão como `false` em recharts (quando `null`, não desenha) — confirmar mantendo `connectNulls={false}` explícito para a linha parar no último dia válido.

### Resultado
A linha pontilhada cinza (mês anterior) termina exatamente no último dia real daquele mês (ex: dia 28 em Fev), sem queda artificial para zero.

### Fora do escopo
Nenhuma outra alteração de lógica, layout, ou cores.
