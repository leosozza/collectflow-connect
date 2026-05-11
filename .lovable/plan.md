## Objetivo

Entregar duas coisas complementares para acelerar a operação do novo tenant:

- **B)** Um **Wizard de Setup do Tenant** (pós-criação) que guie o admin por todas as etapas até o go-live, com checklist visual e progresso persistido.
- **C)** Um **guia em `docs/`** que espelha as mesmas etapas, para a equipe de implantação seguir.

---

## Parte B — Wizard de Setup do Tenant

### O que já existe
- `src/pages/OnboardingPage.tsx`: cria a **empresa** (nome, slug, CNPJ, plano). Termina aqui hoje.
- `src/components/admin/GoLiveChecklist.tsx`: existe mas é focado em validações **globais da plataforma** (Asaas em produção, planos cadastrados, etc.), não nas etapas que o admin do tenant precisa completar.
- Diversas páginas isoladas para cada configuração (credores, usuários, WhatsApp, telefonia, integrações, importação).

### O que falta
Um lugar único, **dentro da área do tenant**, que mostre quais passos faltam ele cumprir para operar — com links diretos para cada tela e marca automática de "concluído" quando o dado já existe.

### Nova rota
- `/setup` — Tenant Setup Wizard (acesso: admin do tenant)
- Botão "Setup do tenant" no menu lateral (só aparece se ainda houver etapas pendentes, e fica oculto/marcado como concluído após go-live)
- Banner persistente no topo do Dashboard enquanto houver pendências críticas

### Estrutura do Wizard

Página única com **8 cards de etapa**, cada um com:
- Ícone + título
- Status: `pendente` / `em andamento` / `concluído` (calculado por queries reais)
- Resumo do que falta (ex.: "0 credores cadastrados", "WhatsApp não conectado")
- Botão "Configurar" que leva à página correspondente
- Botão "Marcar como concluído" para etapas opcionais

#### Etapa 1 — Empresa
Detecta: `tenants.razao_social`, `cnpj`, `endereco`, `responsavel` preenchidos.
CTA: `/configuracoes` (aba Empresa)

#### Etapa 2 — Credores e cadastros base
Detecta:
- `credores.count > 0`
- `tipos_devedor.count > 0`, `tipos_divida.count > 0`, `status_cobranca.count > 0`
- `scripts_abordagem.count > 0`, `dispositions.count > 0`
- `document_layouts.count > 0`

CTA: `/cadastros`

#### Etapa 3 — Equipe e permissões
Detecta:
- `profiles` com role `operador` no tenant (count ≥ 1)
- Opcional: equipes, metas, comissão

CTA: `/users` (criação de operador) e `/admin/equipes`

#### Etapa 4 — Canais de comunicação
Detecta:
- WhatsApp: pelo menos 1 `whatsapp_instances` conectada
- Telefonia: credenciais 3CPlus configuradas (`tenant_settings.threecplus_*`)
- E-mail: domínio Resend configurado (opcional)

CTA: `/contact-center/whatsapp` e `/contact-center/telefonia`

#### Etapa 5 — Gateways de pagamento
Detecta: `payment_gateway_credentials` (Asaas e/ou Negociarie ativos) no tenant.
CTA: `/configuracoes` (aba Integrações)

#### Etapa 6 — Importação da carteira
Detecta: `clients.count > 0` no tenant.
Submetas:
- Carteira importada (`clients > 0`)
- Higienização executada (existe ao menos 1 cliente com `endereco`/`cep` preenchido pós-enrich)
- Auto-status-sync rodado (existe ao menos 1 cliente fora de `pendente`)

CTA: `/carteira` com botão "Importar"

#### Etapa 7 — Automação e workflows
Detecta:
- `workflows.count > 0` ativos
- Regras de score configuradas (`scoring_rules.count > 0`)

CTA: `/automacao`

