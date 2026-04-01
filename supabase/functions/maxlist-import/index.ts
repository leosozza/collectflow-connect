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

// Fields that can be updated from MaxSystem origin
const SYNC_FIELDS = [
  "data_pagamento", "valor_pago", "valor_parcela", "valor_saldo",
  "data_vencimento", "status", "cod_contrato", "numero_parcela", "model_name", "external_id",
];

// Fields that must NEVER be overwritten by sync
const PROTECTED_FIELDS = new Set([
  "observacoes", "propensity_score", "debtor_profile", "operator_id",
  "status_cobranca_id", "custom_data", "debtor_category_id", "score_confidence",
  "score_reason", "score_updated_at", "suggested_profile", "suggested_queue",
  "preferred_channel", "tipo_devedor_id", "tipo_divida_id",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Não autenticado", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getUser();
    if (claimsError || !claimsData?.user) {
      return errorResponse("Não autenticado", 401);
    }

    const body = await req.json();
    const { tenant_id, filter, credor, field_mapping, status_cobranca_id, mode = "import" } = body;

    if (!tenant_id || !filter || !credor || !field_mapping) {
      return errorResponse("Campos obrigatórios: tenant_id, filter, credor, field_mapping", 400);
    }

    if (mode !== "import" && mode !== "update") {
      return errorResponse("mode deve ser 'import' ou 'update'", 400);
    }

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

    // Verify maxlist_enabled
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("settings, slug")
      .eq("id", tenant_id)
      .single();

    const settings = (tenantData?.settings as any) || {};
    const maxlistEnabled = settings.maxlist_enabled === true || tenantData?.slug === "ybrasil";

    if (!maxlistEnabled) {
      return errorResponse("MaxList não habilitado para este tenant", 403);
    }

    console.log(`[maxlist-import] Starting ${mode} for tenant ${tenant_id}, credor: ${credor}`);

    // Step 1: Fetch all pages from MaxSystem via maxsystem-proxy
    const PAGE_SIZE = 5000;
    let allItems: any[] = [];
    let skip = 0;

    while (true) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      try {
        const url = `${supabaseUrl}/functions/v1/maxsystem-proxy?filter=${encodeURIComponent(filter)}&top=${PAGE_SIZE}&skip=${skip}`;
        const resp = await fetch(url, {
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
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

      // YBRASIL status rules
      const rawIsCancelled = (rawItem as any).IsCancelled === true;
      const rawPaymentEffected = (rawItem as any).PaymentDateEffected;
      const hasPagamento = !!record.data_pagamento || !!rawPaymentEffected;

      let derivedStatus: string;
      if (rawIsCancelled) {
        derivedStatus = "cancelado_maxlist";
      } else if (hasPagamento) {
        derivedStatus = "pago";
      } else {
        derivedStatus = "pendente";
      }

      const mapped: any = {
        tenant_id,
        nome_completo: (record.nome_completo || "").trim(),
        cpf: record.cpf || "",
        credor,
        valor_parcela: record.valor_parcela || record.valor_saldo || 0,
        valor_saldo: record.valor_saldo ?? null,
        data_vencimento: record.data_vencimento || new Date().toISOString().split("T")[0],
        data_pagamento: record.data_pagamento || (rawPaymentEffected ? String(rawPaymentEffected).split("T")[0] : null),
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
        status: derivedStatus,
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

    // Step 3: Deduplicate by external_id within batch
    const deduped = new Map<string, any>();
    let duplicatesDiscarded = 0;
    for (const r of records) {
      if (deduped.has(r.external_id)) {
        duplicatesDiscarded++;
      } else {
        deduped.set(r.external_id, r);
      }
    }
    const finalRecords = [...deduped.values()];

    console.log(`[maxlist-import] Valid: ${finalRecords.length}, Rejected: ${rejected.length}, Duplicates: ${duplicatesDiscarded}`);

    // Counters
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let paid = 0;
    let cancelledMaxlist = 0;
    let errors = 0;
    const updatedRecords: { nome: string; cpf: string; changes: Record<string, { old: any; new: any }> }[] = [];

    if (mode === "update") {
      // === UPDATE MODE: Intelligent reconciliation ===
      const BATCH = 200;
      for (let i = 0; i < finalRecords.length; i += BATCH) {
        const batch = finalRecords.slice(i, i + BATCH);
        const externalIds = batch.map((r: any) => r.external_id);

        // Fetch existing records by external_id
        const { data: existingRows } = await supabase
          .from("clients")
          .select("id, external_id, cpf, cod_contrato, numero_parcela, data_pagamento, valor_pago, valor_parcela, valor_saldo, data_vencimento, status, model_name, nome_completo")
          .eq("tenant_id", tenant_id)
          .in("external_id", externalIds);

        const existingMap = new Map<string, any>();
        if (existingRows) {
          for (const row of existingRows) {
            existingMap.set(row.external_id, row);
          }
        }

        // Also build fallback map by cod_contrato+numero_parcela+cpf
        const fallbackMap = new Map<string, any>();
        if (existingRows) {
          for (const row of existingRows) {
            const key = `${row.cod_contrato || ""}-${row.numero_parcela || 1}-${cleanCPF(row.cpf)}`;
            fallbackMap.set(key, row);
          }
        }

        // For records not found by external_id, try fallback lookup
        const missingBatch: any[] = [];
        for (const rec of batch) {
          if (!existingMap.has(rec.external_id)) {
            missingBatch.push(rec);
          }
        }

        if (missingBatch.length > 0) {
          // Batch fallback query by CPFs
          const cpfs = [...new Set(missingBatch.map((r: any) => cleanCPF(r.cpf)))];
          const { data: fallbackRows } = await supabase
            .from("clients")
            .select("id, external_id, cpf, cod_contrato, numero_parcela, data_pagamento, valor_pago, valor_parcela, valor_saldo, data_vencimento, status, model_name, nome_completo")
            .eq("tenant_id", tenant_id)
            .in("cpf", cpfs);

          if (fallbackRows) {
            for (const row of fallbackRows) {
              const key = `${row.cod_contrato || ""}-${row.numero_parcela || 1}-${cleanCPF(row.cpf)}`;
              if (!fallbackMap.has(key)) {
                fallbackMap.set(key, row);
              }
            }
          }
        }

        // Process each record
        const toInsert: any[] = [];

        for (const rec of batch) {
          let existing = existingMap.get(rec.external_id);
          if (!existing) {
            const fbKey = `${rec.cod_contrato || ""}-${rec.numero_parcela || 1}-${cleanCPF(rec.cpf)}`;
            existing = fallbackMap.get(fbKey);
          }

          if (!existing) {
            // New record
            toInsert.push(rec);
            inserted++;
            if (rec.status === "pago") paid++;
            if (rec.status === "cancelado_maxlist") cancelledMaxlist++;
            continue;
          }

          // Compare fields
          const changes: Record<string, { old: any; new: any }> = {};
          for (const field of SYNC_FIELDS) {
            const oldVal = existing[field] ?? null;
            const newVal = rec[field] ?? null;
            const oldStr = String(oldVal ?? "");
            const newStr = String(newVal ?? "");
            if (oldStr !== newStr) {
              changes[field] = { old: oldVal, new: newVal };
            }
          }

          if (Object.keys(changes).length === 0) {
            unchanged++;
            continue;
          }

          // Build update payload (only changed sync fields)
          const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
          for (const field of Object.keys(changes)) {
            if (!PROTECTED_FIELDS.has(field)) {
              updatePayload[field] = rec[field];
            }
          }

          try {
            const { error } = await supabase
              .from("clients")
              .update(updatePayload)
              .eq("id", existing.id)
              .eq("tenant_id", tenant_id);

            if (error) {
              console.error(`[maxlist-import] Update error for ${existing.id}:`, error.message);
              errors++;
            } else {
              updated++;
              if (changes.status && rec.status === "pago") paid++;
              if (changes.status && rec.status === "cancelado_maxlist") cancelledMaxlist++;
              if (updatedRecords.length < 500) {
                updatedRecords.push({
                  nome: existing.nome_completo || rec.nome_completo,
                  cpf: rec.cpf,
                  changes,
                });
              }
            }
          } catch (err: any) {
            console.error(`[maxlist-import] Update exception:`, err.message);
            errors++;
          }
        }

        // Insert new records in batch
        if (toInsert.length > 0) {
          try {
            const { error } = await supabase
              .from("clients")
              .upsert(toInsert, { onConflict: "external_id,tenant_id" });

            if (error) {
              console.error(`[maxlist-import] Insert batch error:`, error.message);
              errors += toInsert.length;
              inserted -= toInsert.length; // revert counter
            }
          } catch (err: any) {
            console.error(`[maxlist-import] Insert batch exception:`, err.message);
            errors += toInsert.length;
            inserted -= toInsert.length;
          }
        }
      }
    } else {
      // === IMPORT MODE: Upsert in batches ===
      const BATCH_SIZE = 500;
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

      // Count statuses for import mode
      for (const r of finalRecords) {
        if (r.status === "pago") paid++;
        if (r.status === "cancelado_maxlist") cancelledMaxlist++;
      }
    }

    // Auto-status-sync
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

    const durationMs = Date.now() - startTime;
    const actionName = mode === "update" ? "maxlist_update" : "maxlist_import";

    // Log import
    await supabase.from("import_logs").insert({
      tenant_id,
      source: "maxlist",
      total_records: finalRecords.length,
      inserted,
      skipped: errors,
      credor,
    }).catch(() => {});

    // Audit log
    await supabase.from("audit_logs").insert({
      tenant_id,
      user_id: claimsData.user.id,
      user_name: "Sistema",
      action: actionName,
      entity_type: "import",
      details: {
        module: "maxlist",
        mode,
        credor,
        total_fetched: allItems.length,
        inserted,
        updated,
        paid,
        cancelled_maxlist: cancelledMaxlist,
        unchanged,
        rejected: rejected.length,
        duplicates_discarded: duplicatesDiscarded,
        errors,
        duration_ms: durationMs,
      },
    }).catch(() => {});

    const report = {
      success: true,
      mode,
      total_fetched: allItems.length,
      inserted,
      updated,
      paid,
      cancelled_maxlist: cancelledMaxlist,
      unchanged,
      rejected: rejected.length,
      rejected_records: rejected.slice(0, 100),
      duplicates_discarded: duplicatesDiscarded,
      errors,
      duration_ms: durationMs,
      updated_records: updatedRecords.slice(0, 200),
    };
    console.log(`[maxlist-import] Complete: mode=${mode}, inserted=${inserted}, updated=${updated}, unchanged=${unchanged}, paid=${paid}, cancelled=${cancelledMaxlist}`);

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[maxlist-import] Fatal error:`, err.message);
    return errorResponse(err.message || "Erro interno", 500);
  }
});
