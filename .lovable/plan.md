## Objetivo

Adicionar em **Gamificação → Gerenciar Metas** um seletor de **modo de meta** por tenant: **Global** (meta única do mês, sem credor) **ou** **Por Credor** (uma meta por credor, somadas para compor a meta do operador). Resolver o efeito colateral disto no Dashboard (bug dos R$ 255.000) sem violar as diretrizes de `docs/README.md`.

## Comportamento atual (resumo)

- A tela permite criar metas **globais** (`credor_id IS NULL`) **e** **por credor** ao mesmo tempo.
- O Dashboard (`DashboardMetaCard`) soma **todas** as linhas de `operator_goals` do mês — somando global + per-credor → inflação (R$ 135k + R$ 120k = R$ 255k).
- Não existe configuração de "modo" por tenant.

## Comportamento proposto

### 1. Tela "Gerenciar Metas" (UI apenas)

Adicionar no topo da aba um **toggle/segmented control** com 2 opções:

- **Global** — meta mensal única por operador (estado padrão).
- **Por Credor** — uma meta por credor; a meta do operador é a **soma** dos credores ativos.

Regras visuais:
- Quando **Global**: esconde o `Select` de credor; tabela mostra "Meta do Mês" (linha única `credor_id IS NULL`).
- Quando **Por Credor**: aparece o `Select` de credor para criar/editar metas por credor; abaixo da tabela, uma linha de **subtotal** por operador mostrando "Total (soma dos credores): R$ X".
- O toggle é persistido em `tenant_settings` (chave nova `goals_mode`: `"global" | "per_credor"`) — escrita simples por admin.

### 2. Dashboard — corrigir o R$ 255.000

`DashboardMetaCard.tsx` passa a respeitar `goals_mode`:

- Se `goals_mode = "global"` → soma apenas linhas com `credor_id IS NULL` (caso atual mais comum).
- Se `goals_mode = "per_credor"` → soma apenas linhas com `credor_id IS NOT NULL`.
- Nunca somar os dois grupos juntos (raiz do bug).

`fetchGoals` ganha um parâmetro opcional `mode?: "global" | "per_credor" | "all"` — default `"all"` para não quebrar usos existentes; o Dashboard passa o modo correto.

### 3. Multi-tenant (diretriz `docs/README.md` §1)

- Toda nova query inclui `.eq("tenant_id", tid)` (já é o padrão via `goalService`).
- A leitura/escrita de `tenant_settings.goals_mode` também filtra por `tenant_id`.

## Detalhes técnicos

**Arquivos alterados (frontend apenas, sem schema novo):**

- `src/components/gamificacao/GoalsManagementTab.tsx`
  - Novo `ToggleGroup` "Global | Por Credor" no topo.
  - Hook `useTenantGoalsMode(tenantId)` para ler/gravar o modo (usa `tenant_settings` existente, chave `goals_mode`).
  - Esconder/mostrar `Select` de credor conforme o modo.
  - Forçar `credorFilter = "__global__"` quando modo = Global.
  - Linha de subtotal por operador no modo "Por Credor".

- `src/services/goalService.ts`
  - `fetchGoals(year, month, credorId?, tenantId?, mode?)` — `mode` filtra `credor_id IS NULL` ou `IS NOT NULL`.

- `src/components/dashboard/DashboardMetaCard.tsx`
  - Lê `goals_mode` do tenant e passa para `fetchGoals`.
  - Operador (`fetchMyGoals`) idem: filtra conforme o modo.

**Persistência do modo:**
- Usar `tenant_settings` (já existe) com chave nova `goals_mode`. **Não** cria coluna nova, **não** mexe em `operator_goals`. Sem migração de schema.

**Não alterado (para não quebrar nada):**
- Estrutura de `operator_goals` (campo `credor_id` continua existindo).
- `awardGoalIfReached`, `fetchMyGoalHistory` (continuam usando `credor_id IS NULL` — comportamento já compatível com modo Global; em Por Credor o histórico/premiação ficam para iteração futura, sinalizado em comentário).

## Fora de escopo

- Criar nova tabela ou migração de dados existentes.
- Mudar lógica de premiação por pontos no modo Por Credor (anotar TODO).
- Mexer em metas de equipe/ranking.

## Validação

1. Tenant atual (modo Global): Dashboard volta a mostrar R$ 135.000 (não R$ 255.000).
2. Trocar para "Por Credor" em Gerenciar Metas: tabela mostra subtotal somado; Dashboard passa a somar apenas as metas por credor.
3. Voltar para Global: Dashboard volta ao estado anterior. Nenhum dado é apagado.
