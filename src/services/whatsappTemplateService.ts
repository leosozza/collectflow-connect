import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppTemplate {
  id: string;
  tenant_id: string;
  name: string;
  category: string;
  message_body: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const TEMPLATE_CATEGORIES = [
  { value: "cobranca", label: "Cobrança" },
  { value: "lembrete", label: "Lembrete" },
  { value: "acordo", label: "Acordo" },
  { value: "geral", label: "Geral" },
] as const;

export const TEMPLATE_VARIABLES = [
  "{{nome}}",
  "{{cpf}}",
  "{{valor_parcela}}",
  "{{data_vencimento}}",
  "{{credor}}",
];

export const SAMPLE_DATA: Record<string, string> = {
  "{{nome}}": "João Silva",
  "{{cpf}}": "123.456.789-00",
  "{{valor_parcela}}": "R$ 350,00",
  "{{data_vencimento}}": "15/03/2026",
  "{{credor}}": "Empresa Exemplo",
};

export async function fetchTemplates(
  tenantId: string,
  category?: string
): Promise<WhatsAppTemplate[]> {
  let query = supabase
    .from("whatsapp_templates" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as WhatsAppTemplate[];
}

export async function createTemplate(
  template: Omit<WhatsAppTemplate, "id" | "created_at" | "updated_at">
): Promise<WhatsAppTemplate> {
  const { data, error } = await supabase
    .from("whatsapp_templates" as any)
    .insert(template as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as WhatsAppTemplate;
}

export async function updateTemplate(
  id: string,
  updates: Partial<Omit<WhatsAppTemplate, "id" | "tenant_id" | "created_at" | "updated_at">>
): Promise<WhatsAppTemplate> {
  const { data, error } = await supabase
    .from("whatsapp_templates" as any)
    .update({ ...updates, updated_at: new Date().toISOString() } as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as WhatsAppTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_templates" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
}
