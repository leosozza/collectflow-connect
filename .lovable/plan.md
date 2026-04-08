

# Fix: Jaciele Não Aparece nos Vencimentos do Dia 07/04

## Causa Raiz

A correção anterior alterou a RPC `get_dashboard_vencimentos` para filtrar **apenas** acordos com `status = 'pending'`. Como o acordo da Jaciele já foi marcado como `approved` (pagamento confirmado), ela é excluída da lista.

## Proposta

Alterar a RPC para incluir **todos os acordos ativos** (não cancelados), mostrando cada um com seu status real. Assim, acordos pagos aparecerão nos vencimentos do dia com badge verde "Pago", e operadores poderão confirmar que o pagamento foi processado.

### Alteração: RPC `get_dashboard_vencimentos`

Trocar o filtro de:
```sql
AND a.status = 'pending'
```
Para:
```sql
AND a.status NOT IN ('cancelled')
```

Isso inclui acordos `pending`, `approved`, `overdue` — todos aparecerão na lista com seus respectivos badges (Pendente, Pago, Atrasado).

### Arquivo afetado
- 1 migration SQL (alteração da RPC)

### Impacto
- Nenhum em outras rotas. O DashboardPage.tsx já tem o mapeamento de cores correto para cada status.

