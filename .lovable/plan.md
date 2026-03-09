

## Plano: Auto-preencher regras do credor ao abrir Formalizar Acordo

### Situação atual
O componente `AgreementCalculator` já busca as regras do credor via `fetchCredorRules` e preenche **juros** e **multa**. Porém:
1. **Honorários** não são buscados (campo `honorarios_grade` não está no `fetchCredorRules`)
2. **Aging discount** é buscado mas não aplicado automaticamente no desconto
3. **Índice de correção monetária** é buscado mas não exibido/utilizado
4. O **desconto** é preenchido com `desconto_maximo` (teto), quando deveria vir do aging

### O que será feito

**1. Expandir `fetchCredorRules` (`cadastrosService.ts`)**
- Adicionar `honorarios_grade` ao select e ao tipo `CredorRulesResult`

**2. Auto-calcular honorários baseado na grade (`AgreementCalculator.tsx`)**
- Após buscar as regras, determinar o percentual de honorários baseado no valor total dos títulos e a grade configurada (ex: faixa "0-5000" = 10%, "5001-10000" = 8%)
- Preencher `honorariosPercent` automaticamente

**3. Auto-calcular desconto baseado no aging (`AgreementCalculator.tsx`)**
- Identificar o maior atraso entre os títulos selecionados
- Buscar na `aging_discount_tiers` a faixa correspondente
- Preencher `descontoPercent` com o valor da faixa (não com `desconto_maximo`)
- Se não houver faixa correspondente, manter 0

**4. Exibir índice de correção monetária**
- Mostrar um badge informativo na barra de parâmetros indicando o índice configurado (ex: "IPCA")

### Arquivos alterados
- `src/services/cadastrosService.ts` — adicionar `honorarios_grade` ao fetch e tipo
- `src/components/client-detail/AgreementCalculator.tsx` — lógica de auto-preenchimento de honorários (pela grade) e desconto (pelo aging)

### Lógica de honorários por grade
```text
honorarios_grade = [{ faixa: "0-5000", honorario: 10, valor_fixo: 0 }, ...]
totalOriginal = soma dos títulos selecionados
→ encontrar a faixa que contém totalOriginal
→ usar honorario (%) daquela faixa
```

### Lógica de desconto por aging
```text
aging_discount_tiers = [{ min_days: 0, max_days: 30, discount_percent: 30 }, ...]
maiorAtraso = max(atraso de cada título selecionado)
→ encontrar tier onde min_days <= maiorAtraso <= max_days
→ usar discount_percent daquele tier
```

