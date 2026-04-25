## Objetivo

Reformular a barra de filtros da página `/financeiro/baixas` para seguir o padrão visual da imagem anexada: filtros principais em uma linha (controles arredondados e leves) e busca + ação Excel em uma segunda linha.

## Layout final (em `src/pages/financeiro/BaixasRealizadasPage.tsx`)

### Linha 1 — Filtros principais (espelha a imagem)
`Todos os Credores` · `Todos os Operadores` · `Ano` · `Mês (multi)` · `De` · `Até`

- Controles com `h-10`, `rounded-xl`, fundo `bg-muted/40` (sem borda forte) — padrão `Select`/`Button outline` do shadcn já disponível, ajustado via classes.
- **Ano**: `Select` populado dinamicamente com os anos presentes nas linhas (fallback: ano atual ± 2).
- **Mês**: `DropdownMenu` com checkboxes (Jan…Dez) permitindo seleção múltipla. Rótulo do trigger:
  - Vazio/12 marcados → "Todos os meses"
  - 1 marcado → nome do mês (ex.: "Abril")
  - N marcados → "N meses"
- **De / Até**: continuam como `Popover` + `Calendar` (já existem). Se preenchidos, **prevalecem** sobre Ano/Mês; se ambos limpos, o range vem de Ano + Meses selecionados.

### Linha 2 — Busca + ações
- Input de busca ocupando toda a largura (ícone de lupa à esquerda), `h-10 rounded-xl bg-muted/40`.
- Botão **Excel** à direita (substitui o botão "Exportar" do header), `variant="outline"`, ícone `Download`.

### Linha 3 (opcional, discreta) — Filtros secundários
Mantemos `Local de Pagamento` e `Meio de Pagamento` como Selects compactos abaixo, para não perder funcionalidade. Mesmo estilo da linha 1.

### Header
- Remover o botão "Exportar" do topo (passa a ser o botão "Excel" da linha 2).
- Manter título "Baixas Realizadas" + subtítulo.

## Mudanças de estado

```ts
const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
const [yearFilter, setYearFilter] = useState<string>(String(today.getFullYear()));
const [monthsFilter, setMonthsFilter] = useState<number[]>([today.getMonth()]); // 0-11
```

`effectiveRange` (memo): se `dateFrom`/`dateTo` definidos, usa-os; senão deriva de `yearFilter` + `monthsFilter` (min mês → `startOfMonth`, max mês → `endOfMonth`). É esse range que vai para a RPC `get_baixas_realizadas`.

## Fora de escopo
- Sem alteração na RPC, na lógica de cálculo, na tabela ou no agrupamento por mês.
- Filtro de Operador (já corrigido na iteração anterior) permanece igual.