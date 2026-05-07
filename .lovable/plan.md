# Carteira: remover trava de "Mar Aberto" para operador

## Diagnóstico

Hoje, em `src/pages/CarteiraPage.tsx` linha 279, a listagem força:

```ts
operatorId: (!permissions.canViewFullData && profileId) ? profileId : undefined,
```

Como o operador não tem `carteira.view_full_data`, a RPC `get_carteira_grouped` recebe `_operator_id = <user>` e devolve **só os clientes atribuídos a ele**. Por isso o Vitor pesquisou "Marcela Cristina dos Santos Khouwayer" e a tela mostra "Nenhum cliente encontrado" — a Marcela não está atribuída a ele.

Não foi mudança recente. A última alteração (Financeiro) não tocou em `carteira`.

## Mudança

Arquivo único: `src/pages/CarteiraPage.tsx`, linha 279.

De:
```ts
operatorId: (!permissions.canViewFullData && profileId) ? profileId : undefined,
```
Para:
```ts
operatorId: undefined,
```

Pronto. A RPC passa a listar todos os clientes do tenant para qualquer papel. RLS de tenant continua intacta (escopo por `tenant_id`).

## Por que isso é seguro

As travas operacionais que importam **não dependem** desse filtro de listagem — elas vivem em outras camadas e continuam aplicáveis:

| Trava | Onde mora | Continua valendo? |
|---|---|---|
| Cliente com **acordo vigente / em negociação** | Hierarquia de status por CPF/Credor (`QUITADO > ACORDO VIGENTE > ACORDO ATRASADO > ...`) e validações de `AgreementForm` / RPCs de criação | Sim, intacta |
| Concorrência de atendimento (lock) | `lockService` / `useAtendimentoModal` | Sim |
| Disposições / dados sensíveis | `view_full_data` segue controlando mascaramento de CPF/telefone na UI | Sim |
| Atribuição em ações em massa | Diálogos de bulk continuam respeitando `operator_id` ao gravar | Sim |

Ou seja: operador **enxerga e pesquisa** qualquer cliente, mas operações que exigem exclusividade continuam barradas pelas regras de status/lock já existentes.

## Fora de escopo

- Não mexer em RLS, RPCs, ou em `view_full_data` (mascaramento permanece).
- Não mudar atribuição automática nem lógica de `operator_id` nos clientes.
- Não alterar Financeiro, Acordos, ou Atendimento.

## Validação após apply

1. Logar como Vitor (operador) → `/carteira` → buscar "Marcela" → cliente aparece.
2. Abrir o card → vê detalhes (mascaramento de CPF/telefone segue se ele não tiver `view_full_data`).
3. Tentar formalizar acordo num CPF que já tem **acordo vigente** → bloqueio existente continua disparando.
4. Logar como admin → sem mudança.
