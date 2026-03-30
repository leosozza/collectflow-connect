

# Plano: Templates WhatsApp dedicados + Vincular instância à Régua

## Resumo

1. Remover aba "Regras" do `/automacao` (manter apenas em Cadastros > Credor > Régua)
2. Criar tabela `whatsapp_templates` e gestão dedicada de templates na aba que era "Regras"
3. Adicionar coluna `instance_id` à `collection_rules` para vincular instância à régua
4. Atualizar UI da Régua (CredorReguaTab) para mostrar/selecionar instância vinculada

---

## 1. Migração SQL

```sql
-- Tabela de templates WhatsApp reutilizáveis
CREATE TABLE public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'cobranca', -- cobranca, lembrete, acordo, geral
  message_body TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Vincular instância à régua de cobrança
ALTER TABLE public.collection_rules
  ADD COLUMN instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL;
```

---

## 2. Remover aba "Regras" do AutomacaoPage

**Arquivo**: `src/pages/AutomacaoPage.tsx`

- Remover `TabsTrigger value="regras"` e seu `TabsContent`
- Remover imports de `RulesList`, `RuleForm`, e toda lógica de `rules` state/handlers
- Adicionar nova aba "Templates" com o componente `WhatsAppTemplatesTab`
- Limpar código não utilizado (loadRules, handleSave, handleToggle, handleDelete para rules)

---

## 3. Criar componente `WhatsAppTemplatesTab`

**Novo arquivo**: `src/components/automacao/WhatsAppTemplatesTab.tsx`

- CRUD de templates WhatsApp com: nome, categoria (select), corpo da mensagem, variáveis disponíveis
- Preview com dados de exemplo (como já existe na Régua)
- Tabela listando templates com filtro por categoria
- Categorias: Cobrança, Lembrete, Acordo, Geral
- Botões de editar/excluir/ativar-desativar

---

## 4. Criar service `whatsappTemplateService.ts`

**Novo arquivo**: `src/services/whatsappTemplateService.ts`

- `fetchTemplates(tenantId, category?)`
- `createTemplate(data)`
- `updateTemplate(id, data)`
- `deleteTemplate(id)`

---

## 5. Atualizar Régua para vincular instância

**Arquivo**: `src/components/cadastros/CredorReguaTab.tsx`

- Adicionar select de instância WhatsApp no formulário de regra
- Carregar instâncias via `fetchEligibleInstances` (do whatsappCampaignService)
- Salvar `instance_id` junto com a regra
- Na tabela/timeline, exibir badge com nome da instância vinculada
- Quando canal = "email", instância não é obrigatória

---

## 6. Atualizar `automacaoService.ts`

**Arquivo**: `src/services/automacaoService.ts`

- Adicionar `instance_id` ao tipo `CollectionRule`

---

## 7. Atualizar `WhatsAppBulkDialog` para usar templates dedicados

**Arquivo**: `src/components/carteira/WhatsAppBulkDialog.tsx`

- Na etapa 1, buscar de `whatsapp_templates` em vez de `collection_rules`
- Manter opção "Mensagem personalizada"

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migração SQL | `whatsapp_templates` + `instance_id` em `collection_rules` |
| `AutomacaoPage.tsx` | Remover aba Regras, adicionar aba Templates |
| `WhatsAppTemplatesTab.tsx` | **Novo** — gestão de templates |
| `whatsappTemplateService.ts` | **Novo** — CRUD templates |
| `CredorReguaTab.tsx` | Adicionar seletor de instância |
| `automacaoService.ts` | Adicionar `instance_id` ao tipo |
| `WhatsAppBulkDialog.tsx` | Usar templates dedicados |

## O que NÃO muda
- Régua continua funcionando em Cadastros > Credor
- Gatilhos, Fluxos, Pós-Tabulação — intactos
- Contact Center / Chat — intactos

