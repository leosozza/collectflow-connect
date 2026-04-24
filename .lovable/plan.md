## Refino Visual do Dashboard

Apenas ajustes de UI/UX — nenhuma query, RPC, hook, fluxo de dados ou estrutura JSX será alterada. Identidade laranja preservada como cor dominante.

---

### 1. ParcelasProgramadasCard
Arquivo: `src/components/dashboard/ParcelasProgramadasCard.tsx`

- Header de navegação "HOJE": trocar `bg-primary` (laranja) por azul `bg-blue-600` (#2563EB), texto branco, hover `hover:bg-blue-700` (#1D4ED8) nos botões de seta.
- Aumentar respiro das linhas da tabela: `py-3.5` → `py-4`, padding horizontal `px-4` consistente em todas as células (header e body).
- Linhas com divisor mais sutil (`border-border/30`).
- Nome do cliente: manter `text-primary` (laranja) e adicionar `hover:underline underline-offset-2` (já existe `hover:underline`, garantir offset suave).
- Padronizar borda do card (ver item 6).

### 2. TotalRecebidoCard
Arquivo: `src/components/dashboard/TotalRecebidoCard.tsx`

- Valor principal: aumentar de `text-2xl` para `text-3xl`, label "Total Recebido" mais leve (`text-muted-foreground/80`).
- Gráfico (já é AreaChart):
  - Trocar `stroke="hsl(var(--primary))"` (laranja) por azul suave `#3b82f6`.
  - Ajustar gradiente para azul: stop 0% `#3b82f6` opacity 0.35 → stop 100% `#3b82f6` opacity 0.02.
  - Aumentar `strokeWidth` para 2.5 e curva mais suave (`type="monotone"` mantido).
  - Tooltip cursor em azul.
- Aumentar leve respiro vertical no header.

### 3. DashboardMetaCard + MetaGaugeCard
Arquivos: `src/components/dashboard/DashboardMetaCard.tsx`, `src/components/dashboard/MetaGaugeCard.tsx`

- Reduzir `size` do gauge de 180 para 160 no DashboardMetaCard (card mais compacto).
- Ajustar padding do container do gauge: `p-2.5` → `p-3` com `flex items-center justify-center` para centralizar.
- Blocos "Meta" / "Realizado": melhor alinhamento com `gap-3`, padding `p-2.5`, fundo levemente mais claro (`bg-muted/30` ao invés de `bg-primary/5`/`bg-success/5` — manter borda colorida sutil).
- Cores principais do gauge (laranja/verde/azul/vermelho por banda) preservadas.

### 4. AgendamentosHojeCard
Arquivo: `src/components/dashboard/AgendamentosHojeCard.tsx`

- Compactar: `py-2` nas células → `py-2.5` (mantendo compacto mas alinhado), reduzir fonte do nome para `text-[12px]`.
- Padronizar padding horizontal `px-4` em todas as colunas (atualmente mistura `px-2`/`px-4`).
- Estado vazio: ícone discreto + texto centralizado (substituir bloco simples por mini-empty-state com ícone `CalendarCheck` em círculo `bg-muted/40`).
- Header: reduzir `pt-4 pb-2` → `pt-3 pb-2`.

### 5. Cards Superiores (KPIs)
Arquivo: `src/pages/DashboardPage.tsx` (bloco entre linhas 293–333)

- Padronizar todos para o mesmo template visual (os 3 KPIs inline e os 4 `StatCard` têm variações):
  - Mesmo padding `px-4 py-3.5`.
  - Ícone com fundo leve (`rounded-lg p-2`) em todos.
  - Valor: `text-xl font-bold text-foreground` (mais forte).
  - Label: `text-[11px] text-muted-foreground/80 uppercase tracking-wide` (mais leve).
- Em `StatCard.tsx`: alinhar tipografia do valor (já `text-lg` → `text-xl`) e label (`text-[10px]` → `text-[11px]`).
- Garantir que "Colchão de Acordos" use o mesmo template — sem mudanças de ícone ou semântica.

### 6. Sombra, borda e radius (padronização)
Aplicar uniformemente em todos os cards do dashboard:
- `border border-border` (#E5E7EB equivalente via token) — substituir variações `border-border/60`.
- `rounded-xl` (12px) — já consistente.
- `shadow-sm` — já consistente; remover `hover:shadow-md` do StatCard para uniformidade visual estática.

### 7. Espaçamento geral do grid
Arquivo: `src/pages/DashboardPage.tsx`

- Grid de KPIs superiores: `gap-2` → `gap-3` (respiro uniforme).
- Grid principal (parcelas + coluna direita): `gap-4` mantido; coluna direita `gap-3` → `gap-4` para uniformidade.
- Ajustar `flex-col gap-4` raiz mantido.

---

### Fora do escopo (NÃO alterar)
- Nenhuma query/RPC/Supabase.
- Nenhum hook (`useScheduledCallbacks`, `useDashboardLayout`, etc.).
- Nenhuma lógica de filtros, navegação, layout customizável, permissões.
- Estrutura de colunas e ordem dos blocos preservada.
- Identidade laranja (`--primary`) permanece dominante; azul aparece apenas no header "HOJE" e no gráfico de Total Recebido (conforme solicitado).

### Arquivos editados
- `src/pages/DashboardPage.tsx`
- `src/components/dashboard/ParcelasProgramadasCard.tsx`
- `src/components/dashboard/TotalRecebidoCard.tsx`
- `src/components/dashboard/DashboardMetaCard.tsx`
- `src/components/dashboard/MetaGaugeCard.tsx`
- `src/components/dashboard/AgendamentosHojeCard.tsx`
- `src/components/StatCard.tsx`
