import { supabase } from "@/integrations/supabase/client";
import { addMonths } from "date-fns";

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
  const { data: result, error } = await supabase
    .from("clients")
    .insert({
      ...data,
      operator_id: operatorId,
    })
    .select()
    .single();

  if (error) throw error;
  return result as Client;
};

export const updateClient = async (
  id: string,
  data: Partial<ClientFormData>
): Promise<Client> => {
  const { data: result, error } = await supabase
    .from("clients")
    .update(data)
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

export const markAsPaid = async (client: Client, valorPago: number): Promise<void> => {
  const status = valorPago < client.valor_parcela ? "quebrado" : "pago";

  // Update current installment
  await updateClient(client.id, {
    valor_pago: valorPago,
    status,
  });

  // Create next installment
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
  const records = clients.map((c) => ({
    ...c,
    operator_id: operatorId,
  }));

  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from("clients").insert(batch);
    if (error) throw error;
  }
};
