import { supabase } from "@/integrations/supabase/client";

export interface FieldMapping {
  id: string;
  tenant_id: string;
  name: string;
  credor: string | null;
  source: "spreadsheet" | "api";
  mappings: Record<string, string>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const SYSTEM_FIELDS = [
  { value: "nome_completo", label: "Nome Completo", required: true },
  { value: "cpf", label: "CPF/CNPJ", required: true },
  { value: "credor", label: "Credor", required: false },
  { value: "external_id", label: "Código Devedor", required: false },
  { value: "phone", label: "Telefone 1", required: false },
  { value: "phone2", label: "Telefone 2", required: false },
  { value: "phone3", label: "Telefone 3", required: false },
  { value: "email", label: "E-mail", required: false },
  { value: "endereco", label: "Endereço", required: false },
  { value: "cidade", label: "Cidade", required: false },
  { value: "uf", label: "UF", required: false },
  { value: "cep", label: "CEP", required: false },
  { value: "numero_parcela", label: "Nº Parcela", required: false },
  { value: "valor_parcela", label: "Valor Parcela", required: false },
  { value: "valor_entrada", label: "Valor Entrada", required: false },
  { value: "valor_pago", label: "Valor Pago", required: false },
  { value: "valor_atualizado", label: "Valor Atualizado", required: false },
  { value: "data_vencimento", label: "Data Vencimento", required: true },
  { value: "data_pagamento", label: "Data Pagamento", required: false },
  { value: "status", label: "Status", required: false },
  { value: "cod_contrato", label: "Cód. Contrato", required: false },
  { value: "observacoes", label: "Observações", required: false },
  { value: "__ignorar__", label: "— Ignorar —", required: false },
] as const;

export const fetchFieldMappings = async (tenantId: string): Promise<FieldMapping[]> => {
  const { data, error } = await supabase
    .from("field_mappings")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data || []) as unknown as FieldMapping[];
};

export const createFieldMapping = async (mapping: Omit<FieldMapping, "id" | "created_at" | "updated_at">) => {
  const { data, error } = await supabase
    .from("field_mappings")
    .insert(mapping as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as FieldMapping;
};

export const updateFieldMapping = async (id: string, updates: Partial<FieldMapping>) => {
  const { id: _, created_at, updated_at, ...rest } = updates as any;
  const { data, error } = await supabase
    .from("field_mappings")
    .update(rest)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as FieldMapping;
};

export const deleteFieldMapping = async (id: string) => {
  const { error } = await supabase
    .from("field_mappings")
    .delete()
    .eq("id", id);
  if (error) throw error;
};

/**
 * Auto-detect which saved mapping best matches the given headers.
 * Returns the mapping with the highest overlap score, or null.
 */
export const autoDetectMapping = (
  headers: string[],
  savedMappings: FieldMapping[]
): FieldMapping | null => {
  if (savedMappings.length === 0) return null;

  const upperHeaders = new Set(headers.map(h => h.toUpperCase().trim()));
  let best: FieldMapping | null = null;
  let bestScore = 0;

  for (const m of savedMappings) {
    const keys = Object.keys(m.mappings);
    if (keys.length === 0) continue;
    const matches = keys.filter(k => upperHeaders.has(k.toUpperCase().trim())).length;
    const score = matches / keys.length;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }

  // Only return if at least 50% of keys match
  return bestScore >= 0.5 ? best : null;
};

/**
 * Apply a mapping to transform raw column names to system field names.
 */
export const applyMapping = (
  rawRow: Record<string, unknown>,
  mappings: Record<string, string>
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(rawRow)) {
    const upperKey = rawKey.toUpperCase().trim();
    const mapped = mappings[upperKey] || mappings[rawKey];
    if (mapped && mapped !== "__ignorar__") {
      result[mapped] = value;
    } else if (!mapped) {
      // Keep unmapped fields as-is
      result[rawKey] = value;
    }
  }
  return result;
};
