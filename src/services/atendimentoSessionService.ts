import { supabase } from "@/integrations/supabase/client";

export type SessionChannel = "call" | "whatsapp" | "portal" | "ai_whatsapp" | "ai_voice";
export type SessionActor = "operator" | "ai" | "portal_self";

interface FindOrCreateParams {
  tenantId: string;
  clientId: string;
  clientCpf: string;
  credor?: string;
  channel: SessionChannel;
  actor?: SessionActor;
  assignedTo?: string;
  sourceConversationId?: string;
  sourceCallId?: string;
}

export async function findOrCreateSession(params: FindOrCreateParams) {
  const { tenantId, clientId, clientCpf, credor, channel, actor, assignedTo, sourceConversationId, sourceCallId } = params;

  // Try to find existing active session
  let query = supabase
    .from("atendimento_sessions" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("status", "open");

  if (credor) {
    query = query.eq("credor", credor);
  }

  const { data: existing } = await query.limit(1).maybeSingle();

  if (existing) {
    // Update current channel if different
    if ((existing as any).current_channel !== channel) {
      await updateSessionChannel((existing as any).id, channel, actor);
    }
    return existing as any;
  }

  // Create new session
  const { data: newSession, error } = await supabase
    .from("atendimento_sessions" as any)
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      client_cpf: clientCpf.replace(/\D/g, ""),
      credor: credor || null,
      status: "open",
      origin_channel: channel,
      current_channel: channel,
      origin_actor: actor || "operator",
      current_actor: actor || "operator",
      assigned_to: assignedTo || null,
      source_conversation_id: sourceConversationId || null,
      source_call_id: sourceCallId || null,
    } as any)
    .select()
    .single();

  if (error) {
    // Unique constraint violation — race condition, fetch existing
    if (error.code === "23505") {
      const { data: retry } = await query.limit(1).maybeSingle();
      if (retry) return retry as any;
    }
    throw error;
  }

  // Register atendimento_opened event
  await supabase.from("client_events").insert({
    tenant_id: tenantId,
    client_id: clientId,
    client_cpf: clientCpf.replace(/\D/g, ""),
    event_type: "atendimento_opened",
    event_source: actor || "operator",
    event_channel: channel,
    event_value: channel,
    metadata: { session_id: (newSession as any).id, origin_channel: channel },
    session_id: (newSession as any).id,
  } as any);

  return newSession as any;
}

export async function updateSessionChannel(sessionId: string, channel: SessionChannel, actor?: SessionActor) {
  const { error } = await supabase
    .from("atendimento_sessions" as any)
    .update({
      current_channel: channel,
      current_actor: actor || "operator",
    } as any)
    .eq("id", sessionId);

  if (error) throw error;

  // We don't insert channel_switched event here to avoid noise — can be added later if needed
}

export async function closeSession(sessionId: string, tenantId?: string, clientId?: string, clientCpf?: string) {
  const { error } = await supabase
    .from("atendimento_sessions" as any)
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
    } as any)
    .eq("id", sessionId);

  if (error) throw error;

  // Register atendimento_closed event if we have client info
  if (tenantId && clientCpf) {
    await supabase.from("client_events").insert({
      tenant_id: tenantId,
      client_id: clientId || null,
      client_cpf: clientCpf.replace(/\D/g, ""),
      event_type: "atendimento_closed",
      event_source: "operator",
      event_value: "closed",
      metadata: { session_id: sessionId },
      session_id: sessionId,
    } as any);
  }
}

export async function getActiveSession(tenantId: string, clientId: string, credor?: string) {
  let query = supabase
    .from("atendimento_sessions" as any)
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("status", "open");

  if (credor) {
    query = query.eq("credor", credor);
  }

  const { data } = await query.limit(1).maybeSingle();
  return (data as any) || null;
}
