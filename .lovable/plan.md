

# Melhoria de UX nos inputs numéricos do AgreementCalculator

## Problema
Na tela de Formalizar Acordo (`AgreementCalculator.tsx`), os campos numéricos usam `type="number"` com `step={0.01}`, causando:
1. **% Honorários / Juros / Multa / Desconto**: não permite apagar o zero para digitar novo valor; setas incrementam 0.01 em vez de 1.0
2. **Parcelas**: não permite apagar o "1" para digitar quantidade diretamente
3. **Valor Entrada**: mesmo problema de não poder limpar e redigitar

## Solução

Converter todos os inputs percentuais e de quantidade para `type="text"` com `inputMode="decimal"` (ou `numeric` para inteiros), permitindo campo vazio durante edição e restaurando valor padrão no `onBlur`.

### Arquivo: `src/components/client-detail/AgreementCalculator.tsx`

**Campos a alterar (linhas 504-539, 653, 691):**

| Campo | De | Para |
|-------|-----|------|
| % Juros (L506) | `type="number" step={0.01}` | `type="text" inputMode="decimal"`, state aceita `""`, onBlur → 0 |
| % Multa (L510) | idem | idem |
| % Honor. (L514) | idem | idem |
| % Desc. (L518) | idem | idem (já aceita `""` no state) |
| R$ Desc. (L530) | idem | idem (já aceita `""` no state) |
| Parcelas (L691) | `type="number" min={1}` | `type="text" inputMode="numeric"`, onBlur → 1 |
| Valor Entrada (L653) | `type="number"` | `type="text" inputMode="decimal"`, onBlur → 0 |

**Mudança nos states (linhas 61-63):**
```typescript
// De:
const [jurosPercent, setJurosPercent] = useState<number>(0);
const [multaPercent, setMultaPercent] = useState<number>(0);
const [honorariosPercent, setHonorariosPercent] = useState<number>(0);

// Para:
const [jurosPercent, setJurosPercent] = useState<number | "">(0);
const [multaPercent, setMultaPercent] = useState<number | "">(0);
const [honorariosPercent, setHonorariosPercent] = useState<number | "">(0);
const [numParcelas, setNumParcelas] = useState<number | "">(1);
```

**Padrão de cada input:**
```tsx
<Input
  type="text"
  inputMode="decimal"
  value={honorariosPercent}
  onChange={(e) => {
    const v = e.target.value.replace(/[^0-9.]/g, "");
    setHonorariosPercent(v === "" ? "" : Number(v));
  }}
  onBlur={() => setHonorariosPercent(prev => prev === "" ? 0 : prev)}
  className="h-7 text-xs px-2"
/>
```

**Ajustes derivados**: onde o código faz cálculos com esses valores, usar fallback `typeof x === "number" ? x : 0` (padrão já usado para `descontoPercent`).

### Resultado
- Usuário pode clicar, apagar tudo e digitar o valor desejado
- Sem setas que incrementam 0.01 — campo livre para digitação
- Ao sair do campo vazio, valor volta ao padrão (0 ou 1 para parcelas)

