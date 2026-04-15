

# Liberar casas decimais em % Desc e R$ Desconto

## Problema
Os campos `% Desc.` e `R$ Desc.` usam `replace(/[^0-9.]/g, "")` que remove vírgulas. No Brasil, o separador decimal é vírgula (`0,15`), então o usuário não consegue digitar valores como `0,15%` ou `R$ 0,50`. Além disso, `Number("0,15")` retorna `NaN`.

## Solução

### Arquivo: `src/components/client-detail/AgreementCalculator.tsx`

Nos dois campos (linhas ~524-544), alterar a lógica de sanitização para:

1. Aceitar vírgula como separador decimal: `replace(/[^0-9.,]/g, "")` no filtro visual
2. Converter vírgula para ponto antes de fazer `Number()`: `.replace(",", ".")`
3. Manter o valor bruto digitado (string com vírgula) no campo para exibição natural

Mesma correção nos campos `% Juros`, `% Multa` e `% Honorários` (linha ~520) para consistência.

**Lógica por campo:**
```tsx
// Antes:
const raw = e.target.value.replace(/[^0-9.]/g, "");
const pct = Number(raw);

// Depois:
const raw = e.target.value.replace(/[^0-9.,]/g, "");
const pct = Number(raw.replace(",", "."));
if (raw !== "" && isNaN(pct)) return;
```

Isso permite digitar `0,15` ou `0.15` e ambos convertem para `0.15` internamente.

### Resultado
- `0,15%` → aceito, calcula corretamente
- `R$ 0,50` → aceito, calcula corretamente
- Mantém compatibilidade com ponto como separador

