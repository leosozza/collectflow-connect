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

interface AutocloseSettings {
  enabled?: boolean;
  inactivity_hours?: number;
  applies_to_statuses?: string[];
  applies_to_official?: boolean;
  applies_to_unofficial?: boolean;
}

async function ensureAutoCloseDisposition(
  supabase: any,
  tenantId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("call_disposition_types")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("key", "auto_close")
    .eq("channel", "whatsapp")
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("call_disposition_types")
    .insert({
      tenant_id: tenantId,
      key: "auto_close",
      label: "Fechamento automático",
      channel: "whatsapp",
      color: "#94a3b8",
      group_name: "Sistema",
      behavior: "system",
      impact: "neutral",
      active: true,
      sort_order: 999,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[autoclose] failed creating disposition:", error);
    return null;
  }
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let totalClosed = 0;
  const tenantsProcessed: { tenant_id: string; closed: number }[] = [];

  try {
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id, settings");

    for (const t of tenants || []) {
      const settings = (t.settings as Record<string, any>) || {};
      const ac: AutocloseSettings = settings.whatsapp_autoclose || {};
      if (!ac.enabled) continue;

      const hours = Math.max(1, Number(ac.inactivity_hours) || 24);
      const statuses = Array.isArray(ac.applies_to_statuses) && ac.applies_to_statuses.length > 0
        ? ac.applies_to_statuses
        : ["open"];
      const applyOfficial = ac.applies_to_official !== false;
      const applyUnofficial = ac.applies_to_unofficial !== false;

      const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();

      // Buscar conversas elegíveis
      const { data: convs, error: convErr } = await supabase
        .from("conversations")
        .select("id, status, instance_id, endpoint_id, client_id, channel_type, last_interaction_at, last_message_at")
        .eq("tenant_id", t.id)
        .in("status", statuses)
        .lt("last_interaction_at", cutoff);

      if (convErr) {
        console.error(`[autoclose] tenant=${t.id} fetch error:`, convErr);
        continue;
      }
      if (!convs || convs.length === 0) {
        tenantsProcessed.push({ tenant_id: t.id, closed: 0 });
        continue;
      }

      // Filtrar por oficial/não-oficial via instância
      const instanceIds = Array.from(
        new Set(convs.map((c) => c.endpoint_id || c.instance_id).filter(Boolean))
      );
      const { data: instances } = instanceIds.length
        ? await supabase
            .from("whatsapp_instances")
            .select("id, provider_category")
            .in("id", instanceIds)
        : { data: [] as any[] };
      const instMap = new Map<string, string>();
      (instances || []).forEach((i: any) =>
        instMap.set(i.id, (i.provider_category || "").toLowerCase())
      );

      const eligible = convs.filter((c) => {
        const iid = c.endpoint_id || c.instance_id;
        const cat = iid ? instMap.get(iid) || "" : "";
        const isOfficial = cat.startsWith("official");
        if (isOfficial && !applyOfficial) return false;
        if (!isOfficial && !applyUnofficial) return false;
        return true;
      });

      if (eligible.length === 0) {
        tenantsProcessed.push({ tenant_id: t.id, closed: 0 });
        continue;
      }

      const dispId = await ensureAutoCloseDisposition(supabase, t.id);

      let closedThisTenant = 0;
      for (const c of eligible) {
        // Fechar
        const { error: upErr } = await supabase
          .from("conversations")
          .update({ status: "closed" })
          .eq("id", c.id);
        if (upErr) {
          console.error(`[autoclose] failed closing ${c.id}:`, upErr);
          continue;
        }

        // Atribuir disposição auto_close
        if (dispId) {
          await supabase
            .from("conversation_disposition_assignments")
            .insert({
              conversation_id: c.id,
              disposition_type_id: dispId,
              assigned_by: null,
            })
            .then(() => null, () => null);
        }

        // client_event
        if (c.client_id) {
          try {
            const { data: client } = await supabase
              .from("clients")
              .select("cpf")
              .eq("id", c.client_id)
              .single();
            if (client?.cpf) {
              await supabase.from("client_events").insert({
                tenant_id: t.id,
                client_id: c.client_id,
                client_cpf: client.cpf,
                event_source: "system",
                event_type: "conversation_auto_closed",
                event_channel: c.channel_type || "whatsapp",
                event_value: `Inatividade > ${hours}h`,
                metadata: {
                  conversation_id: c.id,
                  inactivity_hours: hours,
                  last_interaction_at: c.last_interaction_at,
                },
              });
            }
          } catch (e) {
            console.warn(`[autoclose] client_event skipped for ${c.id}:`, e);
          }
        }

        closedThisTenant++;
      }

      totalClosed += closedThisTenant;
      tenantsProcessed.push({ tenant_id: t.id, closed: closedThisTenant });
    }

    return jsonResp({ success: true, total_closed: totalClosed, tenants: tenantsProcessed });
  } catch (err) {
    console.error("[whatsapp-autoclose-runner] error:", err);
    return jsonResp({ error: "Erro interno" }, 500);
  }
});
