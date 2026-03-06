

## Plano: Corrigir lógica de negociação — aging, juros/multa, e aprovação automática

### Problemas identificados

1. **Regras de aging do TESS MODELS salvaram corretamente** — confirmado no banco: 3 faixas (0-59 dias = 0%, 60-365 = 30%, 366+ = 50%). A terceira faixa tem `min_days: 36` (provavelmente digitação do usuário, mas o código vai usar a primeira faixa que casar).

2. **Lógica de aprovação invertida**: Atualmente, quando o credor **não tem regras cadastradas**, o sistema exige liberação. O correto é o oposto: **sem regras = aprovação automática**. A mensagem "Credor sem regras" só deveria aparecer se o credor tem regras E o acordo viola alguma.

3. **`totalAberto` não aplica juros/multa**: O valor usado na negociação é o valor bruto das parcelas pendentes, sem considerar juros, multa e correção monetária do credor. O "Valor Atualizado" já é calculado no header mas não é usado na calculadora de acordo.

### Correções

**1. `src/components/atendimento/NegotiationPanel.tsx` — Inverter lógica de aprovação**
- Linhas 78-84: Quando `!credorRules`, retornar `{ isOut: false, reasons: [] }` (sem regras = tudo liberado)
- Manter validação quando credorRules existe e limites são violados

**2. `src/components/client-detail/AgreementCalculator.tsx` — Inverter lógica + usar valor atualizado**
- Linhas 194-199: Mesmo ajuste — sem regras = aprovação automática
- No cálculo de `originalTotal` (linhas 79-83): Aplicar juros/multa/correção baseado nas regras do credor e data de vencimento da parcela mais antiga selecionada
- Buscar também `indice_correcao_monetaria` do credor para exibir informação

**3. `src/pages/ClientDetailPage.tsx` — Passar valor atualizado para a calculadora**
- Ajustar `totalAberto` para considerar juros e multa do credor quando disponíveis, usando a mesma lógica do header (parcela mais antiga como base de cálculo)

**4. `src/services/cadastrosService.ts` — Incluir `indice_correcao_monetaria` no fetch**
- Adicionar `indice_correcao_monetaria` ao `select` e ao `CredorRulesResult` interface

### Resumo das mudanças de comportamento
| Cenário | Antes | Depois |
|---------|-------|--------|
| Credor sem regras cadastradas | Exige liberação | Aprovação automática |
| Credor com regras, acordo dentro dos limites | Aprovação automática | Aprovação automática |
| Credor com regras, acordo fora dos limites | Exige liberação | Exige liberação |
| Cálculo do débito | Valor bruto da parcela | Valor + juros + multa baseado na parcela mais antiga |

### Arquivos alterados
- `src/components/atendimento/NegotiationPanel.tsx`
- `src/components/client-detail/AgreementCalculator.tsx`
- `src/pages/ClientDetailPage.tsx`
- `src/services/cadastrosService.ts`

