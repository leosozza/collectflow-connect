# Corrigir exibição de Juros / Multa / Honorários / Descontos em `/financeiro/baixas`

## Diagnóstico

Hoje as 4 colunas aparecem quase sempre como `—` porque cada fonte de baixa expõe esses valores de jeito diferente:

| Fonte | Como vem hoje | Problema |
|---|---|---|
| `manual_payments` | colunas `interest_amount`, `penalty_amount`, `fees_amount`, `discount_amount` | operador raramente preenche → vira 0 |
| `portal_payments` | `payment_data->>'interest'…` com fallback de rateio do acordo | gateway quase nunca envia decomposto |
| `negociarie_cobrancas` | **não existe coluna nenhuma** | RPC retorna `0` fixo |

Conclusão: a decomposição **não existe no nível da baixa em lugar nenhum**. O que existe, sempre, é a decomposição **no nível do acordo** (`agreements.interest_amount / penalty_amount / fees_amount / discount_amount`). Isso é a "verdade contábil" do acordo — o valor de juros/multa/honorários/desconto pactuado, distribuído entre as parcelas.

## Caminho correto (simples, sem gambiarra)

**Ratear o valor planejado do acordo proporcionalmente por parcela**, sempre, para todas as 3 fontes — usando exatamente a mesma fórmula que o portal já usa hoje no fallback.

Regra única, aplicada na RPC `get_baixas_realizadas`:

```text
para cada baixa (manual | portal | negociarie):
  total_parcelas = agreements.installments_count   (entrada + parcelas mensais, sem canceladas)
  juros_parcela     = agreements.interest_amount  / total_parcelas
  multa_parcela     = agreements.penalty_amount   / total_parcelas
  honor_parcela     = agreements.fees_amount      / total_parcelas
  desc_parcela      = agreements.discount_amount  / total_parcelas
```

Em manual_payments, **se o operador preencheu manualmente** (`interest_amount > 0` etc.), respeita o valor manual; **senão** usa o rateio do acordo. Mesmo princípio para portal (gateway primeiro, rateio depois). Negociarie sempre usa rateio (não há outra fonte).

Resultado: as colunas passam a refletir a verdade contábil pactuada no acordo, sem inventar dados, sem nova rota, sem nova tabela, sem mudança de UI.

## Mudanças

**Único arquivo afetado:** migration recriando a RPC `get_baixas_realizadas`.

- Bloco `manual`: `COALESCE(NULLIF(mp.interest_amount,0), a.interest_amount / total_parcelas)` e idem para os outros 3.
- Bloco `portal`: `COALESCE(NULLIF((pp.payment_data->>'interest')::numeric,0), a.interest_amount / total_parcelas)` e idem.
- Bloco `negociarie`: `a.interest_amount / total_parcelas` (substitui o `0::numeric` atual).

`total_parcelas` = `(SELECT count(*) FROM agreement_installments ai WHERE ai.agreement_id = a.id AND ai.cancelled = false)`. Se 0 (defensivo), usa 1.

**Sem mudanças** em: assinatura/retorno da RPC, `BaixasRealizadasPage.tsx`, manual_payments, portal_payments, negociarie_cobrancas, dashboard, ranking. `valor_pago` continua intocado.

## Validação

1. Abrir `/financeiro/baixas` em maio/26 → as 4 colunas passam a mostrar valor (≠ —) em ~todas as linhas.
2. Soma de `valor_pago` continua = R$ 64.463,99 (Dashboard "Recebido").
3. Em uma linha de acordo X com 10 parcelas: juros exibido = `agreements.interest_amount / 10`.
4. Baixa manual onde o operador preencheu juros = R$ 50: continua mostrando R$ 50 (manual prevalece).
