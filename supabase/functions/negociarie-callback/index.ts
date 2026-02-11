import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("Negociarie callback received:", JSON.stringify(body));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Extract relevant fields from callback
    const idGeral = body.id_geral || body.idGeral;
    const idParcela = body.id_parcela || body.idParcela;
    const status = body.status;
    const idStatus = body.id_status || body.idStatus;

    if (!idGeral) {
      return new Response(JSON.stringify({ error: "id_geral required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find matching cobranca
    let query = supabase
      .from("negociarie_cobrancas")
      .select("*, clients(operator_id, tenant_id)")
      .eq("id_geral", idGeral);

    if (idParcela) query = query.eq("id_parcela", idParcela);

    const { data: cobrancas, error: findError } = await query;

    if (findError || !cobrancas?.length) {
      console.log("Cobrança não encontrada para id_geral:", idGeral);
      return new Response(JSON.stringify({ ok: true, message: "No matching cobranca" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cobranca = cobrancas[0];

    // Map Negociarie status codes to internal status
    let newStatus = cobranca.status;
    if (idStatus === 801 || status === "pago" || status === "liquidado") {
      newStatus = "pago";
    } else if (idStatus === 800 || status === "registrado") {
      newStatus = "registrado";
    } else if (status === "cancelado" || status === "baixado") {
      newStatus = "cancelado";
    } else if (status) {
      newStatus = status;
    }

    // Update cobranca
    const { error: updateError } = await supabase
      .from("negociarie_cobrancas")
      .update({
        status: newStatus,
        id_status: idStatus || cobranca.id_status,
        callback_data: body,
      })
      .eq("id", cobranca.id);

    if (updateError) console.error("Error updating cobranca:", updateError);

    // If paid, update client status
    if (newStatus === "pago" && cobranca.client_id) {
      await supabase
        .from("clients")
        .update({ status: "pago", valor_pago: cobranca.valor })
        .eq("id", cobranca.client_id);

      // Create notification for operator
      const client = cobranca.clients as any;
      if (client?.operator_id && client?.tenant_id) {
        await supabase.rpc("create_notification", {
          _tenant_id: client.tenant_id,
          _user_id: client.operator_id,
          _title: "Pagamento confirmado",
          _message: `Cobrança ${cobranca.tipo} de R$ ${cobranca.valor} foi paga (ID: ${idGeral})`,
          _type: "success",
          _reference_type: "negociarie_cobranca",
          _reference_id: cobranca.id,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Callback error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
