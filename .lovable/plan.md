## Objetivo

Voltar o Dashboard ao padrão visual da imagem de referência:

```text
┌─────────────────┬──────────────────────────┬──────────────────┐
│  Meta do Mês    │     Total Recebido       │  6 KPIs (3x2)    │
│   (col 1-3)     │       (col 4-9)          │   (col 10-12)    │
├─────────────────┼──────────────────────────┴──────────────────┤
│ Agendamentos    │     Parcelas Programadas (col 4-9)          │
│   (col 1-3)     │     (lado direito vazio – col 10-12)        │
└─────────────────┴─────────────────────────────────────────────┘
```

A altura é fixa (sem scroll global), os 6 KPIs voltam para o estilo "card branco com ícone colorido" (igual ao da imagem), e o **Ticket Médio Dia** sai do Dashboard e vai para a página Analytics.

---

## Mudanças

### 1. Unificar os 6 KPIs em um único bloco (3 colunas × 2 linhas)

Hoje existem dois blocos separados (`KpisOperacionaisCard` com 4 tiles coloridos em gradiente + `KpisFinanceirosCard` com 3 tiles brancos). Vou criar um único componente **`KpisGridCard.tsx`** que renderiza os 6 KPIs no estilo branco da imagem (idêntico ao atual `KpisFinanceirosCard`):

| Tile | Ícone | Cor | Trend |
|---|---|---|---|
| Acionados Hoje | Phone | azul | vs ontem |
| Acordos do Dia | FileText | verde | vs ontem |
| Acordos do Mês | CalendarCheck | azul | vs mês anterior |
| Total de Quebra | TrendingDown | vermelho | vs mês anterior |
| Pendentes | Hourglass | âmbar | vs mês anterior |
| Colchão de Acordos | Wallet | índigo | (sem trend) |

Cada tile mantém o visual atual do `KpisFinanceirosCard.Tile` (ícone com bg suave, label cinza pequeno, valor em bold, trend com cor verde/vermelha + texto "vs ontem"/"vs mês anterior").

### 2. Remover Ticket Médio Dia do Dashboard

- Remover a query `dashboard-ticket-medio-dia` e helpers (`getAgreementTicketBase`, `parseCurrencyLike`, `getCustomInstallmentValue`, `TicketAgreementRow`) do `DashboardPage.tsx`.
- Apagar `KpisOperacionaisCard.tsx` e `KpisFinanceirosCard.tsx` (substituídos pelo novo `KpisGridCard`).

### 3. Mover Ticket Médio Dia para a página Analytics

Em `src/pages/AnalyticsPage.tsx`, adicionar um KPI "Ticket Médio do Dia" junto aos cards de métrica existentes no topo da página, reutilizando a mesma lógica de cálculo (média do `entrada_value` ou primeira parcela dos acordos criados hoje, respeitando os filtros de operador já aplicados na página).

### 4. Ajustar Meta do Mês (apenas dimensões)

Manter o visual atual (gauge laranja + bloco "META R$ ..." + período), mas reduzir as dimensões para caber confortavelmente na coluna ~3/12 (mesma largura da coluna de Agendamentos). Concretamente em `DashboardMetaCard.tsx` / `MetaGaugeCard.tsx`:

- Reduzir `size` do gauge de 150 para ~110.
- Reduzir tipografia interna do gauge ("60%", "do objetivo", labels Meta/Realizado) para caber sem quebra.
- Header e padding ficam como estão.

### 5. Reescrever o grid do `DashboardPage.tsx`

Layout fixo, sem drag-and-drop visual (mantendo a tela travada como o usuário pediu antes — sem scroll geral, cards visíveis sem ampliar). Substituir o grid atual por:

```tsx
<div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-12
                xl:grid-rows-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
  {/* Linha 1 */}
  <section className="xl:col-span-3 xl:row-start-1">{Meta}</section>
  <section className="xl:col-span-6 xl:row-start-1">{TotalRecebido}</section>
  <section className="xl:col-span-3 xl:row-start-1">{KpisGrid}</section>

  {/* Linha 2 */}
  <section className="xl:col-span-3 xl:row-start-2">{Agendamentos}</section>
  <section className="xl:col-span-6 xl:row-start-2">{Parcelas}</section>
  {/* col 10-12 da linha 2 fica vazio, como na imagem */}
</div>
```

### 6. Atualizar `useDashboardLayout.ts` e `CustomizeDashboardDialog`

- Substituir os ids `kpisOperacionais` + `kpisFinanceiros` por um único id **`kpisGrid`** em:
  - `DashboardBlockId`
  - `ALL_DASHBOARD_BLOCKS`
  - `DEFAULT_DASHBOARD_LAYOUT.visible` / `order`
- Bumpar `STORAGE_PREFIX` para `v8` para invalidar layouts salvos antigos (que ainda referenciam o drag-and-drop quebrado).
- Atualizar o diálogo de personalização para listar o novo bloco unificado "KPIs".

### 7. Limpeza do drag-and-drop

O usuário já reportou problemas com o arrasta-e-solta. Como o layout agora é fixo e idêntico ao da imagem, vou remover o `SortableCard.tsx` do `DashboardPage` (ele continua existindo no projeto mas deixa de ser importado). Personalizar permanece como toggle de visibilidade.

---

## Arquivos afetados

- **Criar**: `src/components/dashboard/KpisGridCard.tsx`
- **Editar**: `src/pages/DashboardPage.tsx`, `src/pages/AnalyticsPage.tsx`, `src/hooks/useDashboardLayout.ts`, `src/components/dashboard/CustomizeDashboardDialog.tsx`, `src/components/dashboard/DashboardMetaCard.tsx`, `src/components/dashboard/MetaGaugeCard.tsx`
- **Remover**: `src/components/dashboard/KpisOperacionaisCard.tsx`, `src/components/dashboard/KpisFinanceirosCard.tsx`

Sem mudanças de banco de dados.
