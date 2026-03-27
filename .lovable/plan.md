

# Plano: Corrigir cálculos no Analytics

## Problemas

### 1. Taxa de Conversão — dupla contagem no denominador
```
totalAtivos = vigentes + pendentes + vencidos + acordosComPagamento
```
Um acordo `approved` com `total_pago > 0` é contado em `vigentes` E em `acordosComPagamento`. O denominador fica inflado e a taxa cai artificialmente.

**Correção**: `totalAtivos` deve ser o total de acordos ativos (sem cancelados), sem somar `acordosComPagamento` separadamente:
```
totalAtivos = activeAgreements.length
taxaConversao = (acordosComPagamento.length / totalAtivos) * 100
```

### 2. Distribuição de Status — nomenclatura inconsistente
O status `pending` no banco significa "Acordo Vigente" (como padronizamos), mas o gráfico mostra como "Pendentes". E `approved` mostra como "Vigentes". Na prática os dois representam acordos vigentes.

**Correção**: Unificar `pending` e `approved` como "Acordo Vigente" no gráfico de pizza:
```
{ name: "Acordo Vigente", value: vigentes.length + pendentes.length }
{ name: "Pagos", value: pagos.length }
{ name: "Vencidos", value: vencidos.length }
{ name: "Cancelados", value: cancelados.length }
```
E atualizar `STATUS_LABELS` e `STATUS_COLORS` conforme.

### 3. Taxa de Recuperação — verificar se RPC retorna dados corretos
O cálculo `totalRecebido / totalNegociado` está conceitualmente correto. Preciso apenas confirmar que a RPC `get_analytics_payments` está retornando `total_pago` para o filtro de credor selecionado (MAXFAMA).

## Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/pages/AnalyticsPage.tsx` | Corrigir fórmula `totalAtivos`, unificar status `pending`+`approved` como "Acordo Vigente" no pie chart |

