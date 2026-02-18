

## Campanhas de Gamificacao e Gestao Administrativa

### Visao Geral

Criar um sistema completo de **campanhas competitivas** dentro do modulo de gamificacao, com CRUD completo para admins e paineis de visualizacao para operadores. Tambem adicionar gestao de conquistas e metas por equipe/operador/credor.

---

### 1. Nova Tabela: `gamification_campaigns`

Armazena campanhas criadas pelo admin com diferentes periodicidades e metricas.

```sql
CREATE TABLE public.gamification_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metric TEXT NOT NULL,          -- 'menor_taxa_quebra', 'menor_valor_quebra', 'maior_valor_recebido', 'maior_valor_promessas', 'maior_qtd_acordos'
  period TEXT NOT NULL,           -- 'diaria', 'semanal', 'mensal', 'trimestral', 'semestral', 'anual'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  prize_description TEXT,
  status TEXT NOT NULL DEFAULT 'ativa',  -- 'ativa', 'encerrada', 'rascunho'
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gamification_campaigns ENABLE ROW LEVEL SECURITY;

-- Admin gerencia
CREATE POLICY "Tenant admins can manage campaigns"
  ON public.gamification_campaigns FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

-- Operadores visualizam
CREATE POLICY "Tenant users can view campaigns"
  ON public.gamification_campaigns FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));
```

### 2. Nova Tabela: `campaign_participants`

Registra os participantes e seus resultados em cada campanha.

```sql
CREATE TABLE public.campaign_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.gamification_campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  operator_id UUID NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  rank INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage participants"
  ON public.campaign_participants FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view participants"
  ON public.campaign_participants FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));
```

### 3. Pagina de Gamificacao — Diferenciacao por Role

A pagina `/gamificacao` tera comportamento diferente baseado no role:

**Admin ve 5 abas:**
| Aba | Conteudo |
|---|---|
| Ranking | Ranking atual (ja existe) |
| Conquistas | Visualizar + editar/criar conquistas personalizadas |
| Campanhas | CRUD de campanhas com formulario completo |
| Metas | Definir metas por operador (ja existe parcialmente via `operator_goals`) |
| Historico | Historico de pontos (ja existe) |

**Operador ve 4 abas (somente leitura):**
| Aba | Conteudo |
|---|---|
| Ranking | Ranking atual |
| Conquistas | Suas conquistas desbloqueadas |
| Campanhas | Campanhas ativas com ranking dos participantes |
| Historico | Seu historico de pontos |

### 4. Componentes Novos

| Arquivo | Descricao |
|---|---|
| `src/components/gamificacao/CampaignsTab.tsx` | Lista campanhas ativas/encerradas. Admin ve botao "Nova Campanha" e pode editar/excluir. Operador ve apenas cards com ranking. |
| `src/components/gamificacao/CampaignForm.tsx` | Dialog/sheet para criar/editar campanha. Campos: titulo, descricao, metrica (select), periodo (select), data inicio/fim, premio. |
| `src/components/gamificacao/CampaignCard.tsx` | Card visual de uma campanha mostrando metrica, periodo, participantes e ranking parcial. |
| `src/components/gamificacao/GoalsManagementTab.tsx` | Tabela para admin definir meta (R$) por operador para o mes selecionado. Usa `upsertGoal` existente. |
| `src/components/gamificacao/AchievementsManagementTab.tsx` | Admin pode criar conquistas customizadas (titulo, descricao, icone) e conceder manualmente a operadores. |

### 5. Service Layer

| Arquivo | Funcoes |
|---|---|
| `src/services/campaignService.ts` | `fetchCampaigns`, `createCampaign`, `updateCampaign`, `deleteCampaign`, `fetchCampaignParticipants`, `upsertParticipantScore` |

### 6. Formulario de Campanha — Campos

- **Titulo** (texto livre)
- **Descricao** (textarea)
- **Metrica** (select):
  - Menor taxa de quebra
  - Menor valor de quebra
  - Maior valor negociado/recebido
  - Maior valor de promessas de acordos
  - Maior quantidade de acordos
- **Periodo** (select): Diaria, Semanal, Mensal, Trimestral, Semestral, Anual
- **Data inicio / Data fim** (date pickers)
- **Premio** (texto descritivo do premio)
- **Status**: Ativa, Rascunho, Encerrada

### 7. Visualizacao do Operador nas Campanhas

Cada campanha ativa aparece como um card com:
- Titulo, descricao e premio
- Badge com periodo e metrica
- Ranking dos participantes (posicao, nome, avatar, score)
- Destaque visual para a posicao do operador logado
- Countdown para fim da campanha

### 8. Aba de Metas (Admin)

Tabela com todos os operadores do tenant, permitindo definir `target_amount` individual para o mes/ano selecionado. Reutiliza a funcao `upsertGoal` ja existente.

### 9. Arquivos a Modificar/Criar

| Arquivo | Acao |
|---|---|
| `supabase/migrations/` | Migration com as 2 tabelas novas + RLS |
| `src/services/campaignService.ts` | **Novo** — CRUD de campanhas |
| `src/components/gamificacao/CampaignsTab.tsx` | **Novo** — Aba de campanhas |
| `src/components/gamificacao/CampaignForm.tsx` | **Novo** — Formulario de campanha |
| `src/components/gamificacao/CampaignCard.tsx` | **Novo** — Card visual de campanha |
| `src/components/gamificacao/GoalsManagementTab.tsx` | **Novo** — Gestao de metas pelo admin |
| `src/components/gamificacao/AchievementsManagementTab.tsx` | **Novo** — Gestao de conquistas pelo admin |
| `src/pages/GamificacaoPage.tsx` | **Modificar** — Adicionar abas condicionais por role |
| `src/services/gamificationService.ts` | **Modificar** — Tornar conquistas editaveis (nao mais hardcoded) |

### Resumo

- 2 tabelas novas no banco (`gamification_campaigns`, `campaign_participants`)
- 5 componentes novos
- 1 service novo
- 2 arquivos modificados
- Admin: CRUD completo de campanhas, metas e conquistas
- Operador: visualizacao do ranking e campanhas ativas para engajamento
