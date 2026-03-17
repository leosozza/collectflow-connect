

# Fix campos expandidos no Atendimento + Mover config para dentro do Credor

## Problemas identificados

1. **Campos mostram UUIDs**: `tipo_devedor`, `tipo_divida` e `status_cobranca` exibem IDs em vez de nomes legíveis — os renderers usam `c.tipo_devedor_id` diretamente
2. **Config deve ser por credor, não por tenant**: Cada credor pode ter campos diferentes relevantes para o operador
3. **Aba "Campos do Atendimento" em Cadastros**: Deve ser removida de lá e movida para dentro do CredorForm, na aba "Negociação"

## Mudanças

### 1. Migration: Adicionar coluna `credor_id` à tabela `atendimento_field_config`

```sql
ALTER TABLE public.atendimento_field_config ADD COLUMN credor_id UUID REFERENCES credores(id) ON DELETE CASCADE;
-- Drop old unique constraint (tenant_id, field_key)
-- Add new unique constraint (credor_id, field_key)
-- Update RLS policies accordingly
```

### 2. Service `atendimentoFieldsService.ts`
- Alterar `fetchFieldConfig` para filtrar por `credor_id` em vez de apenas `tenant_id`
- Alterar `seedDefaultFields` para receber `credorId`
- Alterar `toggleFieldVisibility` — sem mudança

### 3. `ClientHeader.tsx` — Fix dos campos com UUID
- Para `tipo_devedor`, `tipo_divida`, `status_cobranca`: renderizar o nome (via join ou lookup) em vez do UUID
- O `client` já vem com `select("*")` — verificar se há campos de nome disponíveis ou se precisa resolver via lookup
- Buscar config por `credor_id` do client (via `client.credor_id` ou nome do credor)

### 4. Mover config para CredorForm → aba Negociação
- **Novo componente**: `CredorAtendimentoFieldsConfig.tsx` (versão compacta do `AtendimentoFieldsConfig` que recebe `credorId`)
- Adicionar dentro de `<TabsContent value="negociacao">` no `CredorForm.tsx`, como seção colapsável ao final
- Remover item "campos_atendimento" do `CadastrosPage.tsx`

### 5. Remover `AtendimentoFieldsConfig.tsx` de Cadastros
- Remover import e renderização em `CadastrosPage.tsx`
- O componente pode ser deletado ou reutilizado pelo novo componente do Credor

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Adicionar `credor_id`, ajustar unique constraint |
| `src/services/atendimentoFieldsService.ts` | Queries por `credor_id` |
| `src/components/atendimento/ClientHeader.tsx` | Fix UUIDs + buscar config por credor |
| `src/components/cadastros/CredorForm.tsx` | Adicionar seção de campos do atendimento na aba Negociação |
| `src/pages/CadastrosPage.tsx` | Remover "Campos do Atendimento" da nav |
| `src/components/cadastros/AtendimentoFieldsConfig.tsx` | Refatorar para aceitar `credorId` prop |

