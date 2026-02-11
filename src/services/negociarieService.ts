import { supabase } from "@/integrations/supabase/client";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/negociarie-proxy`;

async function callProxy(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...params }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

export const negociarieService = {
  testConnection: () => callProxy("test-connection"),

  // Cobranças
  novaCobranca: (data: Record<string, unknown>) => callProxy("nova-cobranca", { data }),
  novaPix: (data: Record<string, unknown>) => callProxy("nova-pix", { data }),
  novaCartao: (data: Record<string, unknown>) => callProxy("nova-cartao", { data }),
  consultaCobrancas: (filters?: { cpf?: string; id_geral?: string; limit?: number }) =>
    callProxy("consulta-cobrancas", filters || {}),
  baixaManual: (data: Record<string, unknown>) => callProxy("baixa-manual", { data }),
  parcelasPagas: (data?: string) => callProxy("parcelas-pagas", { data }),
  alteradasHoje: () => callProxy("alteradas-hoje"),
  atualizarCallback: (data: { url: string }) => callProxy("atualizar-callback", { data }),

  // Pagamento crédito
  pagamentoCredito: (data: Record<string, unknown>) => callProxy("pagamento-credito", { data }),
  cancelarPagamento: (data: Record<string, unknown>) => callProxy("cancelar-pagamento", { data }),

  // Inadimplência
  inadimplenciaNova: (data: Record<string, unknown>) => callProxy("inadimplencia-nova", { data }),
  inadimplenciaTitulos: (cpf?: string) => callProxy("inadimplencia-titulos", cpf ? { cpf } : {}),
  inadimplenciaAcordos: () => callProxy("inadimplencia-acordos"),
  inadimplenciaBaixaParcela: (data: Record<string, unknown>) => callProxy("inadimplencia-baixa-parcela", { data }),
  inadimplenciaDevolucao: (data: Record<string, unknown>) => callProxy("inadimplencia-devolucao", { data }),

  // Local DB
  async getCobrancas(tenantId: string) {
    const { data, error } = await supabase
      .from("negociarie_cobrancas" as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async saveCobranca(cobranca: Record<string, unknown>) {
    const { data, error } = await supabase
      .from("negociarie_cobrancas" as any)
      .insert(cobranca as any)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
