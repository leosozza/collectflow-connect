import { supabase } from "@/integrations/supabase/client";

export interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  limits: Record<string, any>;
  is_active: boolean;
}

export interface Tenant {
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

export const fetchPlans = async (): Promise<Plan[]> => {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("price_monthly", { ascending: true });
  if (error) throw error;
  return (data as Plan[]) || [];
};

export const createTenant = async (
  name: string,
  slug: string,
  planId: string,
  _userId: string
): Promise<Tenant> => {
  // Use atomic SECURITY DEFINER function to create tenant + tenant_user + update profile
  const { data: tenantId, error } = await supabase.rpc("onboard_tenant", {
    _name: name,
    _slug: slug,
    _plan_id: planId,
  });

  if (error) throw error;

  // Fetch the created tenant
  const { data: tenant, error: fetchError } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (fetchError) throw fetchError;
  return tenant as Tenant;
};

export const fetchAllTenants = async (): Promise<(Tenant & { plan_name?: string })[]> => {
  const { data, error } = await supabase
    .from("tenants")
    .select("*, plans(name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((t: any) => ({
    ...t,
    plan_name: t.plans?.name,
  }));
};

export const updateTenant = async (
  id: string,
  updates: Partial<Pick<Tenant, "name" | "slug" | "logo_url" | "primary_color" | "status" | "settings">>
): Promise<Tenant> => {
  const { data, error } = await supabase
    .from("tenants")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Tenant;
};

export const fetchTenantUsers = async (tenantId: string) => {
  const { data, error } = await supabase
    .from("tenant_users")
    .select("*")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return data || [];
};
