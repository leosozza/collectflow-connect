import { supabase } from "@/integrations/supabase/client";
import { addMonths } from "date-fns";
import { validateClientData, validateImportRows } from "@/lib/validations";
import { logAction } from "@/services/auditService";

export interface Client {
  id: string;
  operator_id: string | null;
  credor: string;
  nome_completo: string;
  cpf: string;
  phone: string | null;
  email: string | null;
  numero_parcela: number;
  total_parcelas: number;
  valor_entrada: number;
  valor_parcela: number;
  valor_pago: number;
  quebra: number;
  data_vencimento: string;
  status: "pendente" | "pago" | "quebrado";
  created_at: string;
  updated_at: string;
  tenant_id: string | null;
}

export interface ClientFormData {
  credor: string;
  nome_completo: string;
  cpf: string;
  phone?: string;
  email?: string;
  numero_parcela: number;
  total_parcelas: number;
  valor_entrada: number;
  valor_parcela: number;
  valor_pago: number;
  data_vencimento: string;
  status: "pendente" | "pago" | "quebrado";
}

export const fetchClients = async (filters?: {
  status?: string;
  credor?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<Client[]> => {
  let query = supabase.from("clients").select("*").order("data_vencimento", { ascending: false });

  if (filters?.status && filters.status !== "todos") {
    query = query.eq("status", filters.status as "pendente" | "pago" | "quebrado");
  }
  if (filters?.credor && filters.credor !== "todos") {
    query = query.eq("credor", filters.credor);
  }
  if (filters?.dateFrom) {
    query = query.gte("data_vencimento", filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte("data_vencimento", filters.dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as Client[]) || [];
};

export const createClient = async (
  data: ClientFormData,
  operatorId: string
): Promise<Client> => {
  const validated = validateClientData(data);
  const totalParcelas = validated.total_parcelas || data.total_parcelas || 1;

  // Create all installments at once
  const valorEntrada = data.valor_entrada || 0;
  const records = [];
  for (let i = 0; i < totalParcelas; i++) {
    const date = addMonths(new Date(validated.data_vencimento + "T00:00:00"), i);
    const dateStr = date.toISOString().split("T")[0];
    const isFirst = i === 0;
    records.push({
      credor: validated.credor,
      nome_completo: validated.nome_completo,
      cpf: validated.cpf,
      phone: data.phone || null,
      email: data.email || null,
      numero_parcela: validated.numero_parcela + i,
      total_parcelas: totalParcelas,
      valor_entrada: isFirst ? valorEntrada : 0,
      valor_parcela: isFirst ? valorEntrada : validated.valor_parcela,
      valor_pago: isFirst ? validated.valor_pago : 0,
      data_vencimento: dateStr,
      status: isFirst ? validated.status : "pendente" as const,
      operator_id: operatorId,
    });
  }

  const { data: result, error } = await supabase
    .from("clients")
    .insert(records as any)
    .select();

  if (error) throw error;
  logAction({ action: "create", entity_type: "client", entity_id: (result as Client[])[0]?.id, details: { nome: data.nome_completo, cpf: data.cpf, parcelas: totalParcelas } });
  return (result as Client[])[0];
};

export const updateClient = async (
  id: string,
  data: Partial<ClientFormData>
): Promise<Client> => {
  // Validate the partial data against the schema (only validate provided fields)
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
  return result as Client;
};

export const deleteClient = async (id: string): Promise<void> => {
  logAction({ action: "delete", entity_type: "client", entity_id: id });
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
};

export const markAsPaid = async (client: Client, valorPago: number, dataPagamento?: string): Promise<void> => {
  const isPaid = valorPago >= client.valor_parcela;
  const status = isPaid ? "pago" : "quebrado";

  await updateClient(client.id, { valor_pago: valorPago, status });
  logAction({ action: "payment", entity_type: "client", entity_id: client.id, details: { nome: client.nome_completo, valor: valorPago, status } });

  if (!isPaid) {
    await removeFutureInstallments(client);
  }
};

export const markAsBroken = async (client: Client): Promise<void> => {
  await updateClient(client.id, { valor_pago: 0, status: "quebrado" });
  logAction({ action: "break", entity_type: "client", entity_id: client.id, details: { nome: client.nome_completo } });
  await removeFutureInstallments(client);
};

/** Remove all future pending installments for a client (same CPF, credor, operator) */
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
    numero_parcela: number;
    valor_entrada: number;
    valor_parcela: number;
    valor_pago: number;
    data_vencimento: string;
    status: "pendente" | "pago" | "quebrado";
  }>,
  operatorId: string
): Promise<void> => {
  // Validate all rows before inserting
  const { valid, errors } = validateImportRows(clients);

  if (errors.length > 0) {
    const firstErrors = errors.slice(0, 5).map((e) => `Linha ${e.index}: ${e.message}`).join("\n");
    throw new Error(`Dados inválidos encontrados:\n${firstErrors}${errors.length > 5 ? `\n... e mais ${errors.length - 5} erros` : ""}`);
  }

  const records = valid.map((c) => ({
    ...c,
    operator_id: operatorId,
  }));

  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from("clients").insert(batch as any);
    if (error) throw error;
  }
};
