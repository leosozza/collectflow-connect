

## Plano: Mapeamento de Campos para Importação

### Objetivo
Criar uma tela de configuração de mapeamento de campos por tenant/credor, onde o usuário define como as colunas da planilha ou da API devem ser traduzidas para os campos do sistema. Isso permite validação prévia e flexibilidade para diferentes formatos de arquivos.

### Situação atual
- O mapeamento de colunas hoje é **hardcoded** em `importService.ts` (linhas 110-153) e `clients-api/index.ts` (linhas 51-89)
- Funciona bem para formatos conhecidos (Pagamentos_2.xlsx, MaxSystem), mas falha com planilhas que usam nomes de coluna diferentes
- Não há como o usuário ver ou ajustar o mapeamento antes de importar

### 1) Criar tabela `field_mappings` no banco

```sql
CREATE TABLE public.field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,             -- ex: "Planilha Credor X"
  credor TEXT,                    -- opcional, vincular a um credor
  source TEXT NOT NULL DEFAULT 'spreadsheet', -- 'spreadsheet' | 'api'
  mappings JSONB NOT NULL DEFAULT '{}',
  -- formato: { "NOME_COLUNA_ORIGEM": "campo_destino", ... }
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.field_mappings ENABLE ROW LEVEL SECURITY;
```

RLS: admins do tenant podem CRUD, usuários do tenant podem visualizar.

### 2) Criar componente `FieldMappingConfig`

**Arquivo:** `src/components/cadastros/FieldMappingConfig.tsx`

- Lista os mapeamentos existentes do tenant
- Formulário para criar/editar mapeamento:
  - Nome do mapeamento
  - Credor associado (opcional, select dos credores)
  - Tipo: Planilha ou API
  - Tabela de mapeamento: coluna origem (texto livre) → campo destino (select com campos do sistema)
  - Campos destino disponíveis: `nome_completo`, `cpf`, `credor`, `external_id`, `phone`, `email`, `endereco`, `cidade`, `uf`, `cep`, `numero_parcela`, `valor_parcela`, `valor_entrada`, `valor_pago`, `data_vencimento`, `status`, `observacoes`
  - Botão para adicionar/remover linhas de mapeamento
- Marcar um mapeamento como padrão

### 3) Adicionar tab "Mapeamento de Campos" em Cadastros

**Arquivo:** `src/pages/CadastrosPage.tsx`

- Nova entrada no menu lateral: ícone `Columns` + label "Mapeamento de Campos"
- Renderiza `FieldMappingConfig`

### 4) Integrar mapeamento no ImportDialog

**Arquivo:** `src/components/clients/ImportDialog.tsx`

- Após upload do arquivo, antes do preview:
  1. Detectar colunas do arquivo automaticamente
  2. Buscar mapeamentos salvos do tenant
  3. Se houver match automático, aplicar; senão, mostrar interface de mapeamento manual
  4. Exibir preview com validação campo a campo (verde = ok, vermelho = erro)
  5. Permitir ajustar mapeamento inline antes de confirmar
- Salvar mapeamento usado para reutilização futura (opção "Salvar este mapeamento")

### 5) Integrar mapeamento na API (clients-api)

**Arquivo:** `supabase/functions/clients-api/index.ts`

- No endpoint POST `/clients/bulk`, aceitar parâmetro opcional `mapping_id`
- Se fornecido, buscar o mapeamento do banco e aplicar antes da normalização padrão
- Mapeamento customizado tem prioridade sobre o hardcoded

### 6) Criar service `fieldMappingService.ts`

**Arquivo:** `src/services/fieldMappingService.ts`

- `fetchFieldMappings(tenantId)` — listar mapeamentos
- `createFieldMapping(data)` — criar
- `updateFieldMapping(id, data)` — atualizar
- `deleteFieldMapping(id)` — remover
- `autoDetectMapping(headers: string[], savedMappings)` — encontrar melhor match

### Arquivos criados
- `src/components/cadastros/FieldMappingConfig.tsx`
- `src/services/fieldMappingService.ts`

### Arquivos editados
- `src/pages/CadastrosPage.tsx` (nova tab)
- `src/components/clients/ImportDialog.tsx` (step de mapeamento)
- `src/services/importService.ts` (usar mapeamento dinâmico)
- `supabase/functions/clients-api/index.ts` (suporte a `mapping_id`)

### Migração SQL
- Criar tabela `field_mappings` com RLS

