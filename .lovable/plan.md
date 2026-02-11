

# Fase 3: Relatorios, Portal do Devedor, Acordos e Financeiro

## Resumo

Fase 3 abrange quatro modulos complementares que transformam o sistema de um gestor operacional em uma plataforma completa de cobranca. Dado o volume, sera dividida em sub-fases incrementais para entrega progressiva.

---

## Sub-Fase 3A: Relatorios e Analytics

### O que muda para o usuario
- Nova pagina `/relatorios` com graficos de evolucao mensal (recebimento vs quebra ao longo do tempo)
- Relatorio de desempenho por operador com ranking
- Relatorio de aging (envelhecimento da carteira) mostrando parcelas vencidas por faixas de dias
- Exportacao de relatorios em Excel/PDF
- Filtros por periodo, operador, credor e status

### Detalhes tecnicos

**Nenhuma migracao necessaria** -- todos os dados ja existem na tabela `clients`. Os relatorios sao calculados no frontend com queries agregadas.

**Novos arquivos:**
```text
src/pages/RelatoriosPage.tsx
src/components/relatorios/EvolutionChart.tsx       -- Grafico de linha: recebido vs quebra por mes
src/components/relatorios/AgingReport.tsx           -- Tabela de aging (0-30, 31-60, 61-90, 90+ dias)
src/components/relatorios/OperatorRanking.tsx       -- Ranking de operadores por performance
src/components/relatorios/ReportFilters.tsx         -- Filtros compartilhados
```

- Rota `/relatorios` no App.tsx (admins)
- Item "Relatorios" no menu lateral com icone `BarChart3`
- Usa Recharts (ja instalado) para graficos de evolucao
- Exportacao Excel via `xlsx` (ja instalado), PDF via impressao do navegador (`window.print`)

---

## Sub-Fase 3B: Gestao de Acordos e Negociacoes

### O que muda para o usuario
- Operadores podem criar propostas de acordo para um devedor (desconto, novo parcelamento)
- Admin aprova ou rejeita propostas
- Ao aprovar, o sistema gera automaticamente as novas parcelas e cancela as antigas
- Historico de acordos por devedor
- Dashboard mostra metricas de acordos (propostos, aprovados, valor renegociado)

### Detalhes tecnicos

**Nova tabela `agreements`:**
```sql
CREATE TABLE agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_cpf TEXT NOT NULL,
  client_name TEXT NOT NULL,
  credor TEXT NOT NULL,
  original_total NUMERIC NOT NULL,
  proposed_total NUMERIC NOT NULL,
  discount_percent NUMERIC DEFAULT 0,
  new_installments INTEGER NOT NULL DEFAULT 1,
  new_installment_value NUMERIC NOT NULL,
  first_due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;
-- RLS: tenant isolation
```

**Novos arquivos:**
```text
src/pages/AcordosPage.tsx                          -- Lista de acordos + formulario
src/components/acordos/AgreementForm.tsx            -- Formulario de proposta
src/components/acordos/AgreementsList.tsx           -- Lista com filtros e acoes
src/services/agreementService.ts                    -- CRUD acordos + geracao de parcelas
```

- Rota `/acordos` no App.tsx
- Ao aprovar acordo: cancela parcelas pendentes do CPF/credor, gera novas com valor e datas do acordo
- Fluxo: Operador cria proposta -> Admin ve na lista -> Aprova/Rejeita -> Sistema executa

---

## Sub-Fase 3C: Portal do Devedor

### O que muda para o usuario
- URL publica acessivel sem login: `/portal`
- Devedor informa CPF e ve suas dividas pendentes
- Ve detalhes: credor, parcelas, valores, vencimentos
- Pode solicitar acordo diretamente (formulario simples)
- Devedor recebe link do portal nas mensagens de WhatsApp/Email (template atualizado)

### Detalhes tecnicos

**Nenhuma autenticacao necessaria** -- portal e publico, consulta por CPF.

**Edge function `portal-lookup`:**
- Recebe CPF, retorna dividas pendentes do tenant (sem dados sensiveis como operator_id)
- Tenant identificado via slug na URL ou parametro
- Rate limiting basico (max 10 consultas por IP por minuto)

**Novos arquivos:**
```text
src/pages/PortalPage.tsx                           -- Pagina publica do devedor
src/components/portal/DebtList.tsx                 -- Lista de dividas
src/components/portal/AgreementRequest.tsx         -- Formulario de solicitacao de acordo
supabase/functions/portal-lookup/index.ts          -- Edge function para consulta
```

- Rota `/portal/:tenantSlug` no App.tsx (sem ProtectedRoute)
- A edge function usa service_role_key para buscar dados, filtrando apenas campos seguros
- Solicitacao de acordo cria um registro na tabela `agreements` com status "pending"

---

## Sub-Fase 3D: Financeiro e Faturamento

### O que muda para o usuario
- Nova pagina `/financeiro` para acompanhar receitas e despesas do tenant
- Resumo financeiro mensal: total recebido, comissoes pagas, margem liquida
- Registro manual de despesas operacionais
- Visao consolidada: receita bruta - comissoes - despesas = resultado liquido
- Exportacao de demonstrativo financeiro em Excel

### Detalhes tecnicos

**Nova tabela `expenses`:**
```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT DEFAULT 'operacional',
  expense_date DATE NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
-- RLS: tenant isolation, admins can manage
```

**Novos arquivos:**
```text
src/pages/FinanceiroPage.tsx                       -- Dashboard financeiro
src/components/financeiro/FinancialSummary.tsx      -- Cards de resumo
src/components/financeiro/ExpenseForm.tsx           -- Formulario de despesa
src/components/financeiro/ExpenseList.tsx           -- Lista de despesas
src/components/financeiro/ProfitChart.tsx           -- Grafico receita vs despesa
src/services/financeService.ts                     -- CRUD despesas + queries agregadas
```

- Rota `/financeiro` no App.tsx (admins)
- Receita calculada a partir de `clients` com status "pago"
- Comissoes calculadas usando o sistema existente de grades
- Resultado = receita - comissoes - despesas

---

## Ordem de Implementacao Sugerida

| Ordem | Modulo | Justificativa |
|-------|--------|---------------|
| 1 | 3A - Relatorios | Nao requer migracao, usa dados existentes |
| 2 | 3B - Acordos | Adiciona valor operacional imediato |
| 3 | 3D - Financeiro | Complementa acordos com visao financeira |
| 4 | 3C - Portal do Devedor | Depende de acordos e templates prontos |

---

## Novas Rotas e Menu

```text
Menu lateral (admins):
  - Relatorios    /relatorios     BarChart3
  - Acordos       /acordos        Handshake
  - Financeiro    /financeiro     DollarSign
  
Rota publica (sem login):
  - Portal        /portal/:slug   (nao aparece no menu)
```

---

## Migracoes SQL Totais

Duas novas tabelas: `agreements` e `expenses`, ambas com RLS por tenant_id.
Uma nova edge function: `portal-lookup` para consultas publicas por CPF.

---

## Seguranca

- Portal do devedor expoe apenas: nome, credor, valor, vencimento, status. Nunca expoe operator_id, tenant internals
- Edge function `portal-lookup` valida formato do CPF e aplica rate limiting
- Tabela `agreements` tem campo `approved_by` para auditoria
- Tabela `expenses` restrita a admins via RLS
- Dados financeiros agregados no frontend, sem exposicao de dados individuais sensiveis

