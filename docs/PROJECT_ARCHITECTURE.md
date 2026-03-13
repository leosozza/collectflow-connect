# 🏗️ RIVO Connect — Arquitetura do Projeto

> Guia explicativo da estrutura, padrões e fluxos de dados do projeto.  
> Atualizado em: Março 2026

---

## 1. Visão Geral

O **RIVO Connect** é uma plataforma SaaS multi-tenant de cobrança e recuperação de crédito, construída com:

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **UI** | Tailwind CSS + shadcn/ui + Framer Motion |
| **Estado** | TanStack React Query + Context API |
| **Roteamento** | React Router v6 |
| **Backend** | Supabase (Postgres + Auth + Storage + Edge Functions) |
| **Infraestrutura** | Lovable Cloud (serverless) |

---

## 2. Estrutura de Diretórios

### `src/pages/` — Páginas da aplicação

Cada arquivo representa uma rota. Organizadas por domínio:

| Subdiretório | Descrição |
|-------------|-----------|
| `pages/` (raiz) | Páginas do tenant (operador, admin) |
| `pages/admin/` | Páginas exclusivas do Super Admin |
| `pages/admin/comercial/` | CRM interno (pipeline, leads, empresas) |

**Convenção**: `NomeDaPaginaPage.tsx` (PascalCase + sufixo `Page`).

---

### `src/components/` — Componentes React

Organização **domain-driven** — cada pasta agrupa componentes de um módulo funcional:

| Pasta | Módulo | Exemplos |
|-------|--------|----------|
| `ui/` | Design system (shadcn/ui) | Button, Dialog, Table, Card |
| `acordos/` | Gestão de acordos | AgreementForm, AgreementsList |
| `carteira/` | Carteira de clientes | CarteiraTable, CarteiraKanban, Filters |
| `contact-center/` | Telefonia + WhatsApp | ChatPanel, DialPad, ConversationList |
| `automacao/` | Réguas e workflows | RuleForm, WorkflowCanvas, FlowNodes |
| `gamificacao/` | Gamificação | RankingTab, ShopTab, CampaignCard |
| `cadastros/` | Credores, tipos, equipes | CredorForm, TipoStatusList |
| `integracao/` | Integrações externas | SerasaRecordsList, ProtestoTab |
| `portal/` | Portal do devedor | PortalHero, PortalCheckout, Signatures |
| `dashboard/` | Dashboard KPIs | KPICards, GoalProgress, MiniRanking |
| `financeiro/` | Financeiro | ExpenseForm, PaymentCheckoutDialog |
| `relatorios/` | Relatórios | AgingReport, EvolutionChart |
| `notifications/` | Notificações | NotificationBell, AgreementCelebration |
| `perfil/` | Perfil do usuário | PersonalDataTab, SecurityTab |
| `comercial/` | CRM components | LeadScoreBadge, OpportunityCard |
| `admin/` | Admin/Super Admin | GoLiveChecklist, IntegrationTabs |
| `support/` | Suporte ao cliente | SupportChatTab, SupportFloatingButton |
| `tokens/` | Sistema de tokens | TokenBalance, TokenPurchaseDialog |

**Convenção**: Componentes em PascalCase. Subpastas para features complexas (ex: `workflow/nodes/`).

---

### `src/services/` — Camada de Serviços

Cada service encapsula **toda a comunicação com o Supabase** para um domínio:

```
Componente → Service → Supabase Client → Banco de Dados
```

| Service | Responsabilidade |
|---------|-----------------|
| `clientService.ts` | CRUD de clientes/devedores |
| `agreementService.ts` | Criar, listar, aprovar acordos |
| `conversationService.ts` | Mensagens e conversas WhatsApp |
| `gamificationService.ts` | Pontos, conquistas, ranking |
| `crmService.ts` | Leads, oportunidades, pipeline |
| `workflowService.ts` | Workflows visuais (CRUD + execução) |
| `importService.ts` | Importação de planilhas |
| `auditService.ts` | Registros de auditoria |
| `tenantService.ts` | Gestão de tenants |
| `tokenService.ts` | Consumo e compra de tokens |

**Padrão**: Funções assíncronas que retornam dados tipados. Nenhum componente acessa o Supabase diretamente — sempre via service.

---

### `src/hooks/` — Hooks Customizados

Gerenciam **estado global e lógica reutilizável**:

