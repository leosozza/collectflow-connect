import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone } from "@/lib/cpfUtils";

export const useClientByPhone = (phone: string | undefined) => {
  const normalized = normalizePhone(phone || "");
  const phoneSuffix = normalized.length >= 8 ? normalized.slice(-8) : normalized;

  const { data: client, isLoading } = useQuery({
    queryKey: ["client-by-phone", phoneSuffix],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .or(`phone.ilike.%${phoneSuffix},phone2.ilike.%${phoneSuffix},phone3.ilike.%${phoneSuffix}`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!phoneSuffix && phoneSuffix.length >= 8,
  });

  return { client, isLoading };
};
