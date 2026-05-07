# Manual de Governança para IA (Antigravity & Lovable)

Este documento define regras obrigatórias para qualquer inteligência artificial que manipule este repositório.

## 🛑 REGRAS CRÍTICAS (NÃO VIOLAR)

### 1. Multi-Tenant Sagrado
- **TODA** query ao banco de dados deve obrigatoriamente incluir o filtro `.eq("tenant_id", tid)`.
- Funções de serviço (services/) devem aceitar `tenantId` como parâmetro opcional para garantir isolamento em visualizações administrativas.
- RLS deve usar `get_my_tenant_id()` e, em RPCs tenant-scoped, `public.can_access_tenant(_tenant_id)`. **Nunca** usar `profiles.role='super_admin'` (a coluna só aceita `admin` | `operador`).

### 2. Integridade da Documentação (Obsidian)
- Arquivos em `docs/rivo-vault/` fazem parte de um grafo de conhecimento.
- **NUNCA** remova ou altere links entre colchetes duplos `[[ Link ]]`. Eles são essenciais para a navegação do arquiteto.
- Se for atualizar um documento, preserve os cabeçalhos e rodapés de navegação.

### 3. Centralização de Metas
- A fonte única de verdade para metas é a tabela `operator_goals`.
- Metas de Equipe são calculadas dinamicamente via código (Soma dos membros).
- Não re-introduzir o campo `meta_mensal` na tabela ou UI de Equipes.

### 4. Integridade Financeira
- O cálculo de "Saldo Devedor" deve sempre abater pagamentos confirmados (manuais/portal/negociarie) da dívida original.

### 5. Separação de Domínios (Carteira × Acordos)
- `clients` = **dívida original / Carteira**.
- `agreements` = **acordos comerciais formalizados**.
- **Proibido misturar** essas tabelas em uma mesma query/agregação. Cada módulo (Carteira, Acordos, Dashboard, Relatórios) deve declarar explicitamente qual domínio está consultando.

### 6. Status Hierárquico CPF-Cêntrico
Hierarquia oficial (um único status por CPF/Credor):

```
QUITADO  >  ACORDO VIGENTE  >  ACORDO ATRASADO  >  QUEBRA DE ACORDO  >  INADIMPLENTE  >  EM DIA
```

- Nenhuma IA pode reordenar, renomear ou inserir status intermediários sem aprovação humana.
- Render da Carteira deve **sempre** priorizar o pior status global do CPF (worst-case).

### 7. Modo de Metas (Global × Per Credor)
- A fonte do modo é `tenants.settings.goals_mode` (`"global"` | `"per_credor"`).
- `DashboardMetaCard`, `fetchGoals` e `fetchMyGoals` **devem** filtrar por esse modo:
  - `global` → `credor_id IS NULL`
  - `per_credor` → `credor_id IS NOT NULL`
- **PROIBIDO** somar os dois grupos (foi o que causou a regressão dos R$ 255.000 de meta inflada).
- Toda mudança de modo precisa invalidar as queryKeys: `["dash-meta-goals-all", ...]`, `["dash-meta-my-goals", ...]`, `["tenant-goals-mode", ...]`.

### 8. Escala / Paginação
- **Nunca** usar `fetchAllRows` ingênuo.
- Usar `.range()` para paginação server-side (limite Supabase = 1000 linhas/query).

---

## 📂 Estrutura de Documentação
- `docs/rivo-vault/`: Cérebro do projeto (Obsidian).
- `docs/README.md`: Este manual.
- `docs/IA_BOUNDARIES.md`: Matriz de responsabilidade Lovable × Antigravity.

---
[[RIVO_BRAIN]]
