import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone } from "@/lib/cpfUtils";
import { useTenant } from "@/hooks/useTenant";

export const useClientByPhone = (phone: string | undefined) => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const normalized = normalizePhone(phone || "");

  const { data: client, isLoading } = useQuery({
    queryKey: ["client-by-phone", tenantId, normalized],
    queryFn: async () => {
      if (!tenantId) return null;
      
      // Use indexed RPC instead of ILIKE full table scan
      const { data, error } = await supabase.rpc("resolve_client_by_phone", {
        _tenant_id: tenantId,
        _phone: normalized,
      });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const resolved = data[0];
      if (!resolved.client_id) return null;

      // Fetch full client record
      const { data: clientData, error: clientErr } = await supabase
        .from("clients")
        .select("*")
        .eq("id", resolved.client_id)
        .maybeSingle();

      if (clientErr) throw clientErr;
      return clientData;
    },
    enabled: !!normalized && normalized.length >= 8 && !!tenantId,
  });

  return { client, isLoading };
};
