import { supabase } from "@/integrations/supabase/client";

export const tenantSetupService = {
  async markStepManually(tenantId: string, stepId: string, value: boolean) {
    const { data: current } = await supabase
      .from("tenants")
      .select("setup_steps_state")
      .eq("id", tenantId)
      .maybeSingle();
    const state = ((current?.setup_steps_state as any) || {}) as Record<string, boolean>;
    if (value) state[stepId] = true;
    else delete state[stepId];
    const { error } = await supabase
      .from("tenants")
      .update({ setup_steps_state: state })
      .eq("id", tenantId);
    if (error) throw error;
  },

  async completeSetup(tenantId: string) {
    const { error } = await supabase
      .from("tenants")
      .update({ setup_completed_at: new Date().toISOString() })
      .eq("id", tenantId);
    if (error) throw error;
  },

  async resetSetup(tenantId: string) {
    const { error } = await supabase
      .from("tenants")
      .update({ setup_completed_at: null })
      .eq("id", tenantId);
    if (error) throw error;
  },
};
