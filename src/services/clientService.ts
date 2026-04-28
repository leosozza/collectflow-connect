import { supabase } from "@/integrations/supabase/client";
import { upsertClientProfile } from "@/services/clientProfileService";
import { validateClientData, validateImportRows } from "@/lib/validations";
import { logAction } from "@/services/auditService";
import { logger } from "@/lib/logger";
import { handleServiceError } from "@/lib/errorHandler";
import { generateInstallments } from "@/lib/installmentUtils";
import { cleanCPF } from "@/lib/cpfUtils";

export interface Client {
  id: string;
  operator_id: string | null;
  credor: string;
  nome_completo: string;
  cpf: string;
  phone: string | null;
  email: string | null;
  external_id: string | null;
  numero_parcela: number;
  total_parcelas: number;
  valor_entrada: number;
  valor_parcela: number;
  valor_pago: number;
  quebra: number;
  data_vencimento: string;
  status: "pendente" | "pago" | "quebrado";
  propensity_score: number | null;
  created_at: string;
  updated_at: string;
  tenant_id: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  observacoes: string | null;
  tipo_devedor_id: string | null;
  tipo_divida_id: string | null;
  status_cobranca_id: string | null;
  status_cobranca_locked_by: string | null;
  status_cobranca_locked_at: string | null;
  data_quitacao: string | null;
  valor_saldo: number | null;
}

export interface ClientFormData {
  credor: string;
  nome_completo: string;
  cpf: string;
  phone?: string;
  email?: string;
  external_id?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  observacoes?: string;
  numero_parcela: number;
  total_parcelas: number;
  valor_entrada: number;
  valor_parcela: number;
  valor_pago: number;
  data_vencimento: string;
  status: "pendente" | "pago" | "quebrado";
}

const MODULE = "clientService";

const CLIENT_SELECT_COLUMNS = "id, nome_completo, cpf, phone, phone2, phone3, email, credor, status, data_vencimento, valor_parcela, valor_pago, numero_parcela, total_parcelas, propensity_score, tipo_devedor_id, tipo_divida_id, status_cobranca_id, status_cobranca_locked_by, status_cobranca_locked_at, operator_id, external_id, created_at, updated_at, valor_saldo, valor_entrada, endereco, cidade, uf, cep, observacoes, debtor_profile, data_quitacao, tenant_id, enrichment_data, quebra, cod_contrato";

