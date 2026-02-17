

## Melhorias na Tela de Telefonia

### 1. Remover "Pagamentos" dos cards de agentes

**Arquivo: `AgentStatusTable.tsx`**
- Remover a linha `StatRow` de "Pagamentos" (linha 199)
- Manter apenas "Contatos" e "Acordos" nas metricas do card
- Atualizar a interface `AgentMetrics` para remover o campo `payments`

**Arquivo: `TelefoniaDashboard.tsx`**
- Remover a query `todayPayments` (linhas 98-111) que busca pagamentos no banco
- Simplificar o `agentMetrics` useMemo removendo a contagem de payments
- Tipo das metricas passa a ser `{ contacts: number; agreements: number }`

### 2. Otimizar KPI Cards - layout mais compacto e fluido

**Arquivo: `TelefoniaDashboard.tsx`**
- Redesenhar os 6 KPI cards em formato horizontal inline (icone + valor + label lado a lado) em vez de empilhados verticalmente
- Usar layout mais compacto: icone a esquerda, valor grande + label pequeno a direita
- Reduzir padding dos cards para `p-3`
- Mover o badge de conexao e controles de refresh para dentro da mesma barra dos KPIs, eliminando o card de toolbar separado

### 3. Melhorar cards dos agentes

**Arquivo: `AgentStatusTable.tsx`**
- Tornar os cards mais compactos: reduzir avatar para `h-12 w-12`, menos padding
- Mover o nome e status para layout mais horizontal e condensado
- Campanha do agente aparece como texto pequeno abaixo do status
- Grid mais denso: `xl:grid-cols-6` em vez de `xl:grid-cols-5`

### 4. Melhorar card de Campanhas

**Arquivo: `CampaignOverview.tsx`**
- Redesenhar com layout mais limpo:
  - Header da campanha: nome + badge de status + horario em uma linha
  - Metricas (Agentes, Completadas, Abandonadas) em badges/chips inline em vez de grid 3 colunas com bg-muted
  - Slider de agressividade mais compacto, inline com o label e valor
  - Botao Pausar/Retomar menor, posicionado ao lado do slider
- Separar visualmente campanhas ativas (running) das pausadas/paradas com secoes ou opacidade reduzida nas inativas

### 5. Barra superior unificada

**Arquivo: `TelefoniaDashboard.tsx`**
- Unificar toolbar: Menu dropdown + titulo "Dashboard" + badge de conexao ficam numa unica linha compacta sem card separado
- Isso libera espaco vertical e torna o layout mais fluido

---

### Detalhes Tecnicos

**Arquivos a modificar:**
- `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` - toolbar unificada, remover query payments, KPIs compactos
- `src/components/contact-center/threecplus/AgentStatusTable.tsx` - remover Pagamentos, cards mais compactos
- `src/components/contact-center/threecplus/CampaignOverview.tsx` - redesign dos cards de campanha

**Nenhuma migracao de banco necessaria.**

