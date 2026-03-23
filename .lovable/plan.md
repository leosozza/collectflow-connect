

# Plano: Melhorar aba Campanhas em /contact-center/telefonia

## Situacao atual

O `CampaignsPanel.tsx` lista campanhas com opcoes basicas: criar, expandir para ver listas/agentes. Faltam acoes essenciais e analise.

## Endpoints 3CPlus disponiveis (confirmados na API oficial)

| Acao | Endpoint | Status no proxy |
|---|---|---|
| Excluir campanha | `DELETE /campaigns/{id}` | Falta adicionar |
| Pausar campanha | `PUT /campaigns/{id}/pause` | Ja existe |
| Retomar campanha | `PUT /campaigns/{id}/resume` | Ja existe |
| Excluir lista de mailing | `DELETE /campaigns/{id}/lists/{list-id}` | Falta adicionar |
| Excluir todas as listas | `DELETE /campaigns/{id}/lists` | Falta adicionar |
| Metricas por lista | `GET /campaigns/{id}/lists/metrics` | Falta adicionar |
| Metricas totais | `GET /campaigns/{id}/lists/total_metrics` | Falta adicionar |
| Metricas agentes | `GET /campaigns/{id}/agents/metrics/total` | Falta adicionar |
| Stats qualificacoes | `GET /campaigns/{id}/qualifications` | Falta adicionar |
| Agressividade | `PATCH /campaigns/{id}` | Ja existe (`update_campaign`) |

**Reciclar mailing**: A API 3CPlus nao expoe endpoint de reciclagem via REST. A reciclagem e feita internamente pela plataforma. O campo `recycle_filters` aparece nos dados da lista mas nao existe endpoint para disparar reciclagem via API. Vou implementar exclusao de mailing + reenvio como alternativa funcional.

## Mudancas

### 1. `supabase/functions/threecplus-proxy/index.ts` — Novos actions

- `delete_campaign`: `DELETE /campaigns/{campaign_id}`
- `delete_campaign_list`: `DELETE /campaigns/{campaign_id}/lists/{list_id}`
- `delete_all_campaign_lists`: `DELETE /campaigns/{campaign_id}/lists`
- `campaign_lists_metrics`: `GET /campaigns/{campaign_id}/lists/metrics`
- `campaign_lists_total_metrics`: `GET /campaigns/{campaign_id}/lists/total_metrics`
- `campaign_agents_metrics`: `GET /campaigns/{campaign_id}/agents/metrics/total`
- `campaign_qualifications`: `GET /campaigns/{campaign_id}/qualifications`

### 2. `src/components/contact-center/threecplus/CampaignsPanel.tsx` — Redesenho completo

**Cabecalho de cada campanha** (na row expandida):
- Badge de status (Ativa/Pausada/Inativa) com cor
- Botoes de acao: Pausar/Retomar, Excluir (com confirmacao), Slider de agressividade

**Secao expandida com sub-tabs**:
1. **Visao Geral**: Cards com metricas (total discado, atendidas, abandonadas, ASR, tempo medio)
2. **Listas de Mailing**: Tabela com nome, total, discado %, completado %, com botao de excluir lista individual e botao "Limpar todas as listas"
3. **Agentes**: Lista de agentes vinculados com metricas individuais (chamadas, tempo online, tempo pausa)
4. **Qualificacoes**: Distribuicao de qualificacoes da campanha

**Slider de agressividade**: Ja funcional via `update_campaign` (PATCH). Manter e melhorar visual.

**Excluir campanha**: Dialog de confirmacao com nome da campanha para digitar.

**Pausar/Retomar**: Botoes na linha da campanha (ja tem no `CampaignOverview`, trazer para o `CampaignsPanel`).

### 3. `src/components/contact-center/threecplus/CampaignOverview.tsx`

Manter como componente do Dashboard (visao resumida). O `CampaignsPanel` tera a versao completa.

## Arquivos a editar

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | 7 novos actions para campanha |
| `src/components/contact-center/threecplus/CampaignsPanel.tsx` | Redesenho com acoes (pausar, excluir, agressividade), sub-tabs de analise (metricas, listas, agentes, qualificacoes) |

