import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { event, payment } = body;

    if (!event || !payment) {
      return new Response(JSON.stringify({ error: "Invalid webhook payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[asaas-webhook] Event: ${event}, Payment ID: ${payment.id}, Status: ${payment.status}`);

    // Map Asaas status
    const statusMap: Record<string, string> = {
      PENDING: "pending",
      CONFIRMED: "completed",
      RECEIVED: "completed",
      OVERDUE: "overdue",
      REFUNDED: "refunded",
      RECEIVED_IN_CASH: "completed",
    };

    const mappedStatus = statusMap[payment.status] || payment.status;

    // Find and update payment record
    const { data: paymentRecord, error: findError } = await supabase
      .from("payment_records")
      .select("*")
      .eq("asaas_payment_id", payment.id)
      .single();

    if (findError || !paymentRecord) {
      console.log(`[asaas-webhook] Payment record not found for Asaas ID: ${payment.id}`);
      return new Response(JSON.stringify({ received: true, warning: "Payment not found in DB" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update payment record
    const updateData: Record<string, any> = {
      asaas_status: payment.status,
      status: mappedStatus,
      updated_at: new Date().toISOString(),
    };

    if (["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(payment.status)) {
      updateData.paid_at = new Date().toISOString();
    }

    await supabase
      .from("payment_records")
      .update(updateData)
      .eq("id", paymentRecord.id);

    // If token purchase confirmed, credit tokens
    if (
      paymentRecord.payment_type === "token_purchase" &&
      ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(payment.status) &&
      paymentRecord.tokens_granted
    ) {
      const { error: addError } = await supabase.rpc("add_tokens", {
        p_tenant_id: paymentRecord.tenant_id,
        p_amount: paymentRecord.tokens_granted,
        p_transaction_type: "purchase",
        p_description: `Compra de tokens via Asaas (${payment.billingType})`,
        p_reference_id: paymentRecord.id,
        p_metadata: { asaas_payment_id: payment.id, billing_type: payment.billingType },
      });

      if (addError) {
        console.error(`[asaas-webhook] Error adding tokens:`, addError);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[asaas-webhook] Error:`, err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
