

# Múltiplas Entradas na Calculadora de Acordos

## Problema
Atualmente o `AgreementCalculator.tsx` suporta apenas uma entrada (data + valor). O usuário precisa poder adicionar múltiplas entradas (ex: Entrada 1, Entrada 2, etc.).

## Estratégia de persistência

O banco já possui:
- `entrada_value` (numeric) — armazenará a **soma** de todas as entradas
- `entrada_date` (date) — armazenará a data da **primeira** entrada
- `custom_installment_values` (jsonb) — armazenará os valores individuais: `{"entrada": 500, "entrada_2": 300, "entrada_3": 200}`
- `custom_installment_dates` (jsonb) — armazenará as datas individuais: `{"entrada": "2026-04-15", "entrada_2": "2026-04-20"}`

**Nenhuma migration necessária** — os campos JSONB já existem e suportam essa estrutura.

## Alterações

### 1. `src/components/client-detail/AgreementCalculator.tsx`

**Estado**: Substituir `entradaDate` (string) e `entradaValue` (number) por um array:
```ts
interface EntradaItem { date: string; value: number | "" }
const [entradas, setEntradas] = useState<EntradaItem[]>([{ date: "", value: 0 }]);
```

**UI (Seção "Condições do Acordo")**: Substituir os 2 campos fixos de entrada por uma lista dinâmica:
- Cada linha mostra: label "Entrada N", campo data, campo valor, botão remover (se N > 1)
- Botão "+" para adicionar nova linha de entrada
- Layout compacto mantendo o estilo atual (h-7, text-xs)

**Cálculo**: `numEntrada` passa a ser a soma de todos os valores de entrada. `remainingAfterEntrada` permanece `totalAtualizado - somaEntradas`.

**Simulação (`handleSimulate`)**: Cada entrada gera uma linha individual na tabela de simulação (number: 0 para todas, mas com label "Entrada 1", "Entrada 2", etc.). Ajustar `SimulatedInstallment` para incluir campo `label` opcional.

**Gravação (`handleSubmit`)**: Ao montar `AgreementFormData`:
- `entrada_value` = soma de todas as entradas
- `entrada_date` = data da primeira entrada
- Montar `custom_installment_dates` e `custom_installment_values` com chaves `"entrada"`, `"entrada_2"`, `"entrada_3"`, etc.

### 2. `src/services/agreementService.ts`

Atualizar `AgreementFormData` para aceitar campos opcionais:
```ts
custom_installment_dates?: Record<string, string>;
custom_installment_values?: Record<string, number>;
```
Esses campos já existem na interface `Agreement` e no banco — basta passá-los no insert.

### 3. `src/lib/agreementInstallmentClassifier.ts`

Já suporta múltiplas entradas via `custom_installment_dates`/`custom_installment_values` com a chave `"entrada"`. Ajustar `buildInstallmentSchedule` para iterar sobre chaves `"entrada"`, `"entrada_2"`, etc., gerando uma `VirtualInstallment` para cada.

### 4. Tabela de simulação (display)

Na tabela de simulação, mostrar:
- "Entrada 1" em vez de "Entrada" quando há múltiplas
- "Entrada 2", "Entrada 3", etc. para as adicionais
- Parcelas regulares continuam como `01/XX`, `02/XX`

## Resultado esperado
- Botão "+" visível ao lado dos campos de entrada
- Cada entrada é uma linha editável independente
- Simulação mostra todas as entradas individualmente
- Acordo gravado corretamente com breakdown nas colunas JSONB existentes
- Classificação de parcelas (`agreementInstallmentClassifier`) reconhece múltiplas entradas

