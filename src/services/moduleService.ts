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
  parent_slug: string | null;
  depends_on: string[];
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
  if (error) throw error;
  return ((data || []) as any[]).map((m) => ({
    ...m,
    depends_on: m.depends_on || [],
    parent_slug: m.parent_slug || null,
  }));
};

export const getTenantModules = async (tenantId: string): Promise<(TenantModule & { system_module: SystemModule })[]> => {
  const { data, error } = await supabase
    .from("tenant_modules")
    .select("*, system_module:system_modules(*)")
    .eq("tenant_id", tenantId);
  if (error) throw error;
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
      } as any,
      { onConflict: "tenant_id,module_id" }
    );
  if (error) throw error;
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

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase
      .from("tenant_modules")
      .upsert(batch as any[], { onConflict: "tenant_id,module_id" });
    if (error) {
      console.error("Bulk toggle batch error", error);
      errors += batch.length;
    } else {
      success += batch.length;
    }
  }

  return { success, errors };
};

/**
 * Returns list of dependency slugs that are NOT currently enabled,
 * preventing activation of the target module.
 */
export const getDependencyErrors = (
  moduleSlug: string,
  enabledMap: Record<string, boolean>,
  modules: SystemModule[]
): string[] => {
  const mod = modules.find((m) => m.slug === moduleSlug);
  if (!mod || !mod.depends_on?.length) return [];

  return mod.depends_on.filter((depSlug) => {
    const depMod = modules.find((m) => m.slug === depSlug);
    if (!depMod) return false;
    if (depMod.is_core) return false; // core modules are always enabled
    return !enabledMap[depMod.id];
  });
};

/**
 * Returns list of module IDs that must be disabled when disabling a module
 * (cascade: anything that depends on the disabled module).
 */
export const getAutoDisableModules = (
  moduleSlug: string,
  enabledMap: Record<string, boolean>,
  modules: SystemModule[]
): SystemModule[] => {
  return modules.filter((m) => {
    if (m.is_core) return false;
    if (!enabledMap[m.id]) return false;
    return m.depends_on?.includes(moduleSlug);
  });
};

/**
 * Returns module IDs that need to be auto-enabled as dependencies.
 */
export const getAutoEnableModules = (
  moduleSlug: string,
  enabledMap: Record<string, boolean>,
  modules: SystemModule[]
): SystemModule[] => {
  const mod = modules.find((m) => m.slug === moduleSlug);
  if (!mod || !mod.depends_on?.length) return [];

  const toEnable: SystemModule[] = [];
  const visited = new Set<string>();

  const collect = (slug: string) => {
    if (visited.has(slug)) return;
    visited.add(slug);
    const m = modules.find((x) => x.slug === slug);
    if (!m || m.is_core) return;
    if (!enabledMap[m.id]) {
      toEnable.push(m);
    }
    // Recursively collect dependencies of dependencies
    m.depends_on?.forEach(collect);
  };

  mod.depends_on.forEach(collect);
  return toEnable;
};
