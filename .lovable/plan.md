## Objetivo

Reorganizar APENAS a área principal do `DashboardPage.tsx`, mantendo header, filtros, autenticação, RPCs e regras de negócio intactas. Adicionar card de Total Recebido com gráfico de onda e um modo de personalização (mostrar/ocultar/reordenar) salvo em `localStorage`.

## Estrutura nova da área principal

Manter intactos:
- Header (título "Dashboard", boas-vindas, botões Relatórios/Analytics, filtros Ano/Mês/Operador)
- Linha superior de KPI cards (Acionados Hoje, Acordos do Dia, Acordos do Mês, Colchão, 1ª Parcela, Total Negociado, Quebra, Pendentes)

Importante: REMOVER `StatCard` "Total Recebido" do bloco superior (linha 428) — Total Recebido só existirá no card novo da coluna direita.

Layout principal (abaixo dos KPIs):

```text
┌─────────────────────────────────┬──────────────────────────┐
│                                 │  Total Recebido          │
│   Parcelas Programadas          │  R$ 86.153,29            │
│   (maior — col-span-2)          │  [gráfico de onda azul]  │
│                                 ├──────────────────────────┤
│   - banner azul HOJE            │  Metas — Empresa         │
│   - tabela: Nome|Credor|        │  (DashboardMetaCard)     │
│     Valor|Status                ├──────────────────────────┤
│   - badges ANDAMENTO/QUITADO/   │  Agendamentos para Hoje  │
│     ATRASADO                    │  Nome | Data | Horário   │
│   - "Ver todas" topo direito    │  Ver todos               │
└─────────────────────────────────┴──────────────────────────┘
```

Grid: `lg:grid-cols-3` com Parcelas em `lg:col-span-2` e a coluna direita empilhando 3 cards. Mobile: 1 coluna empilhada.

## Mudanças por arquivo

### `src/pages/DashboardPage.tsx` (editado)
- Remover as 3 colunas atuais (linhas 213–443).
- Manter todo o estado, queries e RPCs (`get_dashboard_stats`, `get_dashboard_vencimentos`, `get_acionados_hoje`, `useScheduledCallbacks`).
- Linha superior: manter os KPI cards atuais (Acionados/Acordos Dia/Mês + Colchão/1ª Parcela/Total Negociado/Quebra/Pendentes) num grid responsivo único (ex: `grid-cols-2 md:grid-cols-4 xl:grid-cols-8`). REMOVER apenas o `StatCard` "Total Recebido".
- Renderização dos cards principais é controlada por `dashboardLayout` (estado + `localStorage`), permitindo ocultar/reordenar.
- Adicionar botão "Personalizar Dashboard" próximo aos filtros (ícone `Settings2`, variant `ghost`, tamanho pequeno e discreto).

### `src/components/dashboard/ParcelasProgramadasCard.tsx` (novo)
- Encapsula o bloco atual de Parcelas Programadas (banner azul HOJE com navegação ←/→, calendário popover, tabela Nome/Credor/Valor/Status com badges).
- Remover badges/contadores de resumo do header (apenas título + "Ver todas" no topo direito linkando `/acordos`).
- Sem barra inferior de resumo.
- Props: `vencimentos`, `browseDate`, `onNavigateDate`, `onPickDate`.

### `src/components/dashboard/TotalRecebidoCard.tsx` (novo)
- Card branco, título "Total Recebido" + select visual "Mensal" (apenas UI por enquanto).
- Valor grande em azul: `formatCurrency(stats?.total_recebido ?? 0)`.
- Gráfico `AreaChart` (Recharts — já em uso no projeto via `EvolutionChart.tsx`) com gradiente azul (`hsl(var(--primary))`), suave, sem eixos pesados.
- Buscar série diária dos últimos 30 dias via query nova:
  - `supabase.from("agreement_payments").select("paid_at, amount").gte("paid_at", D-30).eq("tenant_id", ...)` agrupado por dia no client.
  - Se a tabela não existir/falhar: fallback seguro com array de 30 zeros (não quebra a tela).
- Validar nome real da tabela de pagamentos antes de implementar; se incerto, usar fallback de série derivada de `agreements` por `created_at` e `total_pago` agrupado por dia. O componente é resiliente: aceita `series: {date, value}[]` como prop opcional e a página decide a fonte.

### `src/components/dashboard/AgendamentosHojeCard.tsx` (novo)
- Pequeno card. Header com título + badge contador + "Ver todos" (link para `/agendamentos` ou modal existente).
- Tabela compacta 3 colunas: Nome do cliente (link para `/carteira/:cpf`) | Data (`dd/MM/yyyy`) | Horário (`HH:mm`).
- Consome `callbacks` do `useScheduledCallbacks` já existente.
- Mantém a mesma lógica de destaque para horário próximo/passado.

### `src/components/dashboard/DashboardMetaCard.tsx` (sem alterações funcionais)
- Reutilizado tal como está na coluna direita.

### `src/components/dashboard/CustomizeDashboardDialog.tsx` (novo)
- Dialog (shadcn) acionado pelo botão "Personalizar Dashboard".
- Lista os blocos com toggle (Switch) de visibilidade:
  - `kpisTop` (KPIs superiores)
  - `parcelas` (Parcelas Programadas)
  - `totalRecebido`
  - `metas`
  - `agendamentos`
- Para cada item visível, botões ↑ ↓ para reordenar (sem drag-and-drop, conforme orientação).
- Botões: **Salvar layout** | **Restaurar padrão** | **Cancelar**.
- Persiste em `localStorage` com chave `rivo:dashboard-layout:v1` por `profile?.user_id` (`rivo:dashboard-layout:v1:<userId>`).

### `src/hooks/useDashboardLayout.ts` (novo)
- Lê/escreve preferências em `localStorage`.
- Default:
  ```ts
  {
    visible: { kpisTop: true, parcelas: true, totalRecebido: true, metas: true, agendamentos: true },
    order: ["parcelas", "totalRecebido", "metas", "agendamentos"]
  }
  ```
- Retorna `{ layout, setLayout, reset }`.
- A coluna esquerda renderiza apenas `parcelas` (se visível). A direita renderiza, na ordem definida (filtrando "parcelas"), os demais blocos visíveis.

## Cuidados

- Sem mudanças em RPC, schema, RLS, rotas, AppLayout, sidebar ou topbar.
- Sem migrations, sem nova tabela.
- Total Recebido sai do bloco superior — qualquer outro lugar que ainda mostre é removido.
- Tipagens TS preservadas; componentes novos tipados.
- Build deve permanecer verde.

## Resultado

Dashboard com cabeçalho/KPIs preservados, área principal em 2 colunas (Parcelas grande à esquerda; Total Recebido com gráfico de onda azul + Metas + Agendamentos empilhados à direita) e modo "Personalizar Dashboard" salvo localmente por usuário.

**Posso aplicar?**