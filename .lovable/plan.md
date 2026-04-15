

# Fix: campos decimais não aceitam vírgula no frontend

## Problema raiz

Os estados (`jurosPercent`, `multaPercent`, etc.) são `number | ""`. Quando o usuário digita "0,":
1. `raw = "0,"` → `Number("0.") = 0` → estado vira `0`
2. O input mostra `0` — a vírgula desaparece
3. Impossível digitar valores decimais incrementalmente

## Solução

Mudar os estados de `number | ""` para `string` para manter o texto bruto digitado. Os cálculos usam uma função helper para parsear.

### Arquivo: `src/components/client-detail/AgreementCalculator.tsx`

**1. Alterar tipos dos estados:**
```tsx
// De:
const [jurosPercent, setJurosPercent] = useState<number | "">(0);
const [multaPercent, setMultaPercent] = useState<number | "">(0);
const [honorariosPercent, setHonorariosPercent] = useState<number | "">(0);
const [descontoPercent, setDescontoPercent] = useState<number | "">(0);
const [descontoReais, setDescontoReais] = useState<number | "">(0);

// Para:
const [jurosPercent, setJurosPercent] = useState("0");
const [multaPercent, setMultaPercent] = useState("0");
const [honorariosPercent, setHonorariosPercent] = useState("0");
const [descontoPercent, setDescontoPercent] = useState("0");
const [descontoReais, setDescontoReais] = useState("0");
```

**2. Helper de parse:**
```tsx
const parseDecimal = (s: string): number => {
  if (!s) return 0;
  return Number(s.replace(",", ".")) || 0;
};
```

**3. Simplificar onChange — manter raw string no estado:**
```tsx
onChange={(e) => {
  const raw = e.target.value.replace(/[^0-9.,]/g, "");
  // Validar que parseia (rejeitar "1.2.3")
  const parsed = Number(raw.replace(",", "."));
  if (raw !== "" && isNaN(parsed)) return;
  setJurosPercent(raw);
}}
onBlur={() => setJurosPercent(prev => prev === "" ? "0" : prev)}
```

**4. Nos cálculos**, substituir referências diretas por `parseDecimal()`:
```tsx
// De: typeof jurosPercent === "number" ? jurosPercent : 0
// Para: parseDecimal(jurosPercent)
```

**5. Mesma lógica para `entradas[].value`** — mudar de `number | ""` para `string` na interface `EntradaItem`.

**6. `numParcelas`** — manter `number | ""` pois não precisa de decimais.

### Resultado
- "0," fica visível no campo → usuário continua digitando "0,15"
- "0,15" exibe corretamente e calcula como 0.15
- Compatível com ponto: "0.15" também funciona

