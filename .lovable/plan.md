

## Plano: Relatório de Importação (Rejeitados + Atualizados)

Após a importação no MaxList, exibir um dialog/card de resumo detalhado mostrando:
- Clientes **rejeitados** pelo sistema (sem CPF, sem nome, sem título) com o motivo
- Clientes que foram **atualizados** (já existiam) com os campos que mudaram
- Clientes **inseridos** com sucesso

### Alterações

**`src/pages/MaxListPage.tsx`**:
1. Adicionar estado para armazenar o relatório de importação: `importReport` com listas de `rejected`, `updated`, `inserted`
2. Na função `handleMappingConfirmed`, antes do filtro `filteredItems`, capturar os registros que foram removidos pelo filtro (sem CPF/nome/título) como "rejeitados" com o motivo específico
3. Usar os `changeLogs` já calculados para listar os clientes atualizados com os campos que mudaram
4. Após importação, abrir um dialog de resultado com 3 seções colapsáveis (Accordion):
   - **Inseridos**: quantidade e badge verde
   - **Atualizados**: lista com nome, CPF e campos alterados (old → new)
   - **Rejeitados**: lista com nome/CPF parcial e motivo (ex: "CPF ausente", "Nome ausente", "Título ausente")

**`src/components/maxlist/ImportResultDialog.tsx`** (novo):
- Dialog com resumo visual (badges coloridos para cada categoria)
- Accordion com detalhes expandíveis para rejeitados e atualizados
- Botão "Fechar" e opção de "Download relatório" em Excel

### Dados capturados

```text
rejected[] = { record, reason: "CPF ausente" | "Nome ausente" | "Título ausente" }
updated[]  = { nome, cpf, changes: { campo: { old, new } } }
inserted   = count
skipped    = count (erros de lote)
```

### Arquivos
- **Criar**: `src/components/maxlist/ImportResultDialog.tsx`
- **Editar**: `src/pages/MaxListPage.tsx` (capturar rejeitados, passar dados ao dialog)