#### Etapa 8 — Go-Live
Mostra o status final. Quando 1–7 estão verdes:
- Exibe selo "Pronto para operar"
- Botão "Concluir Setup" que grava `tenants.setup_completed_at = now()`
- A partir daí, o item de menu "Setup" some e o banner do Dashboard some.

### Persistência

Nova coluna em `tenants`:
- `setup_completed_at TIMESTAMPTZ NULL` (preenchida quando admin clica "Concluir Setup")
- `setup_steps_state JSONB DEFAULT '{}'::jsonb` (guarda manuais de "marcar como concluído" para etapas opcionais)

Detecção dos status nas etapas vem **sempre de queries em tempo real** (não armazenamos status booleano), exceto onde o admin marca manualmente.

### Componentes a criar

```
src/pages/TenantSetupPage.tsx                    ← rota /setup
src/components/setup/SetupStepCard.tsx           ← card reutilizável por etapa
src/components/setup/SetupProgressHeader.tsx     ← barra de progresso (X/8)
src/components/setup/SetupBanner.tsx             ← banner no Dashboard quando pendente
src/hooks/useTenantSetupStatus.ts                ← faz as queries e retorna o status de cada etapa
src/services/tenantSetupService.ts               ← persistência (completed_at, manual steps)
```

### Integração com UI existente

- `src/components/AppLayout.tsx`: adicionar item "Setup" no menu (com badge "X pendências") apenas quando `setup_completed_at` for null.
- `src/pages/DashboardPage.tsx`: incluir `<SetupBanner />` no topo enquanto houver pendências críticas (etapas 1, 2, 4, 5, 6).
- `src/App.tsx`: registrar rota `/setup`.

### Migration necessária

```sql
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS setup_steps_state JSONB NOT NULL DEFAULT '{}'::jsonb;
```

Sem mudanças em RLS (a coluna fica sob as policies existentes da tabela `tenants`).

---

## Parte C — Documento `docs/TENANT_SETUP_GUIDE.md`

Novo arquivo em `docs/` (sem mexer no `docs/SAAS_ONBOARDING.md` que é voltado para super-admin criando tenants).

### Conteúdo do guia
1. Visão geral (o que é, quanto tempo leva, pré-requisitos).
2. Para cada uma das 8 etapas do wizard:
   - **O que é**: explicação em português leigo.
   - **Onde fica**: caminho na UI (`Menu → Cadastros → Credores`).
   - **Como fazer**: passo-a-passo numerado.
   - **Como validar**: o que indica que a etapa está concluída.
   - **Erros comuns**: dicas de troubleshooting.
3. Apêndice:
   - Checklist imprimível (markdown checklist).
   - FAQ (CNPJ inválido, WhatsApp não conecta, importação falha).
   - Links cruzados para `docs/SAAS_ONBOARDING.md` (criação) e `docs/maxsystem-integracao.md` (importação).

---

## Ordem de execução

1. Migration (`setup_completed_at` + `setup_steps_state` em `tenants`).
2. `useTenantSetupStatus` (queries de detecção).
3. `SetupStepCard`, `SetupProgressHeader`, `TenantSetupPage` + rota.
4. `SetupBanner` no Dashboard + item de menu no `AppLayout`.
5. `tenantSetupService` (gravação de manual completion + concluir setup).
6. `docs/TENANT_SETUP_GUIDE.md`.
7. Verificação manual: logar como admin do novo tenant, abrir `/setup`, checar que cada etapa reflete o estado real do banco; concluir setup e confirmar que banner e item de menu somem.

## Riscos e cuidados

- **Tenant isolation**: todas as queries do `useTenantSetupStatus` precisam incluir `.eq('tenant_id', tenantId)`.
- **Performance**: o hook faz ~10 counts; agrupar em um único `Promise.all` e usar `react-query` com `staleTime: 30s`.
- **Permissões**: somente role `admin` enxerga `/setup` e o banner; operadores não veem nada.
- **Não bloqueia o uso**: o wizard é informativo, não impede acessar outras telas.
