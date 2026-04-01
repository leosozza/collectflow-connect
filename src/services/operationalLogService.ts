import { supabase } from "@/integrations/supabase/client";

/**
 * Log operational events to audit_logs with entity_type = "operational".
 * Best-effort — never throws.
 */
export async function logOperationalEvent(params: {
  tenantId: string;
  module: string;
  action: string;
  success: boolean;
  durationMs?: number;
  details?: Record<string, any>;
  errorMessage?: string;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    await supabase.from("audit_logs").insert({
      tenant_id: params.tenantId,
      user_id: user.id,
      user_name: profile?.full_name || "Sistema",
      action: params.action,
      entity_type: "operational",
      details: {
        module: params.module,
        success: params.success,
        duration_ms: params.durationMs,
        error_message: params.errorMessage,
        ...params.details,
      },
    } as any);
  } catch {
    // Best-effort — silent fail
  }
}
