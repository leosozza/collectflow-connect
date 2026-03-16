import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useCallback } from "react";

export const useModules = () => {
  const { tenant, isSuperAdmin } = useTenant();

  const { data: enabledSlugs = [], isLoading } = useQuery({
    queryKey: ["enabled-modules", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_enabled_modules");
      if (error) throw error;
      return (data as string[]) || [];
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
