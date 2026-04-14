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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { messageId, audioUrl } = await req.json();

    if (!messageId || !audioUrl) {
      return new Response(JSON.stringify({ error: "messageId and audioUrl required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lovableApiKey) {
      console.error("[transcribe-audio] LOVABLE_API_KEY not configured");
      await updateMetadata(supabase, messageId, { transcription_error: "API key not configured" });
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();
    console.log(`[transcribe-audio] Processing message ${messageId}, audio: ${audioUrl.substring(0, 100)}`);

    // Download audio
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let audioResp: Response;
    try {
      audioResp = await fetch(audioUrl, { signal: controller.signal });
      clearTimeout(timeout);
    } catch (e: any) {
      clearTimeout(timeout);
      console.error("[transcribe-audio] Audio download failed:", e.message);
      await updateMetadata(supabase, messageId, { transcription_error: `Download failed: ${e.message}` });
      return new Response(JSON.stringify({ error: "Audio download failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!audioResp.ok) {
      console.error(`[transcribe-audio] Download HTTP ${audioResp.status}`);
      await updateMetadata(supabase, messageId, { transcription_error: `Download HTTP ${audioResp.status}` });
      return new Response(JSON.stringify({ error: "Audio download failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBlob = await audioResp.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBlob)));
    const mimeType = audioResp.headers.get("content-type") || "audio/ogg";

    console.log(`[transcribe-audio] Audio downloaded: ${audioBlob.byteLength} bytes, ${mimeType}, ${Date.now() - startTime}ms`);

    // Determine format for Gemini — map common WhatsApp formats
    let audioFormat = "wav"; // safe default
    if (mimeType.includes("mp3") || mimeType.includes("mpeg")) {
      audioFormat = "mp3";
    } else if (mimeType.includes("mp4") || mimeType.includes("m4a")) {
      audioFormat = "mp4";
    } else if (mimeType.includes("ogg") || mimeType.includes("opus")) {
      audioFormat = "wav"; // Gemini handles OGG via wav fallback
    } else if (mimeType.includes("webm")) {
      audioFormat = "wav";
    } else if (mimeType.includes("amr")) {
      audioFormat = "wav";
    }

    // Call Lovable AI Gateway with multimodal prompt
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um transcritor de áudio. Transcreva o áudio fornecido em português brasileiro. Retorne APENAS o texto transcrito, sem formatação extra, sem aspas, sem prefixos. Se o áudio estiver inaudível ou vazio, retorne '[áudio inaudível]'.",
          },
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: audioBase64,
                  format: audioFormat,
                },
              },
              {
                type: "text",
                text: "Transcreva este áudio em português.",
              },
            ],
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error(`[transcribe-audio] AI Gateway error: HTTP ${aiResp.status}`, errText.substring(0, 300));
      await updateMetadata(supabase, messageId, { transcription_error: `AI error: HTTP ${aiResp.status}` });
      return new Response(JSON.stringify({ error: "Transcription failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResp.json();
    const transcription = aiResult.choices?.[0]?.message?.content?.trim() || "";
    const elapsed = Date.now() - startTime;

    if (!transcription) {
      console.warn(`[transcribe-audio] Empty transcription result (${elapsed}ms)`);
      await updateMetadata(supabase, messageId, { transcription_error: "Empty transcription" });
    } else {
      console.log(`[transcribe-audio] Transcription (${transcription.length} chars, ${elapsed}ms): ${transcription.substring(0, 100)}...`);
      await updateMetadata(supabase, messageId, { transcription });
    }

    return new Response(JSON.stringify({ ok: true, transcription: transcription || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[transcribe-audio] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function updateMetadata(supabase: any, messageId: string, newFields: Record<string, any>) {
  try {
    // Merge with existing metadata
    const { data: msg } = await supabase
      .from("chat_messages")
      .select("metadata")
      .eq("id", messageId)
      .single();

    const existing = (msg?.metadata as Record<string, any>) || {};
    const merged = { ...existing, ...newFields };

    await supabase
      .from("chat_messages")
      .update({ metadata: merged })
      .eq("id", messageId);
  } catch (e: any) {
    console.error("[transcribe-audio] Failed to update metadata:", e.message);
  }
}
