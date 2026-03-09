

## Plano: Mover toggle "Mar Aberto / Atribuição" para o Cadastro do Credor

### Contexto
O toggle de modo da carteira está atualmente em Configurações do Tenant (global). O usuário quer que fique **por credor**, dentro da aba "Dados" do formulário de edição do credor.

### Alterações

**1. Migração — Adicionar coluna `carteira_mode` na tabela `credores`**
- `carteira_mode text default 'open'` (valores: `"open"` ou `"assigned"`)
- Remover dependência do `tenant.settings.carteira_mode`

**2. `src/components/cadastros/CredorForm.tsx` — Toggle na aba Dados**
- Após os campos de telefone/email (~linha 324), adicionar um bloco com:
  - Label "Modo da Carteira"
  - Dois botões radio ou um Switch: "Mar Aberto" / "Atribuição"
  - Descrição explicativa abaixo
- O valor é salvo no campo `carteira_mode` do credor via `form.carteira_mode`

**3. `src/pages/CarteiraPage.tsx` — Lógica por credor**
- Em vez de ler `tenant.settings.carteira_mode`, verificar o `carteira_mode` do credor associado ao cliente (`client.credor`)
- Buscar os credores e montar um mapa `credorName -> carteira_mode`
- A lógica de filtragem e mascaramento usa o modo do credor do cliente, não o global

**4. `src/pages/TenantSettingsPage.tsx` — Remover aba Carteira**
- Remover a aba "Carteira" e todo o bloco de configuração do modo, já que agora é por credor

### Arquivos alterados
- **Migração SQL**: `ALTER TABLE credores ADD COLUMN carteira_mode text DEFAULT 'open'`
- `src/components/cadastros/CredorForm.tsx`
- `src/pages/CarteiraPage.tsx`
- `src/pages/TenantSettingsPage.tsx`

