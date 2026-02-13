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

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action, conversationId, messages: chatMessages, clientInfo } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "action é obrigatório (suggest, summarize, classify)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context from messages
    let messagesContext = "";
    if (chatMessages && chatMessages.length > 0) {
      messagesContext = chatMessages
        .slice(-30)
        .map((m: any) => `[${m.direction === "inbound" ? "Cliente" : "Operador"}]: ${m.content || "(mídia)"}`)
        .join("\n");
    } else if (conversationId) {
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("direction, content, message_type")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(30);

      if (msgs) {
        messagesContext = msgs
          .map((m: any) => `[${m.direction === "inbound" ? "Cliente" : "Operador"}]: ${m.content || `(${m.message_type})`}`)
          .join("\n");
      }
    }

    let clientContext = "";
    if (clientInfo) {
      clientContext = `\nDados do cliente vinculado:\n- Nome: ${clientInfo.nome_completo || "N/A"}\n- CPF: ${clientInfo.cpf || "N/A"}\n- Credor: ${clientInfo.credor || "N/A"}\n- Status: ${clientInfo.status || "N/A"}\n- Parcela: ${clientInfo.numero_parcela || "?"}/${clientInfo.total_parcelas || "?"}\n- Valor parcela: R$ ${clientInfo.valor_parcela || "0"}`;
    }

    let systemPrompt = "";
    let userPrompt = "";
    const useToolCalling = action === "classify";

    switch (action) {
      case "suggest": {
        systemPrompt = `Você é um assistente de cobrança profissional e empático. Você ajuda operadores a responder mensagens de clientes devedores de forma educada, objetiva e eficaz.
Regras:
- Responda em português brasileiro
- Seja cordial mas direto
- Foque em negociação e resolução
- Ofereça alternativas de pagamento quando apropriado
- Nunca ameace ou seja grosseiro
- Gere UMA sugestão de resposta pronta para enviar`;
        userPrompt = `Histórico da conversa:\n${messagesContext}${clientContext}\n\nGere uma sugestão de resposta para o operador enviar ao cliente. Responda APENAS com o texto da mensagem sugerida, sem explicações ou prefixos.`;
        break;
      }

      case "summarize": {
        systemPrompt = `Você é um assistente que faz resumos concisos de conversas de cobrança em português brasileiro. Capture os pontos principais: motivo do contato, situação do cliente, propostas feitas, acordos alcançados e próximos passos.`;
        userPrompt = `Histórico da conversa:\n${messagesContext}${clientContext}\n\nFaça um resumo conciso desta conversa em formato de bullet points.`;
        break;
      }

      case "classify": {
        systemPrompt = `Você é um classificador de intenções de conversas de cobrança. Analise o histórico e classifique a intenção principal do cliente.`;
        userPrompt = `Histórico da conversa:\n${messagesContext}\n\nClassifique a intenção principal do cliente nesta conversa.`;
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Ação inválida. Use: suggest, summarize, classify" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const aiBody: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };

    if (useToolCalling) {
      aiBody.tools = [
        {
          type: "function",
          function: {
            name: "classify_intent",
            description: "Classifica a intenção principal da conversa de cobrança",
            parameters: {
              type: "object",
              properties: {
                intent: {
                  type: "string",
                  enum: [
                    "negociacao",
                    "pagamento",
                    "duvida",
                    "reclamacao",
                    "cancelamento",
                    "informacao",
                    "acordo",
                    "inadimplencia",
                    "outro",
                  ],
                  description: "Intenção principal do cliente",
                },
                confidence: {
                  type: "number",
                  description: "Nível de confiança de 0 a 1",
                },
                suggested_tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Etiquetas sugeridas para a conversa (máximo 3)",
                },
                summary: {
                  type: "string",
                  description: "Resumo curto da intenção em uma frase",
                },
              },
              required: ["intent", "confidence", "suggested_tags", "summary"],
              additionalProperties: false,
            },
          },
        },
      ];
      aiBody.tool_choice = { type: "function", function: { name: "classify_intent" } };
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiBody),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Configurações > Workspace > Uso." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResp.json();

    let result: any;
    if (useToolCalling) {
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        result = JSON.parse(toolCall.function.arguments);
      } else {
        result = { intent: "outro", confidence: 0, suggested_tags: [], summary: "Não classificado" };
      }
    } else {
      result = { text: aiResult.choices?.[0]?.message?.content || "" };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("chat-ai-suggest error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