| Hook | Função |
|------|--------|
| `useAuth.tsx` | AuthProvider + login/logout/session |
| `useTenant.tsx` | TenantProvider + tenant/role/plan |
| `usePermissions.ts` | Verificação de permissões por role |
| `useSAPermissions.ts` | Permissões granulares do Super Admin |
| `useGamification.ts` | Dados de gamificação do operador |
| `useGamificationTrigger.ts` | Disparar eventos de gamificação |
| `useNotifications.ts` | Notificações em tempo real |
| `useScheduledCallbacks.ts` | Callbacks agendados |
| `useActivityTracker.ts` | Tracking de atividade do usuário |
| `useFlowHistory.ts` | Undo/redo de workflows |
| `use-mobile.tsx` | Detecção de viewport mobile |

---

### `src/lib/` — Utilitários

Funções puras sem dependência de React:

| Arquivo | Conteúdo |
|---------|----------|
| `utils.ts` | `cn()` (merge de classes Tailwind) |
| `formatters.ts` | Formatação de moeda (BRL), datas, CPF/CNPJ |
| `validations.ts` | Validações Zod para formulários |
| `commission.ts` | Cálculo de comissões por faixa |
| `exportUtils.ts` | Geração de CSV/XLSX |
| `fetchWithTimeout.ts` | Fetch com timeout configurável |

---

### `src/integrations/supabase/` — Cliente Supabase

| Arquivo | Descrição |
|---------|-----------|
| `client.ts` | Instância do Supabase client (auto-gerado) |
| `types.ts` | Tipos TypeScript do schema (auto-gerado) |

> ⚠️ **Nunca editar manualmente.** Estes arquivos são regenerados automaticamente.

---

### `supabase/functions/` — Edge Functions (Backend)

**34 funções serverless** organizadas por responsabilidade:

#### 🔌 Proxies de Integrações
| Função | Integração |
|--------|-----------|
| `asaas-proxy` | Gateway de pagamentos Asaas |
| `cobcloud-proxy` | Plataforma CobCloud |
| `evolution-proxy` | Evolution API (WhatsApp) |
| `maxsystem-proxy` | MaxSystem |
| `negociarie-proxy` | Negociarie |
| `threecplus-proxy` | 3CPlus (telefonia) |
| `wuzapi-proxy` | WuzAPI (WhatsApp) |

#### 📥 Webhooks
| Função | Origem |
|--------|--------|
| `asaas-webhook` | Notificações de pagamento |
| `gupshup-webhook` | Mensagens Gupshup |
| `negociarie-callback` | Callbacks Negociarie |
| `targetdata-webhook` | Enriquecimento TargetData |
| `whatsapp-webhook` | Mensagens WhatsApp |

#### ⚙️ Automações
| Função | Descrição |
|--------|-----------|
| `workflow-engine` | Motor de execução de workflows |
| `workflow-resume` | Retomar workflows pausados |
| `workflow-trigger-no-contact` | Trigger: sem contato |
| `workflow-trigger-overdue` | Trigger: vencidos |
| `auto-break-overdue` | Quebra automática |
| `auto-expire-agreements` | Expirar acordos |
| `auto-status-sync` | Sincronizar status |
| `check-sla-expiry` | Verificar SLA |

#### 🧠 IA
| Função | Descrição |
|--------|-----------|
| `chat-ai-suggest` | Sugestões de resposta no chat |
| `support-ai-chat` | Chat de suporte com IA |
| `calculate-propensity` | Score de propensão de pagamento |

#### 👤 Usuários e Auth
| Função | Descrição |
|--------|-----------|
| `create-user` | Criação de usuário com role |
| `accept-invite` | Aceitar convite de tenant |

#### 📦 Outros
| Função | Descrição |
|--------|-----------|
| `clients-api` | API REST pública de clientes |
| `portal-lookup` | Busca no portal do devedor |
| `portal-checkout` | Checkout do portal |
| `consume-tokens` | Consumir tokens |
| `purchase-tokens` | Comprar tokens |
| `send-bulk-whatsapp` | Disparo em massa |
| `send-notifications` | Enviar notificações |
| `send-quitados-report` | Relatório de quitados |
| `targetdata-enrich` | Enriquecimento de dados |

---

## 3. Padrões Arquiteturais

### 3.1 Multi-Tenancy

Todas as tabelas possuem `tenant_id`. O `TenantProvider` injeta o tenant ativo via Context API. Políticas RLS no banco garantem isolamento:

```
Usuário → Auth → tenant_users → tenant_id → RLS filter em todas as queries
```

### 3.2 Domain-Driven Components

Componentes são agrupados por **domínio de negócio**, não por tipo técnico:

