

# Correção: Geração de boletos com múltiplas entradas

## Problema identificado

A edge function `generate-agreement-boletos` tem a função `buildInstallments` (linhas 75-101) que **só reconhece uma única entrada** (`customValues["entrada"]`). Quando o operador configura múltiplas entradas (ex: `entrada`, `entrada_2`, `entrada_3`), apenas a primeira é incluída na geração de boletos. As demais são ignoradas.

Além disso, todas as entradas recebem `number: 0`, o que gera `installment_key` duplicado (`agreement_id:0`) para todas elas, causando conflitos na tabela `negociarie_cobrancas`.

O frontend (classifier) já trata múltiplas entradas corretamente. O problema é exclusivamente na edge function.

## Comparação

```text
Frontend (agreementInstallmentClassifier.ts)     Edge Function (buildInstallments)
──────────────────────────────────────────────    ─────────────────────────────────
Busca todas as keys "entrada*" no customValues   Só busca customValues["entrada"]
Cria uma entrada por key                         Cria no máximo 1 entrada
Usa key como identificador ("entrada_2")         Usa number: 0 para todas
```

## Alteração

### Arquivo: `supabase/functions/generate-agreement-boletos/index.ts`

Reescrever a função `buildInstallments` para:

1. Coletar todas as chaves `entrada*` do `custom_installment_values` (mesma lógica do classifier)
2. Gerar uma `InstallmentInfo` para cada entrada, usando a **key** como identificador (não `number: 0`)
3. Ajustar o campo `number` para diferenciar entradas (ex: `number: -1` para entrada_2, ou usar string key)

Como `InstallmentInfo.number` é usado para gerar o `installment_key`, preciso mudar a interface para incluir uma `key` string:

```typescript
interface InstallmentInfo {
  number: number;
  key: string;      // "entrada", "entrada_2", "1", "2", etc.
  value: number;
  dueDate: string;
  isEntrada: boolean;
}
```

E no loop de geração (linha 218), usar `inst.key` em vez de `inst.number` para o `installment_key`:

```typescript
// Antes
const installmentKey = `${agreement_id}:${inst.number}`;

// Depois  
const installmentKey = `${agreement_id}:${inst.key}`;
```

E ajustar o label da mensagem do boleto para distinguir "Entrada 1", "Entrada 2", etc.

## Resultado esperado

- Acordos com 2+ entradas geram boletos para **todas** as entradas
- Cada entrada tem seu próprio `installment_key` único
- Compatível com a classificação existente no frontend
- Acordos com entrada única continuam funcionando igual

## Arquivo alterado
- `supabase/functions/generate-agreement-boletos/index.ts` (redeploy)

