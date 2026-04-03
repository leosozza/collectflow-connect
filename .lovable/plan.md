

# Plano: Gestão de Campanhas WhatsApp

## Escopo

Novo módulo "Gestão de Campanhas" como aba dentro de WhatsApp no Contact Center. Frontend + backend + permissões granulares. Dados reais das tabelas `whatsapp_campaigns` e `whatsapp_campaign_recipients` já existentes.

## Fase 1 — Esta implementação

Devido ao tamanho do pedido, esta implementação foca em entregar o módulo completo e funcional com todas as abas e permissões. Segue o detalhamento.

---

## 1. Migration: Colunas extras + Permissões

**Tabela `whatsapp_campaigns`** — adicionar campos de origem e nome:
```sql
ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS origin_type text DEFAULT 'carteira',
  ADD COLUMN IF NOT EXISTS origin_id uuid,
  ADD COLUMN IF NOT EXISTS workflow_id uuid,
  ADD COLUMN IF NOT EXISTS rule_id uuid,
  ADD COLUMN IF NOT EXISTS trigger_type text;
```

**Novo módulo de permissões: `campanhas_whatsapp`**

Actions: `view_own`, `view_all`, `create`, `start`, `pause`, `edit`, `export`, `view_metrics`, `view_recipients`

Adicionado nos `ROLE_DEFAULTS`:
- **admin/super_admin**: todas as actions
- **gerente/supervisor**: `view_all`, `view_metrics`
- **operador**: `view_own`

## 2. Permissões (`usePermissions.ts`)

Adicionar módulo `campanhas_whatsapp` com 9 actions:

```typescript
campanhas_whatsapp: ["view_own", "view_all", "create", "start", "pause", "edit", "export", "view_metrics", "view_recipients"]
```

Expor helpers:
- `canViewCampanhasWhatsApp` — hasAny
- `canViewAllCampanhas` — has view_all
- `canViewOwnCampanhas` — has view_own
- `canCreateCampanhas` — has create
- `canStartCampanhas` — has start
- `canPauseCampanhas` — has pause
- `canEditCampanhas` — has edit
- `canExportCampanhas` — has export
- `canViewCampaignMetrics` — has view_metrics
- `canViewCampaignRecipients` — has view_recipients

Adicionar labels em `MODULE_LABELS`, `ACTION_LABELS`, `MODULE_AVAILABLE_ACTIONS`.

## 3. Aba no Contact Center (`ContactCenterPage.tsx`)

Adicionar tab "Campanhas" (ícone `Megaphone`) entre "Conversas" e "Agente IA". Visível quando `canViewCampanhasWhatsApp`. Renderiza `<CampaignManagementTab />`.

## 4. Service (`src/services/campaignManagementService.ts`)

Funções que consomem dados reais:

- `fetchCampaignsWithStats(tenantId, filters, userId?)` — lista campanhas com contadores agregados
- `fetchCampaignDetail(campaignId)` — detalhes completos
- `fetchCampaignRecipients(campaignId, filters)` — recipients com dados de clients (score, perfil, status)
- `fetchCampaignResponses(campaignId)` — recipients com `status = 'replied'` ou que possuem conversa vinculada por phone
- `fetchCampaignAgreements(campaignId)` — join recipients → clients → agreements pelo CPF
- `fetchCampaignMetrics(campaignId)` — agregações por instância e por operador
- `fetchCampaignDashboardStats(tenantId, userId?)` — cards de resumo do topo

Todas as queries incluem `.eq('tenant_id', tenantId)` explícito.

## 5. Componentes Frontend

### 5a. `CampaignManagementTab.tsx` — Tela principal
- **Dashboard cards no topo**: total campanhas, mensagens enviadas, respostas, acordos, taxa resposta, taxa conversão
- **Filtros**: período, status, criado por, origem, instância, própria/todas, com resposta, com acordo, busca textual
- **Tabela de campanhas**: nome, origem, criado por, data, status (badge colorido), tipo, provider, totais, progresso (barra), última atualização
- Click na linha abre detalhe

