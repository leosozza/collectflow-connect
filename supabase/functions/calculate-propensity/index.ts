import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Dimension weights ──
const W_CONTACT = 0.25;
const W_ENGAGEMENT = 0.20;
const W_CONVERSION = 0.35;
const W_CREDIBILITY = 0.20;

// ── Source weights (applied within each dimension) ──
const SRC_OPERATOR = 0.45;
const SRC_SYSTEM = 0.35;
const SRC_PREVENTION = 0.20;

// ── Recency multiplier ──
function recencyWeight(daysAgo: number): number {
  if (daysAgo <= 7) return 1.0;
  if (daysAgo <= 30) return 0.7;
  return 0.4;
}

function daysBetween(d1: Date, d2: Date): number {
  return Math.max(0, Math.floor((d2.getTime() - d1.getTime()) / 86400000));
}

function sourceWeight(source: string): number {
  if (source === "operator") return SRC_OPERATOR;
  if (source === "prevention") return SRC_PREVENTION;
  return SRC_SYSTEM;
}

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
}

// ── Positive contact event types ──
const POSITIVE_CONTACT = new Set(["cpc", "answered", "completed", "connected"]);
const NEGATIVE_CONTACT = new Set(["no_answer", "busy", "voicemail", "wrong_person", "failed", "abandoned"]);

