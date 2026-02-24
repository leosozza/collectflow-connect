

## Plano: Remover Status do Acordo da Carteira, ajustar em Relatorios, e adicionar campo de prazo no credor

### Resumo

O usuario quer:
1. Remover o filtro "Status do Acordo" da Carteira e Clientes -- manter apenas em Relatorios
2. Em Relatorios, o "Status do Acordo" deve refletir o status real do acordo: Pago (em dia), Pendente (dentro do prazo do credor), Quebra (passou o prazo)
3. Adicionar campo no cadastro do credor para definir "prazo maximo de dias para pagamento do acordo"
4. A logica de Relatórios deve cruzar agreements com esse prazo para determinar se o acordo esta Pago, Pendente ou Quebra

### Mudancas

**1. Nova coluna na tabela `credores`** (migration)

Adicionar `prazo_dias_acordo integer DEFAULT 30` -- quantos dias o acordo pode ficar em aberto aguardando pagamento.

**2. `src/components/cadastros/CredorForm.tsx`**

Adicionar campo "Prazo para pagamento do acordo (dias)" na aba Negociacao, input numerico com `min={1}`.

**3. `src/lib/validations.ts`**

Adicionar `prazo_dias_acordo` ao schema Zod do credor (para nao ser removido no strip).

**4. `src/components/clients/ClientFilters.tsx`**

Remover o bloco do select "Status do Acordo" (linhas 106-118). Ajustar o grid de `lg:grid-cols-5` para `lg:grid-cols-4`.

Remover `status` da interface `Filters` (ou mante-lo mas sem uso na Carteira).

**5. `src/pages/CarteiraPage.tsx`**

- Remover o state `filters.status` e toda a logica de `agreementStatusFilter` / `agreementCpfs` query
- Remover o filtro `if (agreementStatusFilter)` do `displayClients`
- Simplificar: o filtro "Sem Acordo" continua usando a query de agreements (sem filtro por status)

**6. `src/pages/ClientsPage.tsx`**

- Remover a logica de `agreementStatusFilter` / `agreementCpfs`
- Remover o filtro `displayClients` baseado em agreement CPFs

**7. `src/components/relatorios/ReportFilters.tsx`**

Alterar as opcoes do "Status do Acordo" para:
- Todos
- Pago (parcelas do acordo todas pagas)
- Pendente (dentro do prazo do credor)
- Quebra (passou o prazo sem pagamento)

**8. `src/pages/RelatoriosPage.tsx`**

Implementar a logica real de Status do Acordo:
- Buscar agreements com seus credores (para pegar `prazo_dias_acordo`)
- Para cada agreement, calcular o status derivado:
  - **Pago**: todas as parcelas geradas pelo acordo estao com status "pago"
  - **Pendente**: ha parcelas pendentes mas ainda dentro do prazo (first_due_date + prazo_dias_acordo > hoje)
  - **Quebra**: ha parcelas pendentes e o prazo ja expirou
- Quando o filtro "Status do Acordo" esta ativo, filtrar `filteredClients` por CPFs que tem acordos naquele status derivado

### Detalhes tecnicos

| Arquivo | Mudanca |
|---|---|
| Migration SQL | `ALTER TABLE credores ADD COLUMN prazo_dias_acordo integer DEFAULT 30` |
| `CredorForm.tsx` | Campo numerico "Prazo para pagamento do acordo (dias)" na aba Negociacao |
| `validations.ts` | Adicionar `prazo_dias_acordo` ao schema |
| `ClientFilters.tsx` | Remover select "Status do Acordo"; grid 5->4 colunas |
| `CarteiraPage.tsx` | Remover agreementStatusFilter, agreementCpfs query, e filtro relacionado |
| `ClientsPage.tsx` | Remover agreementStatusFilter, agreementCpfs query, e displayClients filter |
| `ReportFilters.tsx` | Opcoes: Pago/Pendente/Quebra |
| `RelatoriosPage.tsx` | Query de agreements + credores para calcular status derivado; filtrar por CPF |

