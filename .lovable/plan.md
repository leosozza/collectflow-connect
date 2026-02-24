

## Plano: Reestruturar pagina de Gamificacao

### Resumo das mudancas

Reorganizar a pagina `/gamificacao` para separar visualizacao de gerenciamento, ajustar permissoes por cargo (admin vs operador), remover aba "Templates" desnecessaria do Gerenciar, e melhorar o seletor de operadores nas campanhas.

---

### 1. Reestruturar abas da pagina principal

**Abas visiveis para TODOS (admin + operador):**
- Ranking -- visualizacao (todos veem tudo)
- Campanhas -- visualizacao (todos veem tudo)
- Conquistas -- admin ve tudo, operador ve apenas as suas
- Metas -- admin ve tudo, operador ve apenas a sua

**Abas visiveis apenas para ADMIN:**
- Gerenciar -- contem sub-abas: Campanhas, Conquistas (templates + concessao), Metas

**Remover:**
- Aba "Historico" (PointsHistoryTab) -- manter ou mover para dentro do perfil (vou manter como sub-informacao no card hero)
- Aba separada "Templates" dentro de Gerenciar

### 2. Mudancas por arquivo

**`src/pages/GamificacaoPage.tsx`**
- Aba "Metas" visivel para todos (nao so admin)
- Operador: na aba Conquistas, filtrar para mostrar apenas as dele
- Operador: na aba Metas, mostrar apenas a meta dele
- Admin: nas abas Conquistas e Metas, mostrar tudo
- Manter aba "Gerenciar" apenas para admin
- Remover aba "Historico" separada (mover para hero ou manter inline)

**`src/components/gamificacao/AchievementsTab.tsx`**
- Receber prop `isAdmin` 
- Se admin: buscar conquistas de todos os operadores do tenant (usando query direto na tabela achievements com tenant_id)
- Se operador: manter comportamento atual (apenas do usuario logado)

**`src/components/gamificacao/GoalsManagementTab.tsx`** (renomear conceito para GoalsViewTab ou adaptar)
- Criar uma versao read-only para operadores que mostra apenas a meta deles
- Ou: criar um novo componente `GoalsTab.tsx` para visualizacao
  - Admin: ve tabela com todas as metas dos operadores (sem edicao, apenas leitura)
  - Operador: ve apenas a propria meta com progresso

**`src/components/gamificacao/AchievementsManagementTab.tsx`**
- Remover sub-aba "Templates" -- mostrar templates e concedidas tudo junto, sem abas internas
- Manter: lista de templates com CRUD + botao "Conceder Conquista" + lista de concedidas, tudo em uma unica view

**`src/components/gamificacao/CampaignsTab.tsx`**
- Remover botoes de editar/excluir dos cards (fica apenas visualizacao)
- Remover botao "Nova Campanha"
- Edicao/criacao vai para dentro da aba "Gerenciar"

**Criar `src/components/gamificacao/CampaignsManagementTab.tsx`** (novo)
- Mover a logica de criacao/edicao/exclusao de campanhas para ca
- Admin gerencia campanhas aqui dentro do "Gerenciar"

**`src/components/gamificacao/CampaignForm.tsx`**
- No MultiSelect de operadores: adicionar `searchable` prop e aumentar `max-h` do popover para permitir rolagem
- Ou: usar ScrollArea com altura maior para ver todos os operadores

### 3. Aba Gerenciar (admin only) -- nova estrutura interna

Sub-abas dentro de Gerenciar:
- **Campanhas** -- criar/editar/excluir campanhas (CampaignsManagementTab)
- **Conquistas** -- templates + concessao (AchievementsManagementTab sem sub-tabs)
- **Metas** -- definir metas por operador (GoalsManagementTab atual)

### 4. Correcao do MultiSelect de operadores

**`src/components/ui/multi-select.tsx`**
- Aumentar `max-h-[200px]` para `max-h-[280px]` no container de scroll
- Habilitar `searchable` por padrao no CampaignForm para filtrar operadores

**`src/components/gamificacao/CampaignForm.tsx`**
- Passar `searchable={true}` e `searchPlaceholder="Buscar operador..."` no MultiSelect de operadores

### 5. Novo GoalsTab.tsx (visualizacao)

- Admin: tabela read-only com operador, meta, valor recebido, % progresso
- Operador: card unico mostrando sua meta e progresso

---

### Detalhes tecnicos

- Nenhuma mudanca de banco de dados necessaria
- Nenhuma migracao SQL
- Conquistas do operador ja sao filtradas por `profile_id` no service
- Para admin ver todas conquistas: usar query com `tenant_id` (ja existe `allAchievements` query no AchievementsManagementTab)
- Para operador ver sua meta: usar `fetchMyGoal` que ja existe

