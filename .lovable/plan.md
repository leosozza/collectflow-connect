
## Evolucao do Modulo de Gamificacao

### Objetivo

Transformar campanhas, metas e conquistas em um sistema flexivel e multi-credor, onde o admin do tenant pode:
- Vincular campanhas a 1 ou mais credores
- Selecionar participantes por equipe ou individualmente
- Criar e editar conquistas como templates reutilizaveis (nao apenas "conceder")
- Definir metas por credor

---

### 1. Mudancas no Banco de Dados

#### 1.1 Tabela `campaign_credores` (nova - relacao N:N)

Vincula campanhas a credores.

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | |
| campaign_id | uuid FK | Referencia `gamification_campaigns` |
| credor_id | uuid FK | Referencia `credores` |
| tenant_id | uuid | Para RLS |

RLS: admins gerenciam, usuarios do tenant visualizam.

#### 1.2 Adicionar `source_type` ao `campaign_participants`

Para diferenciar se o participante foi adicionado individualmente ou via equipe:

| Coluna | Tipo | Default |
|---|---|---|
| source_type | text | 'individual' |
| source_id | uuid | null |

`source_type` = 'equipe' ou 'individual'. `source_id` = id da equipe quando aplicavel.

#### 1.3 Tabela `achievement_templates` (nova)

Templates editaveis de conquistas por tenant/credor.

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid PK | |
| tenant_id | uuid | |
| credor_id | uuid | Nullable (global do tenant se null) |
| title | text | Nome da conquista |
| description | text | |
| icon | text | Emoji |
| criteria_type | text | 'manual', 'payments_count', 'total_received', 'no_breaks', 'goal_reached' |
| criteria_value | numeric | Valor do criterio (ex: 10 para "10 pagamentos") |
| points_reward | integer | Pontos concedidos ao desbloquear |
| is_active | boolean | |

RLS: admins gerenciam, usuarios visualizam.

#### 1.4 Adicionar `credor_id` a `operator_goals`

| Coluna | Tipo | Default |
|---|---|---|
| credor_id | uuid | null |

Permite metas por credor. Se null, e meta global.

---

### 2. Mudancas no Frontend

#### 2.1 CampaignForm (reformulado)

O formulario de campanha ganha 2 novas secoes:

**Secao "Credores"** - MultiSelect com lista de credores ativos do tenant. Obrigatorio selecionar ao menos 1.

**Secao "Participantes"** - Duas opcoes:
- **Por Equipe**: MultiSelect de equipes. Ao selecionar equipes, todos os membros sao automaticamente adicionados como participantes.
- **Individual**: MultiSelect de operadores do tenant.

Toggle entre os dois modos. Ao salvar, insere os registros em `campaign_credores` e `campaign_participants`.

#### 2.2 CampaignCard (atualizado)

Exibir badges dos credores vinculados a campanha abaixo do titulo.

#### 2.3 AchievementsManagementTab (reformulado)

Dividir em 2 sub-abas:
- **Templates**: CRUD de templates de conquistas (tabela `achievement_templates`). Cada template pode ser vinculado a um credor especifico ou ser global. Campos editaveis: titulo, descricao, icone, criterio, valor, pontos, ativo/inativo.
- **Concedidas**: Lista atual de conquistas ja atribuidas (tabela `achievements`), com botao "Conceder" que usa os templates como base.

#### 2.4 GoalsManagementTab (atualizado)

Adicionar filtro de credor. Quando um credor e selecionado, as metas sao filtradas/criadas com `credor_id`. Quando "Todos" e selecionado, mostra metas globais (credor_id = null).

---

### 3. Mudancas nos Services

#### 3.1 `campaignService.ts`

- `createCampaign`: apos criar a campanha, inserir registros em `campaign_credores` e `campaign_participants` (expandindo membros de equipe via query em `equipe_membros`).
- `updateCampaign`: atualizar credores e participantes (delete + re-insert).
- `fetchCampaigns`: incluir join para trazer credores vinculados.
- Nova interface `Campaign` com campo `credores?: string[]` e `participants?: string[]`.

#### 3.2 `achievementTemplateService.ts` (novo)

CRUD para `achievement_templates`: fetch, create, update, delete, fetchByCredor.

#### 3.3 `goalService.ts`

- `upsertGoal`: aceitar `credor_id` opcional.
- `fetchGoals`: aceitar filtro por `credor_id`.
- Atualizar unique constraint para incluir `credor_id`.

---

### 4. Arquivos Modificados/Criados

| Arquivo | Acao |
|---|---|
| `src/components/gamificacao/CampaignForm.tsx` | Reformular com selecao de credores, equipes e operadores |
| `src/components/gamificacao/CampaignCard.tsx` | Exibir badges de credores |
| `src/components/gamificacao/CampaignsTab.tsx` | Passar credores e equipes para o form |
| `src/components/gamificacao/AchievementsManagementTab.tsx` | Sub-abas Templates + Concedidas, CRUD de templates |
| `src/components/gamificacao/GoalsManagementTab.tsx` | Filtro por credor |
| `src/services/campaignService.ts` | Logica de credores e participantes |
| `src/services/achievementTemplateService.ts` | Novo service para templates |
| `src/services/goalService.ts` | Suporte a credor_id |

### 5. Fluxo do Admin ao Criar Campanha

```text
1. Clica "Nova Campanha"
2. Preenche titulo, metrica, periodo, datas, premio
3. Seleciona 1+ credores (MultiSelect)
4. Escolhe modo: "Por Equipe" ou "Individual"
   - Equipe: seleciona equipes -> membros sao incluidos automaticamente
   - Individual: seleciona operadores manualmente
5. Salva -> cria campanha + campaign_credores + campaign_participants
```
