# Diagnóstico — Recebido / Baixas Realizadas (Y.BRASIL)

## 1) Maria Eduarda — Maio/2026

Conferência feita direto nas 3 fontes da SSOT (`manual_payments` + `portal_payments` + `negociarie_cobrancas`), filtrando por data de pagamento em Maio e atribuindo via `agreements.created_by`:

- **Maria Eduarda — R$ 18.841,90** (12 manuais + 49 Negociarie). É exatamente o valor do print do Dashboard.
- **Gustavo Abade — R$ 27.353,88** (74 baixas).
- **Vitor Santana — R$ 18.268,21** (78 baixas).

Conclusão: o **Dashboard está correto** para os três. Como você disse que o Ranking de Operadores também mostra os mesmos números agora, esse caminho está consistente — sem ajustes necessários.

## 2) Bug real — "Baixas Realizadas" vem vazia

A página `/financeiro/baixas-realizadas` chama a RPC `get_baixas_realizadas`. Os dados existem no banco (validei: 213 baixas no tenant em Maio), mas o front está renderizando "Nenhuma baixa". Hipóteses prováveis, em ordem:

1. **Race condition em `usePermissions`** — enquanto o hook carrega, `canViewAllFinanceiro` começa `false`, então a página dispara a query travada no `lockedOperatorId = user.id` (id do admin, que não tem acordo nenhum criado por ele → 0 linhas). Quando as permissões terminam de carregar, a `queryKey` muda e deveria refazer — mas se algum erro silencioso interromper, o usuário fica preso na primeira resposta vazia.
2. **Filtro de data preso fora de Maio** (default é mês corrente, mas pode ter sido alterado em outra sessão).
3. **Erro silencioso na RPC** que cai no `catch` do React Query e não aparece no toast.

## 3) Plano de implementação

Mudanças mínimas em `src/pages/financeiro/BaixasRealizadasPage.tsx`:

- **Aguardar `permissions.loading` antes de disparar a query.** Trocar `enabled` para `!!tenant?.id && !permissions.loading && (canViewAll || !!user?.id)`. Elimina a corrida.
- **Logar o erro da RPC** (`onError`) com `console.warn` mais informativo, e mostrar um banner discreto quando `error` existir, para casos futuros.
- **Banner de diagnóstico** no estado vazio mostrando: tenant, período aplicado, operador travado (se houver) e total bruto via uma chamada secundária leve à RPC `get_financial_received_by_day` (mesma SSOT do Dashboard) — assim o admin vê imediatamente se a divergência é "filtro" ou "RPC".

Sem mudanças de schema, sem mexer em `get_baixas_realizadas` (a RPC está correta — ela só filtra por `_operator_id` quando esse parâmetro vem preenchido).

## 4) Validação após o fix

- Logar como Barbara (admin Y.BRASIL) → abrir Baixas Realizadas → ver as 213 linhas de Maio agrupadas, total ≈ R$ 105 mil.
- Filtrar por operador "Maria Eduarda" → 61 linhas, total **R$ 18.841,90** (bate com Dashboard e Ranking).
- Idem para Gustavo (R$ 27.353,88) e Vitor (R$ 18.268,21).
