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
    const body = await req.json();
    const { cpf, tenant_slug, action, notes, credor, original_total, proposed_total, new_installments, new_installment_value } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Action: tenant-info - return tenant public data
    if (action === "tenant-info") {
      if (!tenant_slug) {
        return new Response(JSON.stringify({ error: "Slug obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name, slug, logo_url, primary_color, settings")
        .eq("slug", tenant_slug)
        .single();

      return new Response(JSON.stringify({ tenant: tenant || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions need CPF
    if (!cpf || typeof cpf !== "string" || cpf.replace(/\D/g, "").length !== 11) {
      return new Response(JSON.stringify({ error: "CPF inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

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

    // Action: create-portal-agreement
    if (action === "create-portal-agreement") {
      if (!tenantId) {
        return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get client name from debts
      const { data: clientDebts } = await supabase
        .from("clients")
        .select("nome_completo")
        .in("cpf", [cleanCpf, formattedCpf])
        .eq("tenant_id", tenantId)
        .limit(1);

      const clientName = clientDebts?.[0]?.nome_completo || "Cliente";
      const checkoutToken = crypto.randomUUID();

      const discountPercent = original_total > 0
        ? Math.round((1 - proposed_total / original_total) * 100)
        : 0;

      const { data: agreement, error: insertError } = await supabase.from("agreements").insert({
        tenant_id: tenantId,
        client_cpf: cleanCpf,
        client_name: clientName,
        credor: credor || "N/A",
        original_total: original_total || 0,
        proposed_total: proposed_total || 0,
        new_installments: new_installments || 1,
        new_installment_value: new_installment_value || proposed_total || 0,
        first_due_date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        discount_percent: discountPercent > 0 ? discountPercent : null,
        status: "pending",
        portal_origin: true,
        checkout_token: checkoutToken,
        created_by: "00000000-0000-0000-0000-000000000000",
        notes: notes || "[Solicitação via Portal]",
      }).select().single();

      if (insertError) throw insertError;

      return new Response(JSON.stringify({ success: true, checkout_token: checkoutToken }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: request_agreement (legacy)
    if (action === "request_agreement") {
      if (!tenantId) {
        return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: debts } = await supabase
        .from("clients")
        .select("nome_completo, credor, valor_parcela")
        .in("cpf", [cleanCpf, formattedCpf])
        .eq("tenant_id", tenantId)
        .eq("status", "pendente");

      if (!debts || debts.length === 0) {
        return new Response(JSON.stringify({ error: "Nenhuma pendência encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const totalOriginal = debts.reduce((s, d) => s + Number(d.valor_parcela), 0);
      const clientName = debts[0].nome_completo;
      const credorName = debts[0].credor;

      const { error: insertError } = await supabase.from("agreements").insert({
        tenant_id: tenantId,
        client_cpf: cleanCpf,
        client_name: clientName,
        credor: credorName,
        original_total: totalOriginal,
        proposed_total: totalOriginal,
        new_installments: 1,
        new_installment_value: totalOriginal,
        first_due_date: new Date().toISOString().split("T")[0],
        status: "pending",
        portal_origin: true,
        checkout_token: crypto.randomUUID(),
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
      .in("cpf", [cleanCpf, formattedCpf])
      .order("data_vencimento", { ascending: true });

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: debts, error } = await query;
    if (error) throw error;

    // Fetch creditor portal settings for branding
    let credorSettings: Record<string, any> = {};
    if (tenantId && debts && debts.length > 0) {
      const uniqueCredors = [...new Set(debts.map((d: any) => d.credor))];
      const { data: credores } = await supabase
        .from("credores")
        .select("razao_social, nome_fantasia, portal_hero_title, portal_hero_subtitle, portal_logo_url, portal_primary_color, portal_enabled, desconto_maximo, parcelas_max, parcelas_min, juros_mes, multa, signature_enabled, signature_type")
        .eq("tenant_id", tenantId)
        .in("razao_social", uniqueCredors);

      if (credores) {
        for (const c of credores) {
          credorSettings[c.razao_social] = c;
        }
      }
    }

    return new Response(JSON.stringify({ debts: debts || [], credorSettings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
