import { supabase } from "@/integrations/supabase/client";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { logger } from "@/lib/logger";
import { formatCPFDisplay } from "@/lib/cpfUtils";

/** Format CEP to XXXXX-XXX pattern expected by Negociarie API */
function formatCepForApi(cep: string): string {
  const digits = (cep || "").replace(/\D/g, "");
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return cep || "";
}

/** Fetch client address trying CPF clean then formatted */
async function fetchClientAddress(cpf: string) {
  const cleanCpf = cpf.replace(/[.\-]/g, "");
  const { data } = await supabase
    .from("clients")
    .select("nome_completo, cpf, email, phone, cep, endereco, bairro, cidade, uf")
    .eq("cpf", cleanCpf)
    .limit(1)
    .maybeSingle();
  if (data) return data;

  const formatted = formatCPFDisplay(cleanCpf);
  const { data: data2 } = await supabase
    .from("clients")
    .select("nome_completo, cpf, email, phone, cep, endereco, bairro, cidade, uf")
    .eq("cpf", formatted)
    .limit(1)
    .maybeSingle();
  return data2 || {};
}

/** Validate address fields within the cliente object */
function validateClienteFields(cliente: Record<string, unknown>) {
  const required = ["documento", "nome", "cep", "endereco", "cidade", "uf"] as const;
  const placeholders = ["00000000", "00000-000", "Não informado", ""];
  for (const field of required) {
    const val = String(cliente[field] || "").trim();
    if (!val || placeholders.includes(val)) {
      throw new Error(`Preencha o endereço do devedor antes de gerar o boleto. Campo obrigatório ausente: ${field}`);
    }
  }
  const cep = String(cliente.cep || "");
  if (!/^\d{5}-\d{3}$/.test(cep)) {
    throw new Error(`CEP em formato inválido: "${cep}". O formato esperado é 00000-000.`);
  }
  const doc = String(cliente.documento || "");
  if (!/^\d{11}$/.test(doc) && !/^\d{14}$/.test(doc)) {
    throw new Error(`CPF/CNPJ em formato inválido: "${doc}". Informe apenas dígitos (11 ou 14).`);
  }
  const uf = String(cliente.uf || "");
  if (!/^[A-Z]{2}$/.test(uf)) {
    throw new Error(`UF em formato inválido: "${uf}". Informe a sigla do estado (ex: SP, RJ).`);
  }
}

function getTodayLocalIso(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIsoDateForMessage(date: string): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

function validateDueDate(dueDate: string, installmentLabel: string): string {
  const normalizedDueDate = String(dueDate || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDueDate)) {
    throw new Error(`Data de vencimento inválida para ${installmentLabel}. Informe uma data válida antes de gerar o boleto.`);
  }

  if (normalizedDueDate < getTodayLocalIso()) {
    throw new Error(
      `${installmentLabel} está com vencimento em ${formatIsoDateForMessage(normalizedDueDate)}. Edite a data para hoje ou uma data futura antes de gerar o boleto.`
    );
  }

  return normalizedDueDate;
}

/** Build a Negociarie-compliant nested payload: { cliente, id_geral, parcelas } */
function buildNegociariePayload(
  cleanCpf: string,
  clientData: any,
  fallbackName: string,
  agreementId: string,
  installment: { value: number; dueDate: string; label: string; idParcela: string }
): Record<string, unknown> {
  let phone = (clientData.phone || "").replace(/\D/g, "");
  // Remove DDI 55 if present — API expects only DDD+number
  if (phone.length >= 12 && phone.startsWith("55")) {
    phone = phone.slice(2);
  }

  const cliente: Record<string, unknown> = {
    documento: cleanCpf.replace(/\D/g, ""),
    nome: (clientData.nome_completo || fallbackName || "").trim(),
    cep: formatCepForApi(clientData.cep || ""),
    endereco: (clientData.endereco || "").trim(),
    cidade: (clientData.cidade || "").trim(),
    uf: (clientData.uf || "").trim().toUpperCase(),
    telefones: phone ? [phone] : [],
    email: (clientData.email || "").trim(),
  };

  const validatedDueDate = validateDueDate(
    String(installment.dueDate || "").slice(0, 10),
    installment.label
  );

  validateClienteFields(cliente);

  return {
    cliente,
    id_geral: `ACORDO-${agreementId.substring(0, 8)}`,
    parcelas: [
      {
        id_parcela: installment.idParcela,
        data_vencimento: validatedDueDate,
        valor: installment.value,
      },
    ],
  };
}

