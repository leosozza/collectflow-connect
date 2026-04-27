## Problema

No card "Total Recebido" aparece `+744911,83%` vs mês anterior. Isso **não é** problema de casas decimais (já está em 2 casas). É uma variação percentual real e gigantesca, causada porque o mês anterior teve um valor recebido muito baixo (próximo de zero), tornando o cálculo `(atual - anterior) / anterior * 100` um número absurdo.

Quando a base de comparação é minúscula, qualquer crescimento vira milhares de %.

## Solução proposta

Aplicar formatação inteligente no badge de variação percentual em `src/components/dashboard/TotalRecebidoCard.tsx`:

1. **Limite de exibição**: quando `|diffPct| >= 999`, exibir `+999%+` (ou `-999%+`) em vez do número absurdo, evitando poluir o card.
2. **Compactar números grandes**: entre 100% e 999%, exibir sem casas decimais (ex.: `+450%`).
3. **Manter 2 casas decimais** apenas para variações abaixo de 100% (ex.: `+12,34%`), que é o caso útil de comparação.
4. **Tooltip opcional**: ao passar o mouse no badge, mostrar o valor real completo + o total do mês anterior, para o usuário entender a base de comparação.

### Regra de formatação

```text
|pct| < 100   → "+12,34%"
100 ≤ |pct| < 1000 → "+450%"
|pct| ≥ 1000  → "+999%+"  (com tooltip mostrando real)
```

## Arquivo afetado

- `src/components/dashboard/TotalRecebidoCard.tsx` — apenas o trecho de renderização do `diffPct`.

Nenhuma mudança em queries, RPCs ou banco.
