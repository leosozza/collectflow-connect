## Ajustes Finais — Dashboard

Análise do estado atual revelou 3 problemas pós-refino:

1. **Colchão de Acordos sumiu**: removido na última passada. Era um KPI baseado em `stats.total_projetado` (já retornado pela RPC `get_dashboard_stats`). Os 6 KPIs atuais não o incluem.
2. **Total Recebido / Meta do Mês / Agendamentos cortados**: a coluna direita usa `overflow-y-auto` dentro de `flex-1 min-h-0`. Como cada card tem altura natural grande (chart 130px + Meta gauge 160px + tabela 160px), o conteúdo total estoura a altura disponível e os cards aparecem cortados sem rolagem clara. Além disso, os top KPIs estão ocupando muito espaço vertical (`px-5 py-4` + ícone 40px + valor 26px + trend), reduzindo o espaço da área principal.
3. **Parcelas Programadas grande demais**: linhas com `py-4` + header com 4px = ocupa muito espaço vertical em telas 1431x876.

---

### 1. Restaurar "Colchão de Acordos" no topo

Arquivo: `src/pages/DashboardPage.tsx`

- Adicionar como **7º KPI** no array `kpis` (após "Pendentes"):
  - `label: "Colchão de Acordos"`
  - `value: formatCurrency(stats?.total_projetado ?? 0)`
  - `Icon: Wallet` (importar de lucide-react)
  - `iconColor: "text-indigo-500"`, `iconBg: "bg-indigo-500/10"`
  - sem `trend` (ou trend neutro)
- Atualizar `interface DashboardStats` já contém `total_projetado` ✓.
- Ajustar grid de KPIs: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` → `grid-cols-2 sm:grid-cols-4 lg:grid-cols-7` para acomodar 7 cards alinhados em uma linha em telas grandes.

### 2. Compactar KPIs do topo (alinhar tudo na mesma linha visual)

Arquivo: `src/pages/DashboardPage.tsx` (bloco linhas 322–352)

- Padding: `px-5 py-4` → `px-4 py-3`.
- Ícone: caixa `p-2.5` → `p-2`, ícone `w-5 h-5` → `w-4 h-4`, margem `mb-4` → `mb-2.5`.
- Label: `text-[12.5px] mb-1.5` → `text-[11px] mb-1`.
- Valor: `text-[26px]` → `text-[20px]` (cabe melhor em 7 colunas).
- Trend: `mt-4` → `mt-2.5`, `text-[11.5px]` → `text-[10.5px]`.
- Resultado: cards mais baixos, todos com altura uniforme, liberando ~40px verticais para a área principal.

### 3. Corrigir corte da coluna direita (Total Recebido / Meta / Agendamentos)

Arquivo: `src/pages/DashboardPage.tsx` (linhas 367–376)

- Trocar a coluna direita de `flex flex-col gap-4 min-h-0 h-full overflow-y-auto pr-1` por `flex flex-col gap-3` (sem altura fixa — deixa o conteúdo fluir naturalmente).
- Trocar o grid principal de `items-stretch flex-1 min-h-0` por `items-start` para que ParcelasProgramadas e a coluna direita não sejam forçadas à mesma altura.
- Remover `h-full min-h-0` do wrapper de `ParcelasProgramadasCard` (linha 357) → manter apenas `flex flex-col`.
- Em `ParcelasProgramadasCard.tsx`: trocar root `h-full min-h-0 flex flex-col` por `flex flex-col`, e a tabela `overflow-auto flex-1` para `overflow-auto max-h-[420px]` (limita altura, evita estourar).

### 4. Compactar Parcelas Programadas

Arquivo: `src/components/dashboard/ParcelasProgramadasCard.tsx`

- Linhas da tabela: `py-4` → `py-2.5` em todas as 4 células (linhas 138, 146, 149, 152).
- Header da tabela: `h-10` → `h-9`.
- Header do card: `pt-4 pb-2` → `pt-3 pb-2`.
- Banner azul HOJE: `py-1.5` mantido, mas botões `h-8 w-8` → `h-7 w-7`, ícones `w-5 h-5` → `w-4 h-4`.
- Limita altura útil para que o card fique mais compacto e alinhado com a altura combinada dos 3 cards da direita.

### 5. Compactar Total Recebido (altura)

Arquivo: `src/components/dashboard/TotalRecebidoCard.tsx`

- Chart container: `h-[110px] sm:h-[130px]` → `h-[90px] sm:h-[110px]`.
- Header `pt-4 pb-3` → `pt-3 pb-2`.
- Valor `text-3xl` → `text-2xl` (mais alinhado com o tamanho dos demais).

### 6. Compactar Meta do Mês

Arquivo: `src/components/dashboard/DashboardMetaCard.tsx`

- Gauge `size={160}` → `size={140}`.
- Container do gauge: `p-3` → `p-2`.

### 7. Compactar Agendamentos para Hoje

Arquivo: `src/components/dashboard/AgendamentosHojeCard.tsx`

- `max-h-[160px]` → `max-h-[200px]` (mais respiro vertical).
- Padding rows `py-2.5` mantido.

---

### Resultado Esperado
- **7 KPIs** no topo (incluindo Colchão de Acordos) alinhados em uma única linha, mais compactos.
- **Coluna direita inteira visível** (Total Recebido, Meta, Agendamentos) sem corte.
- **Parcelas Programadas** mais compacta, alinhada visualmente com a altura combinada da coluna direita.
- Identidade laranja preservada; azul mantido apenas no banner HOJE e gráfico.

### Fora do escopo
- Nenhuma alteração de query, RPC, hook ou lógica.
- Ordem dos blocos preservada.

### Arquivos editados
- `src/pages/DashboardPage.tsx`
- `src/components/dashboard/ParcelasProgramadasCard.tsx`
- `src/components/dashboard/TotalRecebidoCard.tsx`
- `src/components/dashboard/DashboardMetaCard.tsx`
- `src/components/dashboard/AgendamentosHojeCard.tsx`
