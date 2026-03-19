import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { TenantProvider, useTenant } from "@/hooks/useTenant";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import CarteiraPage from "./pages/CarteiraPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import CadastroPage from "./pages/CadastroPage";
import CadastrosPage from "./pages/CadastrosPage";
import UsersPage from "./pages/UsersPage";
import IntegracaoPage from "./pages/IntegracaoPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import TenantSettingsPage from "./pages/TenantSettingsPage";
import OnboardingPage from "./pages/OnboardingPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import SignsPage from "./pages/SignsPage";
import AutomacaoPage from "./pages/AutomacaoPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import AcordosPage from "./pages/AcordosPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import PortalPage from "./pages/PortalPage";
import AuditoriaPage from "./pages/AuditoriaPage";
import AtendimentoPage from "./pages/AtendimentoPage";
import ContactCenterPage from "./pages/ContactCenterPage";
import PerfilPage from "./pages/PerfilPage";
import RoadmapPage from "./pages/RoadmapPage";
import GamificacaoPage from "./pages/GamificacaoPage";
import NotFound from "./pages/NotFound";
import ModuleGuard from "./components/ModuleGuard";
import ApiDocsPage from "./pages/ApiDocsPage";
import ApiDocsPublicPage from "./pages/ApiDocsPublicPage";
import MaxListPage from "./pages/MaxListPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AdminUsuariosHubPage from "./pages/admin/AdminUsuariosHubPage";
import LandingPage from "./pages/LandingPage";
import SupportAdminPage from "./pages/SupportAdminPage";
import SuperAdminLayout from "./components/SuperAdminLayout";
import { AtendimentoModalProvider } from "./hooks/useAtendimentoModal";
import AdminFinanceiroPage from "./pages/admin/AdminFinanceiroPage";
import AdminTreinamentosPage from "./pages/admin/AdminTreinamentosPage";
import AdminConfiguracoesPage from "./pages/admin/AdminConfiguracoesPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminServicosPage from "./pages/admin/AdminServicosPage";
import CRMPipelinePage from "./pages/admin/comercial/CRMPipelinePage";
import CRMLeadsPage from "./pages/admin/comercial/CRMLeadsPage";
import CRMCompaniesPage from "./pages/admin/comercial/CRMCompaniesPage";
import CRMActivitiesPage from "./pages/admin/comercial/CRMActivitiesPage";
import CRMReportsPage from "./pages/admin/comercial/CRMReportsPage";
/* Conditional root: landing for visitors, dashboard for logged-in users */
const RootPage = () => {
  const { user, loading } = useAuth();
  const { isSuperAdmin, loading: tenantLoading } = useTenant();
  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }
  if (!user) return <LandingPage />;
  if (isSuperAdmin) return <Navigate to="/admin" replace />;
  return (
    <ProtectedRoute requireTenant>
      <AppLayout>
        <Index />
      </AppLayout>
    </ProtectedRoute>
  );
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
          <AtendimentoModalProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={<RootPage />}
            />
            <Route
              path="/carteira"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <CarteiraPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/carteira/:cpf"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <ClientDetailPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cadastro"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <CadastroPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cadastros/:tab?"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <CadastrosPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <UsersPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <ConfiguracoesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contact-center/telefonia"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <ModuleGuard module="telefonia">
                      <ContactCenterPage channel="telefonia" />
                    </ModuleGuard>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contact-center/whatsapp"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <ModuleGuard module="whatsapp">
                      <ContactCenterPage channel="whatsapp" />
                    </ModuleGuard>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/central-empresa"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <TenantSettingsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/integracao"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <ModuleGuard module="integracoes">
                      <IntegracaoPage />
                    </ModuleGuard>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/perfil"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <PerfilPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gamificacao"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <ModuleGuard module="gamificacao">
                      <GamificacaoPage />
                    </ModuleGuard>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/automacao"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <ModuleGuard module="automacao">
                      <AutomacaoPage />
                    </ModuleGuard>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/relatorios"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <ModuleGuard module="relatorios">
                      <RelatoriosPage />
                    </ModuleGuard>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/acordos"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <AcordosPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <AnalyticsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/auditoria"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <AuditoriaPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/atendimento/:clientId?"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <AtendimentoPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/signs"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <SignsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/maxlist"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <MaxListPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/api-docs"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <ApiDocsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/api-docs-public" element={<ApiDocsPublicPage />} />
            <Route path="/portal" element={<PortalPage />} />
            {/* Super Admin area with isolated layout */}
            <Route
              element={
                <ProtectedRoute>
                  <SuperAdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/suporte" element={<SupportAdminPage />} />
              <Route path="/admin/tenants" element={<SuperAdminPage />} />
              
              <Route path="/admin/financeiro" element={<AdminFinanceiroPage />} />
              <Route path="/admin/treinamentos" element={<AdminTreinamentosPage />} />
              <Route path="/admin/configuracoes" element={<AdminConfiguracoesPage />} />
              <Route path="/admin/roadmap" element={<RoadmapPage />} />
              <Route path="/admin/servicos" element={<AdminServicosPage />} />
              <Route path="/admin/perfil" element={<PerfilPage />} />
              <Route path="/admin/usuarios" element={<AdminUsuariosHubPage />} />
              <Route path="/admin/comercial/pipeline" element={<CRMPipelinePage />} />
              <Route path="/admin/comercial/leads" element={<CRMLeadsPage />} />
              <Route path="/admin/comercial/empresas" element={<CRMCompaniesPage />} />
              <Route path="/admin/comercial/atividades" element={<CRMActivitiesPage />} />
              <Route path="/admin/comercial/relatorios" element={<CRMReportsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AtendimentoModalProvider>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
