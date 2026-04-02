

# Plano: Fechar fluxo de disparo WhatsApp em lote (multi-provider completo)

## Problemas Identificados

1. **Gupshup invisível**: Configurado em `tenant.settings`, sem registro em `whatsapp_instances` — não aparece no seletor do modal
2. **`provider_category` hardcoded**: `createCampaign` grava `"unofficial"` fixo independente do provider
3. **Sem validação pré-envio**: O modal permite avançar sem validar se a instância suporta bulk ou se as credenciais estão configuradas
4. **Auth fragil na Edge Function**: Usa `getClaims` que pode falhar — deve usar `getUser`

## Solução por Arquivo

### 1. `src/services/whatsappCampaignService.ts`

**a) Gupshup como instância virtual**

Alterar `fetchEligibleInstances` para, além de buscar `whatsapp_instances`, verificar se o tenant tem Gupshup configurado (`gupshup_api_key` + `gupshup_source_number` em `tenant.settings`). Se sim, injetar uma instância virtual com `id: "gupshup-official"`, `provider: "gupshup"`, `provider_category: "official_meta"`, `name: "Gupshup (Oficial)"`, `status: "active"`.

Isso requer buscar `tenants.settings` nessa função — adicionar uma query ao tenant.

**b) `provider_category` dinâmico**

Alterar `CreateCampaignInput` para aceitar `provider_category?: string`. No `createCampaign`, derivar a categoria da lista de instâncias selecionadas:
- Se todas são `official_meta` → `"official_meta"`
- Se todas são `unofficial` → `"unofficial"`
- Se misto → `"mixed"`

**c) Validação de distribuição Gupshup**

No `distributeRoundRobin`, a instância virtual Gupshup não tem `id` real — usar `"gupshup-official"` como ID e no `createRecipients`, se `assignedInstanceId === "gupshup-official"`, gravar `null` no `assigned_instance_id` com um campo extra de metadata ou gravar o ID virtual.

### 2. `src/components/carteira/WhatsAppBulkDialog.tsx`

**a) Validação pré-envio (Step 3)**

Antes do botão "Criar Campanha e Enviar", validar:
- Pelo menos 1 instância selecionada
- Mensagem não vazia
- Pelo menos 1 destinatário válido
- Exibir alerta se instância Gupshup selecionada mas credenciais incompletas

**b) Badge de provider correto**

Já existe — apenas garantir que `"gupshup-official"` renderize corretamente com badge "Oficial".

### 3. `supabase/functions/send-bulk-whatsapp/index.ts`

**a) Suporte à instância virtual Gupshup**

Quando `assigned_instance_id` for `null` ou `"gupshup-official"`, usar diretamente as credenciais Gupshup do `tenantSettings` (já implementado no `sendByProvider` com `provider === "gupshup"`). Criar um fallback: se a instância não for encontrada no `instanceMap` e o `campaign.provider_category` incluir `official_meta`, construir um objeto de instância virtual com `provider: "gupshup"`.

**b) Auth robusta**

Substituir `getClaims` por `getUser` (consistente com as outras edge functions do projeto).

**c) Validação de credenciais antes do loop**

Antes de iterar os recipients, verificar se todas as instâncias referenciadas existem e têm credenciais válidas. Se não, retornar erro 400 imediato em vez de falhar recipient por recipient.

## Fluxo Resultante

```text
Carteira → seleciona clientes → abre WhatsAppBulkDialog
  ↓
fetchEligibleInstances busca whatsapp_instances + verifica Gupshup no tenant.settings
  ↓
Modal mostra: [Baylers/Evolution] [WuzAPI] [Gupshup Oficial] ← todos que estiverem ativos
  ↓
Usuário seleciona instâncias + mensagem → Step 3 valida tudo
  ↓
createCampaign grava provider_category correto (official_meta/unofficial/mixed)
  ↓
send-bulk-whatsapp roteia por provider real de cada instância
  ↓
Resultado: completed / completed_with_errors / failed
```

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/services/whatsappCampaignService.ts` | Gupshup virtual, provider_category dinâmico, validação |
| `src/components/carteira/WhatsAppBulkDialog.tsx` | Validação pré-envio, badge oficial |
| `supabase/functions/send-bulk-whatsapp/index.ts` | Suporte Gupshup virtual, auth via getUser, validação prévia |

Nenhuma alteração em banco, tabelas ou experiência do usuário.

