

# Plano: Evolução do Disparo WhatsApp — Fase 1 (Não Oficial) + Base Fase 2

## Resumo

Criar estrutura de campanhas WhatsApp (`whatsapp_campaigns` + `whatsapp_campaign_recipients`), adicionar metadados de capacidade às instâncias, refazer o modal de disparo da carteira com seleção de múltiplas instâncias e deduplicação por telefone, e evoluir a edge function `send-bulk-whatsapp` para operar por campanha com round-robin.

---

## 1. Migração: Metadados nas instâncias + Tabelas de campanha

### 1a. Colunas na `whatsapp_instances`

```sql
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS provider_category text NOT NULL DEFAULT 'unofficial',
  ADD COLUMN IF NOT EXISTS supports_manual_bulk boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supports_campaign_rotation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supports_ai_agent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_templates boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supports_human_queue boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.whatsapp_instances.provider_category IS 'official_meta or unofficial';
```

### 1b. Tabela `whatsapp_campaigns`

```sql
CREATE TABLE public.whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'carteira',
  channel_type text NOT NULL DEFAULT 'whatsapp',
  provider_category text NOT NULL DEFAULT 'unofficial',
  campaign_type text NOT NULL DEFAULT 'manual_human_outreach',
  status text NOT NULL DEFAULT 'draft',
  message_mode text NOT NULL DEFAULT 'custom', -- 'custom' | 'template'
  message_body text,
  template_id UUID,
  selected_instance_ids UUID[] NOT NULL DEFAULT '{}',
  total_selected int NOT NULL DEFAULT 0,
  total_unique_recipients int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  delivered_count int NOT NULL DEFAULT 0,
  read_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  -- Fase 2 preparação
  routing_mode text DEFAULT 'human', -- 'human' | 'hybrid' | 'autonomous'
  allowed_operator_ids UUID[],
  team_id UUID,
  created_by UUID NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view campaigns"
  ON public.whatsapp_campaigns FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant admins can manage campaigns"
  ON public.whatsapp_campaigns FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_whatsapp_campaigns_updated_at
  BEFORE UPDATE ON public.whatsapp_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 1c. Tabela `whatsapp_campaign_recipients`

```sql
CREATE TABLE public.whatsapp_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  representative_client_id UUID NOT NULL,
  phone text NOT NULL,
  recipient_name text NOT NULL DEFAULT '',
  assigned_instance_id UUID REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  message_body_snapshot text,
  provider_message_id text,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view recipients"
  ON public.whatsapp_campaign_recipients FOR SELECT
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "Tenant admins can manage recipients"
  ON public.whatsapp_campaign_recipients FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE TRIGGER update_whatsapp_campaign_recipients_updated_at
  BEFORE UPDATE ON public.whatsapp_campaign_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## 2. Service: `whatsappCampaignService.ts`

**Novo arquivo**: `src/services/whatsappCampaignService.ts`

- `fetchEligibleInstances(tenantId)`: buscar instâncias com `status='active'`, `provider_category='unofficial'`, `supports_manual_bulk=true`
- `createCampaign(data)`: inserir na `whatsapp_campaigns`
- `createRecipients(campaignId, recipients[])`: inserir em batch na `whatsapp_campaign_recipients`
- `deduplicateClients(clients[])`: normalizar telefones, agrupar por telefone, retornar 1 representante por telefone único
- `distributeRoundRobin(recipients[], instanceIds[])`: atribuir `assigned_instance_id` em round-robin
- `startCampaign(campaignId)`: chamar edge function com `campaign_id`
- `fetchCampaigns(tenantId)`: listar campanhas
- `fetchCampaignRecipients(campaignId)`: listar recipients

---

## 3. Modal refatorado: `WhatsAppBulkDialog.tsx`

Reescrever o modal com as seguintes seções:

**Etapa 1 — Mensagem**
- Mensagem personalizada ou template interno (manter lógica atual)
- Preview com 1º cliente

**Etapa 2 — Instâncias**
- Lista de instâncias elegíveis (unofficial + active + supports_manual_bulk)
- Checkbox multi-select com nome + telefone de cada instância
- Mínimo 1 selecionada

**Etapa 3 — Resumo e confirmação**
- Total selecionados da carteira
- Total de destinatários únicos (após deduplicação por telefone)
- Quantidade sem telefone válido (excluídos)
- Distribuição estimada por instância (round-robin preview)
- Botão "Criar Campanha e Enviar"

**Etapa 4 — Resultado**
- Campanha criada, status atualizado em tempo real
- Contadores de enviados/falhas

---

## 4. Edge Function: `send-bulk-whatsapp` evoluída

Manter compatibilidade com o fluxo legado (`client_ids` + `message_template`) e adicionar novo fluxo por `campaign_id`:

**Novo fluxo (campaign_id)**:
1. Carregar campanha + recipients com `status='pending'`
2. Para cada recipient:
   - Carregar dados do `representative_client_id`
   - Resolver variáveis no template
   - Usar `assigned_instance_id` para buscar credenciais da instância
   - Enviar via Evolution API (instância não oficial)
   - Atualizar status do recipient (`sent` / `failed`)
   - Gravar `provider_message_id` e `error_message`
3. Atualizar contadores consolidados da campanha (`sent_count`, `failed_count`)
4. Marcar campanha como `completed` ao finalizar
5. Throttle de 200ms entre envios (por instância)

**Fluxo legado**: manter funcionando sem alterações para não quebrar nada existente.

---

## 5. Campos preparados para Fase 2 (sem implementação agora)

Todos os campos abaixo ficam no schema mas **não** terão lógica implementada:

- `whatsapp_campaigns.routing_mode` → para `hybrid` / `autonomous`
- `whatsapp_campaigns.allowed_operator_ids` → roteamento para operadores
- `whatsapp_campaigns.team_id` → roteamento por equipe
- `whatsapp_campaigns.campaign_type` → futuros: `automated_collection`, `ai_negotiation`, `hybrid_collection`
- `whatsapp_instances.provider_category = 'official_meta'` → para instâncias oficiais
- `whatsapp_instances.supports_ai_agent` → para IA
- `whatsapp_instances.supports_templates` → para templates aprovados Meta

Documentar no código com comentários `// FASE 2:` em cada ponto de extensão.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Nova: colunas em `whatsapp_instances`, tabelas `whatsapp_campaigns` e `whatsapp_campaign_recipients` |
| `src/services/whatsappCampaignService.ts` | **Novo**: deduplicação, round-robin, CRUD campanhas |
| `src/services/whatsappInstanceService.ts` | Adicionar `fetchEligibleInstances()` |
| `src/components/carteira/WhatsAppBulkDialog.tsx` | Reescrever com etapas, multi-instância, deduplicação, resumo |
| `supabase/functions/send-bulk-whatsapp/index.ts` | Adicionar fluxo por `campaign_id` mantendo legado |

## O que NÃO muda
- `conversations`, `chat_messages`, `whatsapp-webhook` — intactos
- Contact Center / chat atual — intactos
- `/atendimento` — intacto
- `evolution-proxy`, `wuzapi-proxy` — intactos
- Fluxo legado de `send-bulk-whatsapp` — preservado como fallback

