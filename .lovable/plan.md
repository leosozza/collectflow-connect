## Correção: Dashboard zerado — `get_dashboard_stats`

### Causa raiz (confirmada via schema)
A migration anterior referenciou `portal_payments.installment_key`, mas essa coluna **não existe** em `portal_payments` (só existe em `manual_payments` e `negociarie_cobrancas`).

Resultado: a função aborta com erro `42703` e devolve zeros em todos os cards (Recebido, Negociado, Quebra, Pendentes, contagens) — não só nos dois que mudamos.

### Schema real
| Tabela | `installment_key`? |
|---|---|
| `manual_payments` | ✅ |
| `negociarie_cobrancas` | ✅ |
| `portal_payments` | ❌ — só tem `agreement_id`, `amount`, `status` |

### Correção (mínima e cirúrgica)
Nova migration `CREATE OR REPLACE FUNCTION get_dashboard_stats(...)` que:

1. **Quebra (por parcela)**: mantém a checagem em `manual_payments` e `negociarie_cobrancas` (ambas têm `installment_key`). Remove a checagem em `portal_payments`.
2. **Pendentes (por parcela)**: idem.
3. **Trade-off**: parcelas pagas exclusivamente via `portal_payments` (sem registro correspondente em `negociarie_cobrancas` quitada) podem aparecer como pendentes. Na prática, todo pagamento via portal gera `negociarie_cobrancas` com status pago, então o impacto é marginal. Se aparecer divergência, ajustamos depois.
4. **Recebido / Negociado / contagens**: mantidos exatamente como estavam (lógica não muda).

### Arquivo
- `supabase/migrations/<timestamp>_fix_dashboard_portal_payments_column.sql`

### Validação pós-deploy
- Rodar `SELECT get_dashboard_stats(<tenant>, ...)` e confirmar JSON completo (sem erro).
- Conferir Dashboard com valores de Recebido/Negociado voltando ao normal e Quebra/Pendentes aplicando a nova regra per-installment.
