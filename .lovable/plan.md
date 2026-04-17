

## Diagnóstico — Múltiplas entradas com renderização e edição inconsistentes

### O que está acontecendo
Confirmei no banco (acordo Samara Correia / TESS MODELS):
```
entrada_value: 537                  ← SOMA das entradas (230 + 307)
custom_installment_values: { entrada: 230, entrada_2: 307, entrada_method: BOLETO, entrada_2_method: BOLETO }
custom_installment_dates: { entrada: 2026-04-08, entrada_2: 2026-04-20 }
new_installments: 6, new_installment_value: 130,20
```

Ou seja: a calculadora salva corretamente as 2 entradas no JSON, **mas grava na coluna `entrada_value` a SOMA** das duas (537). Esse é o ponto que contamina toda a UI a jusante.

### Bugs derivados

**Bug 1 — Tabela "Parcelas do Acordo" só mostra 1 entrada**
`AgreementInstallments.tsx` (linhas 127–140) e `agreementInstallmentClassifier.buildInstallmentSchedule` parcial: o primeiro componente nem itera sobre `entrada_2/3/...`. Resultado: a 2ª entrada de R$ 307 simplesmente desaparece da listagem visual; o operador não consegue ver/baixar/gerar boleto dela na tela. (O `generate-agreement-boletos` no Edge já trata corretamente, então o boleto pode até existir, mas não aparece na grade.)

**Bug 2 — Resumo "Entrada R$ 230 + 6x R$ 130,20" omite a 2ª entrada**
`getEffectiveAgreementSummary` em `installmentUtils.ts` lê apenas `customValues["entrada"]`. Ignora `entrada_2`. O label fica incoerente com o real `proposed_total`.

**Bug 3 — Modal "Editar Acordo" mostra a SOMA como se fosse uma única entrada (R$ 537,00)**
`handleEditOpen` carrega `entrada_value` (que é 537) num único campo "Valor da Entrada". Pior: o `recalcInstallmentValue` recalcula `proposed - entrada` ignorando que existem outras entradas/método/data, e ao salvar via `updateAgreement` apenas a coluna `entrada_value` é tocada — o JSON `custom_installment_values` permanece com 230+307 conflitando, gerando a discrepância vista no print (`Valor do Acordo` calculado como 1.318,20 em vez de 1.011,20).

**Bug 4 — `entrada_value` semanticamente ambíguo**
Hoje a coluna mistura dois usos: "primeira entrada" (modo simples) vs "soma de entradas" (modo múltiplo). Isso quebra cálculos de saldo, score e relatórios financeiros que tratam essa coluna como "valor da entrada única".

### Correções (puramente frontend, sem migration)

**1. `AgreementInstallments.tsx`** — iterar sobre todas as chaves `entrada*` (igual já faz o `generate-agreement-boletos`):
- Coletar `entradaKeys` ordenadas (`entrada`, `entrada_2`, `entrada_3`...) a partir de `custom_installment_values`.
- Renderizar uma linha por entrada, com seu próprio `value`, `dueDate`, `customKey`, ações (PDF, copiar link, baixa manual). Label: "Entrada" se 1 só, "Entrada 1", "Entrada 2", … se múltiplas.
- `installment_key` continua `${agreementId}:0` apenas para a primeira; as adicionais usam `${agreementId}:entrada_2` (espelhando o que o boleto generator já produz). Verificar se `cobrancas`/`manualPayments` usam essa convenção; se não, usar `customKey` direto.

**2. `installmentUtils.getEffectiveAgreementSummary`** — somar todas as `entrada*`:
- `effectiveEntrada` passa a ser a soma de `customValues[k]` para todo `k` que começa com `entrada` e não termina em `_method`.
- Label adapta: "Entrada R$ 230 + Entrada 2 R$ 307 + 6x R$ 130,20" (ou condensado se desejado). Decisão: manter conciso "Entradas R$ 537 (2x) + 6x R$ 130,20" quando >1 entrada.

**3. `agreementInstallmentClassifier.buildInstallmentSchedule`** — já tem lógica parcial; revisar para garantir que `value` venha de `customValues[key]` e não do `entrada_value` total. (O código atual está correto, mas `installment.number = 0` para todas as entradas — passar o índice no `key` e ajustar `instNumber` em `classifyInstallment` para casar com `manual_payments.installment_number` adequadamente. Provavelmente manter `number = 0` e diferenciar pelo `key`.)

**4. Modal "Editar Acordo" (`ClientDetailPage.tsx`)** — quando `custom_installment_values` tem >1 entrada:
- Renderizar **uma linha por entrada** (data + valor) em vez do par único.
- Detectar via `Object.keys(customValues).filter(k => k.startsWith("entrada") && !k.endsWith("_method")).length > 1`.
- Estado `editEntradas: { key, date, value }[]` reconstruído no `handleEditOpen`.
- `handleEditSubmit` passa a montar `custom_installment_values`/`custom_installment_dates` atualizados E `entrada_value = soma`, mantendo coerência com o modelo atual de armazenamento.
- `recalcInstallmentValue` usa a SOMA das entradas para calcular `proposed - somaEntradas`.

**5. (Opcional, defensivo) `agreementService.updateAgreement`** — quando o caller mandar `custom_installment_values` com chaves `entrada*`, recalcular `entrada_value` no servidor antes do `update` para evitar drift. Implementar como simples normalização no service (sem RPC).

### Sem alterações em
- Schema do banco (continua `entrada_value` numeric + JSONs existentes — mantém compatibilidade com acordos já gravados).
- Edge `generate-agreement-boletos` (já está correto).
- RLS/RPCs.

### Resultado esperado
- Aba "Parcelas do Acordo" mostrará "Entrada 1 — R$ 230,00" e "Entrada 2 — R$ 307,00" como linhas separadas, cada uma com suas ações.
- Resumo do acordo bate com `proposed_total` (1.011,20 = 230 + 307 + 6×130,20 — **wait**, 230+307+780 = 1.317… o usuário precisa revisar o `proposed_total = 1.011,20` que parece inconsistente; mas isso é dado, não bug atual da UI).
- Modal "Editar Acordo" mostrará 2 campos de entrada editáveis e o "Valor do Acordo" refletirá a soma correta.
- Acordos com 1 só entrada continuam idênticos (retrocompatível).

