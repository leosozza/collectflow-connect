import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
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
import LandingPage from "./pages/LandingPage";
import SupportAdminPage from "./pages/SupportAdminPage";
import SuperAdminLayout from "./components/SuperAdminLayout";
import AdminEquipesPage from "./pages/admin/AdminEquipesPage";
import AdminFinanceiroPage from "./pages/admin/AdminFinanceiroPage";
import AdminTreinamentosPage from "./pages/admin/AdminTreinamentosPage";
import AdminConfiguracoesPage from "./pages/admin/AdminConfiguracoesPage";
import AdminRelatoriosPage from "./pages/admin/AdminRelatoriosPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";

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
            {/* Super Admin area with isolated layout */}
            <Route
              element={
                <ProtectedRoute requireTenant>
                  <SuperAdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/suporte" element={<SupportAdminPage />} />
              <Route path="/admin/tenants" element={<SuperAdminPage />} />
              <Route path="/admin/equipes" element={<AdminEquipesPage />} />
              <Route path="/admin/financeiro" element={<AdminFinanceiroPage />} />
              <Route path="/admin/treinamentos" element={<AdminTreinamentosPage />} />
              <Route path="/admin/configuracoes" element={<AdminConfiguracoesPage />} />
              <Route path="/admin/relatorios" element={<AdminRelatoriosPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
