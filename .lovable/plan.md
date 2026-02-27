

## Plano: Criar aba /acordos na sidebar e reestruturar a página

### 1) Adicionar link "Acordos" na sidebar (`AppLayout.tsx`)

- Inserir item "Acordos" logo abaixo de "Carteira" no array `preContactItems`, usando ícone `Handshake` (lucide)
- Condição de visibilidade: `permissions.canViewAcordos`

### 2) Filtrar acordos por operador vs admin (`AcordosPage.tsx`)

- Atualizar `fetchAgreements` no service para aceitar filtro `created_by`
- Na página, se o usuário **não** for admin (`!permissions.canApproveAcordos`), filtrar apenas acordos criados pelo próprio operador (`created_by = user.id`)
- Se admin, mostrar todos os acordos

### 3) Integrar aba de "Liberação" dentro da página de Acordos para admin

- Para admin (`permissions.canApproveLiberacoes`), adicionar uma `Tabs` com duas abas: "Todos os Acordos" e "Aguardando Liberação"
- A aba "Aguardando Liberação" filtra automaticamente por `status = pending_approval`
- Isso traz a funcionalidade de liberação para dentro da mesma página

### 4) Atualizar `agreementService.ts`

- `fetchAgreements` aceita novo filtro opcional `created_by` para filtrar por operador

### 5) Atualizar header titles em `AppLayout.tsx`

- Já existe `/acordos` no `pageTitles` — manter

### Detalhes Técnicos

- Operador: vê apenas seus acordos, sem botões de aprovar/rejeitar
- Admin: vê todos os acordos + aba "Aguardando Liberação" com botões de aprovar/rejeitar
- Nenhuma alteração de banco necessária — RLS já filtra por tenant

