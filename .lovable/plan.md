

# Atualizar Dashboard Executivo: Exportação + Customer Health

## Resumo

Adicionar botões de exportação (Excel/PDF) em cada aba existente e criar nova aba "Customer Health" com Health Score calculado automaticamente. Tudo dentro do `AdminDashboardPage.tsx` existente.

## Alterações

### 1. `src/pages/AdminDashboardPage.tsx`

**Exportação por aba:**
- Adicionar dois botões (Exportar Excel / Exportar PDF) no canto superior direito de cada TabsContent
- Excel: usar `exportToExcel` já existente em `src/lib/exportUtils.ts`
- PDF: usar `window.print()` com CSS de impressão (mesmo padrão do `printSection` existente), envolvendo cada aba em um div com id para impressão
- Cada aba gera dados específicos conforme especificado (MRR/ARR/Ticket Médio para Receita, etc.)

**Nova aba "Customer Health":**
- Adicionar `TabsTrigger` para "Customer Health" com ícone `HeartPulse`
- Calcular Health Score (0-100) por tenant baseado em:
  - Dias desde último login (peso 40%): 0 dias = 40pts, >30 dias = 0pts
  - Atividade no mês (peso 30%): proporção de dias ativos
  - Número de usuários ativos vs total (peso 30%)
- Classificação: 80-100 = Saudável, 50-79 = Atenção, 0-49 = Em Risco
- Tabela com colunas: Cliente, Plano, Health Score (barra visual), Status, Último Login, Dias Inativo
- Botões de exportação Excel/PDF

### 2. `src/lib/exportUtils.ts`

- Adicionar função `exportToPDF(elementId, fileName)` que usa `window.print()` com isolamento CSS do elemento alvo (reutilizando o padrão `printSection` existente)

## Dados por aba na exportação

| Aba | Colunas exportadas |
|-----|-------------------|
| Receita | MRR, ARR, Receita Mês, Ticket Médio, Plano, Receita por Plano |
| Crescimento | Total Clientes, Novos Mês, Novos 7d, Crescimento%, Ativos, Inativos |
| Uso | DAU, WAU, MAU, Total Usuários, Top Páginas |
| Cancelamento | Cancelados, Churn%, Churn Anual%, Receita Perdida, Histórico |
| Operacional | Tickets Abertos, Resolvidos, Total, Por Prioridade |
| Saúde | Saudáveis, Moderados, Risco, Sem Login 30d |
| Customer Health | Cliente, Plano, Score, Status, Último Login, Inatividade |

## Arquivos a alterar

| Arquivo | Ação |
|---------|------|
| `src/pages/AdminDashboardPage.tsx` | Adicionar exportação em cada aba + nova aba Customer Health |
| `src/lib/exportUtils.ts` | Adicionar helper `exportToPDF` |

