import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true if there is ANY agreement record in the Rivo system
 * for the given (tenant_id, cpf) pair — regardless of status.
 *
 * Used to block the "Em Dia" / "wa_em_dia" disposition for clients
 * that already have a formal agreement in the system. "Em Dia" is
 * exclusive for clients still paying their original installments.
 */
export function useHasRivoAgreement(
  cpf: string | null | undefined,
  tenantId: string | null | undefined
) {
  const normalizedCpf = (cpf || "").replace(/\D/g, "");
  const enabled = !!tenantId && normalizedCpf.length >= 11;

  return useQuery({
    queryKey: ["has-rivo-agreement", tenantId, normalizedCpf],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("agreements")
        .select("id")
        .eq("tenant_id", tenantId!)
        .eq("client_cpf", normalizedCpf)
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("useHasRivoAgreement error:", error);
        return false;
      }
      return !!data;
    },
    enabled,
    staleTime: 60_000,
  });
}
