import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Interfaces ──

interface ClientEvent {
  event_type: string;
  event_source: string;
  event_channel: string | null;
  event_value: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ScoreResult {
  cpf: string;
  score: number;
  preferred_channel: string;
  suggested_queue: string;
  score_reason: string;
  score_confidence: string;
  suggested_profile: string | null;
}

// ── Helpers ──

function daysBetween(d1: Date, d2: Date): number {
  return Math.max(0, Math.floor((d2.getTime() - d1.getTime()) / 86400000));
}

const POSITIVE_CONTACT = new Set(["cpc", "answered", "completed", "connected"]);

// ── Score calculation (5-dimension additive model, 0-100) ──

function calculateScore(
  events: ClientEvent[],
  now: Date,
  clientData: { debtor_profile: string | null; data_vencimento: string | null }
): ScoreResult {
  if (events.length === 0) {
    return {
      cpf: "",
      score: 0,
      preferred_channel: "unknown",
      suggested_queue: "low_history",
      score_reason: "Sem histórico de interação",
      score_confidence: "low",
      suggested_profile: null,
    };
  }

  let lastContactDays = -1;
  let callEvents = 0, whatsappEvents = 0;
  let whatsappInbound = 0;
  let totalResponses = 0, totalOutreach = 0;
  let agreementsCreated = 0, agreementsCancelled = 0, agreementsSigned = 0;
  let paymentConfirmed = false, partialPayment = false;
  let overdueEvents = 0;
  let hasComplaints = false;

  for (const ev of events) {
    const daysAgo = daysBetween(new Date(ev.created_at), now);
    if (ev.event_channel === "call") callEvents++;
    if (ev.event_channel === "whatsapp") whatsappEvents++;

    switch (ev.event_type) {
      case "disposition": {
        const val = (ev.event_value || "").toLowerCase();
        if (POSITIVE_CONTACT.has(val) || val.includes("cpc") || val.includes("contato")) {
          if (lastContactDays < 0 || daysAgo < lastContactDays) lastContactDays = daysAgo;
        }
        totalOutreach++;
        break;
      }
      case "call": {
        const val = (ev.event_value || "").toLowerCase();
        if (val === "answered" || val === "completed" || val === "connected") {
          if (lastContactDays < 0 || daysAgo < lastContactDays) lastContactDays = daysAgo;
        }
        totalOutreach++;
        break;
      }
      case "whatsapp_inbound": {
        whatsappInbound++;
        totalResponses++;
        if (lastContactDays < 0 || daysAgo < lastContactDays) lastContactDays = daysAgo;
        break;
      }
      case "whatsapp_outbound": {
        totalOutreach++;
        break;
      }
      case "agreement_created": {
        agreementsCreated++;
        break;
      }
      case "agreement_signed":
      case "agreement_approved": {
        agreementsSigned++;
        break;
      }
      case "agreement_cancelled":
      case "agreement_overdue": {
        agreementsCancelled++;
        if (ev.event_type === "agreement_overdue") overdueEvents++;
        break;
      }
      case "payment_confirmed": {
        paymentConfirmed = true;
        const valor = Number(ev.metadata?.valor_pago || 0);
        const total = Number(ev.metadata?.valor_total || 0);
        if (valor > 0 && total > 0 && valor < total) partialPayment = true;
        break;
      }
      case "message_sent": {
        totalOutreach++;
        break;
      }
      default:
        if ((ev.event_value || "").toLowerCase().includes("reclama")) hasComplaints = true;
        break;
    }
  }

  // DIM 1: Contato (0 to +30)
  let contactScore = 0;
  if (lastContactDays >= 0) {
    if (lastContactDays <= 7) contactScore = 30;
    else if (lastContactDays <= 30) contactScore = 20;
    else contactScore = 10;
  }

  // DIM 2: Engajamento (0 to +30)
  let engagementScore = 0;
  engagementScore += Math.min(whatsappInbound * 5, 10);
  if (lastContactDays >= 0) engagementScore += 5;
  if (agreementsCreated > 0) engagementScore += 5;
  if (agreementsSigned > 0) engagementScore += 5;
  if (partialPayment) engagementScore += 5;
  if (paymentConfirmed) engagementScore += 10;
  engagementScore = Math.min(engagementScore, 30);

  // DIM 3: Histórico de pagamento (-20 to +25)
  let paymentScore = 0;
  if (paymentConfirmed && agreementsCancelled === 0) paymentScore = 25;
  else if (partialPayment && agreementsCancelled === 0) paymentScore = 15;
  else if (paymentConfirmed && agreementsCancelled > 0) paymentScore = 5;
  else if (agreementsCancelled > 0 && !paymentConfirmed) paymentScore = -20;
  else if (agreementsCreated > 0 && agreementsSigned === 0 && !paymentConfirmed) paymentScore = -5;

  // DIM 4: Perfil do devedor (-25 to +20)
  let profileScore = 0;
  const profile = clientData.debtor_profile;
  if (profile === "ocasional") profileScore = 20;
  else if (profile === "recorrente") profileScore = 5;
  else if (profile === "insatisfeito") profileScore = -10;
  else if (profile === "resistente") profileScore = -25;

  // DIM 5: Tempo de atraso (-20 to +10)
  let delayScore = 0;
  if (clientData.data_vencimento) {
    const venc = new Date(clientData.data_vencimento);
    const delayDays = daysBetween(venc, now);
    if (delayDays <= 0) delayScore = 10;
    else if (delayDays <= 30) delayScore = 10;
    else if (delayDays <= 90) delayScore = 0;
    else if (delayDays <= 180) delayScore = -10;
    else delayScore = -20;
  }

  // Final score (sum, clamp 0-100)
  const rawScore = contactScore + engagementScore + paymentScore + profileScore + delayScore;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  // preferred_channel
  let preferred_channel = "unknown";
  if (callEvents > 0 && whatsappEvents > 0) {
    preferred_channel = callEvents > whatsappEvents * 1.5 ? "call" : whatsappEvents > callEvents * 1.5 ? "whatsapp" : "mixed";
  } else if (callEvents > 0) preferred_channel = "call";
  else if (whatsappEvents > 0) preferred_channel = "whatsapp";

  // suggested_queue
  let suggested_queue: string;
  if (score >= 75) suggested_queue = "priority_high";
  else if (score >= 50) suggested_queue = "priority_medium";
  else suggested_queue = "priority_low";
  if (events.length < 3) suggested_queue = "low_history";

  // suggested_profile
  let suggested_profile: string | null = null;
  if (hasComplaints) suggested_profile = "insatisfeito";
  else if (!paymentConfirmed && totalResponses === 0 && score < 50) suggested_profile = "resistente";
  else if (overdueEvents >= 2 || agreementsCancelled >= 2) suggested_profile = "recorrente";
  else if (paymentConfirmed || agreementsSigned > 0) suggested_profile = "ocasional";

  // score_reason
  const reasons: string[] = [];
  if (events.length < 3) reasons.push("Histórico limitado");
  if (contactScore >= 20) reasons.push("Contato recente");
  if (engagementScore >= 20) reasons.push("Bom engajamento");
  if (whatsappInbound > 0 && engagementScore < 20) reasons.push("Respondeu no WhatsApp");
  if (paymentScore >= 25) reasons.push("Pagamentos em dia");
  if (partialPayment && paymentScore < 25) reasons.push("Pagamento parcial realizado");
  if (paymentScore <= -20) reasons.push("Quebra de acordo");
  if (paymentScore === -5) reasons.push("Acordo criado sem formalização");
  if (profileScore <= -10) reasons.push(`Perfil: ${profile}`);
  if (delayScore <= -10) reasons.push("Atraso prolongado");
  const score_reason = reasons.length > 0 ? reasons.slice(0, 3).join("; ") : "Score calculado com base no histórico";

  // score_confidence
  let score_confidence = "low";
  if (events.length >= 10) score_confidence = "high";
  else if (events.length >= 4) score_confidence = "medium";

  return { cpf: "", score, preferred_channel, suggested_queue, score_reason, score_confidence, suggested_profile };
}

// ── Resolve tenant: supports User JWT or Service Role + tenant_id ──

async function resolveTenantId(
  req: Request,
  authHeader: string,
  body: Record<string, unknown>
): Promise<{ tenantId: string; supabase: ReturnType<typeof createClient> } | Response> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const token = authHeader.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Mode 1: Service Role (from DB trigger) — tenant_id must be in body
  if (token === serviceRoleKey) {
    const tenantId = body.tenant_id as string;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id required for service role calls" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return { tenantId, supabase };
  }

