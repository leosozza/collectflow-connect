import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
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
    const asaasAccessToken = req.headers.get("asaas-access-token");

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

    const mappedStatus = statusMap[payment.status] || payment.status?.toLowerCase?.() || "pending";
    const paidStatuses = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];
    const isPaid = paidStatuses.includes(payment.status);

    const updatePlatformSubscription = async () => {
      if (!payment.subscription) return null;

      const { data: platformSubscription } = await supabase
        .from("platform_billing_subscriptions")
        .select("*")
        .eq("asaas_subscription_id", payment.subscription)
        .maybeSingle();

      if (!platformSubscription) return null;

      if (asaasAccessToken) {
        const { data: platformAccount } = await supabase
          .from("platform_billing_accounts")
          .select("webhook_token")
          .eq("id", platformSubscription.platform_account_id)
          .maybeSingle();

        if (platformAccount?.webhook_token && platformAccount.webhook_token !== asaasAccessToken) {
          return { forbidden: true, subscription: platformSubscription };
        }
      }

      await supabase
        .from("platform_billing_subscriptions")
        .update({
          last_payment_id: payment.id,
          last_payment_status: payment.status,
          last_payment_due_date: payment.dueDate || null,
          last_payment_at: isPaid ? new Date().toISOString() : null,
        })
        .eq("id", platformSubscription.id);

      return { forbidden: false, subscription: platformSubscription };
    };

    // Find and update payment record
    const { data: paymentRecord, error: findError } = await supabase
      .from("payment_records")
      .select("*")
      .eq("asaas_payment_id", payment.id)
      .maybeSingle();

    if (findError || !paymentRecord) {
      const platformUpdate = await updatePlatformSubscription();
      if (platformUpdate?.forbidden) {
        return new Response(JSON.stringify({ error: "Invalid Asaas webhook token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const platformSubscription = platformUpdate?.subscription;

      if (platformSubscription) {
        const { error: insertError } = await supabase.from("payment_records").insert({
          tenant_id: platformSubscription.tenant_id,
          payment_type: "subscription",
          amount: payment.value || platformSubscription.value,
          status: mappedStatus,
          payment_method: payment.billingType?.toLowerCase?.() || null,
          payment_gateway: "asaas",
          gateway_response: payment,
          invoice_url: payment.invoiceUrl || null,
          paid_at: isPaid ? new Date().toISOString() : null,
          asaas_payment_id: payment.id,
          asaas_status: payment.status,
          billing_type: payment.billingType || platformSubscription.billing_type,
          boleto_url: payment.bankSlipUrl || null,
          due_date: payment.dueDate || null,
          metadata: {
            platform_billing: true,
            platform_subscription_id: platformSubscription.id,
            asaas_subscription_id: payment.subscription,
          },
        });

        if (insertError) {
          console.error(`[asaas-webhook] Error inserting platform payment record:`, insertError);
        }

        return new Response(JSON.stringify({ received: true, platform_subscription: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[asaas-webhook] Payment record not found for Asaas ID: ${payment.id}`);
      return new Response(JSON.stringify({ received: true, warning: "Payment not found in DB" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const platformUpdate = await updatePlatformSubscription();
    if (platformUpdate?.forbidden) {
      return new Response(JSON.stringify({ error: "Invalid Asaas webhook token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update payment record
    const updateData: Record<string, any> = {
      asaas_status: payment.status,
      status: mappedStatus,
      updated_at: new Date().toISOString(),
    };

    if (isPaid) {
      updateData.paid_at = new Date().toISOString();
    }

    await supabase
      .from("payment_records")
      .update(updateData)
      .eq("id", paymentRecord.id);

    // If token purchase confirmed, credit tokens
    if (
      paymentRecord.payment_type === "token_purchase" &&
      isPaid &&
      paymentRecord.status !== "completed" &&
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