### 5b. `CampaignDetailView.tsx` — Detalhe com 5 abas
- Tabs: Resumo | Destinatários | Respostas | Acordos | Métricas

### 5c. `CampaignSummaryTab.tsx` — Aba Resumo
- Cards com KPIs principais (enviados, falhas, respostas, acordos, taxas)
- Info da campanha (nome, descrição, status, origem, criador, datas, template/mensagem, instâncias)
- Gráficos simples: distribuição por instância (bar), envio x resposta x acordo (funnel), status dos recipients (pie)
- Score médio e distribuição por perfil/status de cobrança

### 5d. `CampaignRecipientsTab.tsx` — Aba Destinatários
- Tabela paginada com: nome, telefone, instância, status, erro, provider_message_id, data envio, respondeu, operador, acordo, score, perfil
- Filtros: status, instância, respondeu, com erro, com acordo, score, perfil
- Visível apenas com `canViewCampaignRecipients`

### 5e. `CampaignResponsesTab.tsx` — Aba Respostas
- Filtra recipients que responderam (vinculo: phone do recipient → conversations.phone)
- Mostra: cliente, telefone, instância, quando respondeu, status conversa, operador, se virou acordo

### 5f. `CampaignAgreementsTab.tsx` — Aba Acordos
- Join recipients → clients (por representative_client_id) → agreements (por CPF + tenant)
- Mostra: cliente, telefone, data acordo, valor, status, operador, origem

### 5g. `CampaignMetricsTab.tsx` — Aba Métricas
- Métricas globais da campanha
- Tabela por instância: recipients, enviados, falhas, respostas, acordos
- Tabela por operador: leads, atendimentos, acordos, taxa conversão
- Visível apenas com `canViewCampaignMetrics`

## 6. Lógica de Respostas

Para vincular respostas à campanha sem alterar o chat:
- Buscar `conversations` cujo `phone` (normalizado) corresponde a um `recipient.phone` da campanha
- Filtrar por `conversations` criadas **após** o `started_at` da campanha
- Não criar FK nem alterar tabelas de conversations/chat_messages

## 7. Lógica de Acordos

- Do recipient pegar `representative_client_id` → buscar `clients.cpf`
- Buscar `agreements` com mesmo CPF + tenant + criados após campanha
- Relação indireta mas segura, sem alterar a tabela de agreements

## 8. Backfill do campo `name`

Na migration, preencher campanhas existentes:
```sql
UPDATE whatsapp_campaigns SET name = 'Campanha #' || EXTRACT(EPOCH FROM created_at)::int
WHERE name IS NULL;
```

No `WhatsAppBulkDialog` / `createCampaign`, começar a gravar `name` com valor descritivo.

---

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| Migration SQL | Colunas extras em `whatsapp_campaigns` |
| `src/hooks/usePermissions.ts` | Novo módulo `campanhas_whatsapp` |
| `src/pages/ContactCenterPage.tsx` | Nova aba "Campanhas" |
| `src/services/campaignManagementService.ts` | **Novo** — queries reais |
| `src/components/contact-center/whatsapp/CampaignManagementTab.tsx` | **Novo** — tela principal |
| `src/components/contact-center/whatsapp/campaigns/CampaignDetailView.tsx` | **Novo** — detalhe |
| `src/components/contact-center/whatsapp/campaigns/CampaignSummaryTab.tsx` | **Novo** |
| `src/components/contact-center/whatsapp/campaigns/CampaignRecipientsTab.tsx` | **Novo** |
| `src/components/contact-center/whatsapp/campaigns/CampaignResponsesTab.tsx` | **Novo** |
| `src/components/contact-center/whatsapp/campaigns/CampaignAgreementsTab.tsx` | **Novo** |
| `src/components/contact-center/whatsapp/campaigns/CampaignMetricsTab.tsx` | **Novo** |
| `src/services/whatsappCampaignService.ts` | Adicionar campo `name` ao `createCampaign` |

Nenhuma alteração em: disparo da carteira, `send-bulk-whatsapp`, conversations, chat_messages, whatsapp-webhook, automação, atendimento, acordos existentes.