  // Mode 2: User JWT (from frontend)
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userErr } = await anonClient.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) {
    return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return { tenantId: tenantUser.tenant_id, supabase };
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const resolved = await resolveTenantId(req, authHeader, body);

    // If resolved is a Response, it's an error — return it
    if (resolved instanceof Response) return resolved;

    const { tenantId, supabase } = resolved;
    const { cpf } = body;
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

    // In batch mode (no cpf), first get CPFs that have events, then fetch their client data
    let targetCpfs: string[] = [];

    if (cpf) {
      targetCpfs = [cpf.replace(/\D/g, "")];
    } else {
      // Get distinct CPFs from recent events for this tenant
      const { data: eventCpfs } = await supabase
        .from("client_events")
        .select("client_cpf")
        .eq("tenant_id", tenantId)
        .gte("created_at", ninetyDaysAgo.toISOString());

      if (eventCpfs && eventCpfs.length > 0) {
        const cpfSet = new Set<string>();
        for (const e of eventCpfs) {
          const clean = e.client_cpf.replace(/\D/g, "");
          if (clean.length >= 11) cpfSet.add(clean);
        }
        targetCpfs = Array.from(cpfSet);
      }
    }

    if (targetCpfs.length === 0) {
      return new Response(JSON.stringify({ scores: [], message: "Nenhum CPF com eventos recentes" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client data for target CPFs in batches
    const cpfDataMap = new Map<string, { debtor_profile: string | null; data_vencimento: string | null }>();
    const CLIENT_BATCH = 50;

    for (let i = 0; i < targetCpfs.length; i += CLIENT_BATCH) {
      const batch = targetCpfs.slice(i, i + CLIENT_BATCH);
      const cpfPatterns = batch.flatMap(c => {
        const formatted = c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        return [c, formatted];
      });

      const { data: clients } = await supabase
        .from("clients")
        .select("cpf, debtor_profile, data_vencimento")
        .eq("tenant_id", tenantId)
        .in("cpf", cpfPatterns);

      for (const c of (clients || [])) {
        const clean = c.cpf.replace(/\D/g, "");
        if (!cpfDataMap.has(clean)) {
          cpfDataMap.set(clean, { debtor_profile: c.debtor_profile, data_vencimento: c.data_vencimento });
        } else {
          const existing = cpfDataMap.get(clean)!;
          if (!existing.data_vencimento || (c.data_vencimento && c.data_vencimento < existing.data_vencimento)) {
            existing.data_vencimento = c.data_vencimento;
          }
          if (!existing.debtor_profile && c.debtor_profile) {
            existing.debtor_profile = c.debtor_profile;
          }
        }
      }
    }

    const uniqueCpfs = targetCpfs;

    const allScores: ScoreResult[] = [];
    const BATCH = 25;

    for (let i = 0; i < uniqueCpfs.length; i += BATCH) {
      const batch = uniqueCpfs.slice(i, i + BATCH);

      const cpfPatterns = batch.flatMap(c => {
        const formatted = c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        return [c, formatted];
      });

      const { data: events, error: evError } = await supabase
        .from("client_events")
        .select("client_cpf, event_type, event_source, event_channel, event_value, metadata, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", ninetyDaysAgo.toISOString())
        .in("client_cpf", cpfPatterns)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (evError) {
        console.error(`[calculate-propensity] Events query error batch ${i}:`, evError.message);
      }

      const eventsByCpf: Record<string, ClientEvent[]> = {};
      for (const ev of (events || [])) {
        const key = ev.client_cpf.replace(/\D/g, "");
        if (!eventsByCpf[key]) eventsByCpf[key] = [];
        eventsByCpf[key].push(ev as ClientEvent);
      }

      for (const cleanCpf of batch) {
        const cpfEvents = eventsByCpf[cleanCpf] || [];
        const clientData = cpfDataMap.get(cleanCpf) || { debtor_profile: null, data_vencimento: null };
        const result = calculateScore(cpfEvents, now, clientData);
        result.cpf = cleanCpf;
        allScores.push(result);
      }
    }

    // Update clients in DB
    for (const s of allScores) {
      const formatted = s.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      const updateData: Record<string, unknown> = {
        propensity_score: s.score,
        preferred_channel: s.preferred_channel,
        suggested_queue: s.suggested_queue,
        score_reason: s.score_reason,
        score_confidence: s.score_confidence,
        score_updated_at: now.toISOString(),
      };
      if (s.suggested_profile) {
        updateData.suggested_profile = s.suggested_profile;
      }
      await supabase.from("clients").update(updateData)
        .eq("tenant_id", tenantId)
        .or(`cpf.eq.${s.cpf},cpf.eq.${formatted}`);
    }

    return new Response(JSON.stringify({
      scores: allScores.map(s => ({ cpf: s.cpf, score: s.score, suggested_profile: s.suggested_profile })),
      count: allScores.length,
      source: "operational_v2",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[calculate-propensity] ERROR:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
