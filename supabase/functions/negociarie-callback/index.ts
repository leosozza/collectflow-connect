import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Map Negociarie id_status to internal status */
function mapStatus(idStatus: number, statusText?: string): string {
  switch (idStatus) {
    case 801: return "pago";
    case 800: return "registrado";
    case 808:
    case 809: return "inadimplente";
    case 810:
    case 812: return "baixado";
    case 811: return "devolvido";
    default: return (statusText || "desconhecido").toLowerCase();
  }
}

/** SHA1 hex digest */
async function sha1(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Check if agreement is fully paid and mark as completed */
async function checkAgreementCompletion(supabase: any, agreementId: string, tenantId: string, clientId: string, clientCpf: string) {
  const { data: agreement } = await supabase
    .from("agreements")
    .select("id, proposed_total, status")
    .eq("id", agreementId)
    .single();

  if (!agreement || agreement.status === "completed" || agreement.status === "cancelled") return;

  // Sum all payments for this agreement from client_events
  const { data: events } = await supabase
    .from("client_events")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .eq("event_type", "payment_confirmed")
    .eq("client_id", clientId);

  let totalPaid = 0;
  if (events) {
    for (const ev of events) {
      if (ev.metadata?.agreement_id === agreementId && ev.metadata?.valor_pago) {
        totalPaid += Number(ev.metadata.valor_pago);
      }
    }
  }

  if (totalPaid >= Number(agreement.proposed_total)) {
    // Mark agreement as completed
    await supabase
      .from("agreements")
      .update({ status: "completed" })
      .eq("id", agreementId);

    // Set data_quitacao on client
    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("clients")
      .update({ data_quitacao: today, status: "pago" })
      .eq("id", clientId);

    // Register completion event
    await supabase.from("client_events").insert({
      tenant_id: tenantId,
      client_id: clientId,
      client_cpf: clientCpf,
      event_type: "agreement_completed",
      event_source: "system",
      event_channel: "boleto",
      event_value: `R$ ${totalPaid.toFixed(2)}`,
      metadata: {
        agreement_id: agreementId,
        proposed_total: Number(agreement.proposed_total),
        total_paid: totalPaid,
      },
    });

    console.log(`Agreement ${agreementId} marked as completed (paid ${totalPaid} >= ${agreement.proposed_total})`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("Negociarie callback received:", JSON.stringify(body));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── New format: body.parcelas[] ───
    if (Array.isArray(body.parcelas) && body.parcelas.length > 0) {
      // Validate token
      const clientId = Deno.env.get("NEGOCIARIE_CLIENT_ID") || "";
      const clientSecret = Deno.env.get("NEGOCIARIE_CLIENT_SECRET") || "";
      if (clientId && clientSecret && body.token) {
        const expected = await sha1(clientId + clientSecret);
        if (body.token !== expected) {
          console.error("Token inválido no callback");
          return new Response(JSON.stringify({ error: "Token inválido" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      let processed = 0;

      for (const parcela of body.parcelas) {
        const idParcela = String(parcela.id_parcela || "");
        if (!idParcela) continue;

        const newStatus = mapStatus(parcela.id_status, parcela.status);

        // Find cobrança by id_parcela
        const { data: cobrancas, error: findErr } = await supabase
          .from("negociarie_cobrancas")
          .select("*")
          .eq("id_parcela", idParcela);

        if (findErr || !cobrancas?.length) {
          console.log("Cobrança não encontrada para id_parcela:", idParcela);
          continue;
        }

        const cobranca = cobrancas[0];

        // Update cobrança
        const updateData: Record<string, unknown> = {
          status: newStatus,
          id_status: parcela.id_status ?? cobranca.id_status,
          callback_data: parcela,
        };
        if (parcela.valor_pago != null) updateData.valor_pago = parcela.valor_pago;
        if (parcela.data_pagamento) updateData.data_pagamento = parcela.data_pagamento;

        const { error: updateErr } = await supabase
          .from("negociarie_cobrancas")
          .update(updateData)
          .eq("id", cobranca.id);

        if (updateErr) {
          console.error("Error updating cobranca:", updateErr);
          continue;
        }

        // If paid (801), process payment effects
        if (newStatus === "pago") {
          const valorPago = Number(parcela.valor_pago || parcela.valor || cobranca.valor || 0);

          // Find client via agreement
          if (cobranca.agreement_id) {
            const { data: agreement } = await supabase
              .from("agreements")
              .select("id, tenant_id, client_cpf, created_by")
              .eq("id", cobranca.agreement_id)
              .single();

            if (agreement) {
              const cleanCpf = (agreement.client_cpf || "").replace(/[.\-]/g, "");
              const fmtCpf = cleanCpf.length === 11
                ? `${cleanCpf.slice(0,3)}.${cleanCpf.slice(3,6)}.${cleanCpf.slice(6,9)}-${cleanCpf.slice(9)}`
                : cleanCpf;
              const { data: client } = await supabase
                .from("clients")
                .select("id, cpf, valor_pago, operator_id, tenant_id")
                .eq("tenant_id", agreement.tenant_id)
                .or(`cpf.eq.${cleanCpf},cpf.eq.${agreement.client_cpf},cpf.eq.${fmtCpf}`)
                .limit(1)
                .single();

              if (client) {
                // Accumulate valor_pago
                const newValorPago = Number(client.valor_pago || 0) + valorPago;
                await supabase
                  .from("clients")
                  .update({ valor_pago: newValorPago })
                  .eq("id", client.id);

                // Register client_event
                await supabase.from("client_events").insert({
                  tenant_id: agreement.tenant_id,
                  client_id: client.id,
                  client_cpf: client.cpf,
                  event_type: "payment_confirmed",
                  event_source: "negociarie",
                  event_channel: "boleto",
                  event_value: `R$ ${valorPago.toFixed(2)}`,
                  metadata: {
                    agreement_id: cobranca.agreement_id,
                    id_parcela: idParcela,
                    id_status: parcela.id_status,
                    valor_pago: valorPago,
                    data_pagamento: parcela.data_pagamento,
                  },
                });

                // Check if agreement is fully paid
                await checkAgreementCompletion(supabase, cobranca.agreement_id, agreement.tenant_id, client.id, client.cpf);

                // Notification for operator
                const operatorId = client.operator_id || agreement.created_by;
                if (operatorId) {
                  await supabase.rpc("create_notification", {
                    _tenant_id: agreement.tenant_id,
                    _user_id: operatorId,
                    _title: "Pagamento confirmado",
                    _message: `Parcela de R$ ${valorPago.toFixed(2)} paga via boleto/PIX (ID: ${idParcela})`,
                    _type: "success",
                    _reference_type: "negociarie_cobranca",
                    _reference_id: cobranca.id,
                  });
                }
              }
            }
          } else if (cobranca.tenant_id && cobranca.client_id) {
            // Manual cobrança without agreement
            const { data: client } = await supabase
              .from("clients")
              .select("id, cpf, valor_pago, operator_id, tenant_id")
              .eq("id", cobranca.client_id)
              .single();

            if (client) {
              const newValorPago = Number(client.valor_pago || 0) + valorPago;
              await supabase
                .from("clients")
                .update({ valor_pago: newValorPago })
                .eq("id", client.id);

              await supabase.from("client_events").insert({
                tenant_id: cobranca.tenant_id,
                client_id: client.id,
                client_cpf: client.cpf,
                event_type: "payment_confirmed",
                event_source: "negociarie",
                event_channel: "boleto",
                event_value: `R$ ${valorPago.toFixed(2)}`,
                metadata: {
                  id_parcela: idParcela,
                  id_status: parcela.id_status,
                  valor_pago: valorPago,
                  data_pagamento: parcela.data_pagamento,
                },
              });

              if (client.operator_id) {
                await supabase.rpc("create_notification", {
                  _tenant_id: cobranca.tenant_id,
                  _user_id: client.operator_id,
                  _title: "Pagamento confirmado",
                  _message: `Parcela de R$ ${valorPago.toFixed(2)} paga via boleto/PIX (ID: ${idParcela})`,
                  _type: "success",
                  _reference_type: "negociarie_cobranca",
                  _reference_id: cobranca.id,
                });
              }
            }
          }
        }

        processed++;
      }

      return new Response(JSON.stringify({ ok: true, processed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Legacy fallback: flat body with id_geral ───
    const idGeral = body.id_geral || body.idGeral;
    const idParcela = body.id_parcela || body.idParcela;
    const status = body.status;
    const idStatus = body.id_status || body.idStatus;

    if (!idGeral) {
      return new Response(JSON.stringify({ error: "Formato de callback não reconhecido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let query = supabase
      .from("negociarie_cobrancas")
      .select("*")
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

    const { error: updateError } = await supabase
      .from("negociarie_cobrancas")
      .update({
        status: newStatus,
        id_status: idStatus || cobranca.id_status,
        callback_data: body,
      })
      .eq("id", cobranca.id);

    if (updateError) console.error("Error updating cobranca:", updateError);

    if (newStatus === "pago" && cobranca.tenant_id && cobranca.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("id, cpf, valor_pago, operator_id")
        .eq("id", cobranca.client_id)
        .single();

      if (client) {
        const valorPago = Number(body.valor_pago || cobranca.valor || 0);
        const newValorPago = Number(client.valor_pago || 0) + valorPago;
        await supabase
          .from("clients")
          .update({ status: "pago", valor_pago: newValorPago })
          .eq("id", client.id);

        if (client.operator_id) {
          await supabase.rpc("create_notification", {
            _tenant_id: cobranca.tenant_id,
            _user_id: client.operator_id,
            _title: "Pagamento confirmado",
            _message: `Cobrança ${cobranca.tipo} de R$ ${cobranca.valor} foi paga (ID: ${idGeral})`,
            _type: "success",
            _reference_type: "negociarie_cobranca",
            _reference_id: cobranca.id,
          });
        }
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