function calculateScore(events: ClientEvent[], now: Date): ScoreResult {
  if (events.length === 0) {
    return { cpf: "", score: 50, preferred_channel: "unknown", suggested_queue: "low_history", score_reason: "Sem histórico suficiente para classificação", score_confidence: "low" };
  }

  // ── Counters ──
  let contactPos = 0, contactNeg = 0, contactTotal = 0;
  let engagePos = 0, engageNeg = 0, engageTotal = 0;
  let conversionPos = 0, conversionNeg = 0, conversionTotal = 0;
  let agreementsCreated = 0, agreementsCancelled = 0, agreementsSigned = 0;
  let callEvents = 0, whatsappEvents = 0;
  let whatsappInbound = 0, whatsappOutbound = 0;

  for (const ev of events) {
    const daysAgo = daysBetween(new Date(ev.created_at), now);
    const rw = recencyWeight(daysAgo);
    const sw = sourceWeight(ev.event_source);
    const weight = rw * sw;

    // Channel tracking
    if (ev.event_channel === "call") callEvents += rw;
    if (ev.event_channel === "whatsapp") whatsappEvents += rw;

    switch (ev.event_type) {
      case "disposition": {
        contactTotal += weight;
        const val = (ev.event_value || "").toLowerCase();
        if (POSITIVE_CONTACT.has(val) || val.includes("cpc") || val.includes("contato")) {
          contactPos += weight;
        } else if (NEGATIVE_CONTACT.has(val)) {
          contactNeg += weight;
        }
        // Callback scheduled = engagement positive
        if (ev.metadata?.scheduled_callback) {
          engagePos += weight;
          engageTotal += weight;
        }
        break;
      }
      case "call": {
        contactTotal += weight;
        const val = (ev.event_value || "").toLowerCase();
        if (val === "answered" || val === "completed" || val === "connected") {
          contactPos += weight;
        } else {
          contactNeg += weight;
        }
        break;
      }
      case "whatsapp_inbound": {
        whatsappInbound++;
        contactPos += weight;
        contactTotal += weight;
        engagePos += weight;
        engageTotal += weight;
        break;
      }
      case "whatsapp_outbound": {
        whatsappOutbound++;
        engageTotal += weight;
        break;
      }
      case "agreement_created": {
        agreementsCreated++;
        conversionPos += weight * 0.5;
        conversionTotal += weight;
        break;
      }
      case "agreement_approved": {
        conversionPos += weight;
        conversionTotal += weight;
        break;
      }
      case "agreement_signed": {
        agreementsSigned++;
        conversionPos += weight * 1.5;
        conversionTotal += weight;
        break;
      }
      case "agreement_cancelled":
      case "agreement_overdue": {
        agreementsCancelled++;
        conversionNeg += weight * 0.5;
        conversionTotal += weight;
        break;
      }
      case "message_sent": {
        // Prevention/rule-based messages
        engageTotal += weight;
        break;
      }
      default:
        break;
    }
  }

  // ── CONTATO dimension (0-100) ──
  let contactScore = 50;
  if (contactTotal > 0) {
    const ratio = (contactPos - contactNeg * 0.5) / contactTotal;
    contactScore = Math.max(0, Math.min(100, 50 + ratio * 50));
  }

  // ── ENGAJAMENTO dimension (0-100) ──
  let engagementScore = 50;
  if (engageTotal > 0) {
    const ratio = engagePos / engageTotal;
    engagementScore = Math.max(0, Math.min(100, ratio * 100));
  }
  // WhatsApp response ratio boosts engagement
  if (whatsappOutbound > 0 && whatsappInbound > 0) {
    const responseRatio = Math.min(whatsappInbound / whatsappOutbound, 1);
    engagementScore = Math.min(100, engagementScore + responseRatio * 20);
  }

  // ── CONVERSÃO dimension (0-100) ──
  let conversionScore = 30; // baseline lower — no conversion yet
  if (conversionTotal > 0) {
    const ratio = (conversionPos - conversionNeg * 0.3) / conversionTotal;
    conversionScore = Math.max(0, Math.min(100, 30 + ratio * 70));
  }
  if (agreementsSigned > 0) {
    conversionScore = Math.min(100, conversionScore + 15);
  }

  // ── CREDIBILIDADE dimension (0-100) ──
  let credibilityScore = 50;
  const totalFormalized = agreementsCreated;
  const totalBroken = agreementsCancelled;
  if (totalFormalized > 0) {
    credibilityScore = 70; // formalizing is positive
    if (agreementsSigned > 0) credibilityScore = 80;
    // Progressive penalty for breaks
    if (totalBroken >= 1) credibilityScore -= 10;
    if (totalBroken >= 2) credibilityScore -= 15;
    if (totalBroken >= 3) credibilityScore -= 20;
    credibilityScore = Math.max(15, credibilityScore);
  } else if (totalBroken > 0) {
    credibilityScore = 30;
  }

  // ── Final weighted score ──
  const raw = contactScore * W_CONTACT + engagementScore * W_ENGAGEMENT + conversionScore * W_CONVERSION + credibilityScore * W_CREDIBILITY;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  // ── preferred_channel ──
  let preferred_channel = "unknown";
  if (callEvents > 0 && whatsappEvents > 0) {
    preferred_channel = callEvents > whatsappEvents * 1.5 ? "call" : whatsappEvents > callEvents * 1.5 ? "whatsapp" : "mixed";
  } else if (callEvents > 0) {
    preferred_channel = "call";
  } else if (whatsappEvents > 0) {
    preferred_channel = "whatsapp";
  }

  // ── suggested_queue ──
  let suggested_queue = "low_history";
  if (events.length < 3) {
    suggested_queue = "low_history";
  } else if (contactScore < 25 && contactTotal > 3) {
    suggested_queue = "hygiene";
  } else if (totalBroken >= 2 && totalFormalized > 0) {
    suggested_queue = "renegotiation";
  } else if (conversionScore < 30 && contactScore > 50) {
    suggested_queue = "low_conversion";
  } else if (preferred_channel === "whatsapp" || (whatsappInbound > callEvents)) {
    suggested_queue = "priority_whatsapp";
  } else {
    suggested_queue = "priority_call";
  }

  // ── score_reason ──
  const reasons: string[] = [];
  if (events.length < 3) reasons.push("Sem histórico suficiente");
  if (contactScore >= 70) reasons.push("Contato produtivo recente");
  if (contactScore < 30 && contactTotal > 3) reasons.push("Muitas tentativas improdutivas");
  if (engagementScore >= 70) reasons.push("Bom engajamento");
  if (whatsappInbound > 0 && callEvents === 0) reasons.push("Responde WhatsApp, não atende ligação");
  if (agreementsSigned > 0 && totalBroken === 0) reasons.push("Acordo formalizado sem quebra");
  if (totalBroken >= 2) reasons.push(`Re-acordo com ${totalBroken} quebras`);
  if (totalFormalized === 0 && events.length > 5) reasons.push("Muitas interações sem acordo");
  const score_reason = reasons.length > 0 ? reasons.slice(0, 2).join("; ") : "Score calculado com base no histórico";

  // ── score_confidence ──
  let score_confidence = "low";
  if (events.length >= 10) score_confidence = "high";
  else if (events.length >= 4) score_confidence = "medium";

  return { cpf: "", score, preferred_channel, suggested_queue, score_reason, score_confidence };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    const tenantId = tenantUser.tenant_id;
    const body = await req.json().catch(() => ({}));
    const { cpf } = body;
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

    // Get unique CPFs to score
    let cpfsToProcess: string[] = [];

    if (cpf) {
      const clean = cpf.replace(/\D/g, "");
      cpfsToProcess = [clean];
    } else {
      // Batch: get all unique CPFs in tenant
      const { data: allClients } = await supabase
        .from("clients")
        .select("cpf")
        .eq("tenant_id", tenantId);

      if (!allClients || allClients.length === 0) {
        return new Response(JSON.stringify({ scores: [], message: "Nenhum cliente encontrado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const uniqueCpfs = new Set<string>();
      for (const c of allClients) {
        uniqueCpfs.add(c.cpf.replace(/\D/g, ""));
      }
      cpfsToProcess = Array.from(uniqueCpfs);
    }

    const allScores: ScoreResult[] = [];
    const BATCH = 100;

    for (let i = 0; i < cpfsToProcess.length; i += BATCH) {
      const batch = cpfsToProcess.slice(i, i + BATCH);

      // Fetch events for this batch of CPFs
      // We query by both clean and formatted CPF patterns
      const cpfPatterns = batch.flatMap(c => {
        const formatted = c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        return [c, formatted];
      });

      const { data: events } = await supabase
        .from("client_events")
        .select("client_cpf, event_type, event_source, event_channel, event_value, metadata, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", ninetyDaysAgo.toISOString())
        .in("client_cpf", cpfPatterns)
        .order("created_at", { ascending: false })
        .limit(5000);

      // Group events by clean CPF
      const eventsByCpf: Record<string, ClientEvent[]> = {};
      for (const ev of (events || [])) {
        const key = ev.client_cpf.replace(/\D/g, "");
        if (!eventsByCpf[key]) eventsByCpf[key] = [];
        eventsByCpf[key].push(ev as ClientEvent);
      }

      for (const cleanCpf of batch) {
        const cpfEvents = eventsByCpf[cleanCpf] || [];
        const result = calculateScore(cpfEvents, now);
        result.cpf = cleanCpf;
        allScores.push(result);
      }
    }

    // Update clients in DB
    for (const s of allScores) {
      const formatted = s.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      await supabase.from("clients").update({
        propensity_score: s.score,
        preferred_channel: s.preferred_channel,
        suggested_queue: s.suggested_queue,
        score_reason: s.score_reason,
        score_confidence: s.score_confidence,
        score_updated_at: now.toISOString(),
      })
        .eq("tenant_id", tenantId)
        .or(`cpf.eq.${s.cpf},cpf.eq.${formatted}`);
    }

    return new Response(JSON.stringify({ scores: allScores.map(s => ({ cpf: s.cpf, score: s.score })), count: allScores.length, source: "operational_v1" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[calculate-propensity] ERROR:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