```
✅ components/carteira/CarteiraTable.tsx
✅ components/carteira/CarteiraFilters.tsx
❌ components/tables/CarteiraTable.tsx   (anti-pattern)
```

### 3.3 Service Layer

Nenhum componente importa `supabase` diretamente. Todo acesso ao banco passa por um service:

```typescript
// ✅ Correto
import { getClients } from "@/services/clientService";

// ❌ Errado
import { supabase } from "@/integrations/supabase/client";
// ...supabase.from("clients").select()  dentro do componente
```

### 3.4 Permissões por Role

Hierarquia de roles:
```
super_admin > admin > gerente > supervisor > operador
```

- `usePermissions()` — verifica feature flags do plano
- `useSAPermissions()` — permissões granulares do Super Admin
- `ProtectedRoute` — bloqueia rotas sem autenticação/tenant

### 3.5 Layouts Isolados

| Layout | Uso |
|--------|-----|
| `AppLayout` | Páginas do tenant (sidebar + header + content) |
| `SuperAdminLayout` | Área administrativa da plataforma |
| `PortalLayout` | Portal público do devedor (sem auth) |

---

## 4. Fluxo de Dados

```
┌─────────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐
│  Componente │────▶│ Service  │────▶│ Supabase  │────▶│ Postgres │
│  (React)    │◀────│ Layer    │◀────│ Client    │◀────│ (RLS)    │
└─────────────┘     └──────────┘     └───────────┘     └──────────┘
       │                                                      │
       │            ┌──────────────┐                          │
       └───────────▶│ React Query  │  (cache + revalidation)  │
                    └──────────────┘                          │
                                                              │
                    ┌──────────────┐     ┌──────────────┐     │
                    │ Edge Function│────▶│ APIs Externas│     │
                    │ (Deno)       │◀────│ (Asaas, etc) │     │
                    └──────────────┘     └──────────────┘     │
                           │                                  │
                           └──────────────────────────────────┘
```

### Fluxo típico de uma operação:

1. **Componente** chama função do service (ex: `createAgreement()`)
2. **Service** usa `supabase.from().insert()` com dados tipados
3. **Supabase Client** envia request autenticada para o banco
4. **RLS** filtra por `tenant_id` automaticamente
5. **React Query** invalida cache e re-fetcha dados atualizados
6. **Componente** re-renderiza com novos dados

### Fluxo de integração externa:

1. **Frontend** chama Edge Function via `supabase.functions.invoke()`
2. **Edge Function** autentica, busca secrets e chama API externa
3. **Resultado** é persistido no banco e retornado ao frontend

---

## 5. Convenções de Nomenclatura

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Páginas | `PascalCase + Page` | `CarteiraPage.tsx` |
| Componentes | `PascalCase` | `AgreementForm.tsx` |
| Services | `camelCase + Service` | `agreementService.ts` |
| Hooks | `use + PascalCase` | `usePermissions.ts` |
| Edge Functions | `kebab-case` | `workflow-engine/index.ts` |
| Tabelas DB | `snake_case` | `agreement_signatures` |
| CSS Variables | `--kebab-case` | `--primary-foreground` |

---

## 6. Tecnologias e Dependências Chave

| Categoria | Pacote | Uso |
|-----------|--------|-----|
| UI Framework | `react` 18 | Base do frontend |
| Build | `vite` 5 | Bundler + HMR |
| Estilo | `tailwindcss` 3 | Utility-first CSS |
| Componentes | `shadcn/ui` (Radix) | 40+ componentes acessíveis |
| Animações | `framer-motion` | Transições e micro-interações |
| Formulários | `react-hook-form` + `zod` | Validação tipada |
| Gráficos | `recharts` | Charts e dashboards |
| Planilhas | `xlsx` | Importação/exportação Excel |
| Workflows | `reactflow` | Editor visual de fluxos |
| Estado Server | `@tanstack/react-query` | Cache + sync com backend |
| Backend | `@supabase/supabase-js` | Client SDK |
| Markdown | `react-markdown` | Renderização de markdown |
| Visão Computacional | `@mediapipe/tasks-vision` | Assinatura facial |

---

## 7. Segurança

- **RLS (Row Level Security)** em todas as tabelas com `tenant_id`
- **SECURITY DEFINER** functions para operações cross-tenant
- **Edge Functions** como proxy para APIs externas (secrets nunca expostos ao frontend)
- **API Keys** com hash SHA-256 (nunca armazenadas em texto puro)
- **Roles** separados em tabela dedicada (`tenant_users.role`)
- **Audit Logs** para todas as ações sensíveis
