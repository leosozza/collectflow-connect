

# Plano: Corrigir card "Pendentes" para subtrair pagamentos confirmados

## Problema

O card "Pendentes" mostra R$ 11,00 para o Raul, mas ele já pagou R$ 11,00. A RPC `get_dashboard_stats` soma todas as parcelas previstas no mês para acordos vigentes, mas **não subtrai os pagamentos já confirmados** (`_recebido`).

## Dados do Raul confirmados no banco
- Acordo: entrada customizada = R$ 11 (original R$ 5), vencimento 23/03
- Pagamento confirmado: R$ 11 via Negociarie (event_type = `payment_confirmed`)
- `_recebido` já calcula R$ 11 corretamente
- `_pendente` calcula R$ 11 (parcela prevista) mas não desconta o pagamento

## Correção

Uma migration SQL que reescreve `get_dashboard_stats` adicionando uma única linha após o cálculo de `_pendente`:

```sql
_pendente := GREATEST(_pendente - _recebido, 0);
```

Isso garante que "Pendentes" = parcelas previstas no mês **menos** pagamentos já confirmados no mês.

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| Migration SQL (`get_dashboard_stats`) | Adicionar subtração de `_recebido` do `_pendente` |

Nenhuma mudança em frontend.

