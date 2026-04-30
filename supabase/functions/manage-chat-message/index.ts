/**
 * manage-chat-message
 * Edit or delete-for-recipient a previously sent WhatsApp message.
 * Body: { messageId: string, action: "delete" | "edit", newText?: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { deleteByProvider, editByProvider } from "../_shared/whatsapp-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const admin = createClient(supabaseUrl, serviceRole);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Sessão inválida" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const messageId: string = body?.messageId;
    const action: "delete" | "edit" = body?.action;
    const newText: string | undefined = body?.newText;

    console.log("[manage-chat-message] start", { messageId, action, hasNewText: !!newText });

    if (!messageId || !action) return json({ error: "messageId e action são obrigatórios" }, 400);
    if (!["delete", "edit"].includes(action)) return json({ error: "action inválida" }, 400);
    if (action === "edit" && (!newText || !newText.trim())) {
      return json({ error: "newText é obrigatório para edit" }, 400);
    }

    // Fetch message + conversation + instance + tenant settings (one round trip)
    const { data: msg, error: msgErr } = await admin
      .from("chat_messages")
      .select("id, tenant_id, conversation_id, direction, message_type, content, status, provider_message_id, external_id, created_at, metadata, deleted_for_recipient_at, original_content, edited_at")
      .eq("id", messageId)
      .maybeSingle();
    if (msgErr || !msg) return json({ error: "Mensagem não encontrada" }, 404);
    if (msg.direction !== "outbound") return json({ error: "Somente mensagens enviadas pelo operador podem ser editadas ou apagadas." }, 400);
    if (msg.status === "failed") return json({ error: "Mensagens que falharam no envio não podem ser editadas ou apagadas." }, 400);
    if (msg.deleted_for_recipient_at) return json({ error: "Esta mensagem já foi apagada para o destinatário." }, 400);

    const providerMessageId = msg.provider_message_id || msg.external_id;
    if (!providerMessageId) return json({ error: "Não foi possível localizar esta mensagem no WhatsApp para editar ou apagar." }, 400);

    // Authorization: tenant admin OR original sender
    const { data: tenantUser } = await admin
      .from("tenant_users")
      .select("role, tenant_id")
      .eq("user_id", userId)
      .eq("tenant_id", msg.tenant_id)
      .maybeSingle();
    if (!tenantUser) return json({ error: "Sem acesso a este tenant" }, 403);
    const isAdmin = tenantUser.role === "admin" || tenantUser.role === "super_admin";

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name")
      .eq("user_id", userId)
      .eq("tenant_id", msg.tenant_id)
      .maybeSingle();

    const meta = (msg.metadata || {}) as Record<string, any>;
    const sentByUserId = meta.sent_by_user_id;
    const sentByProfileId = meta.sent_by_profile_id;
    const hasAuthorshipMeta = !!sentByUserId || !!sentByProfileId;
    let isAuthor =
      (sentByUserId && sentByUserId === userId) ||
      (sentByProfileId && profile?.id && sentByProfileId === profile.id);

    // Legacy fallback: messages sent before authorship metadata existed.
    // If metadata has no authorship, allow when the conversation is currently
    // assigned to this operator (best-effort approximation for legacy rows).
    if (!isAuthor && !isAdmin && !hasAuthorshipMeta && profile?.id) {
      const { data: convForAuth } = await admin
        .from("conversations")
        .select("assigned_to")
        .eq("id", msg.conversation_id)
        .maybeSingle();
      if (convForAuth?.assigned_to && convForAuth.assigned_to === profile.id) {
        isAuthor = true;
      }
    }

    if (!isAdmin && !isAuthor) {
      return json({ error: "Você só pode editar ou apagar mensagens que você mesmo enviou." }, 403);
    }

    // Edit-only: enforce 15 min limit and text-only (WhatsApp-imposed limits)
    if (action === "edit") {
      if (msg.message_type !== "text") {
        return json({ error: "O WhatsApp permite editar apenas mensagens de texto." }, 400);
      }
      const ageMs = Date.now() - new Date(msg.created_at).getTime();
      if (ageMs > 15 * 60 * 1000) {
        return json({ error: "O WhatsApp não permite editar mensagens enviadas há mais de 15 minutos." }, 400);
      }
    }

    // Conversation + instance
    const { data: conv } = await admin
      .from("conversations")
      .select("id, remote_phone, instance_id, tenant_id")
      .eq("id", msg.conversation_id)
      .maybeSingle();
    if (!conv) return json({ error: "Conversa não encontrada" }, 404);

    const { data: inst } = await admin
      .from("whatsapp_instances")
      .select("id, instance_name, instance_url, api_key, provider")
      .eq("id", conv.instance_id)
      .maybeSingle();
    if (!inst) return json({ error: "Instância não encontrada" }, 404);

    const { data: tenant } = await admin
      .from("tenants")
      .select("settings")
      .eq("id", msg.tenant_id)
      .maybeSingle();
    const tenantSettings = (tenant?.settings as Record<string, any>) || {};

    const fallbackEvolutionUrl = Deno.env.get("EVOLUTION_API_URL") || "";
    const fallbackEvolutionKey = Deno.env.get("EVOLUTION_API_KEY") || "";
    const wuzapiUrl = Deno.env.get("WUZAPI_URL") || "";
    const wuzapiAdminToken = Deno.env.get("WUZAPI_ADMIN_TOKEN") || "";

    let providerResult;
    if (action === "delete") {
      providerResult = await deleteByProvider(
        inst as any,
        providerMessageId,
        conv.remote_phone,
        tenantSettings,
        fallbackEvolutionUrl,
        fallbackEvolutionKey,
        wuzapiUrl,
        wuzapiAdminToken,
      );
    } else {
      providerResult = await editByProvider(
        inst as any,
        providerMessageId,
        conv.remote_phone,
        newText!.trim(),
        fallbackEvolutionUrl,
        fallbackEvolutionKey,
        wuzapiUrl,
        wuzapiAdminToken,
      );
    }

    if (!providerResult.ok) {
      console.error("[manage-chat-message] provider error", {
        action,
        provider: providerResult.provider,
        httpStatus: providerResult.httpStatus,
        error: providerResult.error,
        providerMessageId,
        instanceName: inst.instance_name,
        providerBody: providerResult.result,
      });
      return json({
        error: providerResult.error || "Falha no provider",
        provider: providerResult.provider,
        httpStatus: providerResult.httpStatus,
        providerBody: providerResult.result,
      }, 502);
    }

    console.log("[manage-chat-message] provider success", {
      action,
      provider: providerResult.provider,
      messageId,
    });

    // Persist DB change
    if (action === "delete") {
      const { error: updErr } = await admin
        .from("chat_messages")
        .update({
          deleted_for_recipient_at: new Date().toISOString(),
          deleted_by: profile?.id || null,
        } as any)
        .eq("id", messageId);
      if (updErr) {
        console.error("[manage-chat-message] update delete failed", updErr);
        return json({ error: "Mensagem excluída no provider mas falhou ao gravar no banco" }, 500);
      }
    } else {
      const { error: updErr } = await admin
        .from("chat_messages")
        .update({
          edited_at: new Date().toISOString(),
          original_content: msg.original_content || msg.content,
          content: newText!.trim(),
        } as any)
        .eq("id", messageId);
      if (updErr) {
        console.error("[manage-chat-message] update edit failed", updErr);
        return json({ error: "Mensagem editada no provider mas falhou ao gravar no banco" }, 500);
      }
    }

    // Best-effort client_events log
    try {
      await admin.from("client_events").insert({
        tenant_id: msg.tenant_id,
        client_cpf: "",
        event_source: "operator",
        event_type: action === "delete" ? "message_deleted" : "message_edited",
        event_channel: "whatsapp",
        event_value: action === "delete" ? "deleted_for_recipient" : "edited",
        metadata: {
          message_id: messageId,
          conversation_id: conv.id,
          operator_user_id: userId,
          operator_name: profile?.full_name || null,
          provider: providerResult.provider,
          ...(action === "edit" ? { new_text: newText!.trim() } : {}),
        },
      } as any);
    } catch (logErr) {
      console.warn("[manage-chat-message] client_events log skipped:", logErr);
    }

    return json({ ok: true, provider: providerResult.provider });
  } catch (err) {
    console.error("[manage-chat-message] fatal", err);
    return json({ error: (err as Error).message || "Erro inesperado" }, 500);
  }
});
