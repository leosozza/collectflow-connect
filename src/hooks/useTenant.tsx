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
  role: "super_admin" | "admin" | "operador";
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
      
      // Use SECURITY DEFINER RPC to bypass restrictive RLS policies
      const { data: rpcData, error: rpcError } = await supabase
        .rpc("get_user_tenant_data");

      if (rpcError) {
        console.error("Error fetching tenant data via RPC:", rpcError);
      }

      const tuData = rpcData && rpcData.length > 0
        ? {
            id: rpcData[0].tu_id,
            tenant_id: rpcData[0].tu_tenant_id,
            user_id: rpcData[0].tu_user_id,
            role: rpcData[0].tu_role,
            created_at: rpcData[0].tu_created_at,
          }
        : null;

      if (!tuData) {
        setTenantUser(null);
        setTenant(null);
        setPlan(null);
        setLoading(false);
        return;
      }

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
        setTenant(tenantData as Tenant);

        // Fetch plan
        if (tenantData.plan_id) {
          const { data: planData } = await supabase
            .from("plans")
            .select("*")
            .eq("id", tenantData.plan_id)
            .single();
          if (planData) setPlan(planData as Plan);
        }
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
