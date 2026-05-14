## Objetivo
Padronizar a página `/analytics` com o mesmo visual de navegação dos Cadastros (tabs horizontais com ícone + sublinhado primary), expor cada aba como rota própria, simplificar a barra de filtros (uma linha só) e remover o cabeçalho "Analytics" duplicado.

---

## 1. Rotas por aba

Em `src/App.tsx`, transformar a rota única em rotas filhas:

```text
/analytics                  → redirect para /analytics/receita
/analytics/receita
/analytics/funil
/analytics/performance      (Operadores)
/analytics/canais
/analytics/qualidade
/analytics/inteligencia
```

- `AnalyticsPage` passa a ler a aba ativa do `useParams()` (ou do último segmento da URL) em vez do `useUrlState("tab")`.
- Trocar cliques de aba por `navigate(`/analytics/${key}`)`.
- Manter os demais filtros em querystring (`?from`, `?to`, `?credores`, `?operators`).

## 2. Visual das abas (padrão sistema)

Substituir o `<Tabs>` shadcn atual por uma `<nav>` horizontal idêntica à de `CadastrosPage` (linhas 113‑132): botões com ícone + label, fundo `bg-primary/10`, borda inferior `border-b-[3px] border-primary` na ativa, separador `border-b border-border`.

Ícones mantidos: `DollarSign`, `Filter`, `Users`, `MessageSquare`, `ShieldAlert`, `Brain`.

## 3. Barra de filtros — uma linha

Em `src/components/analytics/AnalyticsFiltersBar.tsx`:

- **Remover** a linha "Período rápido" e os presets `7d / 30d / 90d / Mês atual` (incluindo o array `presets` e `activePreset`).
- **Manter** em uma única linha (`flex flex-nowrap items-center gap-2 overflow-x-auto`):
  1. Botão "← Mês anterior" (decrementa `dateFrom`/`dateTo` para o mês anterior completo).
  2. Botão "Mês atual" (volta para `startOfMonth(today)` → `today`).
  3. Date picker "De".
  4. Date picker "Até".
  5. MultiSelect Credores.
  6. MultiSelect Operadores (oculto para operador).
  7. MultiSelect Canais / Score continuam condicionais por aba, no mesmo flex.
- Padding e bordas iguais ao card de filtros do sistema (`bg-card rounded-xl border border-border p-3`).

## 4. Default ao entrar = mês atual

Em `src/hooks/useAnalyticsFilters.ts`:

- Trocar default `dateFrom` de `daysAgo(30)` para `format(startOfMonth(new Date()), "yyyy-MM-dd")`.
- `dateTo` permanece `today()`.

## 5. Remover cabeçalho "Analytics" duplicado

`AppLayout` já injeta o título "Analytics" no topo. Em `AnalyticsPage.tsx` remover o bloco:

```tsx
<div className="flex items-center gap-2">
  <Button …><ArrowLeft/></Button>
  <h1 className="text-xl font-bold">Analytics</h1>
</div>
```

(mantendo apenas o banner amarelo do modo suporte quando aplicável).

---

## Detalhes técnicos

- **Sem mudança de RPC ou backend** — somente UI/roteamento.
- `useUrlState("tab")` é descontinuado; manter retrocompatibilidade redirecionando `/analytics?tab=funil` → `/analytics/funil` no `useEffect` inicial.
- `restrictToSelf` / `isOperator` / `scopedRpcParams` permanecem inalterados.
- Mês anterior: usar `subMonths(parseISO(dateFrom), 1)` → `startOfMonth` e `endOfMonth` daquele mês.
- A11y: cada botão de aba recebe `aria-current="page"` quando ativo.

## Arquivos a editar

- `src/App.tsx` — rotas filhas de `/analytics`.
- `src/pages/AnalyticsPage.tsx` — nav horizontal estilo Cadastros, leitura de aba via rota, remoção do h1 duplicado.
- `src/components/analytics/AnalyticsFiltersBar.tsx` — remover presets, adicionar Mês anterior/atual, layout uma linha.
- `src/hooks/useAnalyticsFilters.ts` — default = mês atual.

## Validação

1. `/analytics` redireciona para `/analytics/receita`.
2. Cada aba muda a URL e mantém filtros na query.
3. Default abre no mês corrente; "Mês anterior" navega corretamente.
4. Filtros em uma única linha em 1326px (viewport atual).
5. Visual das abas idêntico ao screenshot anexado.
