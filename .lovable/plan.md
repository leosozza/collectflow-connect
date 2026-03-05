

## Plano: Remover coluna Modelo da Carteira e exibir no perfil do cliente

### Alterações

**1. `src/pages/CarteiraPage.tsx`**
- Remover a `<TableHead>Modelo</TableHead>` (linha 636)
- Remover a `<TableCell>` correspondente que exibe `observacoes?.replace(...)` (linhas 670-672)
- Manter a sequência das colunas restantes: Checkbox → Nome → CPF → Credor → 1º Vencimento → Valor Total → Score → Status Cobrança → Ações

**2. `src/pages/ClientDetailPage.tsx`**
- Remover a coluna "Modelo" da tabela de títulos (linha 212 `<TableHead>Modelo</TableHead>` e linha 235-237 `<TableCell>`)

**3. `src/components/client-detail/ClientDetailHeader.tsx`**
- Na seção "Mais informações do devedor", adicionar um `<InfoItem>` para "Modelo" no grid de Identificação (após Cod. Contrato), exibindo `client.model_name`
- O campo `model_name` já existe na tabela `clients` do banco de dados

### Observações
- O campo `model_name` já é populado durante a importação via MaxList (campo `ModelName` ou `Model_Name` do payload)
- Nenhuma alteração no banco de dados necessária
- A coluna `model_name` já consta no schema da tabela `clients`

