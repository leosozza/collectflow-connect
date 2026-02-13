

# Suporte a Multiplas Instancias Baylers

## Resumo

Atualmente o sistema suporta apenas **uma** instancia Baylers por tenant, armazenada no campo `settings` (jsonb) da tabela `tenants`. A mudanca consiste em criar uma tabela dedicada `whatsapp_instances` para armazenar N instancias por tenant, com uma UI que permite adicionar, editar, remover e definir qual e a instancia padrao.

## O que muda

### 1. Nova tabela: `whatsapp_instances`

Campos:
- `id` (uuid, PK)
- `tenant_id` (uuid, NOT NULL, FK tenants)
- `name` (text) - nome amigavel (ex: "Vendas", "Cobranca")
- `instance_name` (text) - nome tecnico da instancia na API
- `instance_url` (text, NOT NULL) - URL base da API
- `api_key` (text, NOT NULL) - chave de autenticacao
- `is_default` (boolean, default false) - instancia padrao do tenant
- `status` (text, default 'active') - active/inactive
- `created_at`, `updated_at`

RLS: mesmas regras de admin manage + users select do tenant.

### 2. UI refatorada no WhatsAppIntegrationTab

O card "Baylers" deixa de ter campos fixos e passa a ter:

- Lista das instancias cadastradas (cards compactos com nome, URL, status, badge "Padrao")
- Botao "+ Nova Instancia" que abre um formulario (Dialog)
- Formulario com campos: Nome, URL da Instancia, API Key, Nome da Instancia
- Acoes por instancia: Editar, Remover, Definir como padrao
- O card do Gupshup permanece inalterado

### 3. Logica de envio atualizada

Na edge function `send-bulk-whatsapp` e no `WhatsAppChat`:
- Quando o provider e "baylers", buscar a instancia marcada como `is_default = true`
- Futuramente o operador podera escolher qual instancia usar (nao nesta fase)

### 4. Migracao de dados

Os campos `baylers_*` que ja existem no `tenant.settings` serao mantidos como fallback. A logica na edge function verificara primeiro a tabela `whatsapp_instances`, e se vazia usara o settings legado.

---

## Detalhes tecnicos

### Migracao SQL

```text
CREATE TABLE whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  instance_name TEXT NOT NULL DEFAULT 'default',
  instance_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;

-- Admins manage
CREATE POLICY "Tenant admins can manage whatsapp instances"
  ON whatsapp_instances FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Users view
CREATE POLICY "Tenant users can view whatsapp instances"
  ON whatsapp_instances FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Arquivos a criar

| Arquivo | Descricao |
|---|---|
| `src/services/whatsappInstanceService.ts` | CRUD para instancias (fetch, create, update, delete, setDefault) |
| `src/components/integracao/BaylersInstanceForm.tsx` | Dialog de criar/editar instancia |
| `src/components/integracao/BaylersInstancesList.tsx` | Lista de instancias com acoes |

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `src/components/integracao/WhatsAppIntegrationTab.tsx` | Substituir card unico por lista de instancias |
| `supabase/functions/send-bulk-whatsapp/index.ts` | Buscar instancia default da tabela, fallback para settings |
| `src/components/carteira/WhatsAppBulkDialog.tsx` | Atualizar verificacao de credenciais para considerar instancias |

### Fluxo do usuario

```text
/integracao > WhatsApp > Card Baylers
  -> Lista vazia: "Nenhuma instancia configurada"
  -> Clica "+ Nova Instancia"
  -> Dialog: Nome, URL, API Key, Nome da Instancia
  -> Salva -> Aparece na lista com acoes
  -> Pode adicionar mais instancias
  -> Marca uma como "Padrao" (estrela)
  -> Ao salvar, define whatsapp_provider = "baylers" no tenant
```

### Sobre limites por plano

A tabela ja fica preparada para que futuramente voce adicione um campo `max_whatsapp_instances` na tabela `plans.limits` (jsonb). A validacao podera ser feita no frontend (ao clicar "+ Nova Instancia") ou via trigger no banco. Nesta fase nao sera implementado o limite -- apenas a estrutura que permite N instancias.

