

## Plano: Exportação PDF/Excel em todos os módulos + Prestação de Contas

### Resumo
Adicionar botões de exportação Excel e PDF em 4 componentes existentes, e criar uma nova aba "Prestação de Contas" na página de Relatórios que gera um relatório completo por credor.

### Abordagem técnica
- **Excel**: usar `xlsx` (já instalado)
- **PDF**: usar `window.print()` com CSS `@media print` dedicado — evita instalar nova dependência

---

### 1. Criar utilitário de exportação compartilhado

**Novo arquivo**: `src/lib/exportUtils.ts`

Funções reutilizáveis:
- `exportToExcel(rows, sheetName, fileName)` — encapsula lógica xlsx
- `printPDF(elementId)` — aplica classe CSS para isolar conteúdo e chama `window.print()`

---

### 2. AgingReport — Botões Excel/PDF

**Arquivo**: `src/components/relatorios/AgingReport.tsx`

- Adicionar botões "Excel" e "PDF" no header do card
- Excel: exporta as 4 faixas com colunas Faixa, Quantidade, Valor Total, % do Total
- PDF: usa `window.print()` com escopo no componente

---

### 3. OperatorRanking — Botões Excel/PDF

**Arquivo**: `src/components/relatorios/OperatorRanking.tsx`

- Botões no header ao lado do ícone Trophy
- Excel: colunas #, Operador, Parcelas, Recebido, Quebra, % Sucesso
- PDF: `window.print()`

---

### 4. CarteiraTable — Botão Excel

**Arquivo**: `src/components/carteira/CarteiraTable.tsx`

- Botão "Exportar Excel" no header do card (ao lado do contador de registros)
- Colunas: Nome, CPF, Credor, Parcela, Valor, Vencimento, Score

---

### 5. AcordosPage — Botão Excel

**Arquivo**: `src/pages/AcordosPage.tsx`

- Botão "Exportar Excel" na barra de filtros
- Exporta `filteredAgreements` com colunas: Cliente, CPF, Credor, Valor Original, Valor Proposto, Desconto%, Parcelas, Valor Parcela, 1º Vencimento, Status, Data Criação

---

### 6. Prestação de Contas (novo componente + aba)

**Novo arquivo**: `src/components/relatorios/PrestacaoContas.tsx`

Componente que:
1. Lista todos os credores em um Select
2. Ao selecionar um credor, calcula e exibe:
   - **Resumo**: total de parcelas, valor total da carteira, total recebido, total pendente, total quebra, taxa de recuperação
   - **Aging**: distribuição por faixa de atraso
   - **Acordos**: total de acordos, aprovados, pendentes, cancelados, valor negociado vs original
   - **Operadores**: ranking por credor
   - **Parcelas detalhadas**: tabela com todas as parcelas do credor
3. Botão "Exportar Excel" — gera workbook com múltiplas abas (Resumo, Aging, Acordos, Parcelas)
4. Botão "Exportar PDF" — `window.print()` do conteúdo

**Arquivo**: `src/pages/RelatoriosPage.tsx`
- Adicionar Tabs no topo: "Visão Geral" (conteúdo atual) | "Prestação de Contas"
- Importar e renderizar `PrestacaoContas` na segunda aba, passando `clients`, `agreements`, `profiles`, `credores`

---

### 7. CSS para impressão

**Arquivo**: `src/index.css`

Adicionar regras `@media print` para:
- Esconder sidebar, header, botões de ação
- Garantir fundo branco e texto preto
- Forçar quebras de página entre seções

---

### Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `src/lib/exportUtils.ts` | Criar — funções utilitárias |
| `src/components/relatorios/AgingReport.tsx` | Editar — adicionar botões export |
| `src/components/relatorios/OperatorRanking.tsx` | Editar — adicionar botões export |
| `src/components/carteira/CarteiraTable.tsx` | Editar — adicionar botão Excel |
| `src/pages/AcordosPage.tsx` | Editar — adicionar botão Excel |
| `src/components/relatorios/PrestacaoContas.tsx` | Criar — componente completo |
| `src/pages/RelatoriosPage.tsx` | Editar — adicionar aba Prestação de Contas |
| `src/index.css` | Editar — adicionar `@media print` |

