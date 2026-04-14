

# Correção: Valores do DebtorProfileBadge incompatíveis com o enum do banco

## Problema
O `DebtorProfileBadge` usa valores em inglês (`occasional`, `recurrent`, `unsatisfied`, `resistant`), mas o enum `debtor_profile_type` no banco e os filtros da Carteira usam valores em português (`ocasional`, `recorrente`, `insatisfeito`, `resistente`). Isso impede que perfis definidos pelo operador apareçam corretamente nos filtros.

## Correção

### Arquivo: `src/components/shared/DebtorProfileBadge.tsx`
Alterar os valores do array `PROFILES` para usar os valores em português que correspondem ao enum do banco:

```typescript
const PROFILES = [
  { value: "ocasional", label: "Ocasional", color: "hsl(142, 71%, 45%)", desc: "Atrasou, mas paga" },
  { value: "recorrente", label: "Recorrente", color: "hsl(45, 93%, 47%)", desc: "Sempre atrasa" },
  { value: "insatisfeito", label: "Insatisfeito", color: "hsl(25, 95%, 53%)", desc: "Reclamações/contestação" },
  { value: "resistente", label: "Resistente", color: "hsl(0, 84%, 60%)", desc: "Não quer pagar" },
];
```

Também remover o `as any` cast na chamada de update para que o TypeScript valide os valores contra o enum.

### Resultado
- Perfis definidos via WhatsApp serão filtráveis na Carteira
- Valores compatíveis com o enum do banco (sem erros de constraint)
- Filtros `ClientFilters` e `ReportFilters` funcionarão corretamente

