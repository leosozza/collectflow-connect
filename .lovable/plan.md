
# Revisão Financeiro — apenas correções de número (sem nova UI)

Removidas todas as sugestões cosméticas e de "melhoria". Foco exclusivo em garantir que **os números mostrados na tela atual reflitam a verdade**, usando as fontes de verdade que já existem (`manual_payments`, `portal_payments`, `negociarie_cobrancas`, `agreements`).

## Escopo

Apenas a aba **Baixas Realizadas** apresenta números computados (RPC `get_baixas_realizadas`). As outras duas abas (Aguardando Liberação / Confirmação de Pagamento) reusam `AcordosPage` e seus números já vêm das mesmas SSOTs usadas no resto do sistema — **não serão tocadas**.

## Arquivo órfão `src/pages/FinanceiroPage.tsx` — verificação

Resultado da varredura por imports:

```
src/pages/FinanceiroPage.tsx              (auto-referência)
src/services/financeService.ts            (consumido SÓ pela própria FinanceiroPage e seus 2 componentes)
src/components/financeiro/ExpenseForm.tsx (usado SÓ pela FinanceiroPage)
src/components/financeiro/ExpenseList.tsx (usado SÓ pela FinanceiroPage)
src/pages/RoadmapPage.tsx                 (apenas texto/menção em string, não import)
```

Nenhuma rota em `App.tsx` aponta para `FinanceiroPage`. Nenhum menu em `AppLayout.tsx` aponta. **Pode ser removido com segurança**, junto de `ExpenseForm.tsx`, `ExpenseList.tsx` e `financeService.ts` (são todos um cluster órfão). Tabela `expenses` no banco fica intocada.

→ Decisão a confirmar: remover esse cluster ou apenas deixar quieto?

## Correções de número no RPC `get_baixas_realizadas`

Bugs reais identificados (cada um produz número errado na tela hoje):

### Bug 1 — Entrada errada quando o acordo tem 2 ou 3 entradas
Hoje:
```
valor_original = custom_installment_values->>'entrada'   -- para QUALQUER installment_number=0
```
Para baixas marcadas como `entrada_2` ou `entrada_3` (existem 3 registros assim em produção), exibe o valor da 1ª entrada — ou nulo. **Coluna "V. Original" mentirosa.**

Correção (mantém a SSOT `custom_installment_values` que já é usada em todo o sistema):
```
valor_original = COALESCE(
  custom_installment_values ->> NULLIF(installment_key, ''),
  custom_installment_values ->> 'entrada',
  a.entrada_value
)   -- quando installment_number = 0
```

### Bug 2 — `total_installments` ignora múltiplas entradas
Hoje: `1 + new_installments` (assume 1 entrada).
Acordos com `entrada_2`/`entrada_3` mostram total errado. Hoje a coluna não é exibida na tela, mas é retornada e exportada no Excel ("Origem"/cabeçalhos). Mesmo assim, vamos manter o campo correto para não vazar número errado no export.

Correção: contar quantas chaves `entrada%` existem em `custom_installment_values` e somar com `new_installments`.

### Bug 3 — Atribuição de operador trocada nas baixas manuais
Hoje:
```
operator_id = COALESCE(profile.user_id de mp.requested_by, a.created_by)
```
Quando admin solicita a baixa, o "Operador" passa a ser o admin, não quem fechou o acordo. Filtro "Operador" e isolamento por operador (`_operator_id = user.id`) ficam errados — operador deixa de ver a própria baixa.

Correção (inverter prioridade):
```
operator_id = COALESCE(a.created_by, profile.user_id de mp.requested_by)
```
Isso bate com a regra "operador dono do acordo" usada no resto do sistema (Acordos, Ranking de Operadores, Analytics).

### Bug 4 — Data do portal pode estar deslocada
`portal_payments` não tem coluna `paid_at` (verificado). Hoje usa `pp.updated_at::date`, que muda se a linha for atualizada por qualquer motivo após o pagamento. Como **não há SSOT alternativa para a data efetiva** sem criar campo novo, **não será alterado** — manter como está para respeitar a regra "sem nova fonte de verdade".

### Bug 5 — Parcela vazia em portal/negociarie
Sintoma cosmético ("—"). Não é número errado, é só ausência. Como o usuário pediu "sem alteração na tela", **não será mexido**.

## O que NÃO será feito

- ❌ Sem badge "Visualizando apenas suas baixas"
- ❌ Sem mini cards por origem
- ❌ Sem alteração de título/H1 nas abas reusadas
- ❌ Sem novas tabelas, colunas ou views
- ❌ Sem mexer em AcordosPage / Aguardando Liberação / Confirmação de Pagamento

## Plano de execução

1. **Migration SQL**: substituir `get_baixas_realizadas` aplicando Bug 1, Bug 2 e Bug 3.
2. **Limpeza opcional** (aguardando confirmação do usuário):
   - Remover `src/pages/FinanceiroPage.tsx`
   - Remover `src/components/financeiro/ExpenseForm.tsx`
   - Remover `src/components/financeiro/ExpenseList.tsx`
   - Remover `src/services/financeService.ts`

## Detalhe técnico — corpo da nova RPC (resumo)

```sql
-- Ramo 'manual':
valor_original :=
  CASE
    WHEN mp.installment_number = 0 THEN COALESCE(
      a.custom_installment_values ->> NULLIF(mp.installment_key,''),
      a.custom_installment_values ->> 'entrada',
      a.entrada_value
    )
    ELSE COALESCE(
      a.custom_installment_values ->> mp.installment_number::text,
      a.new_installment_value
    )
  END;

operator_id := COALESCE(
  a.created_by,
  (SELECT user_id FROM profiles WHERE id = mp.requested_by LIMIT 1)
);

-- Total de parcelas (aplicar nos 3 ramos):
total_installments :=
  GREATEST(
    1,
    (SELECT COUNT(*) FROM jsonb_object_keys(COALESCE(a.custom_installment_values,'{}'::jsonb)) k
       WHERE k LIKE 'entrada%')
  )
  + COALESCE(a.new_installments, 0);
```

## Perguntas finais

1. Confirma a inversão da prioridade de `operator_id` para `a.created_by` primeiro (item Bug 3)?
2. Pode remover o cluster órfão (`FinanceiroPage.tsx` + `ExpenseForm` + `ExpenseList` + `financeService.ts`)? Nada está roteado nem importado fora dele.
