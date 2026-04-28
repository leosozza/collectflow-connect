import { useState } from "react";
import { Copy, Check, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Status = "done" | "in_progress" | "planned" | "future";

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: Status;
  progress: number;
  category: string;
  lovablePrompt: string;
}

const roadmapData: RoadmapItem[] = [
  // DONE
  {
    id: "dashboard",
    title: "Dashboard & KPIs",
    description: "Página principal com cards de métricas, metas de operadores, gráficos de evolução e ranking.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "O Dashboard já está implementado com KPIs, metas e gráficos. Contexto: página principal em src/pages/DashboardPage.tsx com componentes em src/components/dashboard/.",
  },
  {
    id: "carteira",
    title: "Carteira de Clientes",
    description: "Kanban de clientes por status, filtros avançados, propensão de pagamento via IA, exportação para discador.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "A Carteira de Clientes está implementada com Kanban, filtros e propensão de pagamento. Contexto: src/pages/CarteiraPage.tsx e componentes em src/components/carteira/.",
  },
  {
    id: "acordos",
    title: "Gestão de Acordos",
    description: "Criação de acordos, geração de boleto via Negociarie, termos em PDF e assinatura digital.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "A Gestão de Acordos está implementada. Contexto: src/pages/AcordosPage.tsx, src/components/acordos/, src/services/agreementService.ts.",
  },
  {
    id: "portal",
    title: "Portal do Devedor",
    description: "Negociação self-service, checkout com PIX/boleto, assinatura facial e por desenho.",
    status: "done",
    progress: 100,
    category: "Portal",
    lovablePrompt: "O Portal do Devedor está implementado em src/pages/PortalPage.tsx com componentes em src/components/portal/. Inclui checkout, assinatura facial e por desenho.",
  },
  {
    id: "whatsapp-cc",
    title: "Contact Center — WhatsApp",
    description: "Conversas em tempo real, sugestão IA, etiquetas, respostas rápidas, agente IA autônomo.",
    status: "done",
    progress: 100,
    category: "Contact Center",
    lovablePrompt: "O WhatsApp Contact Center está implementado em src/components/contact-center/whatsapp/. Inclui ChatPanel, AIAgentTab, TagsManagementTab e QuickRepliesTab.",
  },
  {
    id: "telefonia-cc",
    title: "Contact Center — Telefonia 3CPlus",
    description: "Dashboard de operadores, campanhas, discador, relatórios de agentes, mailing, SMS, blacklist.",
    status: "done",
    progress: 100,
    category: "Contact Center",
    lovablePrompt: "A Telefonia 3CPlus está implementada em src/components/contact-center/threecplus/. Proxy em supabase/functions/threecplus-proxy/. Inclui dashboard, campanhas e discador.",
  },
  {
    id: "cobcloud",
    title: "Integração CobCloud",
    description: "Importação em massa de clientes, preview de dados, mapeamento de campos e sincronização.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "A integração CobCloud está implementada em src/components/integracao/CobCloudTab.tsx e supabase/functions/cobcloud-proxy/.",
  },
  {
    id: "negociarie",
    title: "Integração Negociarie",
    description: "Envio de acordos para geração de boleto, callback de pagamento, atualização de status automática.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "A integração Negociarie está implementada em src/components/integracao/NegociarieTab.tsx, supabase/functions/negociarie-proxy/ e negociarie-callback/.",
  },
  {
    id: "evolution",
    title: "Integração WhatsApp Baylers/Evolution",
    description: "Gerenciamento de instâncias WhatsApp, webhooks, QR Code, envio de mensagens em massa.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "A integração Evolution está implementada em src/components/integracao/WhatsAppIntegrationTab.tsx, src/components/integracao/BaylersInstancesList.tsx e supabase/functions/evolution-proxy/.",
  },
  {
    id: "automacao",
    title: "Automação de Cobrança",
    description: "Régua de cobrança por canal (WhatsApp, email, SMS), automação pós-tabulação, histórico de mensagens.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "A Automação de Cobrança está implementada em src/pages/AutomacaoPage.tsx com componentes em src/components/automacao/. Inclui régua, pós-tabulação e histórico.",
  },
  {
    id: "relatorios",
    title: "Relatórios & Analytics",
    description: "Relatório de aging, gráfico de evolução de cobranças, ranking de operadores com filtros por período.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Os Relatórios estão implementados em src/pages/RelatoriosPage.tsx com AgingReport, EvolutionChart e OperatorRanking. Analytics em src/pages/AnalyticsPage.tsx.",
  },
  {
    id: "auditoria",
    title: "Auditoria de Atividades",
    description: "Log completo de ações dos usuários por tenant, filtrável por data e tipo de ação.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "A Auditoria está implementada em src/pages/AuditoriaPage.tsx e src/services/auditService.ts. Logs armazenados na tabela audit_logs no banco.",
  },
  {
    id: "protesto",
    title: "Negativação / Protesto",
    description: "Envio de títulos para protesto, acompanhamento de status, cancelamento e logs detalhados.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "O módulo de Protesto está implementado em src/components/integracao/ProtestoTab.tsx com componentes em src/components/integracao/protesto/.",
  },
  {
    id: "financeiro",
    title: "Módulo Financeiro",
    description: "Registro de despesas por categoria, listagem e controle de custos operacionais.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "O Módulo Financeiro está implementado em src/pages/FinanceiroPage.tsx com ExpenseForm e ExpenseList em src/components/financeiro/.",
  },
  {
    id: "tenant-settings",
    title: "Configurações de Empresa",
    description: "Personalização do tenant: nome, logo, cores do portal, configurações de assinatura e parcelas.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "As Configurações de Empresa estão implementadas em src/pages/TenantSettingsPage.tsx.",
  },
  {
    id: "usuarios",
    title: "Gestão de Usuários, Equipes e Credores",
    description: "CRUD completo de usuários, equipes com líderes, credores com configurações de portal e boleto.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "A Gestão de Usuários/Equipes/Credores está em src/pages/UsersPage.tsx e src/components/cadastros/. Inclui CredorList, EquipeList e CredorReguaTab.",
  },
  {
    id: "auth",
    title: "Autenticação & Onboarding Multi-Tenant",
    description: "Login, cadastro de empresa, convite por link, onboarding guiado, suporte multi-tenant.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "A Autenticação Multi-Tenant está implementada em src/pages/AuthPage.tsx, OnboardingPage.tsx e hooks useAuth/useTenant.",
  },
  {
    id: "assinatura",
    title: "Assinatura Digital",
    description: "Três modalidades: assinatura por desenho, por click com dados biométricos e facial via câmera.",
    status: "done",
    progress: 100,
    category: "Portal",
    lovablePrompt: "A Assinatura Digital está implementada em src/components/portal/signatures/ com SignatureDraw, SignatureClick e SignatureFacial usando MediaPipe.",
  },
  {
    id: "notificacoes",
    title: "Notificações Internas",
    description: "Sino de notificações, celebração de acordo fechado, notificações em tempo real por usuário.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "As Notificações estão implementadas em src/components/notifications/ com NotificationBell e AgreementCelebration. Serviço em src/services/notificationService.ts.",
  },
  {
    id: "gamificacao",
    title: "Gamificação de Operadores — Multi-Credor",
    description: "Sistema de pontuação, ranking mensal, conquistas editáveis por tenant/credor, campanhas com múltiplos credores e participantes por equipe ou individual.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: `A Gamificação de Operadores está implementada em src/pages/GamificacaoPage.tsx com os seguintes componentes:
- src/components/gamificacao/RankingTab.tsx — ranking mensal com medalhas 🥇🥈🥉
- src/components/gamificacao/AchievementsTab.tsx — conquistas desbloqueadas e bloqueadas
- src/components/gamificacao/AchievementsManagementTab.tsx — CRUD de templates de conquistas por credor
- src/components/gamificacao/PointsHistoryTab.tsx — histórico de pontos por mês
- src/components/gamificacao/CampaignsTab.tsx — campanhas com multi-credor e seleção de participantes
- src/components/gamificacao/CampaignForm.tsx — formulário com MultiSelect de credores, seleção por equipe ou individual
- src/components/gamificacao/GoalsManagementTab.tsx — metas por credor com filtro
- src/components/dashboard/MiniRanking.tsx — mini ranking no Dashboard (top 5)

Serviços e hooks:
- src/services/gamificationService.ts — lógica de pontos, conquistas e ranking
- src/services/campaignService.ts — campanhas com campaign_credores e campaign_participants
- src/services/achievementTemplateService.ts — CRUD de templates de conquistas editáveis
- src/services/goalService.ts — metas com suporte a credor_id
- src/hooks/useGamification.ts — hook para verificar e conceder conquistas automaticamente

Tabelas no banco:
- operator_points — pontos mensais por operador
- achievements — conquistas concedidas
- achievement_templates — templates editáveis por tenant/credor
- gamification_campaigns — campanhas de gamificação
- campaign_credores — relação N:N campanha <-> credor
- campaign_participants — participantes com source_type (individual/equipe) e source_id
- operator_goals — metas com credor_id opcional`,
  },

  {
    id: "campanha-operador",
    title: "Seleção de Campanha pelo Operador",
    description: "Operador seleciona e entra em campanhas 3CPlus diretamente pela interface. Inclui login/logout com resolução de token individual via Edge Function proxy.",
    status: "done",
    progress: 100,
    category: "Contact Center",
    lovablePrompt: `O fluxo de seleção de campanha pelo operador está 100% implementado e funcional. Arquivos-chave:
- src/components/contact-center/threecplus/TelefoniaDashboard.tsx — seção isOperatorView com Select de campanhas, botão "Entrar na Campanha" e card de status online.
- supabase/functions/threecplus-proxy/index.ts — actions: login_agent_to_campaign, logout_agent_self, agent_available_campaigns.

Fluxo: operador offline vê dropdown de campanhas ativas → seleciona → chama login_agent_to_campaign (resolve token via GET /users) → POST /agent/login com campaign_id. Sair chama logout_agent_self → POST /agent/logout.`,
  },
  {
    id: "sla-whatsapp",
    title: "SLA de Atendimento WhatsApp",
    description: "Sistema completo de SLA: campo por credor, cálculo automático no webhook, notificação por edge function e indicadores visuais na lista de conversas.",
    status: "done",
    progress: 100,
    category: "Contact Center",
    lovablePrompt: `O módulo de SLA de Atendimento WhatsApp está 100% implementado. Componentes:
- src/components/cadastros/CredorForm.tsx — campo "Prazo SLA de Atendimento (horas)" na aba Negociação, salvo em credores.sla_hours.
- supabase/functions/whatsapp-webhook/index.ts — helper getSlaMinutes() prioriza sla_hours do credor (via JOIN clients→credores), fallback para tenant settings. Calcula sla_deadline_at em cada mensagem inbound.
- supabase/functions/check-sla-expiry/index.ts — edge function que monitora conversas com SLA expirado e envia notificações internas para operadores.
- src/components/contact-center/whatsapp/ConversationList.tsx — ícone AlertTriangle (vermelho) para SLA expirado e Clock (amarelo) quando <25% do tempo restante, com tooltips mostrando data/hora.
- src/components/contact-center/whatsapp/ChatPanel.tsx — badge "SLA Expirado" no cabeçalho do chat.`,
  },
  {
    id: "admin-panel",
    title: "Painel de Configurações Unificado",
    description: "Sub-navegação lateral com grupos categorizados (Cadastros, Pessoas, Sistema), separadores visuais, badges de contagem, busca rápida e animação no item ativo.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: `O Painel de Configurações está 100% implementado em src/pages/CadastrosPage.tsx. Inclui:
- Grupos de navegação: "Cadastros" (Credores, Equipes, Perfil do Devedor, Tipo de Dívida, Tipo de Status), "Pessoas" (Usuários), "Sistema" (Integração, Config. Empresa, Super Admin, Roadmap).
- Separadores visuais (Separator) entre grupos com rótulo em caps lock.
- Badges de contagem dinâmica via useQuery (número de credores, equipes e usuários ativos).
- Busca rápida (Input com ícone Search) que filtra itens em tempo real.
- Item ativo com borda lateral esquerda colorida (border-primary) e fundo primary/10.`,
  },

  // DONE — funcionalidades implementadas
  {
    id: "custom-fields",
    title: "Campos Personalizados",
    description: "CRUD de campos extras por tenant para armazenar informações adicionais dos clientes, integrado ao mapeamento de importação.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Campos Personalizados implementados em src/components/cadastros/CustomFieldsConfig.tsx e src/services/customFieldsService.ts. Tabela custom_fields no banco.",
  },
  {
    id: "field-mapping",
    title: "Mapeamento de Campos de Importação",
    description: "Mapeamento configurável de colunas de planilha para campos do sistema por credor, com suporte a campos personalizados.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Mapeamento implementado em src/components/cadastros/FieldMappingConfig.tsx e src/services/fieldMappingService.ts. Tabela field_mappings.",
  },
  {
    id: "commission-grades",
    title: "Grade de Comissão",
    description: "Tabela de faixas de comissão por volume de recuperação, configurável por tenant.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Grade de Comissão implementada em src/components/cadastros/CommissionGradesTab.tsx e src/lib/commission.ts. Tabela commission_grades.",
  },
  {
    id: "user-permissions",
    title: "Permissões por Usuário",
    description: "Controle granular de permissões por módulo para cada usuário do tenant.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Permissões implementadas em src/components/cadastros/UserPermissionsTab.tsx e src/hooks/usePermissions.ts.",
  },
  {
    id: "prestacao-contas",
    title: "Prestação de Contas",
    description: "Relatório detalhado de prestação de contas com dados de acordos, pagamentos e comissões.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Prestação de Contas implementada em src/components/relatorios/PrestacaoContas.tsx dentro da página de Relatórios.",
  },
  {
    id: "wuzapi-integration",
    title: "Integração WuzAPI",
    description: "Gerenciamento de instâncias WhatsApp via WuzAPI com suporte a QR Code e webhooks.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "WuzAPI implementado em src/components/integracao/WuzApiInstancesList.tsx, src/services/wuzapiService.ts e supabase/functions/wuzapi-proxy/.",
  },
  {
    id: "gupshup-integration",
    title: "Integração Gupshup WhatsApp",
    description: "Recepção de mensagens WhatsApp via Gupshup com webhook e configuração de templates.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "Gupshup implementado em src/components/automacao/GupshupSettings.tsx e supabase/functions/gupshup-webhook/.",
  },
  {
    id: "maxlist-maxsystem",
    title: "MaxList / MaxSystem",
    description: "Importação de clientes via MaxList com mapeamento inteligente e sincronização com MaxSystem.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "MaxList implementado em src/pages/MaxListPage.tsx com componentes em src/components/maxlist/. Proxy em supabase/functions/maxsystem-proxy/.",
  },
  {
    id: "automacao-pos-tabulacao",
    title: "Automação Pós-Tabulação",
    description: "Ações automáticas executadas após tabulação de chamada: envio de WhatsApp, atualização de status, notificação.",
    status: "done",
    progress: 100,
    category: "Automação",
    lovablePrompt: "Automação Pós-Tabulação implementada em src/components/automacao/DispositionAutomationsTab.tsx e src/services/dispositionAutomationService.ts.",
  },
  {
    id: "api-rest-publica",
    title: "API REST Pública",
    description: "API REST para integração externa com autenticação via API Key, documentação interativa e endpoints de clientes.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "API REST implementada em supabase/functions/clients-api/ com autenticação via api_keys. Docs em src/pages/ApiDocsPage.tsx e ApiDocsPublicPage.tsx.",
  },
  {
    id: "callbacks-agendados",
    title: "Callbacks Agendados",
    description: "Agendamento de retorno de ligação com notificação automática e listagem por operador.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Callbacks implementados em src/hooks/useScheduledCallbacks.ts e src/components/dashboard/ScheduledCallbacksDialog.tsx. Dados em call_dispositions.scheduled_callback.",
  },
  {
    id: "propensao-pagamento",
    title: "Propensão de Pagamento (IA)",
    description: "Score de propensão calculado via edge function com base no perfil do devedor, exibido como badge na carteira.",
    status: "done",
    progress: 100,
    category: "IA",
    lovablePrompt: "Propensão implementada em supabase/functions/calculate-propensity/ e src/components/carteira/PropensityBadge.tsx. Score salvo em clients.propensity_score.",
  },

  {
    id: "whatsapp-fase1",
    title: "WhatsApp Fase 1 — Disparo Não Oficial",
    description: "Disparo em massa da carteira com múltiplas instâncias não oficiais, campanhas persistidas, deduplicação por CPF/telefone, round-robin, templates dedicados e logs por recipient.",
    status: "done",
    progress: 100,
    category: "Contact Center",
    lovablePrompt: "WhatsApp Fase 1 implementado: WhatsAppBulkDialog com round-robin multi-instância, whatsapp_campaigns e whatsapp_campaign_recipients no banco, deduplicação por CPF na CarteiraPage, send-bulk-whatsapp edge function.",
  },
  {
    id: "whatsapp-templates",
    title: "Gestão de Templates WhatsApp",
    description: "Tabela dedicada de templates com categorias (cobrança, lembrete, acordo, geral), variáveis dinâmicas, preview e integração com disparo em massa.",
    status: "done",
    progress: 100,
    category: "Automação",
    lovablePrompt: "Templates WhatsApp implementados em src/components/automacao/WhatsAppTemplatesTab.tsx e src/services/whatsappTemplateService.ts. Tabela whatsapp_templates no banco.",
  },
  {
    id: "whatsapp-instance-category",
    title: "Instâncias WhatsApp — Oficial/Não Oficial",
    description: "Seletor de categoria (oficial Meta / não oficial) na criação de instâncias, flags de capacidade e vinculação à régua de cobrança.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "Seletor de provider_category (official/unofficial) adicionado em BaylersInstanceForm e WuzApiInstanceForm. Colunas provider_category, supports_manual_bulk, supports_campaign, supports_regua na tabela whatsapp_instances.",
  },
  {
    id: "regua-instance-link",
    title: "Vinculação de Instância à Régua",
    description: "Seletor de instância WhatsApp no formulário da régua de cobrança, com badge visual na timeline.",
    status: "done",
    progress: 100,
    category: "Automação",
    lovablePrompt: "Seletor de instância implementado em CredorReguaTab.tsx via coluna instance_id na tabela collection_rules. Badge com nome da instância exibido na timeline da régua.",
  },

  // IN PROGRESS
  {
    id: "serasa",
    title: "Negativação Serasa & CENPROT",
    description: "Negativação Serasa e protesto via CENPROT operacionais, com envio, cancelamento e remoção automática por triggers.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "Negativação Serasa + Protesto CENPROT implementados. Componentes em src/components/integracao/serasa/ e protesto/. Serviços: src/services/serasaService.ts e protestoService.ts. Edge functions de proxy ativas. Auto-remoção via triggers ao quitar.",
  },
  {
    id: "export-relatorios",
    title: "Relatórios Exportáveis (PDF + Excel)",
    description: "Exportação Excel já presente em vários módulos (xlsx). Falta padronização de PDF para todos os relatórios.",
    status: "in_progress",
    progress: 40,
    category: "Core",
    lovablePrompt: "Excel via xlsx já implementado em Carteira, Acordos e Relatórios. Falta padronizar exportação PDF (avaliar @react-pdf/renderer ou window.print + CSS print) para Aging, Ranking e Prestação de Contas.",
  },
  {
    id: "mobile",
    title: "App Mobile (PWA)",
    description: "Versão mobile-first com PWA para operadores acessarem pelo celular.",
    status: "planned",
    progress: 0,
    category: "Core",
    lovablePrompt: `Transformar o sistema em um Progressive Web App (PWA) instalável no celular.

Passos para implementar:
1. Criar public/manifest.json com nome, ícones e cores do app
2. Registrar um Service Worker em src/sw.ts para cache offline
3. Adicionar meta tags de viewport e theme-color no index.html
4. Otimizar as páginas mais usadas por operadores para mobile:
   - CarteiraPage (Kanban responsivo)
   - Contact Center WhatsApp (chat responsivo)
   - Formulário de acordo
5. Usar o hook use-mobile.tsx existente para adaptar layouts

Considerar: telas de 390px (iPhone) como resolução base.`,
  },
  {
    id: "gateway",
    title: "Gateway de Pagamento Nativo",
    description: "Integração direta com Stripe ou Pagar.me para checkout sem depender da Negociarie.",
    status: "planned",
    progress: 5,
    category: "Integrações",
    lovablePrompt: `Implementar integração nativa com gateway de pagamento (Stripe ou Pagar.me) como alternativa à Negociarie.

Para Stripe:
1. Usar o conector Stripe já disponível no Lovable
2. Criar edge function supabase/functions/stripe-checkout/ para gerar sessões de pagamento
3. Criar edge function supabase/functions/stripe-webhook/ para receber confirmações
4. Integrar no Portal do Devedor (src/components/portal/PortalCheckout.tsx) como opção de pagamento
5. Salvar dados de pagamento na tabela portal_payments

Para Pagar.me:
1. Adicionar secrets PAGARME_API_KEY no vault
2. Criar edge function proxy similar ao negociarie-proxy
3. Suportar PIX, boleto e cartão de crédito`,
  },
  {
    id: "discador-avancado",
    title: "Scripts de Abordagem Dinâmicos — Discador 3CPlus",
    description: "Scripts personalizados por credor e perfil do devedor com variáveis dinâmicas, exibidos em painel lateral para o operador durante a ligação.",
    status: "done",
    progress: 100,
    category: "Contact Center",
    lovablePrompt: `Os Scripts de Abordagem Dinâmicos estão implementados e integrados ao discador 3CPlus.

Banco de dados:
- Tabela scripts_abordagem: credor_id, tipo_devedor_id, canal, titulo, conteudo, is_active, tenant_id
- RLS completo: admins gerenciam, usuários do tenant visualizam.

Frontend — Gestão (admin):
- src/components/cadastros/CredorScriptsTab.tsx — CRUD de scripts dentro do CredorForm
- Nova aba "Scripts" no CredorForm (src/components/cadastros/CredorForm.tsx)
- Suporte a seleção de canal (telefone, whatsapp, geral) e perfil do devedor
- Inserção de variáveis dinâmicas: {{nome}}, {{valor}}, {{credor}}, {{vencimento}}, {{parcelas}}, {{operador}}

Frontend — Uso em tempo real (operador):
- src/components/contact-center/threecplus/ScriptPanel.tsx — painel colapsável exibido na view do operador
- Busca o script mais adequado por prioridade: credor+tipo_devedor > credor > tipo_devedor > global
- Resolve variáveis automaticamente com dados do cliente identificado pelo telefone em ligação
- Botão "Copiar Script" para facilitar uso

Serviço:
- src/services/scriptAbordagemService.ts — fetchScriptsByCredor, fetchScriptForClient, resolveScriptVariables, CRUD completo`,
  },
  {
    id: "dashboard-executivo",
    title: "Dashboard Executivo Multi-Tenant",
    description: "Visão consolidada para o Super Admin com gráficos por empresa: clientes, valor recuperado, taxa de acordos, usuários ativos e crescimento mês a mês.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: `O Dashboard Executivo está implementado em src/pages/AdminDashboardPage.tsx e acessível como a primeira aba ("Dashboard Executivo") dentro do Painel Super Admin em /admin/tenants.

Métricas implementadas:
1. KPIs globais: total de clientes, valor total recuperado, taxa de acordos (%), usuários ativos
2. Gráfico de linha: crescimento mês a mês (acordos + valor recuperado, últimos 6 meses) com Recharts
3. Gráfico de barras: clientes por empresa (top 10)
4. Gráfico de barras: valor recuperado por empresa (top 10)
5. Tabela: taxa de acordos (negociados/fechados/%) com badge de performance por empresa
6. Tabela: usuários + clientes por empresa com status (ativa/suspensa)

Integração:
- Embutido via lazy import em src/pages/SuperAdminPage.tsx como <TabsContent value="executivo">
- Link na sidebar (AppLayout): "Painel Super Admin" → /admin/tenants, visível apenas para isSuperAdmin
- RLS: super admin já tem acesso irrestrito via is_super_admin() function em todas as tabelas.`,
  },
  {
    id: "super-admin-area",
    title: "Área Super Admin Isolada",
    description: "Layout completamente separado para gestão do SaaS: sidebar própria com tema escuro, dashboard de gestão, suporte, gestão de equipes, financeiro (MRR/ARR/churn), gestão de inquilinos, treinamentos e reuniões, configurações do sistema e relatórios.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: `A Área Super Admin Isolada está implementada com layout independente e acesso exclusivo para super admins.

Layout:
- src/components/SuperAdminLayout.tsx — layout com sidebar escura (bg-[hsl(222,47%,11%)]) e tema âmbar, completamente separado do AppLayout
- Guard de acesso: redireciona para / se !isSuperAdmin
- Sidebar com 8 módulos: Dashboard, Suporte, Equipes, Financeiro, Inquilinos, Treinamentos, Configurações, Relatórios
- Link "Voltar ao Sistema" para retornar à interface de tenant

Rotas (em src/App.tsx):
- /admin → AdminDashboardPage (dashboard executivo com KPIs globais)
- /admin/suporte → SupportAdminPage (tickets e atendimentos)
- /admin/tenants → SuperAdminPage (gestão de inquilinos)
- /admin/equipes → AdminEquipesPage (colaboradores, cargos e permissões)
- /admin/financeiro → AdminFinanceiroPage (MRR, ARR, churn, faturamento por tenant)
- /admin/treinamentos → AdminTreinamentosPage (agenda de reuniões, onboarding)
- /admin/configuracoes → AdminConfiguracoesPage (segurança, notificações, sistema)
- /admin/relatorios → AdminRelatoriosPage (crescimento, saúde do sistema)

Páginas:
- src/pages/admin/AdminEquipesPage.tsx — gestão de equipes internas com cargos e permissões por cargo
- src/pages/admin/AdminFinanceiroPage.tsx — métricas financeiras reais (MRR/ARR calculados dos planos dos tenants)
- src/pages/admin/AdminTreinamentosPage.tsx — agenda de reuniões e treinamentos
- src/pages/admin/AdminConfiguracoesPage.tsx — configurações globais com switches
- src/pages/admin/AdminRelatoriosPage.tsx — relatórios com gráfico de crescimento de inquilinos

Sidebar do tenant (AppLayout.tsx) simplificada: link único "Área Admin" para /admin em vez dos dois links anteriores.`,
  },

  {
    id: "resend-email",
    title: "Infraestrutura de E-mail — Resend",
    description: "Domínio rivoconnect.com.br validado no Resend. Edge functions de e-mail transacional e relatório de quitados operacionais.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "Resend ativo com domínio validado. Edge functions: send-quitados-report (CSV de quitados) e demais e-mails transacionais. Secret RESEND_API_KEY configurada. Fluxos disparam a partir da Carteira e outros módulos.",
  },

  // FUTURE
  {
    id: "ia-acordo",
    title: "IA para Proposta de Acordo",
    description: "IA generativa que analisa o histórico do devedor e propõe condições personalizadas de acordo.",
    status: "future",
    progress: 0,
    category: "IA",
    lovablePrompt: `Implementar IA generativa para sugerir propostas de acordo personalizadas.

Conceito:
1. Analisar histórico do cliente (valor da dívida, tempo em aberto, tentativas anteriores)
2. Considerar perfil do devedor (tipo_devedor, score de propensão)
3. Consultar regras do credor (desconto máximo, parcelas mín/máx, entrada mínima)
4. Gerar 3 opções de acordo: conservadora, equilibrada e agressiva

Implementação:
- Usar Lovable AI (google/gemini-2.5-flash) sem precisar de API key externa
- Criar edge function supabase/functions/ai-agreement-suggestion/
- Integrar no AgreementCalculator (src/components/client-detail/AgreementCalculator.tsx)
- Exibir sugestões como cards clicáveis que preenchem o formulário automaticamente`,
  },
  {
    id: "ocr",
    title: "OCR de Documentos de Dívida",
    description: "Extração automática de dados de contratos e boletos via OCR com IA.",
    status: "future",
    progress: 0,
    category: "IA",
    lovablePrompt: `Implementar OCR para extrair dados de documentos de dívida automaticamente.

Funcionalidade:
1. Upload de contrato, boleto ou extrato na ficha do cliente
2. Processar imagem/PDF com IA (google/gemini-2.5-pro suporta análise de imagens)
3. Extrair: CPF, nome, valor, data de vencimento, credor
4. Preencher automaticamente os campos do formulário de cadastro do cliente

Implementação:
- Criar edge function supabase/functions/ocr-document/
- Usar Lovable AI (gemini-2.5-pro) para análise de imagem — sem API key necessária
- Integrar no ImportDialog (src/components/clients/ImportDialog.tsx) como opção de importação
- Salvar documento em storage e associar ao cliente`,
  },
  {
    id: "score-credito",
    title: "Score de Crédito Integrado",
    description: "Consulta de score Serasa/Boa Vista no momento da negociação para personalizar proposta.",
    status: "future",
    progress: 0,
    category: "Integrações",
    lovablePrompt: `Integrar consulta de score de crédito (Serasa Experian ou Boa Vista) na ficha do cliente.

Funcionalidade:
1. Botão "Consultar Score" na ficha do cliente (ClientDetailPage)
2. Exibir score (0-1000), classificação (ótimo/bom/regular/ruim) e histórico de pagamentos
3. Usar score como um dos fatores no cálculo de propensão de pagamento
4. Registrar consulta em audit_logs

Implementação:
- Criar edge function supabase/functions/credit-score-proxy/
- API Serasa Experian: necessita credenciais corporativas (adicionar como secrets)
- Alternativa gratuita para teste: SPC Brasil
- Mostrar dados em painel lateral no ClientDetailPage`,
  },
  {
    id: "erp",
    title: "Integração com ERP (SAP/Totvs)",
    description: "Sincronização bidirecional de dívidas e acordos com sistemas ERP corporativos.",
    status: "future",
    progress: 0,
    category: "Integrações",
    lovablePrompt: `Implementar integração com sistemas ERP para importação/exportação automática de dados.

Para SAP:
1. Usar SAP Business API (ODATA) para consultar clientes e dívidas
2. Edge function: supabase/functions/sap-proxy/
3. Sincronizar acordos fechados de volta para o SAP

Para Totvs Protheus:
1. Usar a API REST do Protheus
2. Edge function: supabase/functions/totvs-proxy/
3. Importar clientes e dívidas via job agendado

Configuração:
- Adicionar secrets: SAP_API_URL, SAP_API_KEY, TOTVS_API_URL, TOTVS_TOKEN
- Painel de configuração na IntegracaoPage
- Log de sincronizações com sucesso/erro`,
  },
  {
    id: "mediacao",
    title: "Módulo de Mediação de Conflitos",
    description: "Integração com API judicial para mediação extrajudicial de conflitos.",
    status: "future",
    progress: 0,
    category: "Integrações",
    lovablePrompt: `Implementar módulo de mediação extrajudicial integrado ao sistema judicial.

Funcionalidades:
1. Criar processo de mediação vinculado a um cliente/dívida
2. Integrar com TJSP API (ou similar) para registro de acordos mediados
3. Geração de Termo de Mediação com validade jurídica
4. Assinatura digital das partes (usando o módulo de assinatura existente)

Implementação:
- Criar tabela mediations com campos: client_id, mediator_id, status, valor_acordo, data_audiencia
- Edge function supabase/functions/judicial-api-proxy/
- Workflow: Criação → Notificação das partes → Audiência → Acordo → Assinatura → Registro`,
  },
  {
    id: "whatsapp-meta",
    title: "WhatsApp — Provedor Oficial (Meta/Gupshup)",
    description: "Roteamento automático entre instâncias oficiais (Meta/Gupshup) e não-oficiais (Evolution/WuzAPI/Baylers) via provider_category. Templates aprovados e bulk routing operacionais.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "WhatsApp multi-provider implementado: provider_category (official_meta/official_gupshup/unofficial), instance-proxy unificado, templates por categoria, round-robin e bulk routing. Veja src/services/whatsappInstanceService.ts e supabase/functions/instance-proxy/.",
  },

  // ──────────────────────────────────────────────────
  // FASE 1 — O "Core" do Agente de IA Autônomo
  // ──────────────────────────────────────────────────
  {
    id: "politicas-desconto-dinamico",
    title: "Políticas de Desconto por Credor & Aprovação",
    description: "Tabela de descontos por aging configurável por credor + fluxo de aprovação para descontos acima do limite.",
    status: "done",
    progress: 100,
    category: "Acordos",
    lovablePrompt: "Políticas de desconto implementadas via aging por credor (CredorForm.tsx aba Acordos). Limites aplicados no AgreementCalculator com checklist de validação e fluxo de aprovação para descontos acima do permitido. Veja memória logic/agreements/billing-validation-flow.",
  },
  {
    id: "agente-ia-autonomo",
    title: "Agente IA Autônomo de Negociação",
    description: "LLM integrado via Edge Function que negocia em tempo real com contorno de objeções no contexto de cobrança.",
    status: "in_progress",
    progress: 40,
    category: "IA",
    lovablePrompt: `Evoluir o Agente IA do Contact Center para negociar de forma autônoma, aplicando políticas de desconto e contornando objeções.

O que já existe:
- src/components/contact-center/whatsapp/AIAgentTab.tsx — aba de configuração do agente
- src/components/contact-center/whatsapp/AISuggestion.tsx — sugestões IA no chat
- supabase/functions/chat-ai-suggest/index.ts — edge function de sugestão

O que implementar:
1. Evoluir supabase/functions/chat-ai-suggest/index.ts para modo AUTÔNOMO:
   - Receber: histórico da conversa, dados do cliente (dívida, credor, score), política de desconto vigente
   - Usar google/gemini-2.5-flash (sem API key externa)
   - System prompt especializado em cobrança: tom empático, contorno de objeções, LGPD compliance
   - Retornar: proposta de desconto, número de parcelas, argumento de negociação

2. Criar modo "Piloto Automático" no AIAgentTab:
   - Toggle "Agente Autônomo Ativo"
   - Quando ativo: a IA responde automaticamente sem intervenção humana
   - Quando inativo: apenas sugestões (comportamento atual)

3. Lógica de proposta:
   - 1ª mensagem: oferta com desconto mínimo da política
   - Objeção detectada → acionar até max_discount_percent
   - Aceite → gerar link de pagamento automaticamente (via negociarie-proxy existente)

4. Guardar log de cada decisão da IA na tabela message_logs (campo: rule_id = null, channel = 'ai_agent')

Tabelas: conversations, chat_messages, clients, agreements, discount_policies (nova), ai_agents`,
  },
  {
    id: "analise-sentimento-devedor",
    title: "Análise de Sentimento do Devedor",
    description: "IA classifica o tom emocional do devedor (agressivo, receptivo, neutro) e adapta a resposta automaticamente.",
    status: "future",
    progress: 0,
    category: "IA",
    lovablePrompt: `Implementar análise de sentimento nas conversas do Contact Center WhatsApp para adaptar a abordagem do agente IA.

Conceito:
- A cada mensagem recebida do devedor, classificar o sentimento: POSITIVO / NEUTRO / NEGATIVO / AGRESSIVO
- Usar essa classificação para: ajustar o tom da resposta IA e alertar o supervisor

Implementação:
1. Evoluir supabase/functions/chat-ai-suggest/ para incluir análise de sentimento:
   - Adicionar ao payload de resposta: { sentiment: 'positive'|'neutral'|'negative'|'aggressive', confidence: 0-1 }
   - Usar google/gemini-2.5-flash-lite (rápido e barato para esta tarefa simples)

2. Salvar sentimento em nova coluna chat_messages.sentiment (migração SQL)

3. Exibir no ChatPanel (src/components/contact-center/whatsapp/ChatPanel.tsx):
   - Ícone de sentimento ao lado de cada mensagem do devedor
   - 😊 Positivo | 😐 Neutro | 😠 Negativo | 🚨 Agressivo

4. Criar componente AISummaryPanel (já existe em src/components/contact-center/whatsapp/AISummaryPanel.tsx):
   - Histórico de sentimentos da conversa
   - Recomendação de abordagem: "Tom formal recomendado" ou "Ofereça mais desconto"

5. Notificar supervisor quando sentimento = AGRESSIVO (usar notificationService.ts)

Tabelas: chat_messages (nova coluna sentiment), conversations, profiles`,
  },

  // ──────────────────────────────────────────────────
  // FASE 2 — Módulo de Automação Visual (N8N Embutido)
  // ──────────────────────────────────────────────────
  {
    id: "construtor-visual-fluxos",
    title: "Construtor Visual de Fluxos (N8N Embutido)",
    description: "Interface drag-and-drop com reactflow para criar réguas de cobrança visuais sem código.",
    status: "done",
    progress: 100,
    category: "Automação",
    lovablePrompt: `Implementar um Construtor Visual de Fluxos de Cobrança usando reactflow, similar ao N8N, dentro do próprio sistema.

Instalar: bun add reactflow

Estrutura de dados — criar tabela workflow_flows:
- id, tenant_id, name, description, is_active
- nodes (JSON): array de nós do fluxo
- edges (JSON): array de conexões
- trigger_type: 'overdue' | 'agreement_broken' | 'first_contact'
- created_at, updated_at

Tipos de Nós a implementar:
GATILHOS (cor azul):
  - node_trigger_overdue: "Fatura Vencida há X dias"
  - node_trigger_broken: "Acordo Quebrado"
  - node_trigger_no_contact: "Sem Contato há X dias"

AÇÕES (cor verde):
  - node_action_whatsapp: "Enviar WhatsApp" (usa instância Evolution existente)
  - node_action_sms: "Enviar SMS" (via 3CPlus existente)
  - node_action_wait: "Aguardar X dias"
  - node_action_ai_negotiate: "Chamar Agente IA para Negociar"
  - node_action_update_status: "Atualizar Status do Cliente"

CONDIÇÕES (cor amarela):
  - node_condition_score: "Se propensity_score > X"
  - node_condition_value: "Se valor_dívida > R$ X"

Implementação:
1. Criar src/pages/WorkflowBuilderPage.tsx com canvas reactflow
2. Painel lateral de nós arrastáveis (sidebar)
3. Propriedades de cada nó ao clicar (form lateral)
4. Botão "Salvar Fluxo" → persiste no banco
5. Botão "Ativar/Desativar" → liga/desliga o motor de execução

Rota: /automacao/fluxos (dentro da AutomacaoPage existente como nova tab)`,
  },
  {
    id: "motor-execucao-fluxos",
    title: "Motor de Execução de Fluxos",
    description: "Engine em Edge Functions + CRON que executa os fluxos visuais de cobrança automaticamente.",
    status: "done",
    progress: 100,
    category: "Automação",
    lovablePrompt: `Implementar o Motor de Execução que roda os fluxos criados no Construtor Visual de Fluxos.

Arquitetura:
1. Edge Function supabase/functions/workflow-engine/index.ts:
   - Recebe: { workflow_id, client_id, trigger_type, trigger_data }
   - Carrega o JSON do fluxo (nodes + edges) do banco
   - Executa nó por nó em ordem topológica
   - Para cada nó de ação: chama o serviço correspondente (Evolution para WhatsApp, 3CPlus para SMS, etc.)
   - Para nó "Aguardar X dias": registra em tabela workflow_executions com next_run_at

2. CRON Job (supabase/config.toml) — rodar a cada hora:
   - Buscar workflow_executions onde next_run_at <= now() e status = 'waiting'
   - Retomar execução a partir do próximo nó
   - Chamar workflow-engine com o estado salvo

3. Tabela workflow_executions:
   - workflow_id, client_id, current_node_id, status ('running'|'waiting'|'done'|'error')
   - execution_log (JSON) — histórico de cada nó executado
   - next_run_at, started_at, completed_at

4. Gatilhos automáticos — edge functions existentes chamarão o motor:
   - auto-break-overdue → dispara trigger_type='agreement_broken'
   - Webhook de vencimento → dispara trigger_type='overdue'

5. Painel de monitoramento na AutomacaoPage: quantas execuções ativas, log de erros

Tabelas: workflow_flows (nova), workflow_executions (nova), clients, chat_messages, message_logs`,
  },

  // ──────────────────────────────────────────────────
  // FASE 3 — Ecossistema Multicanal & Grupos IA
  // ──────────────────────────────────────────────────
  {
    id: "grupos-whatsapp-mutirao",
    title: "Grupos de WhatsApp — Mutirão IA",
    description: "IA orquestra grupos de WhatsApp para mutirões de 'Limpa Nome', gerenciando múltiplos devedores simultaneamente.",
    status: "future",
    progress: 0,
    category: "Contact Center",
    lovablePrompt: `Implementar criação e gestão de Grupos de WhatsApp para Mutirões de Limpa Nome, orquestrados pela IA.

Conceito: Selecionar N devedores de uma carteira, criar um grupo WA, e a IA negocia com todos simultaneamente.

Pré-requisito: Instâncias WhatsApp via Evolution API (já existente em src/components/integracao/WhatsAppIntegrationTab.tsx)

Implementação:
1. Criar tabela mutirao_grupos:
   - id, tenant_id, instance_id, nome, grupo_id_evolution, status ('criando'|'ativo'|'encerrado')
   - data_inicio, data_fim, descricao_oferta, max_discount_percent

2. Criar tabela mutirao_participantes:
   - mutirao_id, client_id, phone, status_resposta ('sem_resposta'|'negociando'|'acordou'|'recusou')

3. UI — nova aba "Mutirão" na CarteiraPage:
   - Seleção múltipla de clientes na tabela (CarteiraTable.tsx — já suporta seleção)
   - Botão "Criar Mutirão" abre dialog com: nome do mutirão, oferta de desconto, data fim
   - Ao confirmar: chama edge function para criar grupo via Evolution API

4. Edge function supabase/functions/mutirao-manager/:
   - POST /create: cria grupo WA via evolution-proxy, adiciona participantes
   - POST /broadcast: envia mensagem inicial da IA para o grupo
   - Webhook de respostas: identifica cliente pela mensagem e atualiza status

5. Painel de acompanhamento: taxa de resposta, acordos fechados, encerrar mutirão

Tabelas: whatsapp_instances, clients, agreements, conversations`,
  },
  {
    id: "transicao-canal-inteligente",
    title: "Transição de Canal Inteligente",
    description: "Lógica automática: tenta WhatsApp → falha → SMS → falha → agenda Voice Bot, maximizando taxa de contato.",
    status: "future",
    progress: 0,
    category: "Automação",
    lovablePrompt: `Implementar a lógica de Transição de Canal Inteligente para maximizar a taxa de contato com devedores.

Fluxo: WhatsApp → (falha/sem resposta após Xh) → SMS → (falha após Yh) → Ligação 3CPlus

O que já existe para aproveitar:
- Evolution API: supabase/functions/evolution-proxy/ (WhatsApp)
- 3CPlus: supabase/functions/threecplus-proxy/ (SMS e Voice)
- Motor de Fluxos: workflow-engine (a ser criado na Fase 2)
- message_logs: tabela com histórico de tentativas por canal

Implementação como nó especial no Construtor de Fluxos:
1. Criar node_action_smart_channel no WorkflowBuilder:
   - Configura: tempo de espera por canal, número de tentativas por canal
   - Exemplo: "WhatsApp: 2 tentativas com 4h de intervalo → SMS: 1 vez → Ligação"

2. No workflow-engine, ao executar este nó:
   - Verificar message_logs para o client_id: qual foi o último canal e resultado
   - Se WhatsApp não entregue (status evolution = 'failed'): escalar para SMS
   - Se SMS falhou: criar tarefa de ligação no 3CPlus (endpoint agent_call da API 3CPlus)
   - Registrar cada tentativa em message_logs (canal, status, data)

3. Configuração global em TenantSettingsPage:
   - Tempos de espera padrão por canal
   - Habilitar/desabilitar canais disponíveis

Tabelas: message_logs, clients, whatsapp_instances, workflow_executions`,
  },

  // ──────────────────────────────────────────────────
  // FASE 4 — Smart Payments & Split Financeiro
  // ──────────────────────────────────────────────────
  {
    id: "pix-qrcode-dinamico",
    title: "Pix QR Code Dinâmico (nativo, sem gateway)",
    description: "Geração de Pix Copia e Cola/QR Code calculando juros e multa em tempo real direto na Edge Function, independente de Asaas/Negociarie.",
    status: "planned",
    progress: 20,
    category: "Integrações",
    lovablePrompt: "Atualmente Pix é gerado via Asaas e Negociarie. Falta criar edge function generate-pix nativa montando payload EMV (BACEN) com chave Pix do credor, com cálculo de juros/multa em tempo real para uso no Portal e NegotiationPanel.",
  },
  {
    id: "webhook-baixa-automatica",
    title: "Baixa Automática de Pagamentos",
    description: "Webhooks de Asaas e Negociarie + confirmação manual com aprovação realizam baixa automática de acordos, atualização de status e gamificação.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "Implementado via supabase/functions/negociarie-callback, asaas-webhook e fluxo manual-payment-confirmation. Atualiza agreements.status, clients.status, portal_payments, dispara notificação e gamificação. Veja memória logic/acordos/reconciliacao-pagamentos.",
  },

  // ──────────────────────────────────────────────────
  // FASE 4 (cont.) — Split de Pagamento
  // ──────────────────────────────────────────────────
  {
    id: "split-pagamento",
    title: "Split de Pagamento (Comissão + Credor)",
    description: "Sistema de split que separa automaticamente a comissão da assessoria e o valor líquido do credor.",
    status: "future",
    progress: 0,
    category: "Financeiro",
    lovablePrompt: `Implementar Sistema de Split de Pagamento para separar automaticamente comissão da assessoria e valor do credor.

Conceito:
- Quando um pagamento é confirmado, o valor total é dividido:
  * X% para o credor (valor líquido do crédito recuperado)
  * Y% para a assessoria (honorários de cobrança)
  * Z% para o operador (comissão individual — já existe commission_grades)

Implementação:
1. Adicionar campos na tabela credores (migração):
   - honorarios_percent (number) — % de honorários da assessoria
   - split_enabled (boolean)
   - split_account_id (chave da conta destino para transferência)

2. Criar tabela payment_splits:
   - payment_id (FK portal_payments), tenant_id
   - credor_amount, honorarios_amount, operator_commission
   - split_status ('pending'|'executed'|'failed')
   - executed_at

3. No Webhook de Baixa Automática (payment-webhook), após confirmar pagamento:
   - Calcular o split usando honorarios_percent do credor
   - Calcular comissão do operador com commission_grades existente (src/lib/commission.ts)
   - Inserir em payment_splits

4. Painel "Split Financeiro" na FinanceiroPage:
   - Listagem de splits pendentes e executados
   - Totais: quanto foi para credores vs honorários vs comissões
   - Gráfico de pizza com Recharts (já instalado)

Tabelas: portal_payments, agreements, credores, commission_grades, operator_points, profiles`,
  },

  // ──────────────────────────────────────────────────
  // FASE 5 — Inteligência Preditiva & Dashboards
  // ──────────────────────────────────────────────────
  {
    id: "dashboard-roi-ia-vs-humano",
    title: "Dashboard de ROI — IA vs Humano",
    description: "Painel comparando valor recuperado por IA autônoma vs operadores humanos, mostrando custo-benefício.",
    status: "future",
    progress: 0,
    category: "IA",
    lovablePrompt: `Implementar Dashboard de ROI comparando recuperação por Agente IA vs Operadores Humanos.

Métricas principais:
1. Valor total recuperado: IA vs Humano (gráfico de barras side-by-side)
2. Número de acordos: IA vs Humano
3. Ticket médio de acordo: IA vs Humano
4. Taxa de quebra de acordo: IA vs Humano
5. Custo por acordo (estimado): IA tem custo fixo de infra vs salário de operador
6. ROI do Agente IA: (valor_recuperado_ia - custo_ia) / custo_ia * 100

Como identificar acordos fechados pela IA:
- Acordos onde created_by = perfil do ai_agent (tabela ai_agents, campo profile_id)
- Ou agreements com portal_origin = true (auto-serviço)
- Campo sugerido: agreements.origin ('human'|'ai_agent'|'portal')
- Migração: ADD COLUMN origin TEXT DEFAULT 'human' em agreements

Implementação:
1. Criar src/components/dashboard/ROIDashboard.tsx com Recharts
2. Adicionar aba "ROI & IA" na AnalyticsPage (src/pages/AnalyticsPage.tsx)
3. Queries:
   - SELECT origin, COUNT(*), SUM(proposed_total) FROM agreements GROUP BY origin
   - JOIN com operator_points para cruzar com dados de gamificação
4. Filtros: por período (mês/trimestre/ano), por credor, por equipe

Tabelas: agreements (nova coluna origin), operator_points, ai_agents, clients`,
  },
  {
    id: "regua-inversa-lead-scoring",
    title: "Régua Inversa Preventiva & Lead Scoring Avançado",
    description: "Avisos preventivos antes do vencimento + modelo de propensão de pagamento para otimizar custo de disparo.",
    status: "future",
    progress: 0,
    category: "IA",
    lovablePrompt: `Implementar Régua Inversa Preventiva e Lead Scoring Avançado para otimizar a recuperação de crédito.

── RÉGUA INVERSA ──
Objetivo: Enviar mensagens ANTES do vencimento para prevenir inadimplência.

Implementação:
1. Adicionar nós de gatilho pré-vencimento no Construtor de Fluxos:
   - node_trigger_pre_overdue: "X dias ANTES do vencimento"
   - Exemplo: -7 dias → lembrete amigável, -3 dias → lembrete de urgência, -1 dia → último aviso

2. No CRON do workflow-engine: verificar clientes com data_vencimento entre hoje e hoje+X dias
3. Template de mensagem preventivo (diferente do tom de cobrança)
4. Registrar em message_logs com channel = 'preventive'

── LEAD SCORING AVANÇADO ──
Objetivo: Melhorar o campo propensity_score dos clientes com modelo ML mais preciso.

O que já existe:
- supabase/functions/calculate-propensity/ — calcula score básico
- clients.propensity_score — armazena o score

Evoluir o modelo de propensão em calculate-propensity/:
Variáveis a considerar:
- dias_atraso: quanto mais tempo, menor a propensão
- historico_pagamentos: quantas vezes pagou antes (positivo)
- acordos_quebrados: quantas quebras (negativo forte)
- valor_divida: valores menores têm maior propensão
- canal_resposta: se respondeu WhatsApp antes (positivo)
- tipo_devedor_id: usar como feature de segmentação

Usar google/gemini-2.5-flash para scoring quando dados insuficientes para regras.

Output:
1. Score 0-100 por cliente
2. Segmentos: QUENTE (>70) | MORNO (40-70) | FRIO (<40)
3. Badge visual na CarteiraTable e CarteiraKanban (PropensityBadge.tsx já existe)
4. Exportação priorizada: no DialerExportDialog, ordenar por score DESC

Tabelas: clients, agreements, call_dispositions, message_logs, campaign_participants`,
  },

  // ──────────────────────────────────────────────────
  // MÓDULOS PRODUTIVOS RECENTES (já em produção)
  // ──────────────────────────────────────────────────
  {
    id: "score-operacional-v1",
    title: "Score Operacional V1",
    description: "Motor heurístico de propensão (Contato 25%, Engajamento 20%, Conversão 35%, Credibilidade 20%) com decaimento por recência e pesos por fonte (operador/sistema/prevenção).",
    status: "done",
    progress: 100,
    category: "IA",
    lovablePrompt: "Score V1 implementado em supabase/functions/calculate-propensity. Recalculo automático via useScoreRecalc + 6 triggers de client_events. Score base 50 sem histórico. Badge visível em PropensityBadge.tsx.",
  },
  {
    id: "perfis-devedor",
    title: "Sistema de Perfis de Devedor (4 categorias)",
    description: "Perfis fixos com pesos no score: Ocasional (+20), Recorrente (+5), Resistente (-15) e Insatisfeito (-10), atribuídos pelo operador no atendimento.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Perfis de devedor em DebtorCategoryPanel.tsx + DebtorProfileBadge.tsx, com seletor por hover na conversa WhatsApp e no detalhe da Carteira. Persistido em client_profiles.",
  },
  {
    id: "client-events-timeline",
    title: "Timeline Omnichannel Unificada (client_events)",
    description: "client_events é a fonte única de verdade do histórico do cliente. Unifica WhatsApp, telefonia, eventos do portal e ações do operador via session_id.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Timeline unificada em ClientTimeline.tsx baseada em client_events com session_id. Substitui o histórico textual antigo. Todos os canais gravam eventos estruturados (observation_added, message_sent, call_finished etc.).",
  },
  {
    id: "hub-omnichannel",
    title: "Hub Omnichannel de Atendimento",
    description: "Página /atendimento unificada com WhatsApp, telefonia 3CPlus, lock de concorrência, disposições, anexos e timeline em tempo real.",
    status: "done",
    progress: 100,
    category: "Contact Center",
    lovablePrompt: "Implementado em src/pages/AtendimentoPage.tsx + useAtendimentoModal + atendimento_sessions (uma sessão por tenant/client/credor). Lock real via atendimento_locks com modo somente-leitura.",
  },
  {
    id: "anti-ban-backend",
    title: "Anti-Ban Backend Lock — Disparos em Lote",
    description: "Throttling de 8-15s entre mensagens e pausa automática de lote, com checkpoint, executado no servidor (não no cliente).",
    status: "done",
    progress: 100,
    category: "Contact Center",
    lovablePrompt: "Anti-Ban no backend (supabase/functions/whatsapp-bulk-sender e campaign-runner). Limites e pausas de lote definidos no servidor com checkpoint para retomada. Veja memória features/communication/bulk-campaign-resilience.",
  },
  {
    id: "campanhas-whatsapp",
    title: "Gestão de Campanhas WhatsApp",
    description: "Módulo dedicado para acompanhar disparos em lote, com origin_type, estados restritivos pelo Anti-Ban e métricas por campanha.",
    status: "done",
    progress: 100,
    category: "Contact Center",
    lovablePrompt: "Painel de campanhas em src/components/contact-center/whatsapp/CampaignsTab.tsx + whatsappCampaignService.ts + campaignManagementService.ts. Coluna origin_type diferencia campanhas de mensagens individuais.",
  },
  {
    id: "catalogo-servicos-tokens",
    title: "Catálogo de Serviços & Tokens (Faturamento SaaS)",
    description: "Provisionamento por catálogo de serviços e gestão de tokens com consumo atômico (FOR UPDATE) para faturar mensalidade e ações operacionais.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Catálogo em AdminServicosPage + serviceCatalogService.ts. Tokens em src/components/tokens/ + tokenService.ts. Consumo atômico via SQL FOR UPDATE. Veja memórias features/tenant-service-provisioning e features/tokens/architecture.",
  },
  {
    id: "onboarding-cnpj",
    title: "Onboarding Multi-Tenant com CNPJ + 50 tokens cortesia",
    description: "Fluxo de onboarding obriga CNPJ, cria o tenant via RPC onboard_tenant, vincula o usuário e concede 50 tokens de cortesia.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Implementado em src/pages/OnboardingPage.tsx + RPC onboard_tenant. Veja memória logic/tenant-provisioning-and-onboarding.",
  },
  {
    id: "asaas-gateway",
    title: "Gateway Asaas (Mensalidade + Tokens)",
    description: "Cobrança de mensalidades e pacotes de tokens via Asaas (Cartão, PIX e Boleto), com webhooks de baixa automática.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "Implementado via asaasService.ts + edge functions asaas-* + webhooks. Veja memória integrations/asaas/payment-gateway-architecture.",
  },
  {
    id: "gamificacao-v2",
    title: "Gamificação V2 — Snapshot RPC + Cron",
    description: "SSoT financeiro consolidado (Manual + Portal + Negociarie), RPC recalculate_my_full e cron tick a cada 30 min para manter ranking e conquistas atualizados.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Implementado via gamificationService.ts + edge function gamification-recalc-tick (cron 30min) + RPCs unificadas. Templates de conquistas semeados por tenant. Veja memória features/gamification/logic-and-persistence.",
  },
  {
    id: "api-publica-clientes",
    title: "API Pública REST de Clientes",
    description: "Endpoint /clients-api com autenticação X-API-Key (hash SHA-256) para CRUD de clientes, acordos, pagamentos e portal lookup.",
    status: "done",
    progress: 100,
    category: "Integrações",
    lovablePrompt: "API pública em supabase/functions/clients-api + apiKeyService.ts + ApiDocsPage.tsx. Autenticação por X-API-Key SHA-256. Veja memória integrations/api/rest-specification.",
  },
  {
    id: "transcricao-audio",
    title: "Transcrição Automática de Áudios (Gemini)",
    description: "Áudios inbound do WhatsApp são transcritos automaticamente via Gemini, sem bloquear a UI.",
    status: "done",
    progress: 100,
    category: "IA",
    lovablePrompt: "Implementado em supabase/functions/transcribe-audio (google/gemini-2.5-flash). Resultado salvo em chat_messages.metadata. Veja memória features/whatsapp/audio-transcription.",
  },
  {
    id: "documentos-3-niveis",
    title: "Documentos com Resolução em 3 Níveis",
    description: "Templates de Acordo, Recibo, Quitação, Descrição de Dívida e Notificação Extrajudicial resolvidos por hierarquia: Credor → Tenant → Padrão.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Implementado em src/pages/DocumentTemplatesPage.tsx + documentRenderer.ts + documentDataResolver.ts + documentPdfService.ts. Snapshots imutáveis para auditoria. Veja memória features/documentos/architecture-and-logic.",
  },
  {
    id: "reconciliacao-pagamentos",
    title: "Reconciliação Granular de Pagamentos",
    description: "RPC get_agreement_financials consolida Manual + Portal + Negociarie como Pagamento Real, alimentando dashboards, prestação de contas e gamificação.",
    status: "done",
    progress: 100,
    category: "Financeiro",
    lovablePrompt: "RPC get_agreement_financials + get_dashboard_vencimentos verificam manual_payments e portal_payments por parcela. Veja memória logic/acordos/reconciliacao-pagamentos.",
  },
  {
    id: "dashboard-rpc",
    title: "Dashboard via RPC SQL Agregada",
    description: "Métricas do dashboard calculadas no backend via get_dashboard_stats e get_dashboard_vencimentos, com priorização de custom_installment_values.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Implementado em hooks de dashboard + RPCs SQL agregadas para precisão e performance. Veja memórias tech/dashboard-aggregation-strategy e logic/dashboard/value-prioritization.",
  },

  // ── NOVOS ITENS ──
  {
    id: "landing-b2b",
    title: "Landing Page B2B (Hero de Conversão)",
    description: "Hero section otimizada para conversão B2B com técnica AIDA, métricas animadas, CTAs duplos e remoção de objeções.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "A Landing Page B2B está implementada em src/pages/LandingPage.tsx com Hero section focada em conversão, métricas animadas, CTAs para WhatsApp e teste grátis, e barra de remoção de objeções.",
  },
  {
    id: "suporte-inapp",
    title: "Módulo de Suporte In-App",
    description: "Botão flutuante, chat com tickets em tempo real, guias interativos passo-a-passo e agendamento de reunião.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "O Módulo de Suporte está implementado com SupportFloatingButton, SupportPanel (3 abas: Guias, Chat, Agendar), SupportAdminPage para super_admin. Tabelas: support_tickets, support_messages, support_schedule_requests com RLS e realtime.",
  },
  {
    id: "guias-interativos",
    title: "Guias Interativos Passo-a-Passo",
    description: "Tutoriais organizados por módulo do sistema com busca e navegação em accordion.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "Os Guias Interativos estão implementados em src/components/support/SupportGuidesTab.tsx com categorias: Dashboard, Carteira, Acordos, Contact Center, Automação, Cadastros e Portal.",
  },
  {
    id: "agendamento-suporte",
    title: "Agendamento de Reunião com Suporte",
    description: "Formulário para solicitar reunião com data/hora preferida, salvo no banco com notificação ao admin.",
    status: "done",
    progress: 100,
    category: "Core",
    lovablePrompt: "O Agendamento está implementado em src/components/support/SupportScheduleTab.tsx com formulário e tabela support_schedule_requests. Visível na aba 'Agendar' do painel de suporte.",
  },
];

const statusConfig: Record<Status, { label: string; emoji: string; color: string; badgeClass: string; progressClass: string }> = {
  done: {
    label: "Concluído",
    emoji: "✅",
    color: "text-green-600 dark:text-green-400",
    badgeClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
    progressClass: "[&>div]:bg-green-500",
  },
  in_progress: {
    label: "Em Andamento",
    emoji: "🔄",
    color: "text-amber-600 dark:text-amber-400",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    progressClass: "[&>div]:bg-amber-500",
  },
  planned: {
    label: "Planejado",
    emoji: "📋",
    color: "text-blue-600 dark:text-blue-400",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    progressClass: "[&>div]:bg-blue-500",
  },
  future: {
    label: "Futuro",
    emoji: "🔮",
    color: "text-purple-600 dark:text-purple-400",
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    progressClass: "[&>div]:bg-purple-500",
  },
};

const filterOptions: { label: string; value: Status | "all" }[] = [
  { label: "Todos", value: "all" },
  { label: "✅ Concluído", value: "done" },
  { label: "🔄 Em Andamento", value: "in_progress" },
  { label: "📋 Planejado", value: "planned" },
  { label: "🔮 Futuro", value: "future" },
];

function RoadmapCard({ item }: { item: RoadmapItem }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const cfg = statusConfig[item.status];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(item.lovablePrompt);
    setCopied(true);
    toast({ title: "Contexto copiado!", description: "Cole no Lovable para executar esta tarefa." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="group hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground text-sm">{item.title}</span>
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", cfg.badgeClass)}>
                  {cfg.emoji} {cfg.label}
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground shrink-0">
                  {item.category}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          </div>
          <span className={cn("text-sm font-bold tabular-nums shrink-0", item.status === 'done' ? "text-primary" : "text-foreground")}>
            {item.progress}%
          </span>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Progress value={item.progress} className={cn("h-1.5 flex-1", cfg.progressClass)} />
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="h-7 px-2.5 text-xs gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copiado!" : "Copiar contexto"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const RoadmapPage = () => {
  const [filter, setFilter] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");

  const overallProgress = Math.round(
    roadmapData.reduce((acc, item) => acc + item.progress, 0) / roadmapData.length
  );

  const filtered = roadmapData.filter(item => {
    const matchesFilter = filter === "all" || item.status === filter;
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const grouped: Record<Status, RoadmapItem[]> = {
    done: filtered.filter(i => i.status === "done"),
    in_progress: filtered.filter(i => i.status === "in_progress"),
    planned: filtered.filter(i => i.status === "planned"),
    future: filtered.filter(i => i.status === "future"),
  };

  const statusOrder: Status[] = ["done", "in_progress", "planned", "future"];
  const counts = { done: roadmapData.filter(i => i.status === "done").length, in_progress: roadmapData.filter(i => i.status === "in_progress").length, planned: roadmapData.filter(i => i.status === "planned").length, future: roadmapData.filter(i => i.status === "future").length };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roadmap do Produto</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão completa do progresso do sistema — {counts.done} módulos concluídos de {roadmapData.length} total.
          </p>
        </div>

        {/* Overall progress */}
        <div className="bg-card border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Progresso Geral do Sistema</span>
            <span className="text-lg font-bold text-primary">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-3 [&>div]:bg-primary" />
          <div className="flex gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block opacity-80" />{counts.done} concluídos</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary-foreground/60 inline-block" />{counts.in_progress} em andamento</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary-foreground/40 inline-block" />{counts.planned} planejados</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary-foreground/20 inline-block" />{counts.future} futuros</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 flex-wrap">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value as Status | "all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filter === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar módulo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-8">
        {statusOrder.map(status => {
          const items = grouped[status];
          if (items.length === 0) return null;
          const cfg = statusConfig[status];
          return (
            <div key={status} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className={cn("text-sm font-bold uppercase tracking-wider", cfg.color)}>
                  {cfg.emoji} {cfg.label}
                </h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {items.length} {items.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <div className="grid gap-2">
                {items.map(item => (
                  <RoadmapCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum item encontrado para "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoadmapPage;
