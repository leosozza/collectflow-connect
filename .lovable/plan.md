

## Ajustar cores do gráfico Meta por faixa de performance

Atualizar a paleta de cores do `MetaGaugeCard` no Dashboard para refletir a nova escala de performance.

### Nova escala de cores

| Faixa | Cor | Token |
|---|---|---|
| 0% – 40% | Vermelho | `hsl(var(--destructive))` |
| 41% – 80% | Laranja | `#f97316` |
| 81% – 90% | Azul | `#3b82f6` |
| 91% – 100% | Verde | `hsl(var(--success))` |

A cor é aplicada tanto no arco de progresso quanto no número percentual central.

### Arquivo alterado

- `src/components/dashboard/MetaGaugeCard.tsx` — substituir a função `progressColorVar` (linhas 56-57) pela nova lógica de 4 faixas.

### Não incluído

- Sem alterações em outros componentes ou tokens globais de tema.
- O texto "🏆 META ATINGIDA!" continua aparecendo em 100%.

