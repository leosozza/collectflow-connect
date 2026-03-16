import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useClientByPhone = (phone: string | undefined) => {
  const normalizedPhone = phone?.replace(/\D/g, "") || "";
  const phoneSuffix = normalizedPhone.length >= 8 ? normalizedPhone.slice(-8) : normalizedPhone;

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
