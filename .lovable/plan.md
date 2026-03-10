

# Diagnóstico: Funcionalidades do Super Admin — Backend Necessário

## Resumo por Página

| Página | Status | Problema |
|---|---|---|
| `/admin` (Dashboard Executivo) | **Funcional** | Consulta dados reais de tenants, clients, agreements |
| `/admin/suporte` (Suporte) | **Funcional** | Tabelas `support_tickets`, `support_messages`, `support_schedule_requests` existem |
| `/admin/tenants` (Gestão de Tenants) | **Funcional** | CRUD real via `tenants` table |
| `/admin/financeiro` (Financeiro) | **Funcional** | Consulta `payment_records`, `asaas_customers`, `plans` |
| `/admin/servicos` (Serviços e Tokens) | **Funcional** | CRUD real via `service_catalog` e `token_packages` |
| `/admin/configuracoes` (Configurações) | **Funcional** | `system_settings` + Go-Live Checklist |
| `/admin/relatorios` (Relatórios) | **Funcional** | Consulta `tenants` para gráfico de crescimento |
| `/admin/roadmap` (Roadmap) | **Funcional** | Dados estáticos (sem backend necessário) |
| `/admin/equipes` | **MOCK** | Dados hardcoded, sem tabela backend |
| `/admin/treinamentos` | **MOCK** | Dados hardcoded, sem tabela backend |

## O que precisa ser criado no backend

### 1. Gestão de Equipes (`/admin/equipes`) — Totalmente mock

A página usa `mockTeam` e `roles` hardcoded. Precisa de:

**Tabela `admin_staff`**: Colaboradores da equipe interna da Rivo Connect (não confundir com usuários de tenants).

```text
admin_staff
├── id (uuid PK)
├── user_id (uuid → auth.users)
├── full_name (text)
├── role_title (text) — "Gerente Geral", "Suporte N1"
├── department (text) — "Gestão", "Suporte", "Financeiro"
├── status (text) — "ativo" | "inativo"
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

**RLS**: Apenas super_admins podem ler/escrever.

**Código**: Substituir `mockTeam` por queries reais + formulário de cadastro.

### 2. Treinamentos e Reuniões (`/admin/treinamentos`) — Totalmente mock

A página usa `mockMeetings` hardcoded. Precisa de:

**Tabela `admin_meetings`**: Agenda de reuniões e treinamentos gerenciadas pelo Super Admin.

```text
admin_meetings
├── id (uuid PK)
├── title (text)
├── description (text)
├── meeting_type (text) — "Onboarding" | "Treinamento" | "Reunião"
├── tenant_id (uuid → tenants, nullable)
├── scheduled_at (timestamptz)
├── duration_minutes (int, default 60)
├── meeting_url (text, nullable) — link Google Meet/Zoom
├── status (text) — "agendada" | "realizada" | "cancelada"
├── participants_count (int, default 0)
├── notes (text, nullable)
├── created_by (uuid → auth.users)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

**RLS**: Apenas super_admins podem ler/escrever.

**Código**: Substituir `mockMeetings` por queries reais + dialog de criação/edição.

## Plano de Implementação

### Migration SQL
- Criar tabelas `admin_staff` e `admin_meetings`
- RLS: `is_super_admin(auth.uid())` para SELECT/INSERT/UPDATE/DELETE

### Arquivos a editar
| Arquivo | Ação |
|---|---|
| `src/pages/admin/AdminEquipesPage.tsx` | Substituir mock por queries + formulário CRUD |
| `src/pages/admin/AdminTreinamentosPage.tsx` | Substituir mock por queries + dialog de reunião |

### Total: 1 migration + 2 arquivos editados

