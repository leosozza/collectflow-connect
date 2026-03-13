import { supabase } from "@/integrations/supabase/client";

export interface CRMCustomField {
  id: string;
  entity_type: string;
  field_key: string;
  field_label: string;
  field_type: string;
  options: any[];
  is_required: boolean;
  is_visible_in_list: boolean;
  position: number;
  is_active: boolean;
  created_at: string;
}

export const fetchCRMCustomFields = async (entityType?: string): Promise<CRMCustomField[]> => {
  let query = supabase.from("crm_custom_fields").select("*").eq("is_active", true).order("position");
  if (entityType) query = query.eq("entity_type", entityType);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as CRMCustomField[];
};

export const createCRMCustomField = async (field: Partial<CRMCustomField>) => {
  const { error } = await supabase.from("crm_custom_fields").insert(field as any);
  if (error) throw error;
};

export const updateCRMCustomField = async (id: string, updates: Partial<CRMCustomField>) => {
  const { id: _, created_at, ...rest } = updates as any;
  const { error } = await supabase.from("crm_custom_fields").update(rest).eq("id", id);
  if (error) throw error;
};

export const deleteCRMCustomField = async (id: string) => {
  const { error } = await supabase.from("crm_custom_fields").update({ is_active: false } as any).eq("id", id);
  if (error) throw error;
};
