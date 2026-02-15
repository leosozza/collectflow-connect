import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Get tenant
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!tenantUser) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = tenantUser.tenant_id;
    const body = await req.json().catch(() => ({}));
    const { cpf } = body;

    // Build query for unique CPFs
    let clientsQuery = supabase
      .from("clients")
      .select("cpf, nome_completo, status, valor_parcela, valor_pago, data_vencimento, numero_parcela, total_parcelas")
      .eq("tenant_id", tenantId);

    if (cpf) {
      const clean = cpf.replace(/\D/g, "");
      clientsQuery = clientsQuery.or(`cpf.eq.${clean},cpf.eq.${clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`);
    }

    const { data: allClients, error: clientsErr } = await clientsQuery;
    if (clientsErr) throw clientsErr;
    if (!allClients || allClients.length === 0) {
      return new Response(JSON.stringify({ scores: [], message: "Nenhum cliente encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by CPF
    const byCpf: Record<string, typeof allClients> = {};
    for (const c of allClients) {
      const key = c.cpf.replace(/\D/g, "");
      if (!byCpf[key]) byCpf[key] = [];
      byCpf[key].push(c);
    }

    // Use AI to score
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const allCpfs = Object.entries(byCpf);
    const BATCH_SIZE = 50;
    const allScores: Array<{ cpf: string; score: number }> = [];

    for (let batchStart = 0; batchStart < allCpfs.length; batchStart += BATCH_SIZE) {
    const cpfsToScore = allCpfs.slice(batchStart, batchStart + BATCH_SIZE);

    const summaries = cpfsToScore.map(([cpfKey, records]) => {
      const paid = records.filter(r => r.status === "pago").length;
      const pending = records.filter(r => r.status === "pendente").length;
      const broken = records.filter(r => r.status === "quebrado").length;
      const total = records.length;
      const totalDebt = records.filter(r => r.status === "pendente").reduce((s, r) => s + Number(r.valor_parcela), 0);
      const totalPaid = records.reduce((s, r) => s + Number(r.valor_pago), 0);
      const overdue = records.filter(r => r.status === "pendente" && new Date(r.data_vencimento) < new Date()).length;
      const paymentRate = total > 0 ? Math.round((paid / total) * 100) : 0;

      return `CPF:${cpfKey}|total:${total}|paid:${paid}|pending:${pending}|broken:${broken}|overdue:${overdue}|debt:${totalDebt.toFixed(2)}|already_paid:${totalPaid.toFixed(2)}|rate:${paymentRate}%`;
    });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a debt recovery scoring engine. Given debtor summaries, return a JSON array of objects with "cpf" (string) and "score" (integer 0-100). Higher score = more likely to pay. Consider: payment history rate, overdue count, total debt size, broken agreements. Return ONLY the JSON array, no other text.`,
          },
          {
            role: "user",
            content: `Score these debtors:\n${summaries.join("\n")}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_scores",
              description: "Return propensity scores for debtors",
              parameters: {
                type: "object",
                properties: {
                  scores: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        cpf: { type: "string" },
                        score: { type: "integer", minimum: 0, maximum: 100 },
                      },
                      required: ["cpf", "score"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["scores"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_scores" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      // Fallback: calculate heuristic scores
      const fallbackScores = cpfsToScore.map(([cpfKey, records]) => {
        const paid = records.filter(r => r.status === "pago").length;
        const total = records.length;
        const broken = records.filter(r => r.status === "quebrado").length;
        const overdue = records.filter(r => r.status === "pendente" && new Date(r.data_vencimento) < new Date()).length;
        const rate = total > 0 ? paid / total : 0;
        const score = Math.max(0, Math.min(100, Math.round(rate * 60 + (1 - broken / Math.max(total, 1)) * 25 - overdue * 5 + 15)));
        return { cpf: cpfKey, score };
      });
      allScores.push(...fallbackScores);
    } else {
      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          allScores.push(...(parsed.scores || []));
        } catch {
          console.error("Failed to parse AI response for batch");
        }
      }
    }
    } // end batch loop

    // Update all scores in DB
    for (const s of allScores) {
      const cleanCpf = s.cpf.replace(/\D/g, "");
      const formatted = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      await supabase.from("clients").update({ propensity_score: Math.max(0, Math.min(100, s.score)) })
        .eq("tenant_id", tenantId)
        .or(`cpf.eq.${cleanCpf},cpf.eq.${formatted}`);
    }

    return new Response(JSON.stringify({ scores: allScores, source: "ai" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[calculate-propensity] ERROR:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