export const fetchClients = async (
  tenantId: string,
  filters?: {
    status?: string;
    credor?: string;
    dateFrom?: string;
    dateTo?: string;
    operatorId?: string;
    search?: string;
    cadastroDe?: string;
    cadastroAte?: string;
    tipoDevedorId?: string;
    tipoDividaId?: string;
    statusCobrancaId?: string;
  },
  pagination?: { page: number; pageSize: number }
): Promise<{ data: Client[]; count: number }> => {
  try {
    if (!tenantId) throw new Error("tenant_id é obrigatório");

    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 1000;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("clients")
      .select(CLIENT_SELECT_COLUMNS, { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("data_vencimento", { ascending: false });

    if (filters?.search?.trim()) {
      const term = filters.search.trim();
      const cleanTerm = term.replace(/\D/g, "");
      if (cleanTerm.length > 0 && cleanTerm === term.replace(/[.\-\/\s]/g, "")) {
        query = query.or(
          `nome_completo.ilike.%${term}%,cpf.ilike.%${cleanTerm}%,phone.ilike.%${cleanTerm}%,phone2.ilike.%${cleanTerm}%,phone3.ilike.%${cleanTerm}%,email.ilike.%${term}%`
        );
      } else {
        query = query.or(
          `nome_completo.ilike.%${term}%,cpf.ilike.%${term}%,phone.ilike.%${term}%,phone2.ilike.%${term}%,phone3.ilike.%${term}%,email.ilike.%${term}%`
        );
      }
    }

    if (filters?.credor && filters.credor !== "todos") {
      query = query.eq("credor", filters.credor);
    }
    if (filters?.dateFrom) query = query.gte("data_vencimento", filters.dateFrom);
    if (filters?.dateTo) query = query.lte("data_vencimento", filters.dateTo);
    if (filters?.operatorId) query = query.eq("operator_id", filters.operatorId);
    if (filters?.cadastroDe) query = query.gte("created_at", filters.cadastroDe + "T00:00:00");
    if (filters?.cadastroAte) query = query.lte("created_at", filters.cadastroAte + "T23:59:59");
    if (filters?.tipoDevedorId) {
      const ids = filters.tipoDevedorId.split(",").filter(Boolean);
      if (ids.length === 1) query = query.eq("tipo_devedor_id", ids[0]);
      else if (ids.length > 1) query = query.in("tipo_devedor_id", ids);
    }
    if (filters?.tipoDividaId) {
      const ids = filters.tipoDividaId.split(",").filter(Boolean);
      if (ids.length === 1) query = query.eq("tipo_divida_id", ids[0]);
      else if (ids.length > 1) query = query.in("tipo_divida_id", ids);
    }
    if (filters?.statusCobrancaId) {
      const ids = filters.statusCobrancaId.split(",").filter(Boolean);
      if (ids.length === 1) query = query.eq("status_cobranca_id", ids[0]);
      else if (ids.length > 1) query = query.in("status_cobranca_id", ids);
    }

    const { data, count, error } = await query.range(from, to);
    if (error) throw error;
    logger.info(MODULE, "fetch", { count: data?.length, total: count });
    return { data: (data || []) as Client[], count: count || 0 };
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const createClient = async (
  data: ClientFormData,
  operatorId: string
): Promise<Client> => {
  try {
    const validated = validateClientData(data);
    const totalParcelas = validated.total_parcelas || data.total_parcelas || 1;
    const dataVenc = (validated.data_vencimento && validated.data_vencimento.length > 0)
      ? validated.data_vencimento
      : (data.data_vencimento && data.data_vencimento.length > 0)
        ? data.data_vencimento
        : new Date().toISOString().split("T")[0];
    const extId = data.external_id || `MAN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Buscar tenant_id do operador para satisfazer RLS
    const { data: profileData } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", operatorId)
      .single();

    const tenantId = profileData?.tenant_id;
    if (!tenantId) throw new Error("Operador sem empresa vinculada. Faça login novamente.");

    const records = generateInstallments({
      credor: validated.credor,
      nome_completo: validated.nome_completo,
      cpf: validated.cpf,
      phone: data.phone || null,
      email: data.email || null,
      external_id: extId,
      numero_parcela: validated.numero_parcela,
      total_parcelas: totalParcelas,
      valor_entrada: data.valor_entrada || 0,
      valor_parcela: validated.valor_parcela,
      valor_pago: validated.valor_pago,
      data_vencimento: dataVenc,
      status: validated.status,
      operator_id: operatorId,
    }).map(r => ({ ...r, tenant_id: tenantId }));

    const { data: result, error } = await supabase
      .from("clients")
      .insert(records as any)
      .select();

    if (error) throw error;
    logger.info(MODULE, "create", { nome: data.nome_completo, parcelas: totalParcelas });
    logAction({ action: "create", entity_type: "client", entity_id: (result as Client[])[0]?.id, details: { nome: data.nome_completo, cpf: data.cpf, parcelas: totalParcelas } });
    return (result as Client[])[0];
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const updateClient = async (
  id: string,
  data: Partial<ClientFormData>
): Promise<Client> => {
  try {
    const { z } = await import("zod");
    const { clientSchema } = await import("@/lib/validations");
    const partialSchema = clientSchema.partial();
    const validated = partialSchema.parse(data);

    const { data: result, error } = await supabase
      .from("clients")
      .update(validated)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    logger.info(MODULE, "update", { id });
    logAction({ action: "update", entity_type: "client", entity_id: id, details: { changed_fields: Object.keys(data), module: "client" } });
    return result as Client;
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const deleteClient = async (id: string): Promise<void> => {
  try {
    logAction({ action: "delete", entity_type: "client", entity_id: id });
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw error;
    logger.info(MODULE, "delete", { id });
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const markAsPaid = async (client: Client, valorPago: number, dataPagamento?: string): Promise<void> => {
  try {
    const isPaid = valorPago >= client.valor_parcela;
    const status = isPaid ? "pago" : "quebrado";

    const updateData: any = { valor_pago: valorPago, status };
    if (isPaid) {
      updateData.data_quitacao = new Date().toISOString().split("T")[0];
    }
    await updateClient(client.id, updateData);
    logAction({ action: "payment", entity_type: "client", entity_id: client.id, details: { nome: client.nome_completo, valor: valorPago, status } });
    logger.info(MODULE, "markAsPaid", { clientId: client.id, isPaid });

    if (!isPaid) {
      await removeFutureInstallments(client);
    }
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const markAsBroken = async (client: Client): Promise<void> => {
  try {
    await updateClient(client.id, { valor_pago: 0, status: "quebrado" });
    logAction({ action: "break", entity_type: "client", entity_id: client.id, details: { nome: client.nome_completo } });
    logger.info(MODULE, "markAsBroken", { clientId: client.id });
    await removeFutureInstallments(client);
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

const removeFutureInstallments = async (client: Client): Promise<void> => {
  let query = supabase
    .from("clients")
    .delete()
    .eq("cpf", client.cpf)
    .eq("credor", client.credor)
    .eq("status", "pendente")
    .gt("numero_parcela", client.numero_parcela);
  if (client.tenant_id) {
    query = query.eq("tenant_id", client.tenant_id);
  }
  const { error } = await query;
  if (error) throw error;
};

export const bulkCreateClients = async (
  clients: Array<{
    credor: string;
    nome_completo: string;
    cpf: string;
    external_id?: string;
    numero_parcela: number;
    valor_entrada: number;
    valor_parcela: number;
    valor_pago: number;
    data_vencimento?: string;
    status: "pendente" | "pago" | "quebrado";
    status_cobranca_id?: string;
    [key: string]: any;
  }>,
  operatorId: string,
  options?: { source?: string }
): Promise<{ inserted: number; updated: number }> => {
  try {
    const { valid, errors } = validateImportRows(clients);

    if (errors.length > 0) {
      const firstErrors = errors.slice(0, 5).map((e) => `Linha ${e.index}: ${e.message}`).join("\n");
      throw new Error(`Dados inválidos encontrados:\n${firstErrors}${errors.length > 5 ? `\n... e mais ${errors.length - 5} erros` : ""}`);
    }

    const today = new Date().toISOString().slice(0, 10);
    const records = valid.map((c) => {
      const { status_raw, ...rest } = c as any;
      return {
        ...rest,
        cpf: cleanCPF(rest.cpf),
        data_vencimento: rest.data_vencimento || today,
        operator_id: operatorId,
      };
    });

    const externalIds = records.map((r) => r.external_id).filter(Boolean);
    const cpfs = records.map((r) => r.cpf).filter(Boolean);

    let existingMap = new Map<string, any>();

    if (externalIds.length > 0) {
      const { data: existing } = await supabase
        .from("clients")
        .select("*")
        .in("external_id", externalIds)
        .limit(5000);
      (existing || []).forEach((e: any) => {
        if (e.external_id) existingMap.set(e.external_id, e);
      });
    } else if (cpfs.length > 0) {
      const uniqueCpfs = [...new Set(cpfs)];
      for (let i = 0; i < uniqueCpfs.length; i += 100) {
        const batch = uniqueCpfs.slice(i, i + 100);
        const { data: existing } = await supabase
          .from("clients")
          .select("*")
          .in("cpf", batch)
          .limit(5000);
        (existing || []).forEach((e: any) => {
          existingMap.set(e.cpf, e);
        });
      }
    }

    let totalInserted = 0;
    let totalUpdated = 0;
    const changeLogs: any[] = [];

    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      batch.forEach((record) => {
        const key = record.external_id || record.cpf;
        const existing = existingMap.get(key);
        if (existing) {
          const changes: Record<string, { old: any; new: any }> = {};
          const fieldsToCompare = [
            "nome_completo", "phone", "phone2", "phone3", "email",
            "valor_parcela", "valor_pago", "status", "data_vencimento",
            "endereco", "cidade", "uf", "cep", "credor", "status_cobranca_id",
          ];
          fieldsToCompare.forEach((field) => {
            const oldVal = existing[field];
            const newVal = record[field];
            if (newVal !== undefined && newVal !== null && String(oldVal) !== String(newVal)) {
              changes[field] = { old: oldVal, new: newVal };
            }
          });
          if (Object.keys(changes).length > 0) {
            changeLogs.push({
              tenant_id: existing.tenant_id,
              client_id: existing.id,
              source: options?.source || "import",
              changes,
            });
            totalUpdated++;
          }
        } else {
          totalInserted++;
        }
      });

      if (externalIds.length > 0) {
        const { error } = await supabase
          .from("clients")
          .upsert(batch as any, { onConflict: "external_id,tenant_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(batch as any);
        if (error) throw error;
      }
    }

    if (changeLogs.length > 0) {
      for (let i = 0; i < changeLogs.length; i += 100) {
        const logBatch = changeLogs.slice(i, i + 100);
        await supabase.from("client_update_logs").insert(logBatch as any);
      }
    }

    // Consolidate client_profiles
    try {
      const cpfMap = new Map<string, any>();
      for (const r of records) {
        const c = cleanCPF(r.cpf);
        if (!cpfMap.has(c)) cpfMap.set(c, r);
        else {
          const ex = cpfMap.get(c);
          for (const f of ["nome_completo", "email", "phone", "phone2", "phone3", "cep", "endereco", "bairro", "cidade", "uf"]) {
            if (!ex[f] && (r as any)[f]) ex[f] = (r as any)[f];
          }
        }
      }
      const tenantId = records[0]?.tenant_id;
      if (tenantId) {
        for (const [cpfVal, rec] of cpfMap) {
          await upsertClientProfile(tenantId, cpfVal, {
            nome_completo: rec.nome_completo || "",
            email: rec.email || "",
            phone: rec.phone || "",
            cep: rec.cep || "",
            endereco: rec.endereco || "",
            bairro: rec.bairro || "",
            cidade: rec.cidade || "",
            uf: rec.uf || "",
          }, options?.source || "import");
        }
      }
    } catch (profileErr) {
      logger.error(MODULE, "bulkCreate_profiles", profileErr);
    }

    logger.info(MODULE, "bulkCreate", { inserted: totalInserted, updated: totalUpdated, total: records.length });
    return { inserted: totalInserted, updated: totalUpdated };
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export interface GroupedClient {
  representative_id: string;
  cpf: string;
  nome_completo: string;
  credor: string;
  phone: string | null;
  email: string | null;
  data_vencimento: string;
  valor_total: number;
  valor_pago_total: number;
  parcelas_count: number;
  propensity_score: number | null;
  status_cobranca_id: string | null;
  status: string;
  debtor_profile: string | null;
  operator_id: string | null;
  external_id: string | null;
  all_ids: string[];
  total_count: number;
  // Aliases for backward compat
  id: string;
  valor_parcela: number;
  allIds: string[];
}

export interface CarteiraFilters {
  search?: string;
  credor?: string;
  dateFrom?: string;
  dateTo?: string;
  statusCobrancaId?: string;
  tipoDevedorId?: string;
  tipoDividaId?: string;
  scoreRange?: string;
  debtorProfile?: string;
  operatorId?: string;
  semAcordo?: boolean;
  cadastroDe?: string;
  cadastroAte?: string;
  semWhatsapp?: boolean;
  primeiraParcelaDe?: string;
  primeiraParcelaAte?: string;
}

export const fetchAllCarteiraIds = async (
  tenantId: string,
  filters: CarteiraFilters = {},
  sortField = "created_at",
  sortDir = "desc"
): Promise<string[]> => {
  try {
    if (!tenantId) throw new Error("tenant_id é obrigatório");

    let scoreMin: number | null = null;
    let scoreMax: number | null = null;
    if (filters.scoreRange) {
      const ranges = filters.scoreRange.split(",");
      let min = 100, max = 0;
      for (const r of ranges) {
        if (r === "bom") { min = Math.min(min, 75); max = Math.max(max, 100); }
        if (r === "medio") { min = Math.min(min, 50); max = Math.max(max, 74); }
        if (r === "ruim") { min = Math.min(min, 0); max = Math.max(max, 49); }
      }
      if (ranges.length > 0) { scoreMin = min; scoreMax = max; }
    }

    const allIds: string[] = [];
    let page = 1;
    const pageSize = 1000;

    while (true) {
      const params: Record<string, any> = {
        _tenant_id: tenantId,
        _page: page,
        _page_size: pageSize,
        _sort_field: sortField,
        _sort_dir: sortDir,
      };

      if (filters.search?.trim()) params._search = filters.search.trim();
      if (filters.credor && filters.credor !== "todos") params._credor = filters.credor;
      if (filters.dateFrom) params._date_from = filters.dateFrom;
      if (filters.dateTo) params._date_to = filters.dateTo;
      if (filters.statusCobrancaId) params._status_cobranca_ids = filters.statusCobrancaId.split(",").filter(Boolean);
      if (filters.tipoDevedorId) params._tipo_devedor_ids = filters.tipoDevedorId.split(",").filter(Boolean);
      if (filters.tipoDividaId) params._tipo_divida_ids = filters.tipoDividaId.split(",").filter(Boolean);
      if (filters.debtorProfile) params._debtor_profiles = filters.debtorProfile.split(",").filter(Boolean);
      if (filters.operatorId) params._operator_id = filters.operatorId;
      if (filters.semAcordo) params._sem_acordo = true;
      if (filters.cadastroDe) params._cadastro_de = filters.cadastroDe;
      if (filters.cadastroAte) params._cadastro_ate = filters.cadastroAte;
      if (filters.semWhatsapp) params._sem_whatsapp = true;
      if (filters.primeiraParcelaDe) params._primeira_parcela_de = filters.primeiraParcelaDe;
      if (filters.primeiraParcelaAte) params._primeira_parcela_ate = filters.primeiraParcelaAte;
      if (scoreMin !== null) params._score_min = scoreMin;
      if (scoreMax !== null) params._score_max = scoreMax;

      const { data, error } = await supabase.rpc("get_carteira_grouped" as any, params);
      if (error) throw error;

      const rows = (data || []) as any[];
      for (const r of rows) {
        const ids = r.all_ids || [r.representative_id];
        for (const id of ids) allIds.push(id);
      }

      if (rows.length < pageSize) break;
      page++;
    }

    logger.info(MODULE, "fetchAllCarteiraIds", { total: allIds.length });
    return allIds;
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

/**
 * Fetches ALL grouped clients matching filters (paginated loop).
 * Used when selectAllFiltered is true and we need full client data for bulk actions.
 */
export const fetchAllCarteiraClients = async (
  tenantId: string,
  filters: CarteiraFilters = {},
  sortField = "created_at",
  sortDir = "desc"
): Promise<GroupedClient[]> => {
  try {
    if (!tenantId) throw new Error("tenant_id é obrigatório");

    let scoreMin: number | null = null;
    let scoreMax: number | null = null;
    if (filters.scoreRange) {
      const ranges = filters.scoreRange.split(",");
      let min = 100, max = 0;
      for (const r of ranges) {
        if (r === "bom") { min = Math.min(min, 75); max = Math.max(max, 100); }
        if (r === "medio") { min = Math.min(min, 50); max = Math.max(max, 74); }
        if (r === "ruim") { min = Math.min(min, 0); max = Math.max(max, 49); }
      }
      if (ranges.length > 0) { scoreMin = min; scoreMax = max; }
    }

    const allClients: GroupedClient[] = [];
    let page = 1;
    const pageSize = 1000;

    while (true) {
      const params: Record<string, any> = {
        _tenant_id: tenantId,
        _page: page,
        _page_size: pageSize,
        _sort_field: sortField,
        _sort_dir: sortDir,
      };

      if (filters.search?.trim()) params._search = filters.search.trim();
      if (filters.credor && filters.credor !== "todos") params._credor = filters.credor;
      if (filters.dateFrom) params._date_from = filters.dateFrom;
      if (filters.dateTo) params._date_to = filters.dateTo;
      if (filters.statusCobrancaId) params._status_cobranca_ids = filters.statusCobrancaId.split(",").filter(Boolean);
      if (filters.tipoDevedorId) params._tipo_devedor_ids = filters.tipoDevedorId.split(",").filter(Boolean);
      if (filters.tipoDividaId) params._tipo_divida_ids = filters.tipoDividaId.split(",").filter(Boolean);
      if (filters.debtorProfile) params._debtor_profiles = filters.debtorProfile.split(",").filter(Boolean);
      if (filters.operatorId) params._operator_id = filters.operatorId;
      if (filters.semAcordo) params._sem_acordo = true;
      if (filters.cadastroDe) params._cadastro_de = filters.cadastroDe;
      if (filters.cadastroAte) params._cadastro_ate = filters.cadastroAte;
      if (filters.semWhatsapp) params._sem_whatsapp = true;
      if (filters.primeiraParcelaDe) params._primeira_parcela_de = filters.primeiraParcelaDe;
      if (filters.primeiraParcelaAte) params._primeira_parcela_ate = filters.primeiraParcelaAte;
      if (scoreMin !== null) params._score_min = scoreMin;
      if (scoreMax !== null) params._score_max = scoreMax;

      const { data, error } = await supabase.rpc("get_carteira_grouped" as any, params);
      if (error) throw error;

      const rows = (data || []) as any[];
      for (const r of rows) {
        allClients.push({
          ...r,
          id: r.representative_id,
          valor_parcela: Number(r.valor_total),
          allIds: r.all_ids || [r.representative_id],
          propensity_score: r.propensity_score || null,
        });
      }

      if (rows.length < pageSize) break;
      page++;
    }

    logger.info(MODULE, "fetchAllCarteiraClients", { total: allClients.length });
    return allClients;
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};

export const fetchCarteiraGrouped = async (
  tenantId: string,
  filters: CarteiraFilters = {},
  page = 1,
  pageSize = 50,
  sortField = "created_at",
  sortDir = "desc"
): Promise<{ data: GroupedClient[]; count: number }> => {
  try {
    if (!tenantId) throw new Error("tenant_id é obrigatório");
    const end = logger.timed(MODULE, "fetchCarteiraGrouped");

    // Parse score range into min/max
    let scoreMin: number | null = null;
    let scoreMax: number | null = null;
    if (filters.scoreRange) {
      const ranges = filters.scoreRange.split(",");
      let min = 100, max = 0;
      for (const r of ranges) {
        if (r === "bom") { min = Math.min(min, 75); max = Math.max(max, 100); }
        if (r === "medio") { min = Math.min(min, 50); max = Math.max(max, 74); }
        if (r === "ruim") { min = Math.min(min, 0); max = Math.max(max, 49); }
      }
      if (ranges.length > 0) { scoreMin = min; scoreMax = max; }
    }

    const params: Record<string, any> = {
      _tenant_id: tenantId,
      _page: page,
      _page_size: pageSize,
      _sort_field: sortField,
      _sort_dir: sortDir,
    };

    if (filters.search?.trim()) params._search = filters.search.trim();
    if (filters.credor && filters.credor !== "todos") params._credor = filters.credor;
    if (filters.dateFrom) params._date_from = filters.dateFrom;
    if (filters.dateTo) params._date_to = filters.dateTo;
    if (filters.statusCobrancaId) params._status_cobranca_ids = filters.statusCobrancaId.split(",").filter(Boolean);
    if (filters.tipoDevedorId) params._tipo_devedor_ids = filters.tipoDevedorId.split(",").filter(Boolean);
    if (filters.tipoDividaId) params._tipo_divida_ids = filters.tipoDividaId.split(",").filter(Boolean);
    if (filters.debtorProfile) params._debtor_profiles = filters.debtorProfile.split(",").filter(Boolean);
    if (filters.operatorId) params._operator_id = filters.operatorId;
    if (filters.semAcordo) params._sem_acordo = true;
    if (filters.cadastroDe) params._cadastro_de = filters.cadastroDe;
    if (filters.cadastroAte) params._cadastro_ate = filters.cadastroAte;
    if (filters.semWhatsapp) params._sem_whatsapp = true;
    if (scoreMin !== null) params._score_min = scoreMin;
    if (scoreMax !== null) params._score_max = scoreMax;

    const { data, error } = await supabase.rpc("get_carteira_grouped" as any, params);
    if (error) throw error;

    const rows = (data || []) as any[];
    const count = rows.length > 0 ? Number(rows[0].total_count) : 0;

    const mapped: GroupedClient[] = rows.map((r: any) => ({
      ...r,
      id: r.representative_id,
      valor_parcela: Number(r.valor_total),
      allIds: r.all_ids || [r.representative_id],
      propensity_score: r.propensity_score || null,
    }));

    end({ tenant_id: tenantId, count: mapped.length, total: count, page });
    return { data: mapped, count };
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};
