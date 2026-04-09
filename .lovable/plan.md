

# Correção: Total Recebido e Status de Vencimentos

## Diagnóstico

### Problema 1 — Jaciele não aparece no "Total Recebido"
O evento de pagamento dela é `manual_payment_confirmed` com o valor em `metadata.amount_paid` (700.014). A RPC `get_dashboard_stats` só soma eventos `payment_confirmed` usando `metadata.valor_pago`. Resultado: pagamentos manuais confirmados são ignorados.

### Problema 2 — Renato aparece como "Acordo Atrasado" mesmo tendo pago
Renato pagou a entrada (R$ 457,60) via Negociarie (`negociarie_cobrancas` com status `pago`). A RPC `get_dashboard_vencimentos` verifica apenas `manual_payments` para detectar pagamento — nunca consulta `negociarie_cobrancas`. Como a data 07/04 < hoje (09/04), cai no check de overdue.

## Correções (1 migration SQL)

### Migration — Atualizar ambas as RPCs

**`get_dashboard_stats`** — campo `_recebido`:
- Incluir **ambos** event types: `payment_confirmed` E `manual_payment_confirmed`
- Usar `COALESCE(metadata->>'valor_pago', metadata->>'amount_paid')::numeric` para cobrir os dois formatos de metadata

**`get_dashboard_vencimentos`** — detecção de `effective_status`:
- Adicionar verificação em `negociarie_cobrancas` (onde `status = 'pago'` e `installment_key` corresponde ao acordo/parcela) além da verificação em `manual_payments`
- Para a entrada: checar `installment_key = agreement_id || ':0'`
- Para parcelas regulares: checar `installment_key = agreement_id || ':' || numero_parcela`

### Impacto
- **Total Recebido**: passará a incluir R$ 700,01 da Jaciele + os R$ 457,60 do Renato (que já aparece) + R$ 89,00 = totalizando corretamente
- **Vencimentos**: Renato aparecerá como "Pago" em 07/04 em vez de "Acordo Atrasado"
- Nenhuma alteração de UI necessária — o frontend já mapeia `effective_status` corretamente

