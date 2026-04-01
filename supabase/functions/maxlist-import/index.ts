import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanCPF(cpf: string): string {
  return String(cpf || "").replace(/\D/g, "").padStart(11, "0");
}

function cleanPhone(phone: string | null): string {
  if (!phone) return "";
  return String(phone).replace(/[^\d]/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Não autenticado", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser();
    if (claimsError || !claimsData?.user) {
      return errorResponse("Não autenticado", 401);
    }

    const body = await req.json();
    const { tenant_id, filter, credor, field_mapping, status_cobranca_id } = body;

    if (!tenant_id || !filter || !credor || !field_mapping) {
      return errorResponse("Campos obrigatórios: tenant_id, filter, credor, field_mapping", 400);
    }

    // Use service role for data operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify user belongs to tenant
    const { data: tenantUser } = await supabase
      .from("tenant_users")
      .select("id")
      .eq("user_id", claimsData.user.id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!tenantUser) {
      return errorResponse("Acesso negado a este tenant", 403);
    }

    // Get MaxSystem credentials from tenant settings
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("settings, slug")
      .eq("id", tenant_id)
      .single();

    const settings = (tenantData?.settings as any) || {};
    const maxUrl = settings.maxsystem_url;
    const maxToken = settings.maxsystem_token;

    if (!maxUrl || !maxToken) {
      return errorResponse("MaxSystem não configurado para este tenant", 400);
    }

    console.log(`[maxlist-import] Starting import for tenant ${tenant_id}, credor: ${credor}`);

    // Step 1: Fetch all pages from MaxSystem
    const PAGE_SIZE = 5000;
    let allItems: any[] = [];
    let skip = 0;

    while (true) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      try {
        const url = `${maxUrl}/odata/Payments?$filter=${filter}&$top=${PAGE_SIZE}&$skip=${skip}&$inlinecount=allpages`;
        const resp = await fetch(url, {
          headers: { Authorization: `Basic ${maxToken}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!resp.ok) {
          const errText = await resp.text();
          console.error(`[maxlist-import] MaxSystem error: ${resp.status} ${errText}`);
          return errorResponse(`Erro MaxSystem: ${resp.status}`, 502);
        }

        const json = await resp.json();
        const items = json.Items || [];
        allItems = allItems.concat(items);

        console.log(`[maxlist-import] Fetched ${allItems.length} records so far`);

        if (items.length < PAGE_SIZE) break;
        skip += PAGE_SIZE;
      } catch (fetchErr: any) {
        clearTimeout(timeout);
        if (fetchErr.name === "AbortError") {
          return errorResponse("Timeout ao consultar MaxSystem", 504);
        }
        throw fetchErr;
      }
    }

    console.log(`[maxlist-import] Total records from MaxSystem: ${allItems.length}`);

    // Step 2: Map records using field_mapping
    const records: any[] = [];
    const rejected: { nome?: string; cpf?: string; reason: string }[] = [];

    for (const rawItem of allItems) {
      const record: Record<string, any> = {};
      const custom_data: Record<string, any> = {};

      for (const [apiField, systemField] of Object.entries(field_mapping)) {
        if (systemField === "__ignorar__") continue;
        let value = (rawItem as any)[apiField] ?? null;

        // Special transformations
        if (apiField === "IsCancelled") {
          value = value ? "CANCELADO" : "ATIVO";
        } else if (apiField === "PaymentDateQuery" || apiField === "PaymentDateEffected") {
          value = value ? String(value).split("T")[0] : null;
        } else if (apiField === "ContractNumber" && typeof value === "string") {
          value = value.trim();
        } else if (["CellPhone1", "CellPhone2", "HomePhone"].includes(apiField) && value) {
          value = cleanPhone(String(value));
        } else if (apiField === "ResponsibleCPF" && value) {
          value = cleanCPF(String(value));
        }

        if (typeof systemField === "string" && systemField.startsWith("custom:")) {
          const fieldKey = systemField.replace("custom:", "");
          if (value !== undefined && value !== null && value !== "") {
            custom_data[fieldKey] = value;
          }
        } else {
          record[systemField as string] = value;
        }
      }

      const hasPagamento = !!record.data_pagamento;
      const isCancelado = record.status === "CANCELADO";

      const mapped = {
        tenant_id,
        nome_completo: (record.nome_completo || "").trim(),
        cpf: record.cpf || "",
        credor,
        valor_parcela: record.valor_parcela || record.valor_saldo || 0,
        valor_saldo: record.valor_saldo ?? null,
        data_vencimento: record.data_vencimento || new Date().toISOString().split("T")[0],
        data_pagamento: record.data_pagamento || null,
        external_id: record.cod_titulo
          ? String(record.cod_titulo)
          : record.external_id
            ? String(record.external_id)
            : `${record.cod_contrato || ""}-${record.numero_parcela || 1}`,
        cod_contrato: record.cod_contrato || "",
        numero_parcela: record.numero_parcela || 1,
        total_parcelas: record.numero_parcela || 1,
        valor_entrada: 0,
        valor_pago: hasPagamento ? (record.valor_parcela || record.valor_saldo || 0) : 0,
        status: hasPagamento ? "pago" : isCancelado ? "quebrado" : "pendente",
        phone: record.phone || "",
        phone2: record.phone2 || "",
        phone3: record.phone3 || "",
        email: record.email || null,
        model_name: record.model_name || (rawItem as any).ModelName || null,
        observacoes: record.observacoes || null,
        ...(Object.keys(custom_data).length > 0 ? { custom_data } : {}),
        updated_at: new Date().toISOString(),
        status_cobranca_id: status_cobranca_id === "__auto__" ? null : (status_cobranca_id || null),
      };

      // Validate
      if (!mapped.cpf || !mapped.nome_completo) {
        rejected.push({
          nome: mapped.nome_completo || undefined,
          cpf: mapped.cpf || undefined,
          reason: [!mapped.cpf ? "CPF ausente" : "", !mapped.nome_completo ? "Nome ausente" : ""].filter(Boolean).join(", "),
        });
        continue;
      }

      records.push(mapped);
    }

    // Step 3: Deduplicate by external_id
    const deduped = new Map<string, any>();
    for (const r of records) {
      deduped.set(r.external_id, r);
    }
    const skipped = records.length - deduped.size;
    const finalRecords = [...deduped.values()];

    console.log(`[maxlist-import] Valid: ${finalRecords.length}, Rejected: ${rejected.length}, Dedup skipped: ${skipped}`);

    // Step 4: Upsert in batches
    const BATCH_SIZE = 500;
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < finalRecords.length; i += BATCH_SIZE) {
      const batch = finalRecords.slice(i, i + BATCH_SIZE);
      try {
        const { data: result, error } = await supabase
          .from("clients")
          .upsert(batch, { onConflict: "external_id,tenant_id" })
          .select("id");

        if (error) {
          console.error(`[maxlist-import] Batch error:`, error.message);
          errors += batch.length;
        } else {
          inserted += result?.length ?? batch.length;
        }
      } catch (err: any) {
        console.error(`[maxlist-import] Batch exception:`, err.message);
        errors += batch.length;
      }
    }

    // Step 5: Auto-status-sync if requested
    if (status_cobranca_id === "__auto__") {
      console.log(`[maxlist-import] Running auto-status-sync for tenant ${tenant_id}`);
      try {
        await fetch(`${supabaseUrl}/functions/v1/auto-status-sync`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tenant_id }),
        });
      } catch (syncErr: any) {
        console.error(`[maxlist-import] auto-status-sync error:`, syncErr.message);
      }
    }

    // Log import
    await supabase.from("import_logs").insert({
      tenant_id,
      source: "maxlist",
      total_records: finalRecords.length,
      inserted,
      skipped: errors,
      credor,
    });

    // Audit log
    await supabase.from("audit_logs").insert({
      tenant_id,
      user_id: claimsData.user.id,
      user_name: "Sistema",
      action: "import_completed",
      entity_type: "import",
      details: {
        module: "maxlist-import",
        credor,
        total_fetched: allItems.length,
        inserted,
        rejected: rejected.length,
        skipped,
        errors,
        duration_ms: Date.now() - startTime,
      },
    });

    const report = { success: true, inserted, rejected: rejected.length, skipped, errors, total_fetched: allItems.length, duration_ms: Date.now() - startTime };
    console.log(`[maxlist-import] Complete:`, JSON.stringify(report));

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[maxlist-import] Fatal error:`, err.message);
    return errorResponse(err.message || "Erro interno", 500);
  }
});
