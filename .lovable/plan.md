

## Plano: Mapeamento no MaxList + Campos Personalizados + Upsert com Histórico

### 1) Modal de mapeamento no MaxList ao enviar para CRM

**Arquivo: `src/pages/MaxListPage.tsx`**

Quando o usuário clicar "Enviar para CRM", ao invés de importar direto:
- Abrir um modal de mapeamento mostrando os campos do MaxSystem (CREDOR, COD_DEVEDOR, NOME_DEVEDOR, etc.) → campos do sistema
- Na primeira vez, o mapeamento é manual; ao confirmar, salvar automaticamente como `FieldMapping` com `source: "api"` e `name: "MaxSystem - YBRASIL"` na tabela `field_mappings`
- Nas importações seguintes, detectar automaticamente o mapeamento salvo e pré-aplicar (o usuário pode ajustar se quiser)
- Reutilizar a lógica do `ImportDialog` (step mapping) extraída em um componente compartilhado ou criando um `MaxListMappingDialog`

### 2) Campos personalizados (custom fields)

**Migração SQL** — criar tabela `custom_fields`:
```sql
CREATE TABLE public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  field_key TEXT NOT NULL,        -- ex: "campo_extra_1"
  field_label TEXT NOT NULL,      -- ex: "Nº Processo"
  field_type TEXT NOT NULL DEFAULT 'text', -- text, number, date, select
  options JSONB DEFAULT '[]',     -- para tipo select
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
-- RLS: admins manage, users view
```

**Migração SQL** — adicionar coluna `custom_data JSONB DEFAULT '{}'` na tabela `clients` para armazenar valores dos campos personalizados.

**Atualizar `SYSTEM_FIELDS`** em `fieldMappingService.ts`:
- Ao carregar os campos disponíveis para mapeamento, buscar também os `custom_fields` do tenant e adicioná-los dinamicamente à lista de campos destino (exibidos com prefixo "🏷️" para diferenciá-los)

**UI em Cadastros**: Criar tab "Campos Personalizados" ou seção dentro de "Mapeamento de Campos" para CRUD de custom fields.

### 3) Upsert por CPF ao importar (update se já existe)

**MaxList** (`handleSendToCRM`): Já usa `upsert` com `onConflict: "external_id,tenant_id"` — funciona para MaxList.

**ImportDialog / CarteiraPage**: Alterar `bulkCreateClients` em `clientService.ts` para usar `upsert` com `onConflict: "external_id,tenant_id"` ao invés de `insert`, garantindo que registros existentes com mesmo CPF/external_id sejam atualizados.

Para cenários sem `external_id`, adicionar lógica de deduplicação por CPF: antes do insert, buscar CPFs existentes e fazer update se encontrado.

### 4) Histórico de atualizações dos clientes

**Migração SQL** — criar tabela `client_update_logs`:
```sql
CREATE TABLE public.client_update_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  updated_by UUID,
  source TEXT NOT NULL DEFAULT 'import', -- import, api, manual
  changes JSONB NOT NULL DEFAULT '{}',   -- {field: {old: x, new: y}}
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.client_update_logs ENABLE ROW LEVEL SECURITY;
```

**Lógica de registro**: No `handleSendToCRM` (MaxList) e `bulkCreateClients` (importação planilha):
- Antes do upsert, buscar os registros existentes por `external_id` ou CPF
- Comparar campos que mudaram (valor_parcela, status, phone, etc.)
- Inserir um registro em `client_update_logs` com as diferenças

**UI**: Na página de detalhe do cliente (`ClientDetailPage`), adicionar seção "Histórico de Atualizações" mostrando timeline de mudanças com data, fonte e campos alterados.

### Arquivos criados
- `src/components/maxlist/MaxListMappingDialog.tsx` — modal de mapeamento para MaxList
- `src/components/cadastros/CustomFieldsConfig.tsx` — CRUD de campos personalizados

### Arquivos editados
- `src/pages/MaxListPage.tsx` — integrar modal de mapeamento
- `src/services/fieldMappingService.ts` — incluir custom fields nos campos disponíveis
- `src/services/clientService.ts` — `bulkCreateClients` usar upsert + registrar histórico
- `src/pages/CadastrosPage.tsx` — nova tab "Campos Personalizados"
- `src/pages/ClientDetailPage.tsx` — seção de histórico de atualizações

### Migrações SQL
1. Tabela `custom_fields` + RLS
2. Coluna `custom_data JSONB` em `clients`
3. Tabela `client_update_logs` + RLS

