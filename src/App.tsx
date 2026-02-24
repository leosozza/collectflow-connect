import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenant";
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
import ApiDocsPage from "./pages/ApiDocsPage";
import ApiDocsPublicPage from "./pages/ApiDocsPublicPage";
import MaxListPage from "./pages/MaxListPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
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
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <Index />
                  </AppLayout>
                </ProtectedRoute>
              }
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
              path="/cadastros"
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
                    <ContactCenterPage channel="telefonia" />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/contact-center/whatsapp"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <ContactCenterPage channel="whatsapp" />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/integracao"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <IntegracaoPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tenants"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <SuperAdminPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tenant/configuracoes"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <TenantSettingsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/automacao"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <AutomacaoPage />
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
              path="/relatorios"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <RelatoriosPage />
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
            <Route path="/api-docs/public" element={<ApiDocsPublicPage />} />
            <Route path="/portal/:tenantSlug" element={<PortalPage />} />
            <Route path="/portal/:tenantSlug/checkout/:token" element={<PortalPage />} />
            <Route path="/portal/:tenantSlug/termo/:token" element={<PortalPage />} />
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
              path="/atendimento/:id"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <AtendimentoPage />
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
              path="/perfil/:userId"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <PerfilPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/roadmap"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <RoadmapPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/gamificacao"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <GamificacaoPage />
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
              path="/central-empresa"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <TenantSettingsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
