## Melhoria de UX no simulador de acordo

### Mudança
Em `src/components/client-detail/AgreementCalculator.tsx`, ajustar os valores iniciais do formulário:

- **Quantidade de parcelas**: passa de `0` (vazio) para `1`
- **Primeiro vencimento**: passa de `""` (vazio) para a **data de hoje** (`new Date().toISOString().split("T")[0]`)

### Antes
```ts
const [numParcelas, setNumParcelas] = useState<number | "">(0);
const [firstDueDate, setFirstDueDate] = useState("");
```

### Depois
```ts
const [numParcelas, setNumParcelas] = useState<number | "">(1);
const [firstDueDate, setFirstDueDate] = useState(
  () => new Date().toISOString().split("T")[0]
);
```

### Impacto
- Ao abrir a calculadora, o operador já consegue clicar em **Simular** sem precisar preencher nada → fluxo mais rápido para acordos à vista no mesmo dia (caso mais comum).
- O usuário ainda pode alterar livremente os dois campos.
- Não afeta o fluxo de restauração de rascunho (`loadDraft`) — quando há rascunho salvo, ele continua sobrescrevendo os defaults.
- Não afeta validações/cálculos existentes — só muda o ponto de partida.

### Arquivo
- `src/components/client-detail/AgreementCalculator.tsx` (linhas 90 e 93)

Posso aplicar?