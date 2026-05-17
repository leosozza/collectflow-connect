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
    const { cpf, tenant_slug, action, notes, credor, original_total, proposed_total, new_installments, new_installment_value, template_id } = body;

    // Action: get-templates - public lookup of credor's active agreement templates
    if (action === "get-templates") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Compute aging (days overdue) from oldest open installment for this CPF/credor in this tenant
      let agingDays: number | null = null;
      if (cpf && tenant_slug && credor) {
        const cleanCpfA = String(cpf).replace(/\D/g, "");
        const formattedCpfA = cleanCpfA.length === 11
          ? cleanCpfA.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
          : cleanCpfA;
        const { data: tenantRow } = await supabase
          .from("tenants").select("id").eq("slug", tenant_slug).single();
        if (tenantRow?.id) {
          const { data: oldest } = await supabase
            .from("clients")
            .select("data_vencimento")
            .in("cpf", [cleanCpfA, formattedCpfA])
            .eq("tenant_id", tenantRow.id)
            .eq("credor", credor)
            .in("status", ["pendente", "vencido"])
            .order("data_vencimento", { ascending: true })
            .limit(1);
          const dv = oldest?.[0]?.data_vencimento;
          if (dv) {
            const diff = Math.floor((Date.now() - new Date(dv).getTime()) / 86400000);
            agingDays = Math.max(0, diff);
          }
        }
      }

      const { data, error } = await supabase.rpc("get_portal_agreement_templates", {
        _tenant_slug: tenant_slug,
        _credor_name: credor,
        _aging_days: agingDays,
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const allowCustom = data && data.length > 0 ? Boolean(data[0].allow_custom_proposal) : true;
      return new Response(JSON.stringify({ templates: data || [], allow_custom_proposal: allowCustom, aging_days: agingDays }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Action: tenant-info - return tenant public data + first active creditor branding
    if (action === "tenant-info") {
      if (!tenant_slug) {
        return new Response(JSON.stringify({ error: "Slug obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, name, slug, logo_url, primary_color, settings")
        .eq("slug", tenant_slug)
        .single();

      // Fetch first creditor with portal enabled for branding
      let credorBranding = null;
      if (tenant?.id) {
        const { data: credor } = await supabase
          .from("credores")
          .select("portal_logo_url, portal_primary_color, portal_hero_title, portal_hero_subtitle, portal_enabled, nome_fantasia, razao_social")
          .eq("tenant_id", tenant.id)
          .eq("portal_enabled", true)
          .limit(1)
          .single();
        if (credor) {
          credorBranding = credor;
        }
      }

      return new Response(JSON.stringify({ tenant: tenant || null, credorBranding }), {
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

      // Anti-tampering: if template_id provided, validate against DB
      let autoApprove = false;
      let validatedTotal = Number(proposed_total) || 0;
      let validatedInstallments = Number(new_installments) || 1;
      let validatedInstallmentValue = Number(new_installment_value) || validatedTotal;

      if (template_id) {
        const { data: tpl } = await supabase
          .from("credor_agreement_templates")
          .select("id, ativo, desconto_percent, parcelas, credor_id, tenant_id, credores!inner(razao_social)")
          .eq("id", template_id)
          .eq("tenant_id", tenantId)
          .eq("ativo", true)
          .maybeSingle();

        if (!tpl) {
          return new Response(JSON.stringify({ error: "Modelo de acordo inválido ou inativo" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Recompute canonical values from template
        const orig = Number(original_total) || 0;
        const tplTotal = orig * (1 - Number(tpl.desconto_percent) / 100);
        const tplParcelas = Math.max(1, tpl.parcelas);
        const tplInstValue = tplTotal / tplParcelas;

        // Tolerance 1 cent
        if (Math.abs(tplTotal - validatedTotal) > 0.05 || tplParcelas !== validatedInstallments) {
          // Override with canonical template values (don't trust client)
          validatedTotal = tplTotal;
          validatedInstallments = tplParcelas;
          validatedInstallmentValue = tplInstValue;
        }
        autoApprove = true;
      }

      const discountPercent = original_total > 0
        ? Math.round((1 - validatedTotal / original_total) * 100)
        : 0;

      const insertStatus = autoApprove ? "approved" : "pending";

      const { data: agreement, error: insertError } = await supabase.from("agreements").insert({
        tenant_id: tenantId,
        client_cpf: cleanCpf,
        client_name: clientName,
        credor: credor || "N/A",
        original_total: original_total || 0,
        proposed_total: validatedTotal,
        new_installments: validatedInstallments,
        new_installment_value: validatedInstallmentValue,
        first_due_date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        discount_percent: discountPercent > 0 ? discountPercent : null,
        status: insertStatus,
        portal_origin: true,
        checkout_token: checkoutToken,
        created_by: "00000000-0000-0000-0000-000000000000",
        notes: (template_id ? `[Template: ${template_id}] ` : "") + (notes || "[Solicitação via Portal]"),
      }).select().single();

      if (insertError) throw insertError;

      let boletoUrl: string | null = null;

      // Auto-generate boletos for template-based agreements
      if (autoApprove && agreement) {
        try {
          const { data: boletoRes } = await supabase.functions.invoke("generate-agreement-boletos", {
            body: { agreement_id: agreement.id },
          });
          // try get first installment boleto link
          const { data: firstInst } = await supabase
            .from("agreement_installments")
            .select("boleto_url, pix_qrcode")
            .eq("agreement_id", agreement.id)
            .order("installment_key", { ascending: true })
            .limit(1)
            .maybeSingle();
          boletoUrl = firstInst?.boleto_url || null;
        } catch (e) {
          console.error("[portal-lookup] auto boleto generation failed:", e);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        checkout_token: checkoutToken,
        auto_approved: autoApprove,
        boleto_url: boletoUrl,
        agreement_id: agreement?.id,
      }), {
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
