import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface FieldConfig {
  id: string;
  tenant_id: string;
  field_key: string;
  label: string;
  visible: boolean;
  sort_order: number;
}

const DEFAULT_FIELDS: { field_key: string; label: string }[] = [
  { field_key: "phone", label: "Telefone 1" },
  { field_key: "phone2", label: "Telefone 2" },
  { field_key: "phone3", label: "Telefone 3" },
  { field_key: "email", label: "E-mail" },
  { field_key: "endereco", label: "Endereço" },
  { field_key: "bairro", label: "Bairro" },
  { field_key: "cidade", label: "Cidade" },
  { field_key: "uf", label: "UF" },
  { field_key: "cep", label: "CEP" },
  { field_key: "external_id", label: "Cód. Devedor" },
  { field_key: "cod_contrato", label: "Cód. Contrato" },
  { field_key: "valor_saldo", label: "Valor Saldo" },
  { field_key: "valor_atualizado", label: "Valor Atualizado" },
  { field_key: "data_vencimento", label: "Data Vencimento" },
  { field_key: "tipo_devedor", label: "Perfil Devedor" },
  { field_key: "tipo_divida", label: "Tipo de Dívida" },
  { field_key: "status_cobranca", label: "Status Cobrança" },
  { field_key: "observacoes", label: "Observações" },
];

export const atendimentoFieldsService = {
  async fetchFieldConfig(tenantId: string): Promise<FieldConfig[]> {
    const { data, error } = await (supabase
      .from("atendimento_field_config" as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true }) as any);

    if (error) {
      logger.error("Error fetching atendimento field config", error);
      throw error;
    }
    return (data as FieldConfig[]) || [];
  },

  async seedDefaultFields(tenantId: string): Promise<FieldConfig[]> {
    const rows = DEFAULT_FIELDS.map((f, i) => ({
      tenant_id: tenantId,
      field_key: f.field_key,
      label: f.label,
      visible: true,
      sort_order: i,
    }));

    const { data, error } = await (supabase
      .from("atendimento_field_config" as any)
      .upsert(rows, { onConflict: "tenant_id,field_key" })
      .select() as any);

    if (error) {
      logger.error("Error seeding default fields", error);
      throw error;
    }
    return (data as FieldConfig[]) || [];
  },

  async toggleFieldVisibility(id: string, visible: boolean): Promise<void> {
    const { error } = await (supabase
      .from("atendimento_field_config" as any)
      .update({ visible })
      .eq("id", id) as any);

    if (error) {
      logger.error("Error toggling field visibility", error);
      throw error;
    }
  },

  getDefaultFields() {
    return DEFAULT_FIELDS;
  },
};
