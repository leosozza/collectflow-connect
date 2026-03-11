

# Ajuste Dashboard: Labels e Lógica de Projetado/Negociado

## Mudanças

### 1. Frontend — `src/pages/DashboardPage.tsx`
- Renomear label "Total Negociado no Mês" → **"Total de Primeira Parcela no Mês"**

### 2. Backend — Migration SQL para `get_dashboard_stats`

**Total Projetado no Mês** — nova lógica: soma todas as parcelas virtuais (entrada + mensalidades) de acordos ativos cujo **vencimento** cai no mês selecionado:
```sql
-- Entrada (parcela 0) com vencimento no mês
SELECT entrada_value WHERE entrada_date BETWEEN month_start AND month_end
UNION ALL
-- Mensalidades com vencimento no mês
SELECT new_installment_value WHERE (first_due_date + i months) BETWEEN month_start AND month_end
```

**Total Negociado (agora "Primeira Parcela")** — mantém a lógica de acordos criados no mês, mas soma apenas a primeira parcela:
- Se `entrada_value > 0` → soma `entrada_value`
- Senão → soma `new_installment_value`

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/pages/DashboardPage.tsx` | Renomear label |
| Nova migration SQL | Atualizar função `get_dashboard_stats` |

