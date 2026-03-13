import { supabase } from "@/integrations/supabase/client";
import { validateClientData, validateImportRows } from "@/lib/validations";
import { logAction } from "@/services/auditService";
import { logger } from "@/lib/logger";
import { handleServiceError } from "@/lib/errorHandler";
import { generateInstallments } from "@/lib/installmentUtils";

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

export const fetchClients = async (filters?: {
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
}): Promise<Client[]> => {
  try {
    let query = supabase.from("clients").select("*").order("data_vencimento", { ascending: false });

    if (filters?.search?.trim()) {
      const term = filters.search.trim();
      const cleanTerm = term.replace(/\D/g, "");
      if (cleanTerm.length > 0 && cleanTerm === term.replace(/[.\-\/\s]/g, "")) {
        query = query.or(`nome_completo.ilike.%${term}%,cpf.ilike.%${cleanTerm}%`);
      } else {
        query = query.or(`nome_completo.ilike.%${term}%,cpf.ilike.%${term}%`);
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
    if (filters?.tipoDevedorId) query = query.eq("tipo_devedor_id", filters.tipoDevedorId);
    if (filters?.tipoDividaId) query = query.eq("tipo_divida_id", filters.tipoDividaId);
    if (filters?.statusCobrancaId) query = query.eq("status_cobranca_id", filters.statusCobrancaId);

    const { data, error } = await query;
    if (error) throw error;
    logger.info(MODULE, "fetch", { count: data?.length ?? 0 });
    return (data as Client[]) || [];
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

    const records = generateInstallments({
      credor: validated.credor,
      nome_completo: validated.nome_completo,
      cpf: validated.cpf,
      phone: data.phone || null,
      email: data.email || null,
      external_id: data.external_id || null,
      numero_parcela: validated.numero_parcela,
      total_parcelas: totalParcelas,
      valor_entrada: data.valor_entrada || 0,
      valor_parcela: validated.valor_parcela,
      valor_pago: validated.valor_pago,
      data_vencimento: validated.data_vencimento!,
      status: validated.status,
      operator_id: operatorId,
    });

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
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("cpf", client.cpf)
    .eq("credor", client.credor)
    .eq("status", "pendente")
    .gt("numero_parcela", client.numero_parcela);
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

    logger.info(MODULE, "bulkCreate", { inserted: totalInserted, updated: totalUpdated, total: records.length });
    return { inserted: totalInserted, updated: totalUpdated };
  } catch (error) {
    handleServiceError(error, MODULE);
  }
};
