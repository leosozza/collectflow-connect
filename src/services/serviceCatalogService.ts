import { supabase } from "@/integrations/supabase/client";
import type {
  ServiceCatalogItem,
  ServiceCatalogCreateInput,
  ServiceCatalogUpdateInput,
  TenantService,
} from "@/types/tokens";

// ============================================
// SERVICE CATALOG
// ============================================

export const fetchServiceCatalog = async (): Promise<ServiceCatalogItem[]> => {
  const { data, error } = await supabase
    .from("service_catalog")
    .select("*")
    .order("display_order");
  if (error) throw error;
  return (data || []) as ServiceCatalogItem[];
};

export const fetchActiveServiceCatalog = async (): Promise<ServiceCatalogItem[]> => {
  const { data, error } = await supabase
    .from("service_catalog")
    .select("*")
    .eq("is_active", true)
    .order("display_order");
  if (error) throw error;
  return (data || []) as ServiceCatalogItem[];
};

export const createService = async (input: ServiceCatalogCreateInput): Promise<ServiceCatalogItem> => {
  const { data, error } = await supabase
    .from("service_catalog")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as ServiceCatalogItem;
};

export const updateService = async (id: string, updates: ServiceCatalogUpdateInput): Promise<ServiceCatalogItem> => {
  const { data, error } = await supabase
    .from("service_catalog")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ServiceCatalogItem;
};

export const deleteService = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("service_catalog")
    .delete()
    .eq("id", id);
  if (error) throw error;
};

// ============================================
// TENANT SERVICES
// ============================================

export const fetchTenantServices = async (tenantId: string): Promise<TenantService[]> => {
  const { data, error } = await supabase
    .from("tenant_services")
    .select("*, service_catalog(*)")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data || []).map((item: any) => ({
    ...item,
    service: item.service_catalog,
    service_catalog: undefined,
  })) as TenantService[];
};

export const activateService = async (
  tenantId: string,
  serviceId: string,
  quantity: number = 1,
  unitPriceOverride?: number
): Promise<TenantService> => {
  const { data, error } = await supabase
    .from("tenant_services")
    .upsert(
      {
        tenant_id: tenantId,
        service_id: serviceId,
        status: "active",
        quantity,
        unit_price_override: unitPriceOverride || null,
        activated_at: new Date().toISOString(),
        cancelled_at: null,
      },
      { onConflict: "tenant_id,service_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as TenantService;
};

export const deactivateService = async (
  tenantId: string,
  serviceId: string
): Promise<TenantService> => {
  const { data, error } = await supabase
    .from("tenant_services")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("service_id", serviceId)
    .select()
    .single();
  if (error) throw error;
  return data as TenantService;
};

export const updateTenantServiceQuantity = async (
  tenantId: string,
  serviceId: string,
  quantity: number
): Promise<TenantService> => {
  const { data, error } = await supabase
    .from("tenant_services")
    .update({ quantity })
    .eq("tenant_id", tenantId)
    .eq("service_id", serviceId)
    .select()
    .single();
  if (error) throw error;
  return data as TenantService;
};
