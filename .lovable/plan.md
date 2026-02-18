
## Página de Roadmap do Produto

### Objetivo
Criar uma página `/roadmap` acessível pelo menu de Configurações (CadastrosPage) que exibe de forma visual todo o progresso do sistema: o que está concluído, em andamento, planejado e futuro — com barras de progresso por categoria e um botão para copiar o contexto de cada item diretamente para o Lovable.

---

### Estrutura do Roadmap

Com base nos módulos identificados no sistema, o roadmap será organizado assim:

**CONCLUÍDO (100%)**
- Dashboard & KPIs
- Carteira de Clientes (Kanban, filtros, propensão de pagamento)
- Gestão de Acordos (geração de boleto, termos, assinatura digital)
- Portal do Devedor (negociação self-service, checkout, assinatura facial/desenho)
- Contact Center — WhatsApp (conversas, IA sugestão, etiquetas, respostas rápidas, agente IA)
- Contact Center — Telefonia 3CPlus (dashboard operadores, campanhas, discador, relatórios, mailing, SMS, blacklist)
- Integração CobCloud (importação em massa, preview, mapeamento)
- Integração Negociarie (envio de acordos, callback)
- Integração WhatsApp Baylers/Evolution (instâncias, webhooks)
- Automação de Cobrança (régua por canal, pós-tabulação, histórico)
- Relatórios & Analytics (aging, evolução, ranking de operadores)
- Auditoria de Atividades
- Negativação / Protesto
- Módulo Financeiro (despesas)
- Configurações de Empresa (Tenant Settings)
- Gestão de Usuários, Equipes, Credores, Status, Tipos
- Autenticação & Onboarding Multi-Tenant
- Assinatura Digital (desenho, facial, click)
- Notificações internas

**EM ANDAMENTO (~60%)**
- Operador selecionando campanha no login da Telefonia *(implementado, mas sem testes em produção)*
- SLA de atendimento no WhatsApp *(badge + tooltip entregue, lógica de configuração em andamento)*
- Painel de Admin unificado (Configurações consolidando Avançado e Super Admin)

**PLANEJADO / PENDENTE (~0–30%)**
- Serasa (estrutura criada, configuração/testes pendentes)
- Relatórios exportáveis (PDF/Excel completo por módulo)
- App Mobile (PWA ou React Native)
- Integração com gateway de pagamento nativo (Stripe/Pagar.me)
- Discador preditivo avançado (script de abordagem dinâmico)
- Dashboard executivo consolidado (multi-tenant para super admin)

**FUTURAS / BACKLOG**
- IA generativa para proposta de acordo automatizada
- OCR de documentos de dívida
- Score de crédito integrado (Serasa/Boa Vista)
- Integração com ERP (SAP, Totvs)
- Módulo de Mediação de Conflitos (API judicial)
- WhatsApp Business API (Meta Oficial)

---

### Dados da Página

Cada item do roadmap terá:
- **Título** e **descrição curta**
- **Status**: `done` | `in_progress` | `planned` | `future`
- **Progresso** (0–100%)
- **Categoria**: ex. "Contact Center", "Integrações", "Portal", "Core"
- **Contexto Lovable** (texto copiável para colar no chat do Lovable e executar a tarefa)

---

### Componente Visual

**Layout da página:**
```text
┌─────────────────────────────────────────────────────────┐
│  Roadmap do Produto                                      │
│  Barra de progresso geral (ex: 72% concluído)           │
│                                                         │
│  Filtros: [Todos] [Concluído] [Em Andamento] [Futuro]   │
│           Busca por nome                                 │
├─────────────────────────────────────────────────────────┤
│  ✅ CONCLUÍDO                                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🟢 Dashboard & KPIs          ████████████ 100% │    │
│  │    "Página principal com cards de métricas..."  │    │
│  │    [📋 Copiar contexto Lovable]                 │    │
│  └─────────────────────────────────────────────────┘    │
│  ...                                                    │
│                                                         │
│  🔄 EM ANDAMENTO                                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🟡 SLA de Atendimento        ████████░░░░  65% │    │
│  │    "Badge visual entregue, ..."                 │    │
│  │    [📋 Copiar contexto Lovable]                 │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

### Detalhes Técnicos

**Arquivos a criar/modificar:**

| Arquivo | Ação |
|---|---|
| `src/pages/RoadmapPage.tsx` | Criar — página principal com todos os dados hardcoded |
| `src/components/AppLayout.tsx` | Adicionar `/roadmap` em `pageTitles` |
| `src/pages/CadastrosPage.tsx` | Adicionar seção "Roadmap" com ícone `Map` na sub-nav (visível para admins) |
| `src/App.tsx` | Adicionar rota `/roadmap` |

**Componentes internos da RoadmapPage:**
- `RoadmapCard` — card de cada feature com barra de progresso e botão copiar
- Filtros por status com `useState`
- Campo de busca textual
- Agrupamento por status com contadores
- Progresso geral calculado automaticamente (média ponderada)

**Botão "Copiar contexto Lovable":**
Usa `navigator.clipboard.writeText(item.lovablePrompt)` + toast de confirmação `"Contexto copiado! Cole no Lovable para executar."`.

**Badge de status visual:**
- `done` → verde com ✅
- `in_progress` → âmbar com 🔄
- `planned` → azul com 📋
- `future` → roxo/cinza com 🔮

**Barra de progresso geral:**
Calcula a média ponderada de todos os itens `progress` e exibe no topo com o componente `<Progress>` existente.

**Acesso:**
Visível apenas para admins (verificação via `isTenantAdmin`), assim como as demais seções de Configurações.

---

### Nenhuma migração de banco necessária.
### Nenhuma nova dependência necessária.
