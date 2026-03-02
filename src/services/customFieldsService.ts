import { supabase } from "@/integrations/supabase/client";

export interface CustomField {
  id: string;
  tenant_id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  options: any[];
  is_active: boolean;
  created_at: string;
}

export const fetchCustomFields = async (tenantId: string): Promise<CustomField[]> => {
  const { data, error } = await supabase
    .from("custom_fields")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("field_label");
  if (error) throw error;
  return (data || []) as unknown as CustomField[];
};

export const createCustomField = async (field: {
  tenant_id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  options?: any[];
}) => {
  const { data, error } = await supabase
    .from("custom_fields")
    .insert(field as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CustomField;
};

export const updateCustomField = async (id: string, updates: Partial<CustomField>) => {
  const { id: _, created_at, tenant_id, ...rest } = updates as any;
  const { data, error } = await supabase
    .from("custom_fields")
    .update(rest)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CustomField;
};

export const deleteCustomField = async (id: string) => {
  const { error } = await supabase
    .from("custom_fields")
    .delete()
    .eq("id", id);
  if (error) throw error;
};
