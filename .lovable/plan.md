## Causa raiz da divergência

O cálculo da gamificação estava ignorando os pagamentos via **Negociarie**. O sistema possui dois canais de pagamento real (consolidados na RPC `get_agreement_financials`, usada em Relatórios e Analytics):

1. `manual_payments` com status `confirmed` (parcelas confirmadas pelo admin)
2. `negociarie_cobrancas` com status `pago` (pagamentos via gateway Negociarie)

A RPC de gamificação só lia uma das fontes — por isso o Vitor aparecia com R$ 24.909 em vez de **R$ 37.885,02**.

## Fonte oficial confirmada (Abr/2026)

| Operador | Manual | Negociarie | **Total Real** | Pgtos |
|---|---|---|---|---|
| Vitor | R$ 24.909,28 | R$ 12.975,74 | **R$ 37.885,02** | 140 |
| Gustavo | R$ 20.628,88 | R$ 1.328,27 | **R$ 21.957,15** | 84 |
| Maria Eduarda | R$ 10.667,79 | R$ 4.573,06 | **R$ 15.240,85** | 76 |
| Sabrina | R$ 8.470,00 | R$ 0,00 | **R$ 8.470,00** | 8 |

## O que vou corrigir

### 1. Migração: corrigir `recalculate_operator_gamification_snapshot`

Trocar a lógica de "pagamentos / valor recebido" para usar a **mesma fonte canônica** do `get_agreement_financials`:

```sql
-- Manual confirmadas
SUM(amount_paid) FROM manual_payments
WHERE status='confirmed' AND payment_date no mês
  AND agreement.created_by = operador

-- + Negociarie pagas
SUM(valor_pago) FROM negociarie_cobrancas
WHERE status='pago' AND data_pagamento no mês
  AND agreement.created_by = operador
```

Tanto `payments_count` quanto `total_received` passam a refletir a soma dos dois canais. Demais regras (acordos criados, quitados, quebrados, conquistas, meta) permanecem como estão.

### 2. Re-executar o recálculo de Abr/2026

Chamar a RPC para os 4 operadores ativos. Com base nos novos valores, **três deles batem ou ultrapassam a meta** — o bônus de 250 pts entra:

| Operador | Recebido | Meta | Atinge? | Pontos previstos |
|---|---|---|---|---|
| Vitor | R$ 37.885 | R$ 45.000 | ✗ | ~3.755 |
| Gustavo | R$ 21.957 | R$ 45.000 | ✗ | ~2.330 |
| Maria Eduarda | R$ 15.241 | R$ 40.000 | ✗ | ~1.555 |
| Sabrina | R$ 8.470 | R$ 20.000 | ✗ | ~570 |

(nenhum atinge meta ainda, mas os pontos sobem proporcionalmente ao valor real recebido)

### 3. Auditar e exibir o novo ranking

Mostrar a tabela final com os pontos recalculados e a verificação aritmética item a item.

## Arquivos afetados

- Nova migração: corrige a RPC `recalculate_operator_gamification_snapshot` para somar os dois canais.
- Nenhum arquivo TS/UI precisa mudar — o Ranking lê direto de `operator_points`.

## Observação

Esta mesma correção fará com que o **trigger em tempo real** (`useGamificationTrigger`) também precise ser auditado posteriormente para garantir que conta pagamentos Negociarie quando o webhook chega — mas isso fica para um próximo passo, fora deste plano.