import { supabase } from "@/integrations/supabase/client";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { logger } from "@/lib/logger";
import { getClientProfile } from "@/services/clientProfileService";

/** Format CEP to XXXXX-XXX pattern expected by Negociarie API */
function formatCepForApi(cep: string): string {
  const digits = (cep || "").replace(/\D/g, "");
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return cep || "";
}

/** validateDevedorFields is now replaced by validateClienteFields in buildBoletoPayload */

function normalizeCellphoneForApi(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits;
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

/** Build a Negociarie-compliant BOLETO payload: { cliente, id_geral, parcelas } */
function buildBoletoPayload(
  cleanCpf: string,
  clientData: any,
  fallbackName: string,
  agreementId: string,
  installment: { value: number; dueDate: string; label: string; idParcela: string }
): Record<string, unknown> {
  const celular = normalizeCellphoneForApi(clientData.phone || "");

  // Extract numero from endereco if it contains a comma (e.g. "Rua X, 123")
  let endereco = (clientData.endereco || "").trim();
  let numero = "";
  if (endereco.includes(",")) {
    const parts = endereco.split(",");
    endereco = parts[0].trim();
    numero = (parts[1] || "").trim();
  }
  if (!numero) numero = "SN";

  const cliente: Record<string, unknown> = {
    documento: cleanCpf.replace(/\D/g, ""),
    nome: (clientData.nome_completo || fallbackName || "").trim(),
    razao_social: "",
    cep: formatCepForApi(clientData.cep || ""),
    endereco,
    numero,
    complemento: "",
    bairro: (clientData.bairro || "").trim(),
    cidade: (clientData.cidade || "").trim(),
    uf: (clientData.uf || "").trim().toUpperCase(),
    email: (clientData.email || "").trim(),
    telefones: celular ? [celular] : [],
  };

  const validatedDueDate = validateDueDate(
    String(installment.dueDate || "").slice(0, 10),
    installment.label
  );

  // Reuse validation (same required fields, just check inside cliente)
  validateClienteFields(cliente);

  const CALLBACK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/negociarie-callback`;

  // id_parcela must be a non-zero string per Negociarie docs — never omit
  let idParcela: string;
  if (installment.idParcela && installment.idParcela !== "0") {
    idParcela = String(installment.idParcela);
  } else {
    idParcela = String(Date.now()).slice(-8);
  }

  // Build mensagem for boleto (max 40 chars per line)
  const mensagemLine1 = `Acordo RIVO ${installment.label || ""}`.slice(0, 40);
  const mensagemLine2 = `Venc: ${formatIsoDateForMessage(validatedDueDate)}`.slice(0, 40);
  const mensagem = `${mensagemLine1}\n${mensagemLine2}`;

  const parcela: Record<string, unknown> = {
    id_parcela: idParcela,
    data_vencimento: validatedDueDate,
    valor: parseFloat(installment.value.toFixed(2)),
    valor_mora_dia: 0.10,
    valor_multa: 2.00,
    mensagem,
    callback_url: CALLBACK_URL,
  };

  // Generate a UNIQUE id_geral per attempt to avoid 500 from duplicate id_geral
  const shortId = agreementId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4);
  const idGeral = `RIVO-${shortId}-${Date.now()}`;

  return {
    cliente,
    id_geral: idGeral,
    parcelas: [parcela],
  };
}

/** Validate address fields within the cliente object for boleto */
function validateClienteFields(cliente: Record<string, unknown>) {
  const required = ["documento", "nome", "cep", "endereco", "cidade", "uf", "email"] as const;
  const placeholders = ["00000000", "00000-000", "Não informado", ""];

  for (const field of required) {
    const val = String(cliente[field] || "").trim();
    if (!val || placeholders.includes(val)) {
      throw new Error(`Preencha o cadastro do devedor antes de gerar o boleto. Campo obrigatório ausente: ${field}`);
    }
  }

  const telefones = cliente.telefones as string[] | undefined;
  if (!telefones || telefones.length === 0 || !telefones[0]) {
    throw new Error(`Preencha o cadastro do devedor antes de gerar o boleto. Campo obrigatório ausente: telefone`);
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

  const celular = String(telefones[0] || "");
  if (!/^\d{10,11}$/.test(celular)) {
    throw new Error(`Celular em formato inválido: "${celular}". Informe DDD + número, sem símbolos.`);
  }
}

function getPrimaryParcelResult(apiResult: any) {
  if (Array.isArray(apiResult?.parcelas) && apiResult.parcelas.length > 0) {
    return apiResult.parcelas[0];
  }
  return apiResult || {};
}

/** Extract boleto link from API result, checking parcelas[].link first */
function extractBoletoLink(apiResult: any, parcelaResult: any): string | null {
  return parcelaResult?.link || parcelaResult?.link_boleto || parcelaResult?.url_boleto || apiResult?.link_boleto || apiResult?.url_boleto || null;
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
      clientData = await getClientProfile(agreement.tenant_id, agreement.client_cpf);
    } catch (e) {
      logger.error(MODULE, "fetch_client_for_single_boleto", e);
    }

    const cleanCpf = agreement.client_cpf.replace(/[.\-]/g, "");
    const installmentKey = buildInstallmentKey(agreement.id, installment.number);

    const instLabel = `Acordo ${agreement.id.substring(0, 8)} - Parcela ${installment.number === 0 ? "Entrada" : installment.number}`;
    const shortAgreementId = agreement.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
    const idParcela = installment.number === 0
      ? String(Date.now()).slice(-8)
      : `${shortAgreementId}-${installment.number}-${Date.now().toString(36)}`;
    const payload = buildBoletoPayload(cleanCpf, clientData, agreement.client_name, agreement.id, {
      value: installment.value,
      dueDate: installment.dueDate,
      label: instLabel,
      idParcela,
    });

    const apiResult = await this.novaCobranca(payload);
    const parcelaResult = getPrimaryParcelResult(apiResult);

    // Mark previous boletos for this installment as substituido
    await markPreviousBoletosAsSubstituido(agreement.id, installmentKey);

    // Save new cobranca as vigente
    const cobranca = await this.saveCobranca({
      tenant_id: agreement.tenant_id,
      agreement_id: agreement.id,
      id_geral: apiResult?.id_geral || apiResult?.id || `manual-${Date.now()}`,
      id_parcela: parcelaResult?.id_parcela || String(payload.parcelas[0].id_parcela),
      data_vencimento: parcelaResult?.data_vencimento || installment.dueDate,
      valor: Number(parcelaResult?.valor || installment.value),
      status: "pendente",
      link_boleto: extractBoletoLink(apiResult, parcelaResult),
      linha_digitavel: parcelaResult?.linha_digitavel || apiResult?.linha_digitavel || null,
      pix_copia_cola: parcelaResult?.pix_copia_cola || apiResult?.pix_copia_cola || null,
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
      clientData = await getClientProfile(agreement.tenant_id, agreement.client_cpf);
    } catch (e) {
      logger.error(MODULE, "fetch_client_for_boleto", e);
    }

    const cleanCpf = agreement.client_cpf.replace(/[.\-]/g, "");

    for (const inst of installments) {
      try {
        const installmentKey = buildInstallmentKey(agreement.id, inst.number);
        const instLabel = `Acordo ${agreement.id.substring(0, 8)} - Parcela ${inst.number === 0 ? "Entrada" : inst.number}`;
        const idParcela = inst.number === 0 ? "" : String(inst.number);
        const payload = buildBoletoPayload(cleanCpf, clientData, agreement.client_name, agreement.id, {
          value: inst.value,
          dueDate: inst.dueDate,
          label: instLabel,
          idParcela,
        });

        const apiResult = await this.novaCobranca(payload);
        const parcelaResult = getPrimaryParcelResult(apiResult);

        // Mark previous boletos as substituido
        await markPreviousBoletosAsSubstituido(agreement.id, installmentKey);

        try {
          await this.saveCobranca({
            tenant_id: agreement.tenant_id,
            agreement_id: agreement.id,
            id_geral: apiResult?.id_geral || apiResult?.id || `manual-${Date.now()}`,
            id_parcela: parcelaResult?.id_parcela || String(payload.parcelas[0].id_parcela),
            data_vencimento: parcelaResult?.data_vencimento || inst.dueDate,
            valor: Number(parcelaResult?.valor || inst.value),
            status: "pendente",
            link_boleto: extractBoletoLink(apiResult, parcelaResult),
            linha_digitavel: parcelaResult?.linha_digitavel || apiResult?.linha_digitavel || null,
            pix_copia_cola: parcelaResult?.pix_copia_cola || apiResult?.pix_copia_cola || null,
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