import { supabase } from "@/integrations/supabase/client";

export interface DispositionAutomation {
  id: string;
  tenant_id: string;
  disposition_type: string;
  action_type: string;
  action_config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const AUTOMATION_ACTION_TYPES = {
  send_whatsapp: "Enviar WhatsApp",
  send_payment_link: "Enviar link de pagamento",
  schedule_reminder: "Agendar lembrete",
} as const;

export type AutomationActionType = keyof typeof AUTOMATION_ACTION_TYPES;

export const fetchAutomations = async (tenantId: string): Promise<DispositionAutomation[]> => {
  const { data, error } = await supabase
    .from("disposition_automations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("disposition_type", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as DispositionAutomation[];
};

export const createAutomation = async (
  automation: Omit<DispositionAutomation, "id" | "created_at" | "updated_at">
): Promise<DispositionAutomation> => {
  const { data, error } = await supabase
    .from("disposition_automations")
    .insert(automation as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DispositionAutomation;
};

export const updateAutomation = async (
  id: string,
  updates: Partial<Omit<DispositionAutomation, "id" | "tenant_id" | "created_at" | "updated_at">>
): Promise<DispositionAutomation> => {
  const { data, error } = await supabase
    .from("disposition_automations")
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as DispositionAutomation;
};

export const deleteAutomation = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("disposition_automations")
    .delete()
    .eq("id", id);
  if (error) throw error;
};

export const executeAutomations = async (
  tenantId: string,
  dispositionType: string,
  clientId: string,
  operatorId: string
): Promise<void> => {
  // Fetch active automations for this disposition type
  const { data: automations, error } = await supabase
    .from("disposition_automations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("disposition_type", dispositionType)
    .eq("is_active", true);

  if (error || !automations?.length) return;

  // Fetch client data
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (!client) return;

  for (const auto of automations as unknown as DispositionAutomation[]) {
    try {
      switch (auto.action_type) {
        case "send_whatsapp": {
          const template = auto.action_config?.template || "";
          if (template && client.phone) {
            await supabase.functions.invoke("send-bulk-whatsapp", {
              body: {
                client_ids: [clientId],
                message_template: template,
              },
            });
          }
          break;
        }
        case "schedule_reminder": {
          const delayHours = auto.action_config?.delay_hours || 24;
          const message = (auto.action_config?.message || "Lembrete: retornar contato com {{nome}}")
            .replace(/\{\{nome\}\}/g, client.nome_completo);

          await supabase.rpc("create_notification", {
            _tenant_id: tenantId,
            _user_id: operatorId,
            _title: "Lembrete de retorno",
            _message: message,
            _type: "reminder",
            _reference_type: "client",
            _reference_id: clientId,
          });
          break;
        }
        case "send_payment_link": {
          const tipo = auto.action_config?.tipo || "pix";
          await supabase.functions.invoke("negociarie-proxy", {
            body: {
              action: "create_cobranca",
              client_id: clientId,
              tipo,
            },
          });
          break;
        }
      }
    } catch (err) {
      console.error(`Automation ${auto.action_type} failed for client ${clientId}:`, err);
    }
  }
};
