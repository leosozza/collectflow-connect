import { supabase } from "@/integrations/supabase/client";
import { addMonths } from "date-fns";
import { validateClientData, validateImportRows } from "@/lib/validations";

export interface Client {
  id: string;
  operator_id: string | null;
  credor: string;
  nome_completo: string;
  cpf: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago: number;
  quebra: number;
  data_vencimento: string;
  status: "pendente" | "pago" | "quebrado";
  created_at: string;
  updated_at: string;
}

export interface ClientFormData {
  credor: string;
  nome_completo: string;
  cpf: string;
  numero_parcela: number;
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

  const { data: result, error } = await supabase
    .from("clients")
    .insert({
      ...validated,
      operator_id: operatorId,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return result as Client;
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
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
};

export const markAsPaid = async (client: Client, valorPago: number, dataPagamento?: string): Promise<void> => {
  const isPaid = valorPago >= client.valor_parcela;
  const status = isPaid ? "pago" : "quebrado";

  // Update current installment
  await updateClient(client.id, {
    valor_pago: valorPago,
    status,
  });

  // Only create next installment if fully paid (not broken)
  if (isPaid) {
    const nextDate = addMonths(new Date(client.data_vencimento + "T00:00:00"), 1);
    const nextDateStr = nextDate.toISOString().split("T")[0];

    await supabase.from("clients").insert({
      operator_id: client.operator_id,
      credor: client.credor,
      nome_completo: client.nome_completo,
      cpf: client.cpf,
      numero_parcela: client.numero_parcela + 1,
      valor_parcela: client.valor_parcela,
      valor_pago: 0,
      data_vencimento: nextDateStr,
      status: "pendente",
    });
  }
};

export const markAsBroken = async (client: Client): Promise<void> => {
  await updateClient(client.id, {
    valor_pago: 0,
    status: "quebrado",
  });
};

export const bulkCreateClients = async (
  clients: Array<{
    credor: string;
    nome_completo: string;
    cpf: string;
    numero_parcela: number;
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
