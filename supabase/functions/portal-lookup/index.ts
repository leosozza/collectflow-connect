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
    const { cpf, tenant_slug, action, notes } = await req.json();

    if (!cpf || typeof cpf !== "string" || cpf.replace(/\D/g, "").length !== 11) {
      return new Response(JSON.stringify({ error: "CPF inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanCpf = cpf.replace(/\D/g, "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find tenant by slug
    let tenantId: string | null = null;
    if (tenant_slug) {
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("id")
        .eq("slug", tenant_slug)
        .single();
      tenantId = tenantData?.id || null;
    }

    if (action === "request_agreement") {
      // Create agreement request from portal
      if (!tenantId) {
        return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get pending debts to calculate totals
      const { data: debts } = await supabase
        .from("clients")
        .select("nome_completo, credor, valor_parcela")
        .eq("cpf", cleanCpf)
        .eq("tenant_id", tenantId)
        .eq("status", "pendente");

      if (!debts || debts.length === 0) {
        return new Response(JSON.stringify({ error: "Nenhuma pendência encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const totalOriginal = debts.reduce((s, d) => s + Number(d.valor_parcela), 0);
      const clientName = debts[0].nome_completo;
      const credor = debts[0].credor;

      const { error: insertError } = await supabase.from("agreements").insert({
        tenant_id: tenantId,
        client_cpf: cleanCpf,
        client_name: clientName,
        credor: credor,
        original_total: totalOriginal,
        proposed_total: totalOriginal,
        new_installments: 1,
        new_installment_value: totalOriginal,
        first_due_date: new Date().toISOString().split("T")[0],
        status: "pending",
        created_by: "00000000-0000-0000-0000-000000000000",
        notes: `[Solicitação via Portal] ${notes || ""}`.trim(),
      });

      if (insertError) throw insertError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: lookup debts
    let query = supabase
      .from("clients")
      .select("nome_completo, credor, numero_parcela, total_parcelas, valor_parcela, valor_pago, data_vencimento, status")
      .eq("cpf", cleanCpf)
      .order("data_vencimento", { ascending: true });

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: debts, error } = await query;
    if (error) throw error;

    return new Response(JSON.stringify({ debts: debts || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
