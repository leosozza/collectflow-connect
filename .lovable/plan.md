

# Plano: Adicionar seletor de Credor no MaxList

## Problema
O credor está hardcoded como `"YBRASIL"` em 3 pontos do código. Para suportar múltiplos credores no tenant YBRASIL, o operador precisa escolher o credor antes de importar.

## Alterações em `src/pages/MaxListPage.tsx`

### 1. Buscar credores do tenant
Adicionar query para carregar credores da tabela `credores` (usando `fetchCredores` de `cadastrosService.ts` ou query direta), similar ao que já existe para `tiposStatus`.

### 2. Novo estado `selectedCredorName`
- Estado: `const [selectedCredorName, setSelectedCredorName] = useState<string>("")`
- Valor padrão vazio — obrigatório selecionar antes de importar

### 3. Dropdown de seletor de credor na UI (linha ~888)
Adicionar um `Select` ao lado do seletor de status existente, antes do botão "Enviar para CRM":
- Label: "Credor"
- Opções: lista de credores do tenant (razao_social)
- Obrigatório — botão de envio desabilitado se não selecionado

### 4. Substituir hardcode nos 3 pontos
- **Linha 131** (`mapItem`): `CREDOR: "YBRASIL"` → `CREDOR: selectedCredorName`
  - `mapItem` precisa receber o credor como parâmetro
- **Linha 543** (`buildRecordFromMapping`): `credor: "YBRASIL"` → `credor: selectedCredorName`
  - Idem, receber como parâmetro
- **Linha 758** (log de importação): `credor: "YBRASIL"` → `credor: selectedCredorName`

### 5. Aumentar BATCH_SIZE
- Linha 56: `BATCH_SIZE = 200` → `BATCH_SIZE = 1000`

### 6. Validação
Bloquear envio se nenhum credor selecionado, exibindo toast de erro.

## Resultado
O operador seleciona o credor na interface antes de importar. Todos os registros da API são atribuídos ao credor escolhido, independente da origem. Suporta futuros credores sem alteração de código.

