

# Plano: Corrigir intervalos de pausa, botão de tabulação e endpoints 3CPlus

## Problemas encontrados

### 1. Intervalos de pausa nunca aparecem
O `loadPauseIntervals` depende de `campaign_details` que usa o endpoint `campaign/{id}` (singular). A 3CPlus API exige `campaigns/{id}` (plural). Resultado: **404 em toda chamada de `campaign_details`**, `work_break_group_id` nunca é encontrado, e o array `pauseIntervals` fica vazio.

Solucao alternativa mais confiavel: a API 3CPlus tem `GET /agent/work_break_intervals` que retorna os intervalos diretamente da campanha logada, usando o token do agente. Isso elimina a necessidade de buscar `campaign_details` + `work_break_group_id` + `list_work_break_group_intervals`.

### 2. Qualificacoes de campanha retornam 422
O endpoint `campaigns/{id}/qualifications` e um endpoint de **estatisticas** que exige `start_date` e `end_date`. Nao e o endpoint correto para listar as qualificacoes disponiveis. O correto e: buscar detalhes da campanha → obter `qualification_list` → chamar `list_qualification_list_items`.

Solucao: usar `GET /campaigns/{id}` (endpoint correto, plural) para obter o `qualification_list` id, depois `list_qualification_list_items` com esse id. Ou usar os dados do tenant settings que ja tem o `qualification_list_id`.

### 3. Botao "Finalizar Tabulacao" no fundo da pagina
O usuario espera o botao no topo, junto ao banner de status. Esta no fim do componente (apos todo o conteudo).

## Correcoes

### 1. `supabase/functions/threecplus-proxy/index.ts`

**Corrigir `campaign_details`**: trocar `campaign/${id}` por `campaigns/${id}` (linha 93).

**Nova action `agent_work_break_intervals`**: usar `GET /agent/work_break_intervals` com token do agente (resolve via `resolveAgentToken`). Retorna os intervalos diretamente, sem precisar buscar grupo.

**Corrigir `campaign_qualifications`**: em vez de chamar o endpoint de stats, buscar detalhes da campanha (`GET /campaigns/{id}`) para obter o `qualification_list`, depois chamar `GET /qualification_lists/{list_id}/qualifications`.

### 2. `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

**`loadPauseIntervals`**: trocar para usar `agent_work_break_intervals` (com `agent_id`) como fonte primaria. Fallback para o fluxo existente (campaign_details + group_id).

**`loadCampaignQualifications`**: usar o `qualification_list_id` do tenant settings como fonte primaria. Se nao tiver, usar a nova action `campaign_qualifications` corrigida.

### 3. `src/pages/AtendimentoPage.tsx`

**Mover botao "Finalizar Tabulacao"**: colocar logo abaixo do banner de status no topo, nao no fundo da pagina.

## Arquivos a editar

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Corrigir URL `campaign_details`; nova action `agent_work_break_intervals`; corrigir `campaign_qualifications` |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Usar `agent_work_break_intervals` para intervalos; usar `qualification_list_id` do tenant para qualificacoes |
| `src/pages/AtendimentoPage.tsx` | Mover botao "Finalizar Tabulacao" para o topo |

