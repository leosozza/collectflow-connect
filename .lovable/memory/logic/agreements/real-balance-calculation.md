---
name: Real Balance Calculation
description: RPC get_client_real_balance calcula saldo devedor descontando pagamentos de acordos quebrados/cancelados anteriores (CPF+credor)
type: feature
---

**RPC**: `public.get_client_real_balance(_tenant_id, _client_cpf, _credor)` — SECURITY DEFINER + `can_access_tenant` guard.

**Cálculo**:
- `original_total`: SUM(`clients.valor_atualizado` || `valor_saldo`) onde CPF+credor batem
- `paid_history`: SUM de `manual_payments (approved)` + `portal_payments (paid)` + `negociarie_cobrancas (id_status=801)` cujo `agreement_id` está em acordos `broken|cancelled` do mesmo CPF+credor
- `real_balance`: GREATEST(original - paid_history, 0)

**Uso UI**: `AgreementForm` chama o RPC quando CPF+credor preenchidos (debounce 500ms). Se `paid_history > 0`, mostra banner âmbar com botão "Usar saldo real" que pré-popula `original_total`.

**Por quê**: caso Gabriella — cliente quebrou acordo após pagar parcelas; novo acordo NÃO pode partir da dívida original bruta, tem que partir do saldo restante. Banner avisa operador e oferece valor pronto sem forçar (operador ainda pode digitar valor diferente se houver acordo comercial).

**CPF normalização**: ambos lados via `regexp_replace(..., '\D', '', 'g')` para tolerar `123.456.789-00` vs `12345678900`.
