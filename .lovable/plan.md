## Objetivo

Atualizar o card "Total Recebido" para exibir um gráfico de onda mostrando o recebimento diário do **mês atual**, e adicionar uma comparação percentual com o **mês anterior** ao lado do valor total — sem alterar o tamanho atual do card.

## Referência visual

Conforme imagem anexada:
- Valor total grande em azul (`R$ 86.153,29`)
- Ao lado direito, badge verde/vermelho: `+24% vs mês anterior`
- Gráfico de onda (área com gradiente azul) abaixo do valor
- Eixo X com dias do mês (01, 04, 07, 10, 13, 16, 19, 22, 25)

## Mudanças

### 1. `src/components/dashboard/TotalRecebidoCard.tsx`

**Período da série (gráfico):**
- Trocar a janela atual de "últimos 30 dias" para o **mês corrente** (do dia 01 até hoje), gerando buckets dia a dia.
- Labels do eixo X passam a mostrar dias do mês (01, 04, 07, …).

**Busca do mês anterior (apenas total, não série):**
- Calcular `prevStart` = primeiro dia do mês anterior e `prevEnd` = último dia do mês anterior.
- Consultar `manual_payments` (status `approved`) e `portal_payments` (status `paid`) filtrando pelo intervalo do mês anterior.
- Somar tudo em `prevMonthTotal`.

**Cálculo do percentual:**
```ts
const diffPct = prevMonthTotal > 0
  ? ((totalRecebido - prevMonthTotal) / prevMonthTotal) * 100
  : null; // se mês anterior = 0, mostrar "—" ou "novo"
```

**UI — header de valor (sem alterar dimensões do card):**
- Manter a estrutura atual (`Total Recebido` label + valor grande).
- Adicionar, **na mesma linha do valor** (`flex items-baseline gap-2`), um pequeno badge:
  - Cor verde (`text-emerald-600`) com seta `TrendingUp` se `diffPct >= 0`
  - Cor vermelha (`text-red-600`) com seta `TrendingDown` se `diffPct < 0`
  - Texto: `+24% vs mês anterior` / `-12% vs mês anterior`
  - Quando não houver dados do mês anterior: `— vs mês anterior` discreto
- Tipografia compacta (`text-xs font-medium`) para não quebrar layout em telas menores.

**Gráfico:**
- Mantém `AreaChart` com gradiente atual e altura existente (`h-[110px] sm:h-[130px]`).
- Ajustar `interval` do XAxis para mostrar ~9 marcações (01, 04, 07, …) usando `Math.ceil(series.length / 9)`.

**Tooltip:**
- Continua formatando como `dd/MM/yyyy` e valor em moeda.

### 2. Remover seletor "Mensal" redundante (opcional)
Como o card passa a ser fixo no mês corrente, o `<Select>` "Mensal" no header perde função. Substituir por um badge discreto com o nome do mês atual (ex.: "Abril/2026") ou simplesmente remover, mantendo só o título "Total Recebido". **Sugestão:** remover para ficar igual à referência visual.

## Detalhes técnicos

- Usar `startOfMonth`, `endOfMonth`, `subMonths` do `date-fns` (já é dependência do projeto).
- Adicionar `prevMonthTotal` numa segunda `useQuery` separada (`queryKey: ["dashboard-recebido-prev-month", tenantId]`) para cache independente.
- Não alterar `DashboardPage.tsx` — `totalRecebido` continua vindo por prop.
- Manter compatibilidade com `fetchAllRows` se o volume exigir (atualmente usa `.select` direto, suficiente para 1 mês de pagamentos).
- Ícones: importar `TrendingDown` adicionalmente do `lucide-react`.

## Fora de escopo

- Não alterar dimensões, paddings ou posição do card no grid.
- Não alterar os demais cards do dashboard.