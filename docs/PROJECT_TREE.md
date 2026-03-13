# 🌳 RIVO Connect — Árvore do Projeto

> Estrutura completa de diretórios e arquivos do projeto.  
> Atualizado em: Março 2026

```text
rivoconnect/
├── .env                              # Variáveis de ambiente (auto-gerado)
├── .lovable/
│   └── plan.md                       # Plano de implementação atual
├── index.html                        # Entry point HTML
├── package.json                      # Dependências e scripts
├── vite.config.ts                    # Configuração do Vite
├── tailwind.config.ts                # Configuração do Tailwind CSS
├── tsconfig.json                     # Configuração TypeScript raiz
├── tsconfig.app.json                 # TypeScript — app
├── tsconfig.node.json                # TypeScript — node
├── vitest.config.ts                  # Configuração de testes
├── postcss.config.js                 # PostCSS
├── eslint.config.js                  # ESLint
├── components.json                   # Configuração shadcn/ui
│
├── docs/
│   ├── COMPLETE_STABILITY_AUDIT.md   # Auditoria de estabilidade
│   ├── maxsystem-integracao.md       # Documentação integração MaxSystem
│   ├── PROJECT_TREE.md               # Este arquivo
│   └── PROJECT_ARCHITECTURE.md       # Explicação da arquitetura
│
├── public/
│   ├── favicon.ico
│   ├── favicon.png
│   ├── placeholder.svg
│   ├── robots.txt
│   └── templates/
│       └── PLANILHA_MODELO.xlsx      # Template de importação
│
├── src/
│   ├── main.tsx                      # Bootstrap da aplicação
│   ├── App.tsx                       # Rotas e providers
│   ├── App.css                       # Estilos globais extras
│   ├── index.css                     # Design tokens e variáveis CSS
│   ├── vite-env.d.ts                 # Tipos do Vite
│   │
│   ├── assets/
│   │   ├── logo-cc.png               # Logo Contact Center
│   │   └── rivo_connect.png          # Logo RIVO Connect
│   │
│   ├── hooks/
│   │   ├── useAuth.tsx               # Autenticação (AuthProvider + useAuth)
│   │   ├── useTenant.tsx             # Multi-tenant (TenantProvider + useTenant)  ← NÃO listado no hooks/ mas existe
│   │   ├── usePermissions.ts         # Permissões por role
│   │   ├── useSAPermissions.ts       # Permissões Super Admin
│   │   ├── useActivityTracker.ts     # Rastreamento de atividade
│   │   ├── useFlowHistory.ts         # Histórico de workflow
│   │   ├── useGamification.ts        # Dados de gamificação
│   │   ├── useGamificationTrigger.ts # Triggers de gamificação
│   │   ├── useNotifications.ts       # Notificações
│   │   ├── useScheduledCallbacks.ts  # Callbacks agendados
│   │   ├── use-mobile.tsx            # Detecção mobile
│   │   └── use-toast.ts             # Toast notifications
│   │
│   ├── lib/
│   │   ├── utils.ts                  # Utilitários gerais (cn, etc.)
│   │   ├── formatters.ts             # Formatação de moeda, datas, CPF
│   │   ├── validations.ts            # Validações de formulário
│   │   ├── commission.ts             # Cálculo de comissões
│   │   ├── exportUtils.ts            # Exportação CSV/Excel
│   │   └── fetchWithTimeout.ts       # Fetch com timeout
│   │
│   ├── types/
│   │   └── tokens.ts                 # Tipos do sistema de tokens
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts             # Cliente Supabase (auto-gerado)
│   │       └── types.ts              # Tipos do banco (auto-gerado)
│   │
│   ├── services/
│   │   ├── achievementTemplateService.ts   # Templates de conquistas
│   │   ├── addressEnrichmentService.ts     # Enriquecimento de endereço
│   │   ├── agreementService.ts             # Acordos
│   │   ├── apiKeyService.ts                # Chaves de API
│   │   ├── asaasService.ts                 # Gateway Asaas
│   │   ├── auditService.ts                 # Logs de auditoria
│   │   ├── automacaoService.ts             # Réguas de cobrança
│   │   ├── cadastrosService.ts             # Cadastros gerais
│   │   ├── campaignService.ts              # Campanhas de gamificação
│   │   ├── clientService.ts                # CRUD de clientes/devedores
│   │   ├── cobcloudService.ts              # Integração CobCloud
│   │   ├── conversationService.ts          # Conversas WhatsApp
│   │   ├── crmService.ts                   # CRM — leads e oportunidades
│   │   ├── crmActivityService.ts           # CRM — atividades
│   │   ├── crmCustomFieldService.ts        # CRM — campos customizados
│   │   ├── customFieldsService.ts          # Campos customizados (clientes)
│   │   ├── dispositionAutomationService.ts # Automação de disposições
│   │   ├── dispositionService.ts           # Disposições de chamada
│   │   ├── fieldMappingService.ts          # Mapeamento de campos
│   │   ├── financeService.ts               # Financeiro
│   │   ├── gamificationService.ts          # Gamificação core
│   │   ├── goalService.ts                  # Metas
│   │   ├── importService.ts                # Importação de planilhas
│   │   ├── negociarieService.ts            # Integração Negociarie
│   │   ├── notificationService.ts          # Notificações
│   │   ├── protestoService.ts              # Protesto de títulos
│   │   ├── rankingConfigService.ts         # Configuração de ranking
│   │   ├── rivocoinService.ts              # RivoCoins (moeda virtual)
│   │   ├── saPermissionService.ts          # Permissões Super Admin
│   │   ├── scriptAbordagemService.ts       # Scripts de abordagem
│   │   ├── serasaService.ts                # Negativação Serasa
│   │   ├── serviceCatalogService.ts        # Catálogo de serviços
│   │   ├── shopService.ts                  # Loja de gamificação
│   │   ├── systemSettingsService.ts        # Configurações do sistema
│   │   ├── tenantService.ts                # Gestão de tenants
│   │   ├── tokenService.ts                 # Tokens de consumo
│   │   ├── whatsappInstanceService.ts      # Instâncias WhatsApp
│   │   ├── workflowService.ts              # Workflows visuais
│   │   └── wuzapiService.ts                # WuzAPI
│   │
│   ├── pages/
│   │   ├── Index.tsx                       # Dashboard principal
│   │   ├── AuthPage.tsx                    # Login / Cadastro
│   │   ├── ResetPasswordPage.tsx           # Redefinir senha
│   │   ├── LandingPage.tsx                 # Landing page pública
│   │   ├── OnboardingPage.tsx              # Onboarding de novo tenant
│   │   ├── DashboardPage.tsx               # (alias Dashboard)
│   │   ├── CarteiraPage.tsx                # Carteira de clientes
│   │   ├── ClientDetailPage.tsx            # Detalhe do cliente
│   │   ├── ClientsPage.tsx                 # Lista de clientes
│   │   ├── CadastroPage.tsx                # Cadastro simples
│   │   ├── CadastrosPage.tsx               # Cadastros gerais (credores, tipos)
│   │   ├── UsersPage.tsx                   # Gestão de usuários
│   │   ├── AcordosPage.tsx                 # Acordos
│   │   ├── AtendimentoPage.tsx             # Atendimento ao cliente
│   │   ├── ContactCenterPage.tsx           # Contact Center (telefonia + WhatsApp)
│   │   ├── AutomacaoPage.tsx               # Automação e workflows
│   │   ├── IntegracaoPage.tsx              # Integrações
│   │   ├── ConfiguracoesPage.tsx           # Configurações
│   │   ├── TenantSettingsPage.tsx          # Central da Empresa
│   │   ├── RelatoriosPage.tsx              # Relatórios
│   │   ├── AnalyticsPage.tsx               # Analytics avançado
│   │   ├── AuditoriaPage.tsx               # Auditoria
│   │   ├── FinanceiroPage.tsx              # Financeiro
│   │   ├── GamificacaoPage.tsx             # Gamificação
│   │   ├── PerfilPage.tsx                  # Perfil do usuário
│   │   ├── PortalPage.tsx                  # Portal do devedor
│   │   ├── SignsPage.tsx                   # Assinaturas
│   │   ├── MaxListPage.tsx                 # MaxList (importação em massa)
│   │   ├── ApiDocsPage.tsx                 # Documentação API (autenticada)
│   │   ├── ApiDocsPublicPage.tsx           # Documentação API (pública)
│   │   ├── RoadmapPage.tsx                 # Roadmap do produto
│   │   ├── SuperAdminPage.tsx              # Super Admin — Tenants
│   │   ├── AdminDashboardPage.tsx          # Super Admin — Dashboard
│   │   ├── SupportAdminPage.tsx            # Super Admin — Suporte
│   │   ├── NotFound.tsx                    # 404
│   │   │
│   │   └── admin/
│   │       ├── AdminUsuariosPage.tsx        # Admin — Usuários
│   │       ├── AdminUsuariosHubPage.tsx     # Admin — Hub de Usuários
│   │       ├── AdminEquipesPage.tsx         # Admin — Equipes
│   │       ├── AdminPermissoesPage.tsx      # Admin — Permissões
│   │       ├── AdminFinanceiroPage.tsx      # Admin — Financeiro
│   │       ├── AdminTreinamentosPage.tsx    # Admin — Treinamentos
│   │       ├── AdminConfiguracoesPage.tsx   # Admin — Configurações
│   │       ├── AdminServicosPage.tsx        # Admin — Serviços
│   │       │
│   │       └── comercial/
│   │           ├── CRMPipelinePage.tsx      # CRM — Pipeline Kanban
│   │           ├── CRMLeadsPage.tsx         # CRM — Leads
│   │           ├── CRMCompaniesPage.tsx     # CRM — Empresas
│   │           ├── CRMActivitiesPage.tsx    # CRM — Atividades
│   │           └── CRMReportsPage.tsx       # CRM — Relatórios
│   │
│   ├── components/
│   │   ├── AppLayout.tsx                   # Layout principal (sidebar + header)
│   │   ├── SuperAdminLayout.tsx            # Layout Super Admin
│   │   ├── ProtectedRoute.tsx              # Rota protegida
│   │   ├── NavLink.tsx                     # Link de navegação
│   │   ├── StatCard.tsx                    # Card de estatísticas
│   │   │
│   │   ├── ui/                             # shadcn/ui (40+ componentes)
│   │   │   ├── accordion.tsx
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── aspect-ratio.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── breadcrumb.tsx
│   │   │   ├── button.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── card.tsx
│   │   │   ├── carousel.tsx
│   │   │   ├── chart.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── command.tsx
│   │   │   ├── context-menu.tsx
│   │   │   ├── currency-input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── drawer.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── form.tsx
│   │   │   ├── glass-calendar.tsx
│   │   │   ├── hover-card.tsx
│   │   │   ├── input-otp.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── menubar.tsx
│   │   │   ├── multi-select.tsx
│   │   │   ├── navigation-menu.tsx
│   │   │   ├── pagination.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── radio-group.tsx
│   │   │   ├── resizable.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── sonner.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── toaster.tsx
│   │   │   ├── toggle-group.tsx
│   │   │   ├── toggle.tsx
│   │   │   ├── tooltip.tsx
│   │   │   └── use-toast.ts
│   │   │
│   │   ├── acordos/
│   │   │   ├── AgreementForm.tsx           # Formulário de acordo
│   │   │   └── AgreementsList.tsx          # Lista de acordos
│   │   │
│   │   ├── admin/
│   │   │   ├── GoLiveChecklist.tsx         # Checklist go-live
│   │   │   ├── TenantServicesTab.tsx       # Aba serviços do tenant
│   │   │   └── integrations/
│   │   │       ├── CobCloudTab.tsx
│   │   │       ├── IntegrationTestCard.tsx
│   │   │       ├── NegativacaoTab.tsx
│   │   │       ├── NegociarieTab.tsx
│   │   │       ├── TargetDataTab.tsx
│   │   │       ├── ThreeCPlusTab.tsx
│   │   │       └── WhatsAppAdminTab.tsx
│   │   │
│   │   ├── atendimento/
│   │   │   ├── ClientHeader.tsx
│   │   │   ├── ClientTimeline.tsx
│   │   │   ├── DispositionPanel.tsx
│   │   │   ├── NegotiationPanel.tsx
│   │   │   └── WhatsAppChat.tsx
│   │   │
│   │   ├── automacao/
│   │   │   ├── DispositionAutomationForm.tsx
│   │   │   ├── DispositionAutomationsTab.tsx
│   │   │   ├── GatilhosTab.tsx
│   │   │   ├── GupshupSettings.tsx
│   │   │   ├── MessageHistory.tsx
│   │   │   ├── RuleForm.tsx
│   │   │   ├── RulesList.tsx
│   │   │   └── workflow/
│   │   │       ├── FlowNodeTypes.ts
│   │   │       ├── FlowTemplates.ts
│   │   │       ├── FlowTemplatesDialog.tsx
│   │   │       ├── FlowTestSimulator.tsx
│   │   │       ├── WorkflowCanvas.tsx
│   │   │       ├── WorkflowListTab.tsx
│   │   │       ├── WorkflowNodeProperties.tsx
│   │   │       ├── WorkflowSidebar.tsx
│   │   │       └── nodes/
│   │   │           ├── ActionNode.tsx
│   │   │           ├── ConditionNode.tsx
│   │   │           ├── CustomFlowNode.tsx
│   │   │           └── TriggerNode.tsx
│   │   │
│   │   ├── cadastros/
│   │   │   ├── CommissionGradesTab.tsx
│   │   │   ├── CredorForm.tsx
│   │   │   ├── CredorList.tsx
│   │   │   ├── CredorReguaTab.tsx
│   │   │   ├── CredorScriptsTab.tsx
│   │   │   ├── CustomFieldsConfig.tsx
│   │   │   ├── EquipeList.tsx
│   │   │   ├── FieldMappingConfig.tsx
│   │   │   ├── InlineCustomFieldDialog.tsx
│   │   │   ├── TipoDevedorList.tsx
│   │   │   ├── TipoDividaList.tsx
│   │   │   ├── TipoStatusList.tsx
│   │   │   └── UserPermissionsTab.tsx
│   │   │
│   │   ├── carteira/
│   │   │   ├── AssignOperatorDialog.tsx
│   │   │   ├── CarteiraFilters.tsx
│   │   │   ├── CarteiraKanban.tsx
│   │   │   ├── CarteiraTable.tsx
│   │   │   ├── DialerExportDialog.tsx
│   │   │   ├── EnrichmentConfirmDialog.tsx
│   │   │   ├── PropensityBadge.tsx
│   │   │   └── WhatsAppBulkDialog.tsx
│   │   │
│   │   ├── client-detail/
│   │   │   ├── AgreementCalculator.tsx
│   │   │   ├── AgreementInstallments.tsx
│   │   │   ├── ClientDetailHeader.tsx
│   │   │   ├── ClientDocuments.tsx
│   │   │   ├── ClientSignature.tsx
│   │   │   └── ClientUpdateHistory.tsx
│   │   │
│   │   ├── clients/
│   │   │   ├── ClientAttachments.tsx
│   │   │   ├── ClientFilters.tsx
│   │   │   ├── ClientForm.tsx
│   │   │   ├── ClientTable.tsx
│   │   │   ├── ImportDialog.tsx
│   │   │   └── PaymentDialog.tsx
│   │   │
│   │   ├── comercial/
│   │   │   ├── LeadScoreBadge.tsx
│   │   │   └── OpportunityCard.tsx
│   │   │
│   │   ├── contact-center/
│   │   │   ├── TelefoniaTab.tsx
│   │   │   ├── WhatsAppTab.tsx
│   │   │   ├── threecplus/
│   │   │   │   ├── AgentDetailSheet.tsx
│   │   │   │   ├── AgentStatusTable.tsx
│   │   │   │   ├── AgentsReportPanel.tsx
│   │   │   │   ├── BlockListPanel.tsx
│   │   │   │   ├── CallHistoryPanel.tsx
│   │   │   │   ├── CallsChart.tsx
│   │   │   │   ├── CampaignOverview.tsx
│   │   │   │   ├── CampaignsPanel.tsx
│   │   │   │   ├── DialPad.tsx
│   │   │   │   ├── MailingPanel.tsx
│   │   │   │   ├── OfficeHoursPanel.tsx
│   │   │   │   ├── OperatorCallHistory.tsx
│   │   │   │   ├── QualificationsPanel.tsx
│   │   │   │   ├── ReceptiveQueuesPanel.tsx
│   │   │   │   ├── RoutesPanel.tsx
│   │   │   │   ├── SMSPanel.tsx
│   │   │   │   ├── SchedulesPanel.tsx
│   │   │   │   ├── ScriptPanel.tsx
│   │   │   │   ├── SpyButton.tsx
│   │   │   │   ├── TeamsPanel.tsx
│   │   │   │   ├── TelefoniaAtendimento.tsx
│   │   │   │   ├── TelefoniaDashboard.tsx
│   │   │   │   ├── ThreeCPlusPanel.tsx
│   │   │   │   ├── UsersPanel.tsx
│   │   │   │   └── WorkBreakIntervalsPanel.tsx
│   │   │   └── whatsapp/
│   │   │       ├── AIAgentTab.tsx
│   │   │       ├── AISuggestion.tsx
│   │   │       ├── AISummaryPanel.tsx
│   │   │       ├── AudioRecorder.tsx
│   │   │       ├── ChatInput.tsx
│   │   │       ├── ChatMessage.tsx
│   │   │       ├── ChatPanel.tsx
│   │   │       ├── ContactSidebar.tsx
│   │   │       ├── ConversationList.tsx
│   │   │       ├── EmojiPicker.tsx
│   │   │       ├── GlobalSearch.tsx
│   │   │       ├── QuickRepliesTab.tsx
│   │   │       ├── TagManager.tsx
│   │   │       ├── TagsManagementTab.tsx
│   │   │       └── WhatsAppChatLayout.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── GoalProgress.tsx
│   │   │   ├── KPICards.tsx
│   │   │   ├── MiniRanking.tsx
│   │   │   └── ScheduledCallbacksDialog.tsx
│   │   │
│   │   ├── financeiro/
│   │   │   ├── ExpenseForm.tsx
│   │   │   ├── ExpenseList.tsx
│   │   │   ├── PaymentCheckoutDialog.tsx
│   │   │   └── PaymentHistoryCard.tsx
│   │   │
│   │   ├── gamificacao/
│   │   │   ├── AchievementsManagementTab.tsx
│   │   │   ├── AchievementsTab.tsx
│   │   │   ├── CampaignCard.tsx
│   │   │   ├── CampaignForm.tsx
│   │   │   ├── CampaignsManagementTab.tsx
│   │   │   ├── CampaignsTab.tsx
│   │   │   ├── GoalsManagementTab.tsx
│   │   │   ├── GoalsTab.tsx
│   │   │   ├── PointsHistoryTab.tsx
│   │   │   ├── RankingManagementTab.tsx
│   │   │   ├── RankingTab.tsx
│   │   │   ├── ShopManagementTab.tsx
│   │   │   ├── ShopTab.tsx
│   │   │   └── WalletTab.tsx
│   │   │
│   │   ├── integracao/
│   │   │   ├── BaylersInstanceForm.tsx
│   │   │   ├── BaylersInstancesList.tsx
│   │   │   ├── CobCloudTab.tsx
│   │   │   ├── CobrancaForm.tsx
│   │   │   ├── CobrancasList.tsx
│   │   │   ├── NegociarieTab.tsx
│   │   │   ├── ProtestoTab.tsx
│   │   │   ├── SyncPanel.tsx
│   │   │   ├── ThreeCPlusTab.tsx
│   │   │   ├── WhatsAppIntegrationTab.tsx
│   │   │   ├── WuzApiInstanceForm.tsx
│   │   │   ├── WuzApiInstancesList.tsx
│   │   │   ├── cobcloud/
│   │   │   │   └── CobCloudPreviewCard.tsx
│   │   │   ├── protesto/
│   │   │   │   ├── ProtestoBatchDialog.tsx
│   │   │   │   ├── ProtestoConfigCard.tsx
│   │   │   │   ├── ProtestoLogsCard.tsx
│   │   │   │   ├── ProtestoTitleForm.tsx
│   │   │   │   └── ProtestoTitlesList.tsx
│   │   │   └── serasa/
│   │   │       ├── SerasaBatchDialog.tsx
│   │   │       ├── SerasaConfigCard.tsx
│   │   │       ├── SerasaLogsCard.tsx
│   │   │       ├── SerasaRecordForm.tsx
│   │   │       └── SerasaRecordsList.tsx
│   │   │
│   │   ├── maxlist/
│   │   │   ├── ImportResultDialog.tsx
│   │   │   ├── MaxListMappingDialog.tsx
│   │   │   └── MaxListSettingsDialog.tsx
│   │   │
│   │   ├── notifications/
│   │   │   ├── AgreementCelebration.tsx
│   │   │   ├── NotificationBell.tsx
│   │   │   └── NotificationList.tsx
│   │   │
│   │   ├── perfil/
│   │   │   ├── PersonalDataTab.tsx
│   │   │   ├── ProfileStatsCards.tsx
│   │   │   └── SecurityTab.tsx
│   │   │
│   │   ├── portal/
│   │   │   ├── PortalAgreementTerm.tsx
│   │   │   ├── PortalCheckout.tsx
│   │   │   ├── PortalDebtList.tsx
│   │   │   ├── PortalHero.tsx
│   │   │   ├── PortalLayout.tsx
│   │   │   ├── PortalNegotiation.tsx
│   │   │   └── signatures/
│   │   │       ├── FaceLandmarks.tsx
│   │   │       ├── SignatureClick.tsx
│   │   │       ├── SignatureDraw.tsx
│   │   │       ├── SignatureFacial.tsx
│   │   │       └── SignatureStep.tsx
│   │   │
│   │   ├── relatorios/
│   │   │   ├── AgingReport.tsx
│   │   │   ├── EvolutionChart.tsx
│   │   │   ├── OperatorRanking.tsx
│   │   │   ├── PrestacaoContas.tsx
│   │   │   └── ReportFilters.tsx
│   │   │
│   │   ├── services/
│   │   │   ├── ServiceCard.tsx
│   │   │   └── ServiceCatalogGrid.tsx
│   │   │
│   │   ├── support/
│   │   │   ├── SupportChatTab.tsx
│   │   │   ├── SupportFloatingButton.tsx
│   │   │   ├── SupportGuidesTab.tsx
│   │   │   └── SupportScheduleTab.tsx
│   │   │
│   │   └── tokens/
│   │       ├── TokenBalance.tsx
│   │       ├── TokenHistoryTable.tsx
│   │       ├── TokenPackageCard.tsx
│   │       └── TokenPurchaseDialog.tsx
│   │
│   └── test/
│       ├── example.test.ts
│       └── setup.ts
│
└── supabase/
    ├── config.toml                         # Configuração Supabase (auto-gerado)
    └── functions/
        ├── accept-invite/index.ts          # Aceitar convite de tenant
        ├── asaas-proxy/index.ts            # Proxy Asaas (pagamentos)
        ├── asaas-webhook/index.ts          # Webhook Asaas
        ├── auto-break-overdue/index.ts     # Quebra automática de vencidos
        ├── auto-expire-agreements/index.ts # Expirar acordos vencidos
        ├── auto-status-sync/index.ts       # Sincronizar status
        ├── calculate-propensity/index.ts   # Score de propensão
        ├── chat-ai-suggest/index.ts        # Sugestões IA no chat
        ├── check-sla-expiry/index.ts       # Verificar SLA
        ├── clients-api/index.ts            # API pública de clientes
        ├── cobcloud-proxy/index.ts         # Proxy CobCloud
        ├── consume-tokens/index.ts         # Consumo de tokens
        ├── create-user/index.ts            # Criar usuário
        ├── evolution-proxy/index.ts        # Proxy Evolution API
        ├── gupshup-webhook/index.ts        # Webhook Gupshup
        ├── maxsystem-proxy/index.ts        # Proxy MaxSystem
        ├── negociarie-callback/index.ts    # Callback Negociarie
        ├── negociarie-proxy/index.ts       # Proxy Negociarie
        ├── portal-checkout/index.ts        # Checkout do portal
        ├── portal-lookup/index.ts          # Busca portal do devedor
        ├── purchase-tokens/index.ts        # Compra de tokens
        ├── send-bulk-whatsapp/index.ts     # Envio em massa WhatsApp
        ├── send-notifications/index.ts     # Envio de notificações
        ├── send-quitados-report/index.ts   # Relatório de quitados
        ├── support-ai-chat/index.ts        # Chat IA de suporte
        ├── targetdata-enrich/index.ts      # Enriquecimento TargetData
        ├── targetdata-webhook/index.ts     # Webhook TargetData
        ├── threecplus-proxy/index.ts       # Proxy 3CPlus
        ├── whatsapp-webhook/index.ts       # Webhook WhatsApp
        ├── workflow-engine/index.ts        # Engine de workflows
        ├── workflow-resume/index.ts        # Retomar workflow
        ├── workflow-trigger-no-contact/index.ts   # Trigger sem contato
        ├── workflow-trigger-overdue/index.ts      # Trigger vencidos
        └── wuzapi-proxy/index.ts           # Proxy WuzAPI
```
