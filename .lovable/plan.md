

## Plano: Reorganizacao de Filtros, Negociacao e Relatorios

### 1. Negociacao do Credor (`CredorForm.tsx`)

**Collapsible nas secoes de Grade e Aging:**
- Envolver "Grade de Honorarios" e "Faixas de Desconto por Aging" em componentes `Collapsible` com seta para recolher/expandir
- Quando ha dados salvos, iniciar recolhido com indicador de quantidade (ex: "3 faixas salvas")
- Quando vazio, iniciar expandido

**Remover Prazo SLA de Atendimento:**
- Remover o bloco completo do campo `sla_hours` (linhas 387-398) da aba Negociacao

### 2. Filtros da Carteira (`ClientFilters.tsx`)

**Reorganizacao dos filtros avancados:**

Linha 1 (selects lado a lado):
- Status do Acordo | Status de Carteira | Credor | Perfil do Devedor | Tipo de Divida

Linha 2 (datas lado a lado):
- Vencimento De | Vencimento Ate | Cadastro De | Cadastro Ate

Linha 3 (checkboxes lado a lado):
- Sem Acordo | Quitados

**Remover filtros de Quitacao (De/Ate)** da pagina Carteira - serao movidos para Relatorios.

**Logica de filtragem:**
- "Status do Acordo" filtra por `status` (pendente/pago/quebrado) -- mostra apenas clientes que TEM acordo formalizado quando != "todos"
- "Status de Carteira" filtra por `status_cobranca_id` -- filtra toda a carteira independente de acordo
- Sao filtros independentes e complementares

### 3. Relatorios (`RelatoriosPage.tsx` + `ReportFilters.tsx`)

**Adicionar novos filtros em ReportFilters:**
- Filtro de Quitacao De / Quitacao Ate (movido da Carteira)
- Filtro de Status do Acordo (pendente/pago/quebrado)
- Filtro de Tipo de Divida
- Filtro de Perfil do Devedor

**Atualizar ReportFilters props** para receber os novos estados e callbacks.

**Atualizar RelatoriosPage** para aplicar os novos filtros no `filteredClients`.

### Detalhes tecnicos

| Arquivo | Mudanca |
|---|---|
| `CredorForm.tsx` | Collapsible em Grade + Aging; remover SLA |
| `ClientFilters.tsx` | Remover quitacaoDe/Ate; reorganizar grid; Sem Acordo + Quitados lado a lado |
| `CarteiraPage.tsx` | Remover refs a quitacaoDe/Ate do state inicial e displayClients |
| `ReportFilters.tsx` | Adicionar filtros de quitacao, status acordo, tipo divida, perfil devedor |
| `RelatoriosPage.tsx` | Novos states + logica de filtragem para os filtros adicionados |

