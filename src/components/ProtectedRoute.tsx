import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireTenant?: boolean;
}

const ProtectedRoute = ({ children, requireTenant = false }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { tenant, tenantUser, loading: tenantLoading } = useTenant();
  const location = useLocation();

  if (authLoading || tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // User is on /onboarding but already has a tenant → redirect to dashboard
  if (location.pathname === "/onboarding" && tenant) {
    return <Navigate to="/" replace />;
  }

  // requireTenant routes: no tenant found → onboarding
  if (requireTenant && !tenant) {
    if (tenantUser) {
      // tenantUser resolved but tenant still loading — show spinner
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-muted-foreground">Carregando...</span>
          </div>
        </div>
      );
    }
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
