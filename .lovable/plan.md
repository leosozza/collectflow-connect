

# Categorização da Chamada — Renomear, Atualizar Defaults e Criar Aba em /cadastros

## Resumo

1. Renomear "Categorização do Chamado" → "Categorização da Chamada" no DispositionPanel
2. Renomear "NEGOCIAR AGORA" → "FORMALIZAR ACORDO"
3. Atualizar defaults de disposições: Caixa Postal, Ligação Interrompida, Não Atende, CPC, Contato Pessoa Errada
4. Criar tabela `call_disposition_types` no banco para que cada tenant gerencie suas categorizações
5. Criar componente `CallDispositionTypesTab` para CRUD na aba de /cadastros
6. Atualizar DispositionPanel para buscar tipos do banco (com fallback nos defaults)

## Banco de dados

Nova tabela `call_disposition_types`:
```sql
CREATE TABLE call_disposition_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  group_name text DEFAULT 'resultado',
  sort_order int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX ON call_disposition_types(tenant_id, key);
ALTER TABLE call_disposition_types ENABLE ROW LEVEL SECURITY;
-- RLS policies for tenant isolation
```

## Arquivos a modificar

### `src/services/dispositionService.ts`
- Atualizar `DISPOSITION_TYPES` com os novos defaults: `voicemail` → "Caixa Postal", `interrupted` → "Ligação Interrompida", `no_answer` → "Não Atende", `cpc` → "CPC (Contato com a Pessoa Certa)", `wrong_contact` → "Contato Pessoa Errada"
- Remover `callback`, `negotiated`, `promise` dos defaults de resultado (callback fica no card separado, negotiated é ação)
- Adicionar `fetchTenantDispositionTypes(tenantId)` que busca da tabela `call_disposition_types`

### `src/components/atendimento/DispositionPanel.tsx`
- Título: "Categorização da Chamada"
- Botão: "FORMALIZAR ACORDO" em vez de "NEGOCIAR AGORA"
- Buscar tipos do banco via query, com fallback nos defaults
- Atualizar `DEFAULT_GROUP_MAP` para os novos keys

### `src/components/cadastros/CallDispositionTypesTab.tsx` (novo)
- CRUD de tipos de categorização por tenant
- Tabela com colunas: Label, Grupo, Ativo, Ações (editar/excluir)
- Dialog para adicionar/editar com campos: key, label, group_name, active
- Key gerada automaticamente a partir do label (slug)

### `src/pages/CadastrosPage.tsx`
- Adicionar item `{ key: "categorizacao_chamada", label: "Categorização da Chamada", icon: Headset }` no grupo "Cadastros"
- Importar e renderizar `CallDispositionTypesTab` quando ativo

### `src/pages/AtendimentoPage.tsx`
- Texto do DialogTitle: "Formalizar Acordo" (já está correto, verificar consistência)

