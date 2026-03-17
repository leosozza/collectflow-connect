

# Plano: Mesclar Credores, Renomear Tenant e Limpar Dados

## Situação Atual

**Tenant:** `39a450f8-7a40-46e5-8bc7-708da5043ec7` — Nome: "Temis Assessoria", Slug: "temis"

**Credores:**
- `143cc8af` — TESS MODELS PRODUTOS FOTOGRAFICOS LTDA (fantasia: Maxfama)
- `79180313` — YBRASIL (fantasia: YBRASIL)

**Dados existentes (Test + Live):**
- 9.495 clients (todos com credor "YBRASIL")
- 8 agreements, 635 conversations, 4.776 chat messages
- 5.895 user activity logs, 49 audit logs, 23 import logs
- 18 call dispositions, 6 client events, 10 enrichment jobs
- 7 usuários vinculados ao tenant

**Ambos os ambientes (Test e Live) têm dados que precisam ser limpos.**

---

## Ações

### 1. Mesclar Credores
- Atualizar todos os `clients` com `credor = 'YBRASIL'` para `credor = 'TESS MODELS PRODUTOS FOTOGRAFICOS LTDA'`
- Atualizar `agreements` que referenciam YBRASIL
- Deletar o credor YBRASIL (`79180313`)
- Manter o credor TESS MODELS (`143cc8af`)

### 2. Renomear Tenant
- Atualizar `tenants` SET `name = 'Y.BRASIL'`, `slug = 'ybrasil'` WHERE id = `39a450f8...`

### 3. Limpar Dados Operacionais
Deletar dados de **todas** as tabelas transacionais, preservando apenas configurações e estrutura:

**Deletar (dados operacionais):**
- clients, client_events, client_phones, client_update_logs, client_attachments
- agreements, agreement_signatures, portal_payments
- call_dispositions, call_logs
- conversations, chat_messages, conversation_tags
- notifications, audit_logs, import_logs, message_logs
- operator_points, enrichment_jobs, user_activity_logs
- token_transactions, rivocoin_transactions, rivocoin_wallets
- payment_records, expenses, shop_orders
- protest_titles, protest_logs, serasa_records, serasa_logs
- workflow_executions, asaas_customers
- service_usage_logs

**Preservar (configurações):**
- tenants, tenant_users, profiles, permission_profiles, user_permissions
- credores (só o TESS MODELS após merge)
- equipes, equipe_membros, tipos_devedor, tipos_divida, tipos_status
- custom_fields, field_mappings, atendimento_field_config
- call_disposition_types, collection_rules, debtor_categories
- commission_grades, scripts_abordagem, quick_replies
- tenant_modules, tenant_services, tenant_tokens (resetar saldo)
- system_modules, plans, whatsapp_instances, operator_instances
- ai_agents, workflow_flows, gamification_campaigns
- shop_products, achievement_templates, ranking_configs, operator_goals
- api_keys, invite_links, disposition_automations

### 4. Aplicar no Live
As mesmas operações precisam ser executadas no ambiente Live. Vou fornecer os SQLs para você rodar em **Cloud View > Run SQL** com o ambiente **Live** selecionado.

### 5. Resetar Token Balance
- Resetar `tenant_tokens` para saldo inicial de 50 tokens

---

## Observação Importante
- Os 7 usuários e seus perfis/permissões serão **mantidos**
- As configurações de credores, equipes, campos personalizados etc. serão **mantidas**
- Apenas dados transacionais/operacionais serão removidos

