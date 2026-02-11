

# Fase 2: Automacao e Comunicacao (Regua de Cobranca + WhatsApp + Email)

## Resumo

Implementar um sistema completo de automacao de cobranca onde cada tenant configura suas proprias regras e credenciais. Inclui regua de cobranca configuravel, envio de WhatsApp via Gupshup (chave por tenant) e email via sistema integrado do Lovable Cloud.

---

## Arquitetura

Cada tenant armazena suas credenciais Gupshup no campo `settings` (JSONB) da tabela `tenants`, que ja existe. A edge function `send-notifications` busca as credenciais do tenant ao processar notificacoes.

```text
+-------------------+      +---------------------+      +------------------+
| collection_rules  |      | send-notifications  |      | Gupshup API      |
| (regras por       | ---> | (Edge Function)     | ---> | (WhatsApp)       |
|  tenant)          |      |                     |      +------------------+
+-------------------+      |  Le credenciais do  |
                           |  tenant.settings    | ---> +------------------+
+-------------------+      |                     |      | Lovable Cloud    |
| clients           | ---> |  Filtra clientes    |      | Email (Auth)     |
| (devedores)       |      |  por vencimento     |      +------------------+
+-------------------+      +---------------------+
                                    |
                           +--------v----------+
                           | message_logs      |
                           | (historico envios) |
                           +-------------------+
```

---

## O que muda para o usuario

- Admin do tenant acessa "Configuracoes da Empresa" e insere suas chaves Gupshup (API Key, App Name, Source Number)
- Admin configura regras de cobranca: quantos dias antes/depois do vencimento enviar mensagem, por qual canal (WhatsApp, Email, ambos)
- Sistema envia automaticamente mensagens conforme as regras
- Historico de todas as mensagens enviadas fica disponivel em "Automacao"

---

## Etapas de Implementacao

### Etapa 1: Migracoes SQL -- Novas tabelas

**Tabela `collection_rules`** -- Regras de cobranca por tenant:
- id, tenant_id, name, channel (whatsapp/email/both), days_offset (negativo=antes, positivo=depois do vencimento), message_template (texto com variaveis como {{nome}}, {{valor}}, {{vencimento}}), is_active, created_at, updated_at
- RLS: isolamento por tenant_id

**Tabela `message_logs`** -- Historico de envios:
- id, tenant_id, client_id, rule_id (nullable), channel, status (sent/failed/pending), phone, email_to, message_body, error_message, sent_at, created_at
- RLS: isolamento por tenant_id

### Etapa 2: Credenciais Gupshup por tenant

Armazenar no campo `tenants.settings` (JSONB) as chaves:
```json
{
  "gupshup_api_key": "...",
  "gupshup_app_name": "...",
  "gupshup_source_number": "5511999999999"
}
```

Atualizar a pagina `TenantSettingsPage.tsx` com uma secao "Integracao WhatsApp (Gupshup)" onde o admin insere:
- API Key (campo password, mascarado)
- App Name
- Numero de origem

Esses dados sao salvos via `updateTenant()` no campo settings.

### Etapa 3: UI de Regras de Cobranca

Nova pagina `/automacao` (acessivel a admins do tenant):
- Lista de regras existentes com toggle ativo/inativo
- Formulario para criar/editar regra:
  - Nome da regra (ex: "Lembrete 3 dias antes")
  - Canal: WhatsApp / Email / Ambos
  - Dias: -3 (3 dias antes), 0 (no dia), +1 (1 dia apos), etc
  - Template da mensagem com variaveis: {{nome}}, {{cpf}}, {{valor_parcela}}, {{data_vencimento}}, {{credor}}
- Preview do template com dados fictícios
- Botao para testar envio manual

### Etapa 4: Edge Function `send-notifications`

Funcao serverless que:
1. Busca todos os tenants ativos
2. Para cada tenant, busca as `collection_rules` ativas
3. Para cada regra, calcula a data alvo (hoje + days_offset) e busca clientes com `data_vencimento` = data alvo e status = "pendente"
4. Le as credenciais Gupshup do `tenant.settings`
5. Envia WhatsApp via Gupshup API (se canal inclui whatsapp e credenciais existem)
6. Envia email via Lovable Cloud auth.admin (se canal inclui email)
7. Registra cada envio em `message_logs`

Gupshup API call:
```
POST https://api.gupshup.io/wa/api/v1/msg
Headers: apikey: {tenant.settings.gupshup_api_key}
Body: channel=whatsapp&source={source}&destination={phone}&message={text}&src.name={app_name}
```

### Etapa 5: UI de Historico de Mensagens

Na pagina `/automacao`, aba "Historico":
- Tabela com: data, cliente, canal, status (enviado/falha), mensagem
- Filtros por periodo, canal, status
- Contadores: total enviado, falhas, taxa de sucesso

### Etapa 6: Cron Job

Configurar um cron via `pg_cron` + `pg_net` para chamar `send-notifications` diariamente (ex: 8h da manha).

### Etapa 7: Rotas e Navegacao

- Adicionar rota `/automacao` no `App.tsx`
- Adicionar item "Automacao" no menu lateral (apenas admins)
- Criar `AutomacaoPage.tsx` com tabs: Regras | Historico

---

## Detalhes Tecnicos

### Migracao SQL

```sql
CREATE TABLE collection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','email','both')),
  days_offset INTEGER NOT NULL DEFAULT 0,
  message_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES collection_rules(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  phone TEXT,
  email_to TEXT,
  message_body TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para ambas tabelas isoladas por tenant
ALTER TABLE collection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

-- Policies: tenant users podem ver, admins podem gerenciar
```

### Arquivos novos

```text
src/
  pages/
    AutomacaoPage.tsx          -- Pagina principal com tabs
  components/
    automacao/
      RulesList.tsx            -- Lista de regras
      RuleForm.tsx             -- Formulario criar/editar regra
      MessageHistory.tsx       -- Tabela de historico
      GupshupSettings.tsx      -- Config WhatsApp na pagina de tenant
  services/
    automacaoService.ts        -- CRUD regras + logs

supabase/
  functions/
    send-notifications/
      index.ts                 -- Edge function principal
```

### Seguranca

- Credenciais Gupshup ficam no campo `settings` da tabela `tenants`, protegido por RLS (somente admin do tenant ve/edita)
- A edge function usa service_role_key para acessar dados de todos os tenants (processamento batch)
- Message logs isolados por tenant via RLS
- Inputs de template validados (sem execucao de codigo, apenas substituicao de variaveis)

---

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Credenciais expostas no frontend | Campo settings protegido por RLS; campo de input mascarado |
| Rate limit do Gupshup | Processar tenants sequencialmente com delay entre envios |
| Template com variaveis invalidas | Validacao no frontend + fallback para texto literal |
| Falha de envio | Registrar em message_logs com status "failed" e error_message |
| Cron nao executando | Log de execucao + status visivel na UI |

