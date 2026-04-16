import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResp({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return jsonResp({ error: "Unauthorized" }, 401);
  }
  const fromUserId = claimsData.claims.sub as string;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { conversationId, toUserId, reason } = await req.json();
    if (!conversationId || !toUserId) {
      return jsonResp({ error: "conversationId e toUserId são obrigatórios" }, 400);
    }

    // Resolve tenant do solicitante
    const { data: fromTu } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", fromUserId)
      .limit(1)
      .single();
    if (!fromTu) return jsonResp({ error: "Tenant não encontrado" }, 403);
    const tenantId = fromTu.tenant_id;

    // Conversa pertence ao tenant?
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("id, tenant_id, assigned_to, status, client_id, remote_phone, channel_type")
      .eq("id", conversationId)
      .eq("tenant_id", tenantId)
      .single();
    if (convErr || !conv) return jsonResp({ error: "Conversa não encontrada" }, 404);

    // Destinatário precisa pertencer ao mesmo tenant
    const { data: toTu } = await supabase
      .from("tenant_users")
      .select("user_id, role")
      .eq("user_id", toUserId)
      .eq("tenant_id", tenantId)
      .limit(1)
      .single();
    if (!toTu) return jsonResp({ error: "Operador destino não pertence ao tenant" }, 403);

    // Resolve profile_id do destinatário (assigned_to referencia profiles.id)
    const { data: toProfile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("user_id", toUserId)
      .limit(1)
      .single();
    if (!toProfile) return jsonResp({ error: "Profile do destinatário não encontrado" }, 404);

    const { data: fromProfile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("user_id", fromUserId)
      .limit(1)
      .single();

    // Desativa transferências anteriores ativas dessa conversa
    await supabase
      .from("conversation_transfers")
      .update({ is_active: false })
      .eq("conversation_id", conversationId)
      .eq("is_active", true);

    // Insere registro de transferência
    const { data: transfer, error: trfErr } = await supabase
      .from("conversation_transfers")
      .insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        from_user_id: fromProfile?.id || null,
        to_user_id: toProfile.id,
        reason: reason || null,
        is_active: true,
      })
      .select()
      .single();
    if (trfErr) {
      console.error("[transfer-conversation] insert error:", trfErr);
      return jsonResp({ error: "Falha ao registrar transferência" }, 500);
    }

    // Atualiza assigned_to da conversa
    const { error: updErr } = await supabase
      .from("conversations")
      .update({ assigned_to: toProfile.id })
      .eq("id", conversationId);
    if (updErr) {
      console.error("[transfer-conversation] update conv error:", updErr);
    }

    // Notificação para destinatário
    try {
      await supabase.from("notifications").insert({
        tenant_id: tenantId,
        user_id: toUserId,
        type: "conversation_transferred",
        title: "Conversa transferida para você",
        message: `${fromProfile?.full_name || "Um operador"} transferiu uma conversa (${conv.remote_phone}) para você${reason ? `: ${reason}` : "."}`,
        metadata: { conversation_id: conversationId, from_user_id: fromUserId },
      });
    } catch (e) {
      console.warn("[transfer-conversation] notification skipped:", e);
    }

    // client_event para timeline
    try {
      if (conv.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("cpf")
          .eq("id", conv.client_id)
          .single();
        if (client?.cpf) {
          await supabase.from("client_events").insert({
            tenant_id: tenantId,
            client_id: conv.client_id,
            client_cpf: client.cpf,
            event_source: "whatsapp",
            event_type: "conversation_transferred",
            event_channel: conv.channel_type || "whatsapp",
            event_value: `${fromProfile?.full_name || "—"} → ${toProfile.full_name || "—"}`,
            metadata: {
              conversation_id: conversationId,
              from_user_id: fromUserId,
              to_user_id: toUserId,
              reason: reason || null,
            },
          });
        }
      }
    } catch (e) {
      console.warn("[transfer-conversation] client_event skipped:", e);
    }

    return jsonResp({ success: true, transfer_id: transfer.id });
  } catch (err) {
    console.error("[transfer-conversation] error:", err);
    return jsonResp({ error: "Erro interno" }, 500);
  }
});
