import { supabase } from "@/integrations/supabase/client";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { logger } from "@/lib/logger";
import { addMonths } from "date-fns";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/negociarie-proxy`;
const MODULE = "negociarieService";

async function callProxy(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const res = await fetchWithTimeout(FUNCTION_URL, {
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

export interface BoletoInstallment {
  number: number;
  value: number;
  dueDate: string;
}

export interface BoletoGenerationResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
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

  /**
   * Generate a single boleto for one installment of an agreement.
   */
  async generateSingleBoleto(
    agreement: { id: string; client_cpf: string; credor: string; tenant_id: string; client_name: string },
    installment: { number: number; value: number; dueDate: string }
  ) {
    // Fetch client address data
    let clientData: any = {};
    try {
      const { data } = await supabase
        .from("clients")
        .select("nome_completo, cpf, email, phone, cep, endereco, bairro, cidade, uf")
        .eq("cpf", agreement.client_cpf)
        .eq("credor", agreement.credor)
        .limit(1)
        .maybeSingle();
      if (data) clientData = data;
    } catch (e) {
      logger.error(MODULE, "fetch_client_for_single_boleto", e);
    }

    const cleanCpf = agreement.client_cpf.replace(/[.\-]/g, "");

    const payload: Record<string, unknown> = {
      documento: cleanCpf,
      nome: clientData.nome_completo || agreement.client_name,
      cep: clientData.cep || "",
      endereco: clientData.endereco || "",
      bairro: clientData.bairro || "",
      cidade: clientData.cidade || "",
      uf: clientData.uf || "",
      email: clientData.email || "",
      telefone: (clientData.phone || "").replace(/\D/g, ""),
      valor: installment.value,
      vencimento: installment.dueDate,
      descricao: `Acordo ${agreement.id.substring(0, 8)} - Parcela ${installment.number === 0 ? "Entrada" : installment.number}`,
    };

    const apiResult = await this.novaCobranca(payload);

    // Save to local DB
    const cobranca = await this.saveCobranca({
      tenant_id: agreement.tenant_id,
      agreement_id: agreement.id,
      id_geral: apiResult?.id_geral || apiResult?.id || `manual-${Date.now()}`,
      data_vencimento: installment.dueDate,
      valor: installment.value,
      status: "pendente",
      link_boleto: apiResult?.link_boleto || apiResult?.url_boleto || null,
      linha_digitavel: apiResult?.linha_digitavel || null,
      pix_copia_cola: apiResult?.pix_copia_cola || null,
      callback_data: apiResult || null,
    });

    logger.info(MODULE, "single_boleto_generated", { agreement_id: agreement.id, installment: installment.number });
    return cobranca;
  },

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

  /**
   * Generate boletos for each installment of an agreement.
   * Fetches client address data and calls Negociarie API for each installment.
   * Errors do NOT propagate — returns a summary result.
   */
  async generateAgreementBoletos(
    agreement: { id: string; client_cpf: string; credor: string; tenant_id: string; client_name: string },
    installments: BoletoInstallment[]
  ): Promise<BoletoGenerationResult> {
    const result: BoletoGenerationResult = { total: installments.length, success: 0, failed: 0, errors: [] };

    // Fetch client address data
    let clientData: any = {};
    try {
      const { data } = await supabase
        .from("clients")
        .select("nome_completo, cpf, email, phone, cep, endereco, bairro, cidade, uf")
        .eq("cpf", agreement.client_cpf)
        .eq("credor", agreement.credor)
        .limit(1)
        .maybeSingle();
      if (data) clientData = data;
    } catch (e) {
      logger.error(MODULE, "fetch_client_for_boleto", e);
    }

    const cleanCpf = agreement.client_cpf.replace(/[.\-]/g, "");

    for (const inst of installments) {
      try {
        const payload: Record<string, unknown> = {
          documento: cleanCpf,
          nome: clientData.nome_completo || agreement.client_name,
          cep: clientData.cep || "",
          endereco: clientData.endereco || "",
          bairro: clientData.bairro || "",
          cidade: clientData.cidade || "",
          uf: clientData.uf || "",
          email: clientData.email || "",
          telefone: (clientData.phone || "").replace(/\D/g, ""),
          valor: inst.value,
          vencimento: inst.dueDate,
          descricao: `Acordo ${agreement.id.substring(0, 8)} - Parcela ${inst.number === 0 ? "Entrada" : inst.number}`,
        };

        const apiResult = await this.novaCobranca(payload);

        // Save to local DB with agreement reference
        try {
          await this.saveCobranca({
            tenant_id: agreement.tenant_id,
            agreement_id: agreement.id,
            id_geral: apiResult?.id_geral || apiResult?.id || `manual-${Date.now()}`,
            data_vencimento: inst.dueDate,
            valor: inst.value,
            status: "pendente",
            link_boleto: apiResult?.link_boleto || apiResult?.url_boleto || null,
            linha_digitavel: apiResult?.linha_digitavel || null,
            pix_copia_cola: apiResult?.pix_copia_cola || null,
            callback_data: apiResult || null,
          });
        } catch (saveErr) {
          logger.error(MODULE, "save_cobranca_local", saveErr, { agreement_id: agreement.id, installment: inst.number });
        }

        result.success++;
        logger.info(MODULE, "boleto_generated", { agreement_id: agreement.id, installment: inst.number });
      } catch (err: any) {
        result.failed++;
        const msg = `Parcela ${inst.number === 0 ? "Entrada" : inst.number}: ${err.message || "Erro desconhecido"}`;
        result.errors.push(msg);
        logger.error(MODULE, "boleto_generation_failed", { agreement_id: agreement.id, installment: inst.number, error: err.message });
      }
    }

    return result;
  },
};
