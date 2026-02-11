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
import CadastroPage from "./pages/CadastroPage";
import UsersPage from "./pages/UsersPage";
import IntegracaoPage from "./pages/IntegracaoPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import OnboardingPage from "./pages/OnboardingPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import TenantSettingsPage from "./pages/TenantSettingsPage";
import AutomacaoPage from "./pages/AutomacaoPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import AcordosPage from "./pages/AcordosPage";
import FinanceiroPage from "./pages/FinanceiroPage";
import PortalPage from "./pages/PortalPage";
import AuditoriaPage from "./pages/AuditoriaPage";
import NotFound from "./pages/NotFound";

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
              path="/financeiro"
              element={
                <ProtectedRoute requireTenant>
                  <AppLayout>
                    <FinanceiroPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="/portal/:tenantSlug" element={<PortalPage />} />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
