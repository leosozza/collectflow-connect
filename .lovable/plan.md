

## Plano: Corrigir lógica do Dashboard, Relatórios e Analytics para mostrar apenas dados de Acordos

### Problema atual

As três páginas (Dashboard, Relatórios, Analytics) buscam dados da tabela `clients` inteira (a carteira completa com 18 registros). Como não existem acordos (0 na tabela `agreements`), os valores deveriam estar zerados, mas aparecem R$23.796 recebidos e 9 pendentes porque a lógica conta TODA a carteira.

### Lógica correta (conforme o usuário definiu)

```text
Carteira → Importação de dívidas (tabela clients)
Dashboard → Métricas apenas dos ACORDOS formalizados
Relatórios → Informações dos clientes que REALIZAMOS ACORDOS
Analytics → Informações dos NOVOS ACORDOS
```

### Mudanças

---

**1. Dashboard (`src/pages/DashboardPage.tsx`)**

- As métricas "Total Recebido", "Total Quebra", "Pendentes" devem filtrar apenas clientes que possuem acordo (`agreements`)
- Buscar os CPFs que têm acordo na tabela `agreements` e filtrar `clients` apenas por esses CPFs
- O "Total Projetado" também deve considerar apenas parcelas vinculadas a acordos
- A tabela "Meus Clientes" (vencimentos do dia) pode continuar mostrando a carteira completa, pois é operacional
- Acordos do Dia / Acordos do Mês já estão corretos (usam tabela `agreements`)

**2. Relatórios (`src/pages/RelatoriosPage.tsx`)**

- O `filteredClients` deve incluir apenas clientes cujo CPF aparece na tabela `agreements`
- Adicionar filtro base: cruzar CPFs de `clients` com CPFs de `agreements`
- Os cards de resumo, EvolutionChart, AgingReport e OperatorRanking passarão a refletir apenas acordos

**3. Analytics (`src/pages/AnalyticsPage.tsx`)**

- Mesma lógica: filtrar `allClients` para incluir apenas CPFs presentes em `agreements`
- KPIs, gráficos de evolução, pie chart, heatmap e top credores passam a refletir apenas acordos
- Taxa de conversão passa a ser: contatados com acordo vs convertidos (pagos)

---

### Implementação técnica

Em cada página:
1. Buscar agreements: `supabase.from("agreements").select("client_cpf, credor")`
2. Criar um Set de CPFs com acordo: `new Set(agreements.map(a => a.client_cpf?.replace(/\D/g, "")))`
3. Filtrar clients apenas onde `c.cpf.replace(/\D/g, "")` está no Set
4. No Dashboard, manter a tabela de vencimentos do dia com carteira completa (funcionalidade operacional)

### Resultado esperado

Com 0 acordos no sistema, todas as métricas de Dashboard, Relatórios e Analytics mostrarão zero. Quando acordos forem criados e parcelas geradas, os dados aparecerão corretamente.

