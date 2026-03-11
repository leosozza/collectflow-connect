

# Correção: Analytics e Relatórios baseados em Acordos

## Problemas identificados

### AnalyticsPage
1. **Busca agreements incompleta** — só traz `client_cpf`, não traz `proposed_total`, `status`, `created_at`, `created_by`, `credor`, etc.
2. **Sem filtro por tenant** — queries em `clients` e `agreements` não filtram por `tenant_id`
3. **KPIs calculados de parcelas** — usa `clients.valor_pago` e `clients.status` ao invés dos dados do acordo (`agreements.proposed_total`, `agreements.status`)
4. **Status "overdue" ignorado** — o status recém-adicionado não é tratado nos filtros e cálculos
5. **Evolução mensal incorreta** — usa `data_vencimento` das parcelas e não a data/status do acordo
6. **Query de operadores sem tenant** — busca todos os profiles com `role = "operador"` do sistema inteiro

### RelatoriosPage
7. **Sub-componentes usam status de parcela** — `EvolutionChart`, `AgingReport` e `OperatorRanking` usam `clients.status` (pago/pendente/quebrado) ao invés de derivar do acordo
8. **PrestacaoContas** usa `clients` como fonte principal de métricas financeiras

## Plano de correção

### 1. AnalyticsPage — Reescrever queries e KPIs

- Buscar `agreements` com todos os campos: `id, client_cpf, client_name, credor, proposed_total, original_total, status, created_at, created_by, first_due_date, new_installments, new_installment_value, entrada_value`
- Adicionar filtro de tenant via `tenant_id = get_my_tenant_id()`  (ou usar o tenant do profile)
- Filtrar operadores pelo tenant
- **KPIs recalculados dos acordos:**
  - Total Negociado = `SUM(proposed_total)` de acordos ativos
  - Total Recebido = `SUM(proposed_total)` de acordos com status `completed` ou `paid`
  - Total Quebra = `SUM(proposed_total)` de acordos `cancelled` + `overdue` fora do prazo
  - Taxa de Recuperação = acordos pagos / (pagos + cancelados)
  - Ticket Médio = Total recebido / nº de acordos pagos
- **Evolução mensal** baseada em `agreements.created_at` (mês de criação do acordo)
- **Status pie** usando `agreements.status` (approved, pending, overdue, cancelled, completed)
- Tratar `overdue` como status ativo (vigente porém vencido)

### 2. RelatoriosPage — Alinhar com dados de acordos

- Manter a query de `clients` para o Aging (que é de parcelas vencidas)
- **KPIs do resumo** → calcular a partir de `agreements` (Total Negociado, Recebido, Quebra)
- **EvolutionChart** → receber `agreements[]` além de `clients[]`, usar dados de acordo para "Recebido" e "Quebra"
- **OperatorRanking** → usar `agreements.created_by` para atribuir ao operador, e `agreements.status` para classificar sucesso/quebra

### 3. Componentes de relatório

- **EvolutionChart**: Novo prop `agreements`, evolução baseada em `created_at` do acordo e seu `status`
- **OperatorRanking**: Novo prop `agreements`, ranking por `created_by` com métricas de `proposed_total`
- **AgingReport**: Mantém lógica atual (aging de parcelas é correto por `data_vencimento`)
- **PrestacaoContas**: KPIs de resumo vêm de `agreements`, tabela de parcelas mantém `clients`

### 4. Mapeamento de status de acordo

```text
agreements.status    →  Classificação
─────────────────────────────────────
pending              →  Pendente (ativo)
pending_approval     →  Aguardando
approved             →  Vigente (ativo)
overdue              →  Vencido (ativo, permite recebimento)
completed / paid     →  Pago
cancelled            →  Cancelado/Quebra
rejected             →  Rejeitado (excluído de métricas)
```

## Arquivos a editar

| Arquivo | Ação |
|---|---|
| `src/pages/AnalyticsPage.tsx` | Reescrever queries (agreements completo + tenant), recalcular todos os KPIs e gráficos |
| `src/pages/RelatoriosPage.tsx` | Passar agreements para componentes, ajustar KPIs do resumo |
| `src/components/relatorios/EvolutionChart.tsx` | Adicionar prop agreements, usar dados de acordo na evolução |
| `src/components/relatorios/OperatorRanking.tsx` | Reescrever para usar agreements.created_by e status |
| `src/components/relatorios/PrestacaoContas.tsx` | Ajustar KPIs para usar agreements ao invés de clients |

