# Redesign "Parcelas Programadas"

Reformatar visualmente o card no Dashboard para seguir o padrão da imagem de referência, **mantendo as informações atuais**: Nome (cliente) · Credor · Valor · Status.

## O que muda visualmente

1. **Banner de data no topo** (substitui a faixa atual com setas pequenas)
   - Faixa larga em destaque com fundo `bg-primary/10` arredondada (`rounded-xl`)
   - Setas grandes (`ChevronLeft` / `ChevronRight`) nas extremidades, em `text-primary`
   - Label central grande e bold (`text-base font-bold text-primary tracking-wide`) exibindo `HOJE` ou `dd/MM/yyyy`
   - Clique no label continua abrindo o `GlassCalendar` (Popover)

2. **Cabeçalho "Parcelas Programadas"** (linha abaixo do banner)
   - Título à esquerda: `text-lg font-semibold` com ícone `CalendarClock` em `text-primary`
   - À direita, dois badges quadrados pequenos lado a lado:
     - Cinza neutro (`bg-muted text-foreground`) com **total de parcelas** do dia
     - Verde sólido (`bg-success text-success-foreground`) com **parcelas pagas** do dia
   - Remove o badge "Total R$" e o badge composto "X de Y" atuais (a soma R$ não aparece na referência)

3. **Tabela limpa com cabeçalho de colunas**
   - Adiciona `TableHeader` com as 4 colunas: **Nome · Credor · Valor · Status**
   - Headers em `text-xs font-semibold text-muted-foreground uppercase tracking-wide`
   - Linha divisória sutil abaixo do header (`border-b border-border/60`)
   - Linhas com mais respiro vertical (`py-2.5`) e tipografia consistente (`text-sm`)
   - Nome continua como link `text-primary` para `/carteira/:cpf`
   - Credor abreviado (2 primeiras palavras, como hoje)
   - Valor alinhado à direita
   - Sem zebra striping; apenas hover sutil

4. **Status como pills sólidos** (estilo da imagem)
   - Pago → fundo verde sólido `bg-success text-success-foreground` com label **QUITADO**
   - Pendente / Em andamento → fundo cinza claro `bg-muted text-muted-foreground` com label **ANDAMENTO**
   - Atrasado → fundo `bg-destructive text-destructive-foreground` com label **ATRASADO**
   - Formato: `rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wide`, largura fixa para alinhar visualmente

5. **Empty state**
   - Mantém o card no mesmo tamanho (já está com `flex-1 min-h-0`)
   - Mensagem centralizada com ícone discreto, no padrão do `ScheduledCallbacksCard`

## Arquivo afetado

- `src/pages/DashboardPage.tsx` — bloco "Parcelas Programadas" (linhas ~255–344)

## Detalhes técnicos

- Reaproveita componentes já importados (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `Popover`, `GlassCalendar`, `Button`, ícones `lucide-react`)
- Não altera nenhuma lógica de dados (`vencimentos`, `totalVencimentos`, `effective_status`, `navigateDate`, `browseDate`)
- Mantém scroll interno apenas na lista (`overflow-auto flex-1`) — sem scroll de página
- Tokens semânticos (`bg-primary`, `bg-success`, `bg-muted`, `bg-destructive`, `text-*-foreground`) — sem cores hard-coded
- Sem mudanças em outros cards do dashboard
