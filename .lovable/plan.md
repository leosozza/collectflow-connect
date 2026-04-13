

# Forma de Pagamento Individual por Entrada

## Problema
Atualmente existe um único campo "Forma Pagto" que se aplica a todas as entradas e parcelas. O usuário precisa definir formas de pagamento diferentes para cada entrada (ex: Entrada 1 = PIX, Entrada 2 = Cartão, Parcelas = Boleto).

## Solução

### 1. Atualizar o estado `EntradaItem` para incluir forma de pagamento

Adicionar campo `method` à interface:
```ts
interface EntradaItem { date: string; value: number | ""; method: string }
```
Inicializar com `method: "BOLETO"`.

### 2. Adicionar Select de forma de pagamento em cada linha de entrada

Na UI de cada entrada (linhas 624-655), adicionar um `Select` compacto ao lado dos campos de data e valor. O grid passa de `[1fr_1fr_auto]` para `[1fr_1fr_auto_auto]` ou similar para acomodar o novo campo sem quebrar o layout.

### 3. Manter o campo "Forma Pagto" existente para as parcelas regulares

O `formaPagto` global (linha 69) continua controlando apenas as parcelas regulares (01/XX, 02/XX...). As labels podem ser ajustadas para "Forma Pagto Parcelas" para clareza.

### 4. Atualizar `handleSimulate`

Na criação dos installments de entrada (linhas 209-217), usar `ent.method` em vez de `formaPagto`:
```ts
method: ent.method,
```

### 5. Persistência nos campos JSONB

Adicionar a forma de pagamento de cada entrada no `custom_installment_values` existente, usando chaves como `entrada_method`, `entrada_2_method`, etc. Ou criar um campo separado no JSONB. Como `custom_installment_values` já é JSONB flexível, a abordagem mais limpa é enriquecer o mapa:
```ts
customValues[`${key}_method`] = ent.method; // "BOLETO", "PIX", "CARTAO"
```

### 6. Atualizar `agreementInstallmentClassifier.ts`

Ao construir as parcelas virtuais de entrada, ler a chave `_method` correspondente do JSONB para classificar corretamente a forma de pagamento de cada entrada.

## Arquivos a alterar
- `src/components/client-detail/AgreementCalculator.tsx` — interface, UI, simulação e submissão
- `src/lib/agreementInstallmentClassifier.ts` — leitura da forma de pagamento por entrada

## Sem migrations necessárias
Os campos JSONB existentes comportam os dados adicionais.

