import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireTenant?: boolean;
}

const ProtectedRoute = ({ children, requireTenant = false }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { tenant, tenantUser, isSuperAdmin, loading: tenantLoading, refetch } = useTenant();
  const location = useLocation();
  const [processingInvite, setProcessingInvite] = useState(false);

  // Process pending invite token when user has no tenant
  useEffect(() => {
    if (!user || tenantLoading || tenant || tenantUser || processingInvite) return;

    const pendingToken = localStorage.getItem("pendingInviteToken");
    if (!pendingToken) return;

    setProcessingInvite(true);
    (async () => {
      try {
        await supabase.functions.invoke("accept-invite", {
          body: { token: pendingToken, user_id: user.id },
        });
        localStorage.removeItem("pendingInviteToken");
        await refetch();
      } catch (err) {
        console.error("Failed to process pending invite:", err);
        localStorage.removeItem("pendingInviteToken");
      } finally {
        setProcessingInvite(false);
      }
    })();
  }, [user, tenant, tenantUser, tenantLoading, processingInvite, refetch]);

  if (authLoading || tenantLoading || processingInvite) {
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

  // Super admin bypass: never require tenant, redirect to /admin
  if (requireTenant && isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  // requireTenant routes: no tenant found → onboarding
  if (requireTenant && !tenant) {
    // If there's still a pending invite token, keep showing loading
    if (localStorage.getItem("pendingInviteToken")) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-muted-foreground">Carregando...</span>
          </div>
        </div>
      );
    }
    if (tenantUser) {
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
