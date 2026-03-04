import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const oneDayAgo = new Date(now);
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const sixDaysAgo = new Date(now);
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

  const oneDayAgoStr = oneDayAgo.toISOString().split("T")[0];
  const sixDaysAgoStr = sixDaysAgo.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  try {
    // 1. Mark as overdue: pending/approved with first_due_date < 1 day ago
    const { data: toOverdue, error: err1 } = await supabase
      .from("agreements")
      .select("id, tenant_id, created_by, client_name, client_cpf")
      .in("status", ["pending", "approved"])
      .lt("first_due_date", oneDayAgoStr);

    if (err1) throw err1;

    if (toOverdue && toOverdue.length > 0) {
      const ids = toOverdue.map((a: any) => a.id);
      await supabase
        .from("agreements")
        .update({ status: "overdue" })
        .in("id", ids);

      // Notify operators
      const notifications = toOverdue.map((a: any) => ({
        tenant_id: a.tenant_id,
        user_id: a.created_by,
        title: "Acordo vencido",
        message: `O acordo de ${a.client_name} (${a.client_cpf}) está vencido.`,
        type: "warning",
        reference_type: "agreement",
        reference_id: a.id,
      }));
      await supabase.from("notifications").insert(notifications);
    }

    // 2. Cancel overdue agreements older than 5 days (first_due_date < 6 days ago)
    const { data: toCancel, error: err2 } = await supabase
      .from("agreements")
      .select("id, tenant_id, created_by, client_name, client_cpf")
      .eq("status", "overdue")
      .lt("first_due_date", sixDaysAgoStr);

    if (err2) throw err2;

    if (toCancel && toCancel.length > 0) {
      const ids = toCancel.map((a: any) => a.id);
      await supabase
        .from("agreements")
        .update({ status: "cancelled" })
        .in("id", ids);

      const notifications = toCancel.map((a: any) => ({
        tenant_id: a.tenant_id,
        user_id: a.created_by,
        title: "Acordo cancelado automaticamente",
        message: `O acordo de ${a.client_name} (${a.client_cpf}) foi cancelado após 5 dias de vencimento.`,
        type: "error",
        reference_type: "agreement",
        reference_id: a.id,
      }));
      await supabase.from("notifications").insert(notifications);
    }

    // 3. Mark overdue client installments: pendente + data_vencimento < today → vencido
    const { error: err3 } = await supabase
      .from("clients")
      .update({ status: "vencido" })
      .eq("status", "pendente")
      .lt("data_vencimento", todayStr);

    if (err3) throw err3;

    return new Response(
      JSON.stringify({
        overdue: toOverdue?.length || 0,
        cancelled: toCancel?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
