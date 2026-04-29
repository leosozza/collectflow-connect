## Diagnóstico

Inspecionei as assinaturas reais das RPCs (via `pg_proc`) e os dados retornados para o tenant Y.BRASIL nos últimos 30 dias.

### 1. Aba Inteligência — bug confirmado (mismatch de campos)

| RPC | Campos esperados pelo componente | Campos reais retornados |
|---|---|---|
| `get_bi_score_distribution` | `score_band`, `qtd_clientes` | **`bucket`**, **`qtd`**, `pct`, `valor_carteira` |
| `get_bi_score_vs_result` | `score_band`, `qtd_acordos`, `qtd_quebras`, `taxa_conversao`, `taxa_quebra`, `total_recebido` | **`bucket`**, `qtd_clientes`, **`qtd_com_acordo`**, **`taxa_acordo`**, **`qtd_pagos`**, **`taxa_pagamento`**, **`valor_recebido`** (não há quebras nesta RPC) |
| `get_bi_top_opportunities` | `score`, `valor_em_aberto`, `ultimo_contato_at` | **`propensity_score`**, **`valor_atualizado`**, **`ultimo_contato`** |

Dados reais existem (ex: `bucket=0-20, qtd=10614, pct=2.44`), só não renderizavam por causa das chaves erradas.

### 2. Aba Performance — sem bug

`get_bi_operator_efficiency` retorna exatamente os campos esperados (`talk_time_seconds`, `qtd_chamadas`, `qtd_conversoes`, `conv_rate`, `acordos_por_hora`). Todos os 6 operadores vêm com **0** — é **ausência real de dados de telefonia** no período (nenhuma chamada registrada). Componente não será alterado.

## Plano de Correção

**Único arquivo a editar:** `src/components/analytics/tabs/IntelligenceTab.tsx`

1. **Gráfico "Distribuição por Faixa de Score"**
   - `XAxis dataKey="score_band"` → `"bucket"`
   - `Bar dataKey="qtd_clientes"` → `"qtd"`

2. **Tabela "Score vs Resultado"** — reescrever colunas para os campos reais:
   - Faixa (`r.bucket`)
   - Clientes (`r.qtd_clientes`)
   - Com Acordo (`r.qtd_com_acordo`)
   - Taxa Acordo (`r.taxa_acordo` %)
   - Pagos (`r.qtd_pagos`)
   - Taxa Pagamento (`r.taxa_pagamento` %)
   - Recebido (`r.valor_recebido`)
   - Removidas as colunas "Quebras" e "Taxa Quebra" (não existem nesta RPC).

3. **Tabela "Top Oportunidades"**
   - `r.score` → `r.propensity_score`
   - `r.valor_em_aberto` → `r.valor_atualizado`
   - `r.ultimo_contato_at` → `r.ultimo_contato`

## Não-mudanças (confirmação explícita)

- ❌ RPCs não serão alteradas
- ❌ Receita, Funil, Performance, Canais, Qualidade não serão tocadas
- ❌ Layout/cards/cores/filtros não mudam
- ❌ Nenhuma nova feature, nenhum novo gráfico
- ❌ `PerformanceTab.tsx` não será alterado (dados realmente zerados na origem)

## Validação pós-correção

- Build automático
- Recarregar aba Inteligência (Y.BRASIL, 30 dias) e confirmar:
  - Barras visíveis com labels `0-20, 21-40, ..., sem_score`
  - Coluna "Faixa" preenchida na tabela
  - Top Oportunidades exibindo score e valor

## Relatório que será entregue após a correção

- Lista de arquivos alterados (apenas 1)
- Antes/depois das chaves
- Confirmação de que as outras 5 abas não foram tocadas
