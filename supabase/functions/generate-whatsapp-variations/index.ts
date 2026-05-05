import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { template, count = 10 } = body;

    if (!template) {
      return new Response(JSON.stringify({ error: "template é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um especialista em copy para WhatsApp. Eu vou te passar uma mensagem base de cobrança ou aviso.
Crie ${count} variações diferentes dessa mensagem com o mesmo contexto e mesmo tom, mas usando sinônimos e estruturas de frases ligeiramente diferentes para evitar que os filtros de spam detectem mensagens idênticas (Anti-Ban).
VOCÊ DEVE manter todas as variáveis (ex: {{nome}}, {{cpf}}, {{valor_parcela}}, {{data_vencimento}}, {{credor}}) EXATAMENTE onde fazem sentido em cada variação.
Não crie novas variáveis, apenas utilize as que já estão no texto base.
Retorne APENAS um array JSON de strings com as variações, e nada mais. Nenhuma explicação.`;

    const userPrompt = `Mensagem base:\n\n${template}`;

    const aiBody = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_variations",
            description: "Retorna as variações geradas de forma estruturada.",
            parameters: {
              type: "object",
              properties: {
                variations: {
                  type: "array",
                  items: { type: "string" },
                  description: "Lista com as variações de mensagens geradas",
                },
              },
              required: ["variations"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_variations" } },
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiBody),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA ao gerar variações" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResp.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    let variations: string[] = [];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      variations = parsed.variations || [];
    }

    return new Response(JSON.stringify({ variations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("generate-whatsapp-variations error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
