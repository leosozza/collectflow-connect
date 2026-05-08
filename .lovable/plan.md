## Diagnóstico

O dashboard usa `h-full overflow-hidden` no root + grid de 2 linhas com altura fixa (`grid-rows-[minmax(0,1fr)_minmax(0,1.4fr)]`). Em monitores menores (17", tipicamente 1366×768 ou 1600×900) a soma de paddings, alturas mínimas dos cards e densidade dos textos passa do espaço disponível e os cards são cortados (Visão 360 mostra só 2-3 linhas, header dos cards "espreme" os badges, tabela de parcelas perde linhas).

Restrição: **não podemos adicionar barra de rolagem**. Solução = densidade adaptativa que sempre cabe na viewport.

## Estratégia

Criar 3 níveis de densidade automáticos baseados em breakpoint + altura disponível:

| Tier | Gatilho | Comportamento |
|---|---|---|
| **Compacto** | `lg` (1024-1279px) **ou** altura < 800px | Padding reduzido, fontes -10%, charts mais baixos, tabela com menos linhas visíveis |
| **Padrão** | `xl` (1280-1535px) | Densidade atual |
| **Confortável** | `2xl+` (≥1536px) | Espaços generosos como hoje no monitor grande |

Tudo continua `overflow-hidden` (sem scrollbar). Quem se adapta é a densidade interna.

## Mudanças propostas

### 1. `src/components/AppLayout.tsx` (linha 391)

Reduzir padding do `<main>` em telas baixas/médias:
- Antes: `p-4 lg:p-6`
- Depois: `p-3 xl:p-4 2xl:p-6`

Ganha ~16-32px de altura útil.

### 2. `src/pages/DashboardPage.tsx` (linha 272)

Ajustar grid para reagir mais cedo + gap menor:
- `gap-3` → `gap-2 xl:gap-3`
- Adicionar uma classe `dashboard-compact` no root quando `xl` não bate, controlando densidade dos filhos via CSS (token `--dash-scale`).

Header (linha 206): em `lg` esconder o subtítulo "Bem-vindo, ..." e reduzir botões para `h-7 text-[11px]`.

### 3. Cards individuais — reduzir densidade no breakpoint `lg`

Aplicar utilitários responsivos (`lg:` para compacto, `xl:` para padrão):

- **`DashboardMetaCard.tsx`**: reduzir tamanho do gauge (de `w-44 h-44` → `lg:w-32 lg:h-32 xl:w-44 xl:h-44`), padding `lg:p-2 xl:p-3`.
- **`TotalRecebidoCard.tsx`**: valor principal de `text-[26px]` → `lg:text-[20px] xl:text-[26px]`; chart altura mínima reduzida; legenda esconde texto em `lg`, mantém só pontos.
- **`KpisGridCard.tsx` (Tile)**: número grande de `text-[34px] lg:text-[40px] xl:text-[44px]` → `text-[26px] xl:text-[34px] 2xl:text-[40px]`; padding `lg:px-2 lg:py-2 xl:px-3 xl:py-3`.
- **`Visao360Card.tsx`**: barras mais baixas, espaço entre itens reduzido, fonte do valor `lg:text-sm xl:text-base`.
- **`ParcelasProgramadasCard.tsx`**: linha da tabela `py-1.5` em `lg`, fonte `text-xs`, esconder coluna "Credor" abaixo de `xl` (já temos nome + parcela + valor + status), badges menores.
- **`AgendamentosHojeCard.tsx`**: padding e ícone menores em `lg`.

### 4. Densidade dos headers dos cards (`DashboardCardHeader.tsx`)

Reduzir altura do header (`py-2.5 lg:py-1.5 xl:py-2.5`) e fonte do título (`text-sm lg:text-xs xl:text-sm`). Ganha 8-12px por card × 6 cards.

### 5. Validação visual

Testar nas larguras-alvo após a mudança:
- 1366×768 (notebook 14")
- 1600×900 (monitor 17" típico)
- 1920×1080 (Full HD)
- 2560×1440 (monitor grande atual do usuário)

Em todas: nenhum scrollbar interno, todos os cards visíveis com conteúdo legível, tabela de parcelas com pelo menos 5 linhas.

## Itens fora deste plano

- Mobile/tablet (< 1024px): o dashboard já cai pra `grid-cols-1` empilhado e essa parte continua igual (com scroll natural da página, fora do escopo "sem scrollbar" que vale para desktop).
- Refazer cards individuais ou mudar gráficos.
- Mudar a ordem/visibilidade dos blocos.

## Arquivos tocados

- `src/components/AppLayout.tsx`
- `src/pages/DashboardPage.tsx`
- `src/components/dashboard/DashboardCardHeader.tsx`
- `src/components/dashboard/DashboardMetaCard.tsx`
- `src/components/dashboard/TotalRecebidoCard.tsx`
- `src/components/dashboard/KpisGridCard.tsx`
- `src/components/dashboard/Visao360Card.tsx`
- `src/components/dashboard/ParcelasProgramadasCard.tsx`
- `src/components/dashboard/AgendamentosHojeCard.tsx`
