# Liberar Financeiro para operadores (escopo: apenas próprios acordos)

## Diagnóstico

O operador Gustavo não vê **Financeiro → Acordos em Atraso** porque, em `src/hooks/usePermissions.ts`, o papel `operador` tem `financeiro: []` (nenhuma permissão). Como o menu/rota usa `canViewFinanceiro = hasAny("financeiro")`, o módulo inteiro fica oculto.

Boa notícia: o **scoping por operador já está implementado em todo lugar** que importa, e respeita `canViewAllFinanceiro`:

| Tela | Comportamento sem `view_all` |
|---|---|
| `AcordosPage` (Aguardando Liberação, Em Atraso, etc.) | Já força `created_by = user.id` quando `!isAdmin` (linhas 70‑77). Operador só vê acordos criados por ele. |
| `BaixasRealizadasPage` | Já passa `_operator_id: lockedOperatorId` quando `!canViewAll` (linhas 80, 105). |
| `ConfirmacaoPagamentoPage` | Continua exigindo `canApproveAcordos` — operador **não** aprova pagamentos (correto, evita auto‑aprovação). |

Ou seja, **basta conceder `view` (sem `view_all`)** ao papel operador. O escopo "apenas próprios" sai de graça.

## Mudança

Arquivo único: `src/hooks/usePermissions.ts`

No bloco `ROLE_DEFAULTS.operador`, trocar:
```ts
financeiro: [],
```
por:
```ts
financeiro: ["view"],
```

Nada mais. Sem `view_all` (não vê dos outros) e sem `manage`. Sem mexer em RLS, RPCs, ou em outras telas.

## Efeito imediato

- Operadores passam a ver o item **Financeiro** no menu.
- Em **Aguardando Liberação** e **Acordos em Atraso**: enxergam apenas os acordos onde `created_by = seu user_id`.
- Em **Baixas Realizadas**: a RPC `get_baixas_realizadas` já recebe `_operator_id` travado no próprio user → só baixas dos acordos dele.
- **Confirmação de Pagamento**: continua oculto para operador (precisa `approve` em `acordos`, que ele não tem).
- Admins/gerentes/supervisor: sem mudança.

## Fora de escopo

- Não criar novas RPCs, RLS ou fontes de verdade.
- Não alterar UI das telas Financeiro.
- Não mudar `view_all` de ninguém.
- Não mexer em overrides individuais de outros usuários.

## Validação após apply

1. Logar como operador (Gustavo) → menu **Financeiro** aparece.
2. Abrir `/financeiro/aguardando-liberacao` → lista só acordos criados por ele.
3. Abrir `/financeiro/baixas` → só baixas de acordos dele; banner "Visualizando suas próprias baixas".
4. Tentar `/financeiro/confirmacao-pagamento` → redireciona para `/acordos` (esperado).
5. Logar como admin → continua vendo tudo, dropdown de operador funcional.
