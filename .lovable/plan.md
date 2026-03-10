

# Correção do Dashboard — Métricas baseadas em Acordos Formalizados

## Problema
O Dashboard usa `fetchClients()` que traz no máximo 1000 de 9.495 registros, e tenta calcular tudo no frontend. Além disso, precisa refletir **apenas acordos formalizados no Rivo**, não a carteira bruta importada.

## Modelo de Dados Atual
- **`agreements`**: contém `proposed_total`, `new_installments`, `new_installment_value`, `first_due_date`, `status`, `created_by`, `created_at`
- **Parcelas do acordo são virtuais**: geradas com `first_due_date + addMonths(i)` — não há tabela `agreement_installments`
- **`clients`**: títulos originais marcados como `em_acordo` quando acordo é criado; pagamentos distribuídos via `registerAgreementPayment`

## Plano de Correção

### 1. RPC `get_dashboard_stats` (Migration SQL)

Função que calcula tudo no banco, sem limite de linhas:

```text
Parâmetros: _user_id uuid (nullable), _year int, _month int
Retorna:
  total_projetado     → SUM(proposed_total) de agreements ativos (pending/approved) com first_due_date no período
  total_negociado     → SUM(proposed_total) de agreements criados no mês
  total_recebido      → SUM(valor_pago) de clients cujo CPF tem acordo ativo
  total_quebra        → SUM(proposed_total) de agreements cancelled/overdue
  total_pendente      → total_projetado - total_recebido - total_quebra
  acordos_dia         → COUNT agreements criados hoje
  acordos_mes         → COUNT agreements criados no mês
```

Quando `_user_id` não é null, filtra por `agreements.created_by = _user_id` (visão do operador).

### 2. RPC `get_dashboard_vencimentos` (Migration SQL)

Gera parcelas virtuais dos acordos para uma data específica:

```text
Parâmetros: _target_date date, _user_id uuid (nullable)
Retorna: lista de parcelas virtuais cujo vencimento cai naquela data
  - agreement_id, client_cpf, client_name, credor
  - numero_parcela, valor_parcela
  - status do pagamento (verificado contra clients.valor_pago)
```

Lógica: para cada acordo ativo, gera N datas (first_due_date + i meses). Se alguma cai no `_target_date`, inclui na lista.

**Nota técnica**: Como são parcelas virtuais (não estão em tabela), a função faz um loop `generate_series(0, new_installments-1)` e calcula `first_due_date + (i * interval '1 month')`.

### 3. Refatorar `DashboardPage.tsx`

| Antes | Depois |
|---|---|
| `fetchClients()` (1000 rows max) | `supabase.rpc('get_dashboard_stats', {...})` |
| `useMemo` pesado com filtros | Dados já calculados pelo banco |
| Card Vencimentos lê `clients` | `supabase.rpc('get_dashboard_vencimentos', { _target_date })` |
| Tabela "Meus Clientes" filtra `clients` | Usa retorno da RPC de vencimentos |
| Cache nunca invalida | `queryClient.invalidateQueries` após pagamento/quebra |

### 4. Ações na tabela de vencimentos

A tabela de "Meus Clientes" mostra parcelas virtuais do acordo. Os botões de "Pago" e "Quebra" continuam funcionando, chamando as funções existentes (`markAsPaid`, `markAsBroken`) que atuam nos registros da tabela `clients`.

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Criar RPCs `get_dashboard_stats` e `get_dashboard_vencimentos` |
| `src/pages/DashboardPage.tsx` | Refatorar para usar RPCs; remover `fetchClients`; simplificar lógica |

## Resultado Esperado
- Métricas refletem **apenas acordos formalizados** no Rivo
- Sem limite de 1000 linhas — cálculos feitos no banco
- Vencimentos mostram parcelas do acordo (virtuais), não títulos importados
- Performance superior — retorna ~10 números + ~5-20 linhas de vencimentos
- Cache invalidado corretamente após ações

