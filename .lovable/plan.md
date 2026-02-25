

## Plano: Atualizar Roadmap + Criar Modulo de Suporte In-App

### Escopo

Este plano cobre duas entregas:
1. **Atualizar o Roadmap** com novas funcionalidades (Suporte, Landing Page B2B, Workflow Visual) e identificar melhorias
2. **Projetar o Modulo de Suporte completo** com botao flutuante, chat, guias interativos e agendamento

---

### PARTE 1 — Atualizacao do Roadmap

**Arquivo:** `src/pages/RoadmapPage.tsx`

Adicionar os seguintes itens ao array `roadmapData`:

**Novos itens "done":**
- Landing Page B2B (Hero de Conversao) — status: done, 100%
- Construtor Visual de Fluxos (Workflow Canvas) — status: done, 100% (ja implementado em src/components/automacao/workflow/)

**Novos itens "planned":**
- Modulo de Suporte In-App (detalhado abaixo) — status: planned, 10%
- Guia Interativo Passo-a-Passo (Onboarding Tours) — status: planned, 0%
- Agendamento de Reuniao com Suporte — status: planned, 0%

**Melhorias identificadas para itens existentes:**
- Atualizar "Construtor Visual de Fluxos" de "future" para "done" (ja existe em src/components/automacao/workflow/)
- Atualizar "Motor de Execucao de Fluxos" de "future" para "done" (ja existe em supabase/functions/workflow-engine/)
- Atualizar progresso do "Agente IA Autonomo" para 15% (AIAgentTab ja implementado)

---

### PARTE 2 — Modulo de Suporte In-App

#### Arquivos Novos

| Arquivo | Descricao |
|---------|-----------|
| `src/components/support/SupportFloatingButton.tsx` | Botao flutuante (FAB) canto inferior direito |
| `src/components/support/SupportPanel.tsx` | Painel lateral (Sheet) com abas de suporte |
| `src/components/support/SupportChatTab.tsx` | Chat de suporte em tempo real |
| `src/components/support/SupportGuidesTab.tsx` | Guias interativos organizados por modulo |
| `src/components/support/SupportScheduleTab.tsx` | Agendamento de reuniao com suporte |
| `src/components/support/GuideStep.tsx` | Componente de passo individual do guia |
| `src/pages/SupportAdminPage.tsx` | Pagina para funcionarios do suporte (super_admin) receberem tickets |

#### Arquivos Modificados

| Arquivo | Modificacao |
|---------|-------------|
| `src/pages/RoadmapPage.tsx` | Adicionar novos itens e atualizar status existentes |
| `src/components/AppLayout.tsx` | Renderizar SupportFloatingButton condicionalmente |
| `src/App.tsx` | Adicionar rota `/suporte-admin` (super_admin only) |
| `src/hooks/usePermissions.ts` | Adicionar permissao `suporte` com acoes `view`, `manage` |

#### Detalhes Tecnicos

**1. Botao Flutuante (`SupportFloatingButton.tsx`)**
- Posicao: fixed, bottom-6, right-6, z-50
- Icone: `LifeBuoy` ou `Headset` do lucide-react
- Visibilidade: apenas para usuarios autenticados cujo admin habilitou acesso (ou admins diretamente)
- Badge de notificacao quando ha resposta pendente
- Ao clicar: abre Sheet lateral (SupportPanel)

**2. Painel de Suporte (`SupportPanel.tsx`)**
- Componente Sheet (ja existe em ui/sheet.tsx) abrindo pela direita
- 3 abas usando Tabs:
  - **Chat** — conversa com suporte
  - **Guias** — tutoriais passo-a-passo
  - **Agendar** — marcar reuniao

**3. Chat de Suporte (`SupportChatTab.tsx`)**
- Tabela `support_tickets` no banco:
  - id, tenant_id, user_id, subject, status (open/in_progress/resolved/closed), priority, created_at, updated_at
- Tabela `support_messages`:
  - id, ticket_id, sender_id, content, is_staff (boolean), created_at
- RLS: usuarios veem apenas seus tickets; super_admin ve todos
- Realtime habilitado para mensagens instantaneas
- Interface similar ao WhatsApp chat ja existente (reutilizar estilo de ChatMessage)

**4. Guias Interativos (`SupportGuidesTab.tsx`)**
- Dados estaticos organizados por modulo do sistema:
  - Dashboard: "Como interpretar os KPIs", "Como definir metas"
  - Carteira: "Como importar clientes", "Como usar filtros", "Como exportar para discador"
  - Acordos: "Como criar um acordo", "Como gerar boleto"
  - Contact Center: "Como usar o WhatsApp", "Como entrar numa campanha 3CPlus"
  - Automacao: "Como criar uma regua de cobranca", "Como criar um workflow visual"
  - Cadastros: "Como adicionar credores", "Como gerenciar equipes"
  - Portal: "Como configurar o portal do devedor"
- Cada guia: titulo, descricao curta, lista de passos com texto + screenshot placeholder
- Busca por texto nos guias
- Organizacao em accordion por categoria

**5. Agendamento de Reuniao (`SupportScheduleTab.tsx`)**
- Formulario simples: nome, email, data/hora preferida, assunto
- Salva na tabela `support_schedule_requests` (id, tenant_id, user_id, preferred_date, subject, status, created_at)
- Notificacao interna para o super_admin via notificationService
- Opcao futura: integrar com Calendly ou Google Calendar via iframe

**6. Pagina Admin de Suporte (`SupportAdminPage.tsx`)**
- Acessivel apenas por super_admin (ou funcionario de suporte criado pelo super_admin)
- Lista de tickets com filtros: status, prioridade, tenant
- Ao clicar num ticket: abre chat para responder
- Dashboard basico: tickets abertos, tempo medio de resposta, tickets resolvidos

#### Banco de Dados — Migracoes

```sql
-- Tabela de tickets de suporte
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Usuarios veem seus tickets
CREATE POLICY "Users can view own tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND tenant_id = get_my_tenant_id());

-- Usuarios podem criar tickets
CREATE POLICY "Users can create tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_my_tenant_id());

-- Super admin ve todos
CREATE POLICY "Super admin can manage all tickets" ON public.support_tickets
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Tabela de mensagens do ticket
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_staff BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Politicas similares via JOIN com support_tickets

-- Tabela de agendamentos
CREATE TABLE public.support_schedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  preferred_date TIMESTAMPTZ NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_schedule_requests ENABLE ROW LEVEL SECURITY;

-- Habilitar realtime para mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
```

#### Fluxo do Usuario

```text
1. Usuario logado ve botao flutuante (canto inferior direito)
2. Clica → abre painel lateral com 3 abas
3. ABA GUIAS: navega por categoria, abre guia, segue passo-a-passo
4. ABA CHAT: cria ticket com assunto, envia mensagens, recebe respostas em tempo real
5. ABA AGENDAR: preenche formulario, seleciona data/hora, envia solicitacao
```

```text
FLUXO DO SUPORTE (super_admin):
1. Acessa /suporte-admin (ou aba no Painel Super Admin)
2. Ve lista de tickets abertos ordenados por prioridade
3. Clica num ticket → chat com historico
4. Responde → mensagem aparece em tempo real para o cliente
5. Altera status: open → in_progress → resolved → closed
```

#### Visibilidade do Botao Flutuante

- Super Admin e Admin: sempre visivel
- Outros roles: visivel se o admin habilitou (campo no tenant_settings ou permission_profile)
- Implementacao inicial: visivel para todos os usuarios autenticados (simplificar MVP)

