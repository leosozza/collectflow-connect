

# Plano: Refinar e Corrigir o Módulo /contact-center/telefonia

## Resumo

Correção cirúrgica em 10 frentes: normalizar parsing de respostas 3CPlus, corrigir campanhas no Dashboard, adicionar filtros de período nos Gráficos e Produtividade, limpar aba Mailing, remover aba Histórico (redundante), transformar Usuários/Equipes em consulta, e corrigir bugs pontuais.

---

## Etapa 0: Helper de normalização de respostas 3CPlus

Criar `src/lib/threecplusUtils.ts` com:

```typescript
/** Extrai array de qualquer formato de resposta 3CPlus */
export function extractList(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data?.data?.data && Array.isArray(data.data.data)) return data.data.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

/** Normaliza status de campanha */
export function normalizeCampaignStatus(c: any): {
  isRunning: boolean; isPaused: boolean; statusLabel: string;
  progress: number; total: number; worked: number; aggressiveness: number;
} { ... }
```

Aplicar em **todos** os componentes que hoje fazem parsing inline (`CampaignsPanel`, `CampaignOverview`, `CallsChart`, `AgentsReportPanel`, `CallHistoryPanel`, `UsersPanel`, `TeamsPanel`, `TelefoniaDashboard`).

---

## Etapa 1: Dashboard > Visão Geral — Campanhas

**Arquivo**: `CampaignOverview.tsx`

- Substituir parsing inline por `extractList` + `normalizeCampaignStatus`
- Corrigir botão play/pause: usar `isPaused` da normalização (não `c.status === "running"`)
- Corrigir progresso: buscar `statistics.total_records` / `statistics.worked_records` como fallback além de `completed/total`
- Adicionar coluna de expansão (ChevronDown) — ao expandir, exibir resumo: status, total registros, trabalhados, agentes, agressividade, qualificações vinculadas
- Agressividade: buscar de `c.aggressiveness || c.power || c.dialer_settings?.aggressiveness`

---

## Etapa 2: Gráficos — Filtro de Período

**Arquivo**: `CallsChart.tsx`

- Adicionar inputs `startDate` e `endDate` (como em AgentsReportPanel)
- Remover cálculo fixo `const today = new Date()...`
- Passar datas selecionadas para `campaign_graphic_metrics`
- Exibir mensagem clara quando `chartData` vazio: "Sem dados para o período selecionado"
- Atualizar descrição de "hoje" para "período selecionado"

---

## Etapa 3: Produtividade — Corrigir Leitura

**Arquivo**: `AgentsReportPanel.tsx`

- Substituir parsing por `extractList(data)`
- Melhorar mensagens de vazio: diferenciar "clique para buscar" vs "sem dados no período" vs "erro de integração"
- Adicionar tratamento de erro com mensagem específica
- Adicionar mais fallbacks de campo: `total_calls`, `calls`, `call_count`

---

## Etapa 4: Remover aba Mailing

**Arquivo**: `ThreeCPlusPanel.tsx`

- Remover import de `MailingPanel`
- Remover `{ value: "mailing", label: "Mailing", icon: ListOrdered }` do grupo "Campanhas"
- Remover `mailing: <MailingPanel />` do contentMap
- Não deletar `MailingPanel.tsx` (pode ser útil dentro da gestão de campanha futuramente)

---

## Etapa 5: Remover aba Histórico

A aba Histórico é redundante — Produtividade cobre métricas agregadas e o histórico do cliente cobre chamadas individuais.

**Arquivo**: `ThreeCPlusPanel.tsx`

- Remover `{ value: "history", label: "Histórico", icon: PhoneCall }` do grupo "Chamadas"
- Remover `history: <CallHistoryPanel />` do contentMap
- Remover import de `CallHistoryPanel`
- Manter `CallHistoryPanel.tsx` no projeto (pode ser reaproveitado)

---

## Etapa 6: Usuários — Painel de Consulta

**Arquivo**: `UsersPanel.tsx`

- Remover botão "Novo Usuário" e dialog de criação/edição
- Remover botão de desativar
- Adicionar banner: "Usuários devem ser gerenciados no 3C Plus. Este painel é apenas para consulta."
- Corrigir parsing: usar `extractList(data)`
- Corrigir status: verificar `u.active`, `u.is_active`, `u.status === "active"`, `u.deleted_at === null`
- Adicionar filtro visual: Ativos / Inativos / Todos (Select)

---

## Etapa 7: Equipes — Painel de Consulta

**Arquivo**: `TeamsPanel.tsx`

- Remover botão "Nova Equipe" e dialog de criação/edição
- Adicionar banner: "Equipes devem ser gerenciadas no 3C Plus. Este painel é apenas para consulta."
- Corrigir parsing: usar `extractList(data)`
- Manter visualização de detalhes (Eye)

---

## Etapa 8: CampaignsPanel — Corrigir Detalhes

**Arquivo**: `CampaignsPanel.tsx`

- Aplicar `extractList` em todas as chamadas de detalhe
- Corrigir aba Qualificações dentro da campanha expandida: separar lista de qualificações vinculadas (items da qualification_list) de estatísticas por qualificação (se existirem)
- Se a 3CPlus não retornar distribuição estatística, não simular dados
- Corrigir leitura de agressividade: `c.aggressiveness || c.power || c.dialer_settings?.aggressiveness`
- Adicionar botão "Atualizar" dentro da campanha expandida que chama `loadCampaignDetails`
- Corrigir `CallHistoryPanel` bug: `useState(() => { loadCampaigns(); })` — trocar por `useEffect`

---

## Etapa 9: Reorganizar Navegação

**Arquivo**: `ThreeCPlusPanel.tsx`

Estrutura final das abas:

```text
Dashboard: Visão Geral | Gráficos | Produtividade
Campanhas: Campanhas | Rotas
Chamadas: Receptivo | Agendamentos | Bloqueio
Controle: Usuários | Equipes | Intervalos | Horários | Qualificações
```

Removidos: Mailing, Histórico.

---

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/threecplusUtils.ts` | **Novo** — helper de normalização |
| `src/components/contact-center/threecplus/ThreeCPlusPanel.tsx` | Remover Mailing + Histórico, reorganizar abas |
| `src/components/contact-center/threecplus/CampaignOverview.tsx` | Normalizar parsing, expandir, corrigir play/pause |
| `src/components/contact-center/threecplus/CallsChart.tsx` | Adicionar filtro de período |
| `src/components/contact-center/threecplus/AgentsReportPanel.tsx` | Normalizar parsing, melhorar mensagens |
| `src/components/contact-center/threecplus/CampaignsPanel.tsx` | Normalizar parsing, corrigir qualificações, refresh |
| `src/components/contact-center/threecplus/UsersPanel.tsx` | Transformar em consulta, filtro status, banner |
| `src/components/contact-center/threecplus/TeamsPanel.tsx` | Transformar em consulta, banner |

## O que NÃO muda

- Criação/gestão de campanhas no CampaignsPanel
- Login/logout de campanha
- Pause/unpause
- Monitoramento de agentes (TelefoniaDashboard)
- Tabulação na ficha
- Navegação direta para ficha do cliente
- Mailing como funcionalidade (apenas remove a aba dedicada)
- threecplus-proxy (sem mudanças nesta etapa)

