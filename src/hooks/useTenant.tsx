import { useEffect, useState, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  limits: {
    max_users?: number;
    max_clients?: number;
    features?: string[];
  };
  is_active: boolean;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  plan_id: string | null;
  status: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface TenantUser {
  id: string;
  tenant_id: string;
  user_id: string;
  role: "super_admin" | "admin" | "gerente" | "supervisor" | "operador";
  created_at: string;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantUser: TenantUser | null;
  plan: Plan | null;
  loading: boolean;
  isSuperAdmin: boolean;
  isTenantAdmin: boolean;
  canAccess: (feature: string) => boolean;
  checkLimit: (resource: string, currentCount: number) => boolean;
  refetch: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
};

export const TenantProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantUser, setTenantUser] = useState<TenantUser | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenantData = async () => {
    if (authLoading) return; // Wait for auth to finish
    
    if (!user) {
      setTenant(null);
      setTenantUser(null);
      setPlan(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Use SECURITY DEFINER RPC to get tenant_id (bypasses restrictive RLS)
      const { data: tenantId, error: rpcError } = await supabase
        .rpc("get_my_tenant_id");

      console.log("[useTenant] get_my_tenant_id result:", tenantId, "error:", rpcError);

      if (rpcError) {
        console.error("Error fetching tenant_id via RPC:", rpcError);
      }

      if (!tenantId) {
        console.log("[useTenant] No tenant found, redirecting to onboarding");
        setTenantUser(null);
        setTenant(null);
        setPlan(null);
        setLoading(false);
        return;
      }

      // We have a tenant_id, determine role via SECURITY DEFINER functions
      const [{ data: isSA }, { data: isTA }] = await Promise.all([
        supabase.rpc("is_super_admin", { _user_id: user.id }),
        supabase.rpc("is_tenant_admin", { _user_id: user.id, _tenant_id: tenantId }),
      ]);

      const userRole = isSA ? "super_admin" as const : isTA ? "admin" as const : "operador" as const;

      const tuData = {
        id: tenantId,
        tenant_id: tenantId,
        user_id: user.id,
        role: userRole,
        created_at: new Date().toISOString(),
      };

      setTenantUser(tuData as TenantUser);

      // Fetch tenant
      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tuData.tenant_id)
        .single();

      if (tenantError) {
        console.error("Error fetching tenant:", tenantError);
      }

      if (tenantData) {
        // Fetch plan before setting state to avoid intermediate null renders
        let planData = null;
        if (tenantData.plan_id) {
          const { data: pd } = await supabase
            .from("plans")
            .select("*")
            .eq("id", tenantData.plan_id)
            .single();
          planData = pd;
        }
        // Set everything atomically before marking loading=false
        setTenant(tenantData as Tenant);
        if (planData) setPlan(planData as Plan);
      }
    } catch (err) {
      console.error("Error fetching tenant data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantData();
  }, [user, authLoading]);

  const isSuperAdmin = tenantUser?.role === "super_admin";
  const isTenantAdmin = tenantUser?.role === "admin" || isSuperAdmin;

  const canAccess = (feature: string): boolean => {
    if (isSuperAdmin) return true;
    const features = (plan?.limits?.features as string[]) || [];
    return features.includes(feature);
  };

  const checkLimit = (resource: string, currentCount: number): boolean => {
    if (isSuperAdmin) return true;
    const limits = plan?.limits || {};
    const key = `max_${resource}` as keyof typeof limits;
    const max = limits[key] as number | undefined;
    if (max === undefined) return true;
    return currentCount < max;
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantUser,
        plan,
        loading,
        isSuperAdmin,
        isTenantAdmin,
        canAccess,
        checkLimit,
        refetch: fetchTenantData,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};
