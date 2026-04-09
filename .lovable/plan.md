

# Revisão do Dashboard — Análise Completa

## Diagnóstico

Após análise detalhada das RPCs, dados no banco e código do frontend, identifiquei que as correções da migration anterior foram aplicadas com sucesso. Veja o estado atual:

### ✓ Funcionando Corretamente

1. **Total Recebido** — A RPC `get_dashboard_stats` agora soma corretamente:
   - Eventos `payment_confirmed` (Negociarie) usando `metadata.valor_pago`
   - Eventos `manual_payment_confirmed` (baixas manuais) usando `metadata.amount_paid`
   - Confirmado nos dados: R$ 457,60 (Renato) + R$ 700,01 (Jaciele) + R$ 89,00 (Maria Cristina) = R$ 1.246,61

2. **Vencimentos do Dia** — A RPC `get_dashboard_vencimentos` verifica pagamentos em:
   - `manual_payments` (baixa manual)
   - `negociarie_cobrancas` (pagamento via plataforma)
   - Acordos com status `approved` (totalmente pagos)
   - Renato no dia 08/04 aparece corretamente como "Pago" (Negociarie `:0` = pago)

3. **Frontend** — O mapeamento de cores/labels está correto:
   - `paid` → Badge verde "Pago"
   - `overdue` → Badge vermelho "Acordo Atrasado"
   - `pending` → Badge amarelo "Pendente"

### ⚠ Correção Necessária (1 item)

**Excluir acordos `rejected` dos vencimentos**: A RPC `get_dashboard_vencimentos` exclui apenas `cancelled`, mas deveria excluir também `rejected`. Hoje não há acordos rejeitados no banco, mas é uma questão de integridade para todos os tenants.

## Alteração

### Migration SQL — Atualizar `get_dashboard_vencimentos`

Trocar:
```sql
AND a.status NOT IN ('cancelled')
```
Para:
```sql
AND a.status NOT IN ('cancelled', 'rejected')
```

Em ambas as queries (entrada e parcelas regulares).

### Impacto
- Nenhuma alteração de UI necessária
- Compatível com todos os tenants — as RPCs usam `tenant_id` via `auth.uid()` automaticamente
- Nenhum risco de regressão

