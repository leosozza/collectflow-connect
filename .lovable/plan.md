

# Plano: Selecionar agentes ao criar campanha no 3CPlus

## Problema
Ao criar uma campanha no painel de Campanhas 3CPlus, não há opção para selecionar os agentes que devem pertencer à campanha. Isso obriga o admin a configurar manualmente no painel externo do 3CPlus.

## Solução
Adicionar seleção multi-agente no dialog de criação de campanha e, após criar a campanha, chamar `POST /campaigns/{id}/agents` na API do 3CPlus para vincular os agentes selecionados.

## Mudanças

### 1. Proxy — Nova action `add_agents_to_campaign`
**Arquivo**: `supabase/functions/threecplus-proxy/index.ts`

Adicionar case `add_agents_to_campaign`:
- Requer `campaign_id` e `agent_ids` (array de IDs numéricos)
- Chama `POST /campaigns/{campaign_id}/agents` com body `{ "users": agent_ids }`
- Também adicionar `list_campaign_agents` (`GET /campaigns/{campaign_id}/agents`) e `remove_campaign_agent` (`DELETE /campaigns/{campaign_id}/agents/{agent_id}`) para uso futuro

### 2. CampaignsPanel — Seleção de agentes no dialog
**Arquivo**: `src/components/contact-center/threecplus/CampaignsPanel.tsx`

- Buscar lista de usuários/agentes via `list_users` (já existe no proxy)
- No dialog "Nova Campanha", adicionar seleção multi-agente com checkboxes
- Após `create_campaign` retornar o ID da nova campanha, chamar `add_agents_to_campaign` com os agentes selecionados
- Mostrar feedback: "Campanha criada e X agentes vinculados"
- Na expansão da campanha, mostrar os agentes vinculados além das listas de mailing

### 3. Fluxo completo

```text
Dialog "Nova Campanha"
├── Nome, Horários, Qualificação, Pausas (existente)
├── [NOVO] Seleção de Agentes (multi-select com checkboxes)
└── Botão "Criar"
    ├── POST /campaigns → retorna campaign.id
    ├── POST /campaigns/{id}/agents → { users: [selected_ids] }
    └── Toast: "Campanha criada com X agentes"
```

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Actions: `add_agents_to_campaign`, `list_campaign_agents`, `remove_campaign_agent` |
| `src/components/contact-center/threecplus/CampaignsPanel.tsx` | Multi-select de agentes no dialog + vincular após criação + listar agentes na expansão |

