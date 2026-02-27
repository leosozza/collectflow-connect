

## Plano: Ajustar página /acordos

### 1) Remover botão "Nova Proposta"
- Remover o `<AgreementForm>` do header e seu import
- Remover `handleCreate` e imports não utilizados (`createAgreement`, `AgreementFormData`)

### 2) Alterar Stat Cards para 3 cards apenas com quantidades
- **Total de Acordos**: `activeAgreements.length`
- **Pendentes**: `pending` (count)
- **Pagos**: acordos com `status === "approved"` (count)
- Remover card "Valor Renegociado" e import `formatCurrency`
- Grid: `md:grid-cols-3`

### 3) Adicionar filtro por Credor
- Extrair lista única de credores dos agreements carregados
- Adicionar `credorFilter` state (default "todos")
- Novo `<Select>` ao lado do filtro de status

### 4) Adicionar campo de pesquisa por nome/CPF
- State `searchQuery`
- `<Input>` com placeholder "Buscar por nome ou CPF..."
- Filtrar `agreements` localmente por `client_name` ou `client_cpf` (case-insensitive, contains)

### 5) Aplicar filtros na lista exibida
- Criar `filteredAgreements` memo que aplica `credorFilter` e `searchQuery` sobre `agreements`
- Usar `filteredAgreements` em `renderAgreementsList` e nas tabs

**Arquivo alterado:** `src/pages/AcordosPage.tsx` (único)

