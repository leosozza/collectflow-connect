import { supabase } from "@/integrations/supabase/client";

export interface SystemModule {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  is_core: boolean;
  sort_order: number;
  created_at: string;
}

export interface TenantModule {
  id: string;
  tenant_id: string;
  module_id: string;
  enabled: boolean;
  enabled_at: string;
  enabled_by: string | null;
  system_module?: SystemModule;
}

export const getSystemModules = async (): Promise<SystemModule[]> => {
  const { data, error } = await supabase
    .from("system_modules")
    .select("*")
    .order("sort_order");
  if (error) {
    logger.error("Failed to fetch system modules", error);
    throw error;
  }
  return (data || []) as SystemModule[];
};

export const getTenantModules = async (tenantId: string): Promise<(TenantModule & { system_module: SystemModule })[]> => {
  const { data, error } = await supabase
    .from("tenant_modules")
    .select("*, system_module:system_modules(*)")
    .eq("tenant_id", tenantId);
  if (error) {
    logger.error("Failed to fetch tenant modules", error);
    throw error;
  }
  return (data || []) as any;
};

export const toggleModule = async (
  tenantId: string,
  moduleId: string,
  enabled: boolean
): Promise<void> => {
  const { error } = await supabase
    .from("tenant_modules")
    .upsert(
      {
        tenant_id: tenantId,
        module_id: moduleId,
        enabled,
        enabled_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,module_id" }
    );
  if (error) {
    logger.error("Failed to toggle module", error);
    throw error;
  }
};

export const bulkToggleModules = async (
  tenantIds: string[],
  moduleIds: string[],
  enabled: boolean
): Promise<{ success: number; errors: number }> => {
  let success = 0;
  let errors = 0;

  const rows = tenantIds.flatMap((tid) =>
    moduleIds.map((mid) => ({
      tenant_id: tid,
      module_id: mid,
      enabled,
      enabled_at: new Date().toISOString(),
    }))
  );

  // Upsert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase
      .from("tenant_modules")
      .upsert(batch, { onConflict: "tenant_id,module_id" });
    if (error) {
      logger.error("Bulk toggle batch error", error);
      errors += batch.length;
    } else {
      success += batch.length;
    }
  }

  return { success, errors };
};
