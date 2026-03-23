import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCallback, useEffect, useRef } from "react";

// Slugs that were absorbed into CRM — always return true if CRM is active
const CRM_ABSORBED_SLUGS = [
  "automacao",
  "relatorios",
  "financeiro",
  "integracoes",
  "api_publica",
  "portal_devedor",
  "ia_negociacao",
  "crm_core", // backward compat for old slug
];

export const useModules = () => {
  const { tenant, isSuperAdmin } = useTenant();
  const seedAttempted = useRef(false);

  const { data: enabledSlugs = [], isLoading, refetch } = useQuery({
    queryKey: ["enabled-modules", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_enabled_modules");
      if (error) throw error;
      const slugs = (data as string[]) || [];
      if (slugs.length === 0) {
        console.warn("[useModules] get_my_enabled_modules returned empty — system_modules or tenant_modules may not be populated");
      }
      return slugs;
    },
    enabled: !!tenant?.id && !isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  // Auto-seed modules if empty (e.g. fresh Live environment)
  useEffect(() => {
    if (isLoading || isSuperAdmin || seedAttempted.current) return;
    if (enabledSlugs.length > 0) return;
    if (!tenant?.id) return;

    seedAttempted.current = true;
    console.warn("[useModules] No modules found — attempting auto-seed");
    supabase.functions.invoke("seed-modules").then(({ error }) => {
      if (error) {
        console.error("[useModules] Auto-seed failed:", error);
      } else {
        console.log("[useModules] Auto-seed completed, refetching...");
        refetch();
      }
    });
  }, [enabledSlugs, isLoading, isSuperAdmin, tenant?.id, refetch]);

  const isModuleEnabled = useCallback(
    (slug: string): boolean => {
      if (isSuperAdmin) return true;
      if (isLoading) return true;

      // Absorbed modules: check if CRM is active
      if (CRM_ABSORBED_SLUGS.includes(slug)) {
        return enabledSlugs.includes("crm") || enabledSlugs.includes(slug);
      }

      return enabledSlugs.includes(slug);
    },
    [isSuperAdmin, isLoading, enabledSlugs]
  );

  return { enabledSlugs, isLoading, isModuleEnabled };
};
