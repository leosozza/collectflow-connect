import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface FieldConfig {
  id: string;
  tenant_id: string;
  credor_id: string;
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
];

export const atendimentoFieldsService = {
  async fetchFieldConfig(credorId: string): Promise<FieldConfig[]> {
    const { data, error } = await (supabase
      .from("atendimento_field_config" as any)
      .select("*")
      .eq("credor_id", credorId)
      .order("sort_order", { ascending: true }) as any);

    if (error) {
      logger.error("atendimentoFieldsService", "fetchFieldConfig", error);
      throw error;
    }
    return (data as FieldConfig[]) || [];
  },

  async seedDefaultFields(
    tenantId: string,
    credorId: string,
    customFields?: { field_key: string; field_label: string }[]
  ): Promise<FieldConfig[]> {
    const allFields = [...DEFAULT_FIELDS];

    // Append custom fields with "custom:" prefix
    if (customFields && customFields.length > 0) {
      for (const cf of customFields) {
        allFields.push({
          field_key: `custom:${cf.field_key}`,
          label: cf.field_label,
        });
      }
    }

    const rows = allFields.map((f, i) => ({
      tenant_id: tenantId,
      credor_id: credorId,
      field_key: f.field_key,
      label: f.label,
      visible: true,
      sort_order: i,
    }));

    const { data, error } = await (supabase
      .from("atendimento_field_config" as any)
      .upsert(rows, { onConflict: "credor_id,field_key" })
      .select() as any);

    if (error) {
      logger.error("atendimentoFieldsService", "seedDefaultFields", error);
      throw error;
    }
    return (data as FieldConfig[]) || [];
  },

  /**
   * Sync custom fields into atendimento_field_config without resetting existing ones.
   * Inserts only missing custom fields at the end of the sort order.
   */
  async syncCustomFields(
    tenantId: string,
    credorId: string,
    customFields: { field_key: string; field_label: string }[]
  ): Promise<void> {
    if (!customFields || customFields.length === 0) return;

    // Fetch existing config to find max sort_order and existing keys
    const existing = await this.fetchFieldConfig(credorId);
    const existingKeys = new Set(existing.map((f) => f.field_key));
    let maxSort = existing.reduce((max, f) => Math.max(max, f.sort_order), -1);

    const newRows: any[] = [];
    for (const cf of customFields) {
      const key = `custom:${cf.field_key}`;
      if (!existingKeys.has(key)) {
        maxSort++;
        newRows.push({
          tenant_id: tenantId,
          credor_id: credorId,
          field_key: key,
          label: cf.field_label,
          visible: true,
          sort_order: maxSort,
        });
      }
    }

    if (newRows.length === 0) return;

    const { error } = await (supabase
      .from("atendimento_field_config" as any)
      .insert(newRows) as any);

    if (error) {
      logger.error("atendimentoFieldsService", "syncCustomFields", error);
      throw error;
    }
  },

  async toggleFieldVisibility(id: string, visible: boolean): Promise<void> {
    const { error } = await (supabase
      .from("atendimento_field_config" as any)
      .update({ visible })
      .eq("id", id) as any);

    if (error) {
      logger.error("atendimentoFieldsService", "toggleFieldVisibility", error);
      throw error;
    }
  },

  getDefaultFields() {
    return DEFAULT_FIELDS;
  },
};
