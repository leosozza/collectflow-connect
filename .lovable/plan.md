

# Plano: Transformacao SaaS Multi-Tenant -- Fase 1 (Foundation)

## Resumo

Transformar o CollectFlow Connect de uma aplicacao single-tenant em uma plataforma SaaS multi-tenant, onde cada empresa de cobranca (tenant) opera de forma isolada com seus proprios dados, usuarios e configuracoes. Este plano cobre a **Fase 1 -- Foundation**, que e a base critica para todas as fases seguintes.

---

## O que muda para o usuario

- Cada empresa tera seu proprio espaco isolado no sistema
- Um fluxo de onboarding guiara novos tenants (criar empresa, escolher plano)
- Admins de cada tenant gerenciam apenas seus proprios dados e usuarios
- Um super-admin podera visualizar e gerenciar todos os tenants
- Planos (Starter, Professional, Enterprise) definem limites de uso

---

## Arquitetura Multi-Tenant

A estrategia sera **tenant_id + RLS** (Row Level Security), onde todas as tabelas compartilham o mesmo schema mas os dados sao isolados por politicas de seguranca no banco.

```text
+------------------+     +-------------------+     +------------------+
|   Tenant A       |     |   Tenant B        |     |   Tenant C       |
|   (Empresa X)    |     |   (Empresa Y)     |     |   (Empresa Z)    |
+--------+---------+     +---------+---------+     +--------+---------+
         |                         |                        |
         +------------+------------+------------------------+
                      |
              +-------v--------+
              |  Banco unico   |
              |  com RLS por   |
              |  tenant_id     |
              +----------------+
```

---

## Etapas de Implementacao

### Etapa 1: Criar tabelas base (Migracoes SQL)

**Tabela `plans`** -- Define os planos SaaS disponiveis:
- Campos: id, name, slug, price_monthly, limits (JSONB com max_users, max_clients, features)
- Insercao dos planos iniciais: Starter (R$99,90), Professional (R$299,90), Enterprise (R$799,90)

**Tabela `tenants`** -- Cada empresa de cobranca:
- Campos: id, name, slug (unico), logo_url, primary_color, plan_id (FK para plans), status (active/suspended/cancelled), settings (JSONB), created_at, updated_at

**Tabela `tenant_users`** -- Relacionamento usuario-tenant com role:
- Campos: id, tenant_id, user_id, role (super_admin/admin/operador), created_at
- Substitui o campo `role` da tabela `profiles` para contexto multi-tenant

### Etapa 2: Atualizar tabelas existentes

- Adicionar coluna `tenant_id` (UUID, FK para tenants) nas tabelas:
  - `profiles`
  - `clients`
  - `commission_grades`
- Criar indices em `tenant_id` para performance
- Migrar dados existentes: criar um tenant padrao e associar todos os registros atuais a ele

### Etapa 3: Atualizar politicas RLS

Substituir as politicas atuais por politicas baseadas em tenant_id:

- Funcao helper `get_my_tenant_id()` (SECURITY DEFINER) que retorna o tenant_id do usuario logado
- Funcao helper `has_tenant_role(tenant_id, role)` para verificar roles no contexto do tenant
- Politicas em `clients`: usuario so ve/edita dados do seu tenant
- Politicas em `profiles`: usuario so ve perfis do mesmo tenant
- Politicas em `commission_grades`: isoladas por tenant
- Politica especial para super_admin ver todos os tenants

### Etapa 4: Criar TenantContext (Frontend)

Novo hook `useTenant.tsx`:
- Busca o tenant do usuario logado via `tenant_users`
- Expoe: tenant atual, plano, funcoes `canAccess(feature)` e `checkLimit(resource, count)`
- Envolve toda a aplicacao via `TenantProvider`

### Etapa 5: Fluxo de Onboarding

Nova pagina `/onboarding` com etapas:
1. Criar empresa (nome, slug/subdominio)
2. Selecionar plano
3. Convidar primeiros usuarios (opcional)
4. Redirecionamento ao dashboard

### Etapa 6: Pagina de Configuracoes do Tenant

Nova pagina `/tenant/configuracoes` (somente admin do tenant):
- Dados da empresa (nome, logo, cor primaria)
- Plano atual e uso vs limites
- Gerenciamento de usuarios do tenant

### Etapa 7: Super Admin

Nova role `super_admin` com acesso global:
- Pagina `/admin/tenants` para listar, suspender e gerenciar tenants
- Visao consolidada de todos os tenants

### Etapa 8: Atualizar servicos e componentes existentes

- `clientService.ts`: incluir tenant_id automaticamente nas queries (via RLS, transparente)
- `useAuth.tsx`: carregar tambem o tenant do usuario
- `AppLayout.tsx`: mostrar nome/logo do tenant no sidebar
- Todas as paginas existentes continuam funcionando, agora filtradas por tenant via RLS

---

## Detalhes Tecnicos

### Migracoes SQL principais

```sql
-- plans
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  price_monthly DECIMAL(10,2),
  limits JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#F97316',
  plan_id UUID REFERENCES plans(id),
  status TEXT DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- tenant_users (roles por tenant)
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'operador',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Adicionar tenant_id nas tabelas existentes
ALTER TABLE profiles ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE clients ADD COLUMN tenant_id UUID REFERENCES tenants(id);
ALTER TABLE commission_grades ADD COLUMN tenant_id UUID REFERENCES tenants(id);
```

### Funcoes helper RLS

```sql
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM tenant_users
  WHERE user_id = auth.uid() LIMIT 1
$$;
```

### Estrutura de arquivos novos

```text
src/
  hooks/
    useTenant.tsx            -- Context do tenant
  pages/
    OnboardingPage.tsx       -- Fluxo de criacao de tenant
    TenantSettingsPage.tsx   -- Config do tenant
    SuperAdminPage.tsx       -- Gestao global de tenants
  components/
    billing/
      PlanCard.tsx           -- Card de exibicao do plano
      UsageMeter.tsx         -- Medidor uso vs limites
    tenant/
      TenantSelector.tsx     -- Seletor de tenant (se usuario pertence a mais de um)
  services/
    tenantService.ts         -- CRUD e queries de tenant
```

### Compatibilidade retroativa

- Um tenant padrao sera criado com os dados existentes
- Todos os registros atuais (profiles, clients, commission_grades) recebem o tenant_id do tenant padrao
- O usuario admin atual se torna super_admin
- Nenhuma funcionalidade existente e perdida

---

## Fases futuras (nao incluidas neste plano)

Apos a Fase 1 concluida, as proximas fases serao:
- **Fase 2**: Automacao e Comunicacao (regua de cobranca, WhatsApp, SMS, Email)
- **Fase 3**: Negociacao e Pagamentos (acordos, PIX, boleto, gateways)
- **Fase 4**: Analytics avancado e Portal do Devedor (white-label)

---

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Dados existentes nao migrados | Script de migracao cria tenant padrao e associa tudo |
| Performance com RLS | Indices em tenant_id + funcoes SECURITY DEFINER |
| Complexidade de roles | Tabela tenant_users separada, funcoes helper |
| Limites do Lovable | Toda logica complexa via Edge Functions |

