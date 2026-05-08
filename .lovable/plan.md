## Refinamento visual do Dashboard — padrão RIVO

Aplicar o padrão visual do header escuro do card "META DA EQUIPE" a todos os cards, melhorar legibilidade, reduzir espaçamento e reorganizar blocos. **Sem alterar lógica/RPCs/dados** — apenas UI.

### 1. Header padronizado (escuro RIVO)

Criar componente reutilizável `src/components/dashboard/DashboardCardHeader.tsx`:
- Fundo `bg-secondary` (escuro RIVO), texto `text-white/95`
- Ícone em chip `bg-primary/15 ring-1 ring-primary/30` com cor `text-primary`
- Título em uppercase `tracking-[0.04em]` 12px
- Slot direito para badges/legendas/chips (mês, contadores)
- Mesmo header já usado em `DashboardMetaCard`; extrair para reuso.

Aplicar nos cards:
- `TotalRecebidoCard` — slot direito = legenda "Atual / Mês anterior"
- `ParcelasProgramadasCard` — slot direito = chips "A receber" / "Recebido" (mantém cores azul/verde)
- `AgendamentosHojeCard` — slot direito = badge contador
- `Visao360Card` — slot direito = label do mês
- `KpisGridCard` — cada tile recebe um header escuro compacto (ou se mantém estilo orange-strip atual; ver seção 4)

### 2. `DashboardMetaCard` — melhorar legibilidade

- Aumentar footer "Recebido" / "Faltam":
  - Label: `text-[11px]` (era 10px)
  - Valor: `text-base font-bold` tabular-nums (era 10px)
  - Footer com `py-2.5` e separador mais nítido
- Manter chip "Colchão" como está (já destacado).

### 3. `Visao360Card` — repaginar mantendo essência

- Aplicar header escuro padrão.
- Substituir 3 barras horizontais finas por **layout de 3 linhas tipo "stat row"**:
  - Cada linha: ícone colorido + label + barra mais grossa (h-2.5) + valor à direita destacado.
  - Gap maior, melhor hierarquia.
- Remover legenda redundante do rodapé (já visível em cada linha).
- Cores: primary (provisionado), amber (pendentes), red (quebra) via tokens HSL no `index.css` se ainda não existirem (`--warning`, `--destructive` já existem; usar `hsl(var(--destructive))` e adicionar `--warning` se faltar).

### 4. `KpisGridCard` — manter números grandes, adicionar cor

- Manter layout vertical (3 tiles empilhados) e tamanhos de fonte do número (texto 34–44px atual, agradou).
- Adicionar gradiente sutil de fundo por tile usando token primário (`bg-gradient-to-br from-primary/5 to-transparent`) e borda esquerda colorida 3px (substitui a barrinha atual).
- Header de cada tile fica com mini-faixa escura no topo (versão compacta do header padrão) — opcional, ou manter o atual layout limpo. **Decisão:** manter sem header escuro nos tiles (são KPIs unitários, header escuro polui); aplicar apenas tinta/gradiente leve.

### 5. Reorganização do grid

Trocar posição de **Agendamentos** ↔ **Visão 360**:

```text
Linha 1: [Meta 3col]            [TotalRecebido 6col]    [KpisGrid 3col]
Linha 2: [Visão 360 3col]       [Parcelas 6col]         [Agendamentos 3col]
```

Ajustar `lg:col-start` em `DashboardPage.tsx`:
- `visao360`: `lg:col-start-1 lg:row-start-2`
- `agendamentos`: `lg:col-start-10 lg:row-start-2`

### 6. Redução de espaçamento

- Padding interno dos cards: `p-4` → `p-3` onde aplicável.
- Gap do grid principal: manter `gap-3`.
- Cards com listas (Parcelas, Agendamentos): reduzir `pt-3` do header para `pt-2` (header escuro já dá respiro visual).

### Arquivos afetados (apenas UI)

- `src/components/dashboard/DashboardCardHeader.tsx` (novo, reutilizável)
- `src/components/dashboard/DashboardMetaCard.tsx` (refatorar para usar header novo + footer maior)
- `src/components/dashboard/TotalRecebidoCard.tsx` (header novo, mantém chart)
- `src/components/dashboard/ParcelasProgramadasCard.tsx` (header novo, chips no slot)
- `src/components/dashboard/AgendamentosHojeCard.tsx` (header novo)
- `src/components/dashboard/Visao360Card.tsx` (repaginar layout interno + header novo)
- `src/components/dashboard/KpisGridCard.tsx` (gradiente sutil + borda colorida)
- `src/pages/DashboardPage.tsx` (swap visao360 ↔ agendamentos no grid)
- `src/index.css` (adicionar token `--warning` se ausente)

### Não-objetivos

- Não mexer em RPCs / SQL / dados.
- Não alterar comportamento de filtros, navegação ou permissões.
- Não adicionar/remover métricas.
- Manter responsividade atual (`lg:` breakpoints inalterados; mobile continua coluna única).
