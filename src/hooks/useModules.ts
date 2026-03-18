import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCallback, useRef } from "react";

export const useModules = () => {
  const { tenant, isSuperAdmin } = useTenant();
  const queryClient = useQueryClient();
  const seedAttempted = useRef(false);

  const { data: enabledSlugs = [], isLoading } = useQuery({
    queryKey: ["enabled-modules", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_enabled_modules");
      if (error) throw error;
      const slugs = (data as string[]) || [];

      // Auto-seed if modules are empty (e.g. fresh Live environment)
      if (slugs.length === 0 && !seedAttempted.current) {
        seedAttempted.current = true;
        console.warn("[useModules] No modules found — attempting auto-seed");
        try {
          const { error: seedError } = await supabase.functions.invoke("seed-modules");
          if (!seedError) {
            // Refetch after seed
            const { data: retryData } = await supabase.rpc("get_my_enabled_modules");
            const retrySlugs = (retryData as string[]) || [];
            if (retrySlugs.length > 0) {
              console.log("[useModules] Auto-seed successful:", retrySlugs.length, "modules");
              return retrySlugs;
            }
          } else {
            console.error("[useModules] Auto-seed failed:", seedError);
          }
        } catch (e) {
          console.error("[useModules] Auto-seed error:", e);
        }
      }

      return slugs;
    },
    enabled: !!tenant?.id && !isSuperAdmin,
    staleTime: 5 * 60 * 1000,
  });

  const isModuleEnabled = useCallback(
    (slug: string): boolean => {
      if (isSuperAdmin) return true;
      if (isLoading) return true; // don't block while loading
      return enabledSlugs.includes(slug);
    },
    [isSuperAdmin, isLoading, enabledSlugs]
  );

  return { enabledSlugs, isLoading, isModuleEnabled };
};
