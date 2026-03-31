

# Plano: Correção de Filtros, Score e Carteira

## 8 alterações pontuais

### 1. `hasActiveFilters` — adicionar scoreRange e debtorProfile (CarteiraPage.tsx, linha 102-122)
Adicionar ao `useMemo`:
```
filters.scoreRange !== "" ||
filters.debtorProfile !== ""
```

### 2. `displayClients` dependências — adicionar filtros faltantes (CarteiraPage.tsx, linha 456)
Adicionar `filters.debtorProfile` e `filters.scoreRange` ao array de dependências do `useMemo`.

### 3. Tooltips nos perfis de devedor (ClientFilters.tsx, linha 21-26)
Alterar `DEBTOR_PROFILE_OPTIONS` para incluir descrição em cada opção:
- Ocasional → "Atrasou, mas paga"
- Recorrente → "Sempre atrasa"
- Resistente → "Não quer pagar"
- Insatisfeito → "Não paga por insatisfação"

O MultiSelect usa `title` nativo no option label para tooltip simples sem alterar layout.

### 4. Colunas Telefone e E-mail na tabela (CarteiraPage.tsx)
- Adicionar `<TableHead>Telefone</TableHead>` e `<TableHead>E-mail</TableHead>` no header (após CPF)
- Adicionar `<TableCell>` correspondentes no body, com mascaramento condicional:
  - `canSeeFullData(client) ? client.phone : maskPhone(client.phone)`
  - `canSeeFullData(client) ? client.email : maskEmail(client.email)`
- `maskPhone` e `maskEmail` já existem em `formatters.ts`

### 5. Score sem histórico = 30 (calculate-propensity/index.ts, linha 43)
Alterar `score: 50` para `score: 30` no bloco `if (events.length === 0)`.

### 6. Validar faixas de score
Já coerente no código atual: PropensityBadge usa ≥75/50-74/<50. Nenhuma alteração necessária.

### 7. Nomenclatura "Sem acordo formalizado" (ClientFilters.tsx, linha 228)
Alterar label de "Nunca Formalizou Acordo" para "Sem acordo formalizado".

### 8. Validação final
Todos os filtros (scoreRange, debtorProfile) passam a ativar `hasActiveFilters` e estão nas dependências do `useMemo`, garantindo reatividade.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/pages/CarteiraPage.tsx` | hasActiveFilters + deps do useMemo + colunas telefone/email |
| `src/components/clients/ClientFilters.tsx` | Tooltips nos perfis + label "Sem acordo formalizado" |
| `supabase/functions/calculate-propensity/index.ts` | Score default 50→30 |

## O que NÃO muda
- Layout geral, nenhuma tela nova, arquitetura preservada
- Contact Center, chat, atendimento — intactos
- Estrutura de banco — intacta

