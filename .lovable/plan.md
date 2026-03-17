

# Categorização do Devedor (por Credor)

## Conceito
Novo sistema de categorização vinculado ao **credor** (diferente do "Perfil do Devedor" que é por tenant). Cada credor define suas próprias categorias de devedor. Na tela de atendimento, o operador pode selecionar a categoria do devedor — aparece abaixo da "Categorização da Chamada".

## Mudanças no Banco de Dados

### 1. Nova tabela `debtor_categories`
Armazena as categorias configuradas por credor:
```sql
CREATE TABLE debtor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  credor_id UUID NOT NULL REFERENCES credores(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT DEFAULT '#6B7280',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(credor_id, nome)
);
ALTER TABLE debtor_categories ENABLE ROW LEVEL SECURITY;
-- RLS: tenant isolation
CREATE POLICY "tenant_isolation" ON debtor_categories
  FOR ALL TO authenticated
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());
```

### 2. Nova coluna em `clients`
```sql
ALTER TABLE clients ADD COLUMN debtor_category_id UUID REFERENCES debtor_categories(id) ON DELETE SET NULL;
```

## Mudanças no Frontend

### 1. Componente `CredorDebtorCategoriesConfig` (novo)
- CRUD de categorias para o credor selecionado (nome, descrição, cor)
- Chips com cor editáveis, drag-reorder para sort_order
- Localizado em `src/components/cadastros/CredorDebtorCategoriesConfig.tsx`

### 2. `CredorForm.tsx` — Aba Personalização
- Nova seção colapsável "Categorização do Devedor" entre "Campos Personalizados" e "Scripts de Abordagem"
- Renderiza `<CredorDebtorCategoriesConfig credorId={editing?.id} />`

### 3. Componente `DebtorCategoryPanel` (novo)
- Card com título "Categorização do Devedor", similar ao DispositionPanel
- Exibe as categorias do credor do cliente como chips clicáveis com cor
- Ao clicar, atualiza `clients.debtor_category_id` via Supabase
- Localizado em `src/components/atendimento/DebtorCategoryPanel.tsx`

### 4. `AtendimentoPage.tsx`
- Importar e renderizar `<DebtorCategoryPanel />` abaixo de `<DispositionPanel />`
- Passar `clientId`, `credorName` e `tenantId` como props
- O componente busca o `credor_id` internamente e lista as categorias disponíveis

## Arquivos Envolvidos
- **Novo**: `src/components/cadastros/CredorDebtorCategoriesConfig.tsx`
- **Novo**: `src/components/atendimento/DebtorCategoryPanel.tsx`
- **Editar**: `src/components/cadastros/CredorForm.tsx` (adicionar seção na aba Personalização)
- **Editar**: `src/pages/AtendimentoPage.tsx` (renderizar DebtorCategoryPanel)
- **Migration**: criar tabela + coluna

