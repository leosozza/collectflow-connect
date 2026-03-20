

# Plano: Separar Super Admin da Gamificação + Controle de Participantes + Revisão do Dashboard

## Diagnóstico

### 1. Super Admin misturado com tenant
O login `raul@temisconsultoria.com.br` (super_admin, `user_id: d591ef12`) está na mesma `tenant_id` da YBRASIL e aparece no dashboard, ranking, e filtros de operadores junto com os operadores reais. Da mesma forma, `raulsjunior579@gmail.com` (admin, `user_id: 0e5a460b`) é admin e não deveria aparecer na gamificação.

**Problema no código:**
- `DashboardPage.tsx` (linha 77-80): busca TODOS os profiles do tenant, incluindo admins e super_admin
- `GoalsManagementTab.tsx` (linha 29-33): lista TODOS os profiles do tenant para definir metas
- `gamificationService.ts` `fetchRanking`: retorna TODOS os `operator_points` sem filtrar por role
- Não existe conceito de "usuário habilitado para gamificação"

### 2. Dashboard — números
Os números estão corretos para os dados atuais (só 1 acordo cancelado em março, sem parcelas no mês). Os zeros são legítimos. Porém, o problema de `entrada_date IS NULL` com `entrada_value > 0` pode causar parcelas "perdidas" no cálculo. Precisa de fallback.

## Mudanças

### 1. Nova tabela `gamification_participants` — controlar quem participa
Migration SQL para criar tabela que define quais usuários estão habilitados na gamificação:

```sql
CREATE TABLE public.gamification_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, profile_id)
);
ALTER TABLE gamification_participants ENABLE ROW LEVEL SECURITY;
-- RLS: tenant admins podem gerenciar
```

### 2. Nova aba "Participantes" em Gamificação > Gerenciar
**Novo arquivo:** `src/components/gamificacao/ParticipantsManagementTab.tsx`

- Lista todos os profiles do tenant com toggle (Switch) para habilitar/desabilitar
- Mostra role do usuário como badge informativo
- Por padrão, operadores são habilitados, admins e super_admin não
- Botão "Habilitar todos os operadores" para facilitar setup inicial

### 3. Filtrar operadores no Dashboard e Gamificação

**`src/pages/DashboardPage.tsx`** (linha 77-80):
- No filtro de operadores, excluir profiles com role `admin` ou cujo `user_id` é super_admin (via `tenant_users.role`)
- Alternativa mais simples: filtrar `profiles.role IN ('operador', 'supervisor')` no select

**`src/services/gamificationService.ts`** `fetchRanking`:
- Após buscar `operator_points`, filtrar apenas quem está em `gamification_participants.enabled = true`

**`src/components/gamificacao/GoalsManagementTab.tsx`** (linha 29-33):
- Filtrar operators query para mostrar apenas participantes habilitados na gamificação

### 4. Dashboard RPC — fix `entrada_date IS NULL`
**Migration:** Atualizar `get_dashboard_stats` para usar `COALESCE(a.entrada_date, a.first_due_date)` em vez de `a.entrada_date IS NOT NULL`. Quando a entrada existe (`entrada_value > 0`) mas não tem data definida, usar `first_due_date` como fallback. Isso evita perder parcelas de entrada nos cálculos.

### 5. Registrar na aba Gerenciar
**`src/pages/GamificacaoPage.tsx`:**
- Adicionar sub-tab "Participantes" dentro de "Gerenciar"

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| Migration SQL | Criar `gamification_participants` + RLS + Fix RPC `get_dashboard_stats` (fallback entrada_date) |
| `src/components/gamificacao/ParticipantsManagementTab.tsx` | **Novo** — toggle de participantes |
| `src/pages/GamificacaoPage.tsx` | Adicionar sub-tab Participantes |
| `src/pages/DashboardPage.tsx` | Filtrar operadores por role (excluir admin/super_admin) |
| `src/components/gamificacao/GoalsManagementTab.tsx` | Filtrar apenas participantes habilitados |
| `src/services/gamificationService.ts` | `fetchRanking` filtra por participantes habilitados |