/** Build installment_key from agreement_id and installment number */
function buildInstallmentKey(agreementId: string, installmentNumber: number): string {
  return `${agreementId}:${installmentNumber}`;
}

/** Mark previous unpaid boletos for same installment as substituido */
async function markPreviousBoletosAsSubstituido(agreementId: string, installmentKey: string) {
  try {
    await supabase
      .from("negociarie_cobrancas" as any)
      .update({ status: "substituido" } as any)
      .eq("agreement_id", agreementId)
      .eq("installment_key", installmentKey)
      .neq("status", "pago");
  } catch (e) {
    logger.error("negociarieService", "mark_previous_substituido", e);
  }
}

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
   * Marks previous unpaid boletos for the same installment as substituido.
   */
  async generateSingleBoleto(
    agreement: { id: string; client_cpf: string; credor: string; tenant_id: string; client_name: string },
    installment: { number: number; value: number; dueDate: string }
  ) {
    let clientData: any = {};
    try {
      clientData = await fetchClientAddress(agreement.client_cpf);
    } catch (e) {
      logger.error(MODULE, "fetch_client_for_single_boleto", e);
    }

    const cleanCpf = agreement.client_cpf.replace(/[.\-]/g, "");
    const installmentKey = buildInstallmentKey(agreement.id, installment.number);

    const instLabel = `Acordo ${agreement.id.substring(0, 8)} - Parcela ${installment.number === 0 ? "Entrada" : installment.number}`;
    const idParcela = installment.number === 0 ? "entrada" : String(installment.number);
    const payload = buildNegociariePayload(cleanCpf, clientData, agreement.client_name, agreement.id, {
      value: installment.value,
      dueDate: installment.dueDate,
      label: instLabel,
      idParcela,
    });

    const apiResult = await this.novaCobranca(payload);

    // Mark previous boletos for this installment as substituido
    await markPreviousBoletosAsSubstituido(agreement.id, installmentKey);

    // Save new cobranca as vigente
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
      installment_key: installmentKey,
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
   */
  async generateAgreementBoletos(
    agreement: { id: string; client_cpf: string; credor: string; tenant_id: string; client_name: string },
    installments: BoletoInstallment[]
  ): Promise<BoletoGenerationResult> {
    const result: BoletoGenerationResult = { total: installments.length, success: 0, failed: 0, errors: [] };

    let clientData: any = {};
    try {
      clientData = await fetchClientAddress(agreement.client_cpf);
    } catch (e) {
      logger.error(MODULE, "fetch_client_for_boleto", e);
    }

    const cleanCpf = agreement.client_cpf.replace(/[.\-]/g, "");

    for (const inst of installments) {
      try {
        const installmentKey = buildInstallmentKey(agreement.id, inst.number);
        const instLabel = `Acordo ${agreement.id.substring(0, 8)} - Parcela ${inst.number === 0 ? "Entrada" : inst.number}`;
        const idParcela = inst.number === 0 ? "entrada" : String(inst.number);
        const payload = buildNegociariePayload(cleanCpf, clientData, agreement.client_name, agreement.id, {
          value: inst.value,
          dueDate: inst.dueDate,
          label: instLabel,
          idParcela,
        });

        const apiResult = await this.novaCobranca(payload);

        // Mark previous boletos as substituido
        await markPreviousBoletosAsSubstituido(agreement.id, installmentKey);

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
            installment_key: installmentKey,
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
