

# Corrigir exibição dos valores do Dashboard

## Diagnóstico

Após análise detalhada dos dados:

- **Recebido (R$ 6.125,17)** — CORRETO. Já inclui os R$ 2.658,74 dos 4 acordos quitados no mês. Os pagamentos foram registrados como eventos e são contabilizados.
- **Pendente (R$ 10.712,07)** — CORRETO no cálculo (parcelas que vencem no mês menos o que já foi recebido).
- **Negociado / Total de Primeira Parcela (R$ 19.042,51)** — soma apenas a PRIMEIRA parcela de cada acordo criado no mês.

O problema é que **"Negociado" e "Pendente" medem coisas diferentes**: Negociado = primeira parcela de acordos criados no mês. Pendente = TODAS as parcelas com vencimento no mês. Por isso a soma Recebido + Pendente não bate com Negociado — **nunca deveria bater, são métricas distintas**.

## Solução proposta

Reverter a migration anterior (que não causou dano mas é desnecessária) e melhorar a **clareza visual** do dashboard para eliminar a confusão:

### 1. Reverter a migration anterior
Remover `'completed'` do filtro de Pendente, voltando para `('pending', 'approved', 'overdue')`. Isso não altera os valores finais (a subtração neutralizava), mas mantém a semântica correta: pendente = parcelas de acordos que ainda não foram quitados.

### 2. Adicionar card "Quitados no Mês"
Adicionar um novo card no dashboard mostrando o valor total dos acordos completados no mês (~R$ 2.658). Isso torna visível a parcela que "desaparecia" e permite ao usuário entender a decomposição:

```
Negociado = Recebido (inclui quitados) + Pendente (acordos ativos) + diferença de bases*
```

### 3. Adicionar tooltip explicativo
Nos cards "Negociado" e "Pendente", adicionar tooltips curtos explicando o que cada métrica mede:
- Negociado: "Soma da primeira parcela dos acordos criados no mês"
- Pendente: "Parcelas com vencimento no mês, menos os valores já recebidos"

## Alterações técnicas

- **1 migration SQL**: Reverter filtro de Pendente + adicionar retorno de `_quitados` na RPC
- **1 arquivo frontend**: `src/pages/DashboardPage.tsx` — adicionar card "Quitados" e tooltips

