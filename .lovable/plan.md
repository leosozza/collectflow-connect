

# Plano: Bloquear edição de parcelas + Análise de saldo após quebra

## Parte 1 — Bloquear edição de quantidade de parcelas

### Problema atual
O dialog "Editar Acordo" em `ClientDetailPage.tsx` (linhas 522-533) permite alterar `Nº de Parcelas` via input editável. Isso permite que um operador mude a quantidade de parcelas de um acordo já formalizado.

### Correção

**`src/pages/ClientDetailPage.tsx`**:
- Linha 527: tornar o campo `Nº de Parcelas` **disabled** (read-only)
- Remover a função `handleEditInstallments` (linha 186-190) — não será mais usada
- Adicionar mensagem orientativa abaixo do campo:
  `"Para alterar a quantidade de parcelas, cancele o acordo atual e gere um novo."`
- Manter editáveis: valor do acordo, valor da entrada, data da entrada, 1º vencimento, observações

**`src/services/agreementService.ts`** — `updateAgreement`:
- Adicionar proteção no service: remover `new_installments` do payload antes de enviar ao banco, garantindo que mesmo chamadas diretas não alterem a quantidade

### Resumo visual do dialog após ajuste
- Valor do Acordo: **editável**
- Valor da Entrada: **editável**
- Data da Entrada: **editável**
- Nº de Parcelas: **bloqueado** + mensagem orientativa
- Valor da Parcela: **calculado automaticamente** (disabled)
- 1º Vencimento: **editável**
- Observações: **editável**

---

## Parte 2 — Análise da lógica de saldo após quebra de acordo

### Como funciona HOJE

1. **Criação do acordo**: `createAgreement` marca títulos originais como `status = "em_acordo"` (linhas 119-140 do agreementService)

2. **Cancelamento do acordo**: `cancelAgreement` reverte títulos para `status = "pendente"` (linhas 361-366). **O campo `valor_pago` NÃO é zerado** — os pagamentos feitos permanecem registrados nos títulos.

3. **Nova negociação**: `AgreementCalculator` filtra títulos com `status === "pendente" || status === "vencido"` (linha 43) e usa `valor_parcela` como valor base para cálculo (linha 128: `valorOriginal = Number(c.valor_parcela)`).

### Problema identificado

**O sistema NÃO abate o `valor_pago` do saldo base.**

O `AgreementCalculator` usa `valor_parcela` como base — o valor original do título importado. Mesmo que o cliente tenha pago R$ 200 de um título de R$ 1.000, o sistema apresenta R$ 1.000 como valor para renegociação.

O campo `valor_pago` existe nos títulos mas é completamente ignorado pelo calculador de acordos.

### Tabelas/campos envolvidos

| Tabela | Campo | Uso |
|---|---|---|
| `clients` | `valor_parcela` | Valor original do título (usado como base pelo calculador) |
| `clients` | `valor_pago` | Valor já pago (existe mas é IGNORADO no cálculo) |
| `clients` | `status` | Filtro para títulos elegíveis ("pendente", "vencido") |
| `agreements` | `proposed_total` | Valor total do acordo |
| `agreements` | `original_total` | Valor original registrado no acordo |

---

## Parte 3 — Padrão de mercado e correção proposta

### Padrão de mercado (cobrança)

No mercado de cobrança brasileiro, a regra padrão é:

1. **Saldo devedor = valor original - pagamentos efetivos**: Ao renegociar, o saldo base deve considerar apenas o que o devedor ainda deve efetivamente. Valores já quitados não voltam à mesa.

2. **Encargos recalculados sobre saldo remanescente**: Juros, multa e honorários incidem sobre o saldo em aberto, não sobre o valor original completo.

3. **Rastreabilidade entre acordos**: O novo acordo deve referenciar o anterior (cancelado/quebrado) para auditoria.

### Correção proposta

**`src/components/client-detail/AgreementCalculator.tsx`** (linha 128):

Alterar o cálculo de `valorOriginal` para considerar o saldo efetivo:

```typescript
// DE:
const valorOriginal = Number(c.valor_parcela) || Number(c.valor_saldo) || 0;

// PARA:
const valorBruto = Number(c.valor_parcela) || Number(c.valor_saldo) || 0;
const valorPago = Number(c.valor_pago) || 0;
const valorOriginal = Math.max(0, valorBruto - valorPago);
```

Isso garante que:
- Títulos com pagamento parcial entram com o saldo real
- Títulos totalmente pagos (valor_pago >= valor_parcela) entram com R$ 0 e podem ser filtrados
- Juros, multa e honorários incidem sobre o saldo real

**Exibir coluna "V. Pago"** na tabela de títulos do calculador para transparência, mostrando o que já foi abatido.

**Referência ao acordo anterior**: Adicionar campo `previous_agreement_id` (opcional) na tabela `agreements` para rastreabilidade. Ao criar novo acordo para um CPF/credor que teve acordo cancelado, preencher automaticamente.

### Migração SQL
- Adicionar coluna `previous_agreement_id uuid REFERENCES agreements(id)` na tabela `agreements`

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/ClientDetailPage.tsx` | Bloquear edição de parcelas, remover `handleEditInstallments`, mensagem orientativa |
| `src/services/agreementService.ts` | Proteger `new_installments` no `updateAgreement` |
| `src/components/client-detail/AgreementCalculator.tsx` | Usar saldo real (valor_parcela - valor_pago), coluna "V. Pago" |
| Migração SQL | Adicionar `previous_agreement_id` em `agreements` |

## O que NÃO será alterado
- Header do cliente
- Outras abas
- Fluxo Negociarie
- Baixa automática de boletos
- Baixa manual com confirmação

