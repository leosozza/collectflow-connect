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

/** Helper for case-insensitive access to object properties */
function getVal(obj: any, key: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  if (key in obj) return obj[key];
  
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lowerKey) return obj[k];
  }
  return undefined;
}

// Fields that can be updated from MaxSystem origin
const SYNC_FIELDS = [
  "data_pagamento", "valor_pago", "valor_parcela", "valor_saldo",
  "data_vencimento", "status", "cod_contrato", "numero_parcela", "model_name", "external_id",
  "meio_pagamento_id", "status_cobranca_id", "data_devolucao",
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
    const { tenant_id, filter, credor, field_mapping, status_cobranca_id, mode = "import", items: preloadedItems, skip_fetch } = body;

    if (!tenant_id || !credor || !field_mapping) {
      return errorResponse("Campos obrigatórios: tenant_id, credor, field_mapping", 400);
    }
    if (!skip_fetch && !filter) {
      return errorResponse("filter é obrigatório quando skip_fetch não está ativo", 400);
    }

    if (mode !== "import" && mode !== "update") {
      return errorResponse("mode deve ser 'import' ou 'update'", 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch status ID: try "Vencido" first, fallback to "Inadimplente"
    let vencidoStatusId: string | null = null;
    const { data: statusVencido } = await supabase
      .from("tipos_status")
      .select("id")
      .eq("tenant_id", tenant_id)
      .ilike("nome", "vencido")
      .maybeSingle();
    if (statusVencido?.id) {
      vencidoStatusId = statusVencido.id;
    } else {
      const { data: statusInadimplente } = await supabase
        .from("tipos_status")
        .select("id")
        .eq("tenant_id", tenant_id)
        .ilike("nome", "inadimplente")
        .maybeSingle();
      vencidoStatusId = statusInadimplente?.id || null;
    }
    console.log(`[maxlist-import] vencidoStatusId resolved: ${vencidoStatusId}`);

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

    console.log(`[maxlist-import] Starting ${mode} for tenant ${tenant_id}, credor: ${credor}, skip_fetch: ${!!skip_fetch}`);

    // Step 1: Fetch all pages from MaxSystem via maxsystem-proxy (or use preloaded items)
    let allItems: any[] = [];

    if (skip_fetch && Array.isArray(preloadedItems)) {
      allItems = preloadedItems;
      console.log(`[maxlist-import] Using ${allItems.length} preloaded items (skip_fetch=true)`);
    } else {
      const PAGE_SIZE = 5000;
      let skip = 0;
      const SELECT_FIELDS = "Id,IdRecord,ResponsibleName,ResponsibleCPF,ContractNumber,Number,PaymentDateQuery,PaymentDateEffected,Value,NetValue,IsCancelled,CellPhone1,CellPhone2,HomePhone,ModelName,Email,Observations,Discount,Producer,PaymentType,CheckReturnDateQuery,CheckReturnReason";
      
      while (true) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);

        try {
          const url = `${supabaseUrl}/functions/v1/maxsystem-proxy?filter=${encodeURIComponent(filter)}&top=${PAGE_SIZE}&skip=${skip}&select=${encodeURIComponent(SELECT_FIELDS)}`;
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
          
          if (items.length > 0 && allItems.length === 0) {
            console.log("[maxlist-import] Sample item received from MaxSystem:", JSON.stringify(items[0], null, 2));
          }

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
    }

    console.log(`[maxlist-import] Total records: ${allItems.length}`);

    // Step 1.1: Fetch Payment Mappings for this Creditor
    const { data: credorData } = await supabase
      .from("credores")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("razao_social", credor)
      .maybeSingle();
    
    const credorId = credorData?.id;
    const paymentMappings = new Map<string, string>();
    if (credorId) {
      const { data: mappings } = await supabase
        .from("meio_pagamento_mappings")
        .select("external_code, internal_id")
        .eq("credor_id", credorId);
      
      if (mappings) {
        for (const m of mappings) paymentMappings.set(String(m.external_code), m.internal_id);
      }
    }

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

      // YBRASIL status rules (using getVal for case-insensitivity)
      const rawIsCancelled = getVal(rawItem, "IsCancelled") === true;
      const rawPaymentEffected = getVal(rawItem, "PaymentDateEffected");
      const rawPaymentType = getVal(rawItem, "PaymentType");
      const rawReturnDate = getVal(rawItem, "CheckReturnDateQuery");
      
      const hasPagamento = !!record.data_pagamento || !!rawPaymentEffected;
      const meioPagamentoId = rawPaymentType ? paymentMappings.get(String(rawPaymentType)) : null;

      let derivedStatus: string;
      if (rawIsCancelled) {
        derivedStatus = "cancelado_maxlist";
      } else if (rawReturnDate) {
        // Cheque devolvido — prioridade máxima sobre pagamento
        derivedStatus = "vencido";
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
        // meio_pagamento_id removed — column does not exist in clients table
        phone: record.phone || "",
        phone2: record.phone2 || "",
        phone3: record.phone3 || "",
        email: record.email || null,
        model_name: record.model_name || (rawItem as any).ModelName || null,
        observacoes: record.observacoes || null,
        ...(Object.keys(custom_data).length > 0 ? { custom_data } : {}),
        updated_at: new Date().toISOString(),
        status_cobranca_id: derivedStatus === "vencido" && vencidoStatusId
          ? vencidoStatusId
          : (status_cobranca_id === "__auto__" ? null : (status_cobranca_id || null)),
        data_devolucao: rawReturnDate ? String(rawReturnDate).split("T")[0] : null,
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
    const processingLogs: string[] = [];
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
          .select("id, external_id, cpf, cod_contrato, numero_parcela, data_pagamento, valor_pago, valor_parcela, valor_saldo, data_vencimento, status, model_name, nome_completo, meio_pagamento_id, status_cobranca_id, data_devolucao")
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
            .select("id, external_id, cpf, cod_contrato, numero_parcela, data_pagamento, valor_pago, valor_parcela, valor_saldo, data_vencimento, status, model_name, nome_completo, meio_pagamento_id, status_cobranca_id, data_devolucao")
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
          const recLabel = `CPF=${rec.cpf} parcela=${rec.numero_parcela} ext=${rec.external_id}`;
          let existing = existingMap.get(rec.external_id);
          if (!existing) {
            const fbKey = `${rec.cod_contrato || ""}-${rec.numero_parcela || 1}-${cleanCPF(rec.cpf)}`;
            existing = fallbackMap.get(fbKey);
            if (existing) processingLogs.push(`[FALLBACK] ${recLabel} → matched by contract key`);
          }

          if (!existing) {
            toInsert.push(rec);
            inserted++;
            if (rec.status === "pago") paid++;
            if (rec.status === "cancelado_maxlist") cancelledMaxlist++;
            processingLogs.push(`[INSERT] ${recLabel} status=${rec.status}`);
            continue;
          }

          // Compare fields
          const changes: Record<string, { old: any; new: any }> = {};
          const fieldLog: string[] = [];
          for (const field of SYNC_FIELDS) {
            let oldVal = existing[field] ?? null;
            let newVal = rec[field] ?? null;

            if (field === "status") {
              const normOld = String(oldVal ?? "").toLowerCase();
              const normNew = String(newVal ?? "").toLowerCase();
              if ((normOld === "quitado" || normOld === "pago") && normNew === "pago") {
                fieldLog.push(`${field}: "${oldVal}"→"${newVal}" (skip, equivalent)`);
                continue; 
              }
              if (normOld === normNew) {
                fieldLog.push(`${field}: "${oldVal}"="${newVal}" (skip, same)`);
                continue;
              }
            }

            const oldStr = String(oldVal ?? "");
            const newStr = String(newVal ?? "");
            if (oldStr !== newStr) {
              changes[field] = { old: oldVal, new: newVal };
              fieldLog.push(`${field}: "${oldVal}"→"${newVal}" (CHANGED)`);
            }
          }

          if (Object.keys(changes).length === 0) {
            unchanged++;
            processingLogs.push(`[UNCHANGED] ${recLabel} | ${fieldLog.join("; ")}`);
            continue;
          }

          // Build update payload
          const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
          const appliedFields: string[] = [];
          const skippedFields: string[] = [];
          for (const field of Object.keys(changes)) {
            if (PROTECTED_FIELDS.has(field)) {
              if ((field === "status_cobranca_id" || field === "data_devolucao") && rec.status === "vencido") {
                updatePayload[field] = rec[field];
                appliedFields.push(`${field}(protected-exception)`);
              } else {
                skippedFields.push(`${field}(PROTECTED)`);
              }
              continue;
            }
            updatePayload[field] = rec[field];
            appliedFields.push(field);
          }

          processingLogs.push(`[UPDATE] ${recLabel} | applied=[${appliedFields.join(",")}] skipped=[${skippedFields.join(",")}] changes={${fieldLog.join("; ")}}`);

          try {
            const { error } = await supabase
              .from("clients")
              .update(updatePayload)
              .eq("id", existing.id)
              .eq("tenant_id", tenant_id);

            if (error) {
              console.error(`[maxlist-import] Update error for ${existing.id}:`, error.message);
              processingLogs.push(`[ERROR] ${recLabel} → ${error.message}`);
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
            processingLogs.push(`[EXCEPTION] ${recLabel} → ${err.message}`);
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

    // === Consolidate client_profiles (canonical source) ===
    try {
      // Group records by CPF to consolidate
      const cpfMap = new Map<string, any>();
      for (const rec of finalRecords) {
        const c = cleanCPF(rec.cpf);
        if (!cpfMap.has(c)) {
          cpfMap.set(c, rec);
        } else {
          // Merge: keep first non-empty value
          const existing = cpfMap.get(c);
          const fields = ["nome_completo", "email", "phone", "phone2", "phone3", "cep", "endereco", "bairro", "cidade", "uf"];
          for (const f of fields) {
            if (!existing[f] && rec[f]) existing[f] = rec[f];
          }
        }
      }

      const profileBatch: any[] = [];
      for (const [cpfVal, rec] of cpfMap) {
        profileBatch.push({
          tenant_id,
          cpf: cpfVal,
          nome_completo: rec.nome_completo || "",
          email: rec.email || null,
          phone: rec.phone || null,
          phone2: rec.phone2 || null,
          phone3: rec.phone3 || null,
          cep: rec.cep || null,
          endereco: rec.endereco || null,
          bairro: rec.bairro || null,
          cidade: rec.cidade || null,
          uf: rec.uf || null,
          source: "maxlist",
          updated_at: new Date().toISOString(),
        });
      }

      // Upsert in batches — merge non-destructively via SQL COALESCE
      const PROFILE_BATCH = 200;
      for (let i = 0; i < profileBatch.length; i += PROFILE_BATCH) {
        const batch = profileBatch.slice(i, i + PROFILE_BATCH);
        const { error: profileErr } = await supabase
          .from("client_profiles")
          .upsert(batch, { onConflict: "tenant_id,cpf" });
        if (profileErr) {
          console.error("[maxlist-import] client_profiles upsert error:", profileErr.message);
        }
      }
      console.log(`[maxlist-import] Consolidated ${profileBatch.length} client_profiles`);
    } catch (profileErr: any) {
      console.error("[maxlist-import] client_profiles consolidation error:", profileErr.message);
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
    try {
      const { error: logErr } = await supabase.from("import_logs").insert({
        tenant_id,
        source: "maxlist",
        total_records: finalRecords.length,
        inserted,
        skipped: errors,
        credor,
      });
      if (logErr) console.error("[maxlist-import] import_logs error:", logErr.message);
    } catch (e: any) {
      console.error("[maxlist-import] import_logs exception:", e.message);
    }

    // Audit log
    try {
      const { error: auditErr } = await supabase.from("audit_logs").insert({
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
      });
      if (auditErr) console.error("[maxlist-import] audit_logs error:", auditErr.message);
    } catch (e: any) {
      console.error("[maxlist-import] audit_logs exception:", e.message);
    }

    const report = {
      success: true,
      mode,
      total_fetched: allItems.length,
      inserted,
      updated,
      updated_records: updatedRecords,
      paid,
      cancelled_maxlist: cancelledMaxlist,
      unchanged,
      rejected: rejected.length,
      rejected_records: rejected.slice(0, 100),
      duration_ms: Date.now() - startTime,
      processing_logs: processingLogs.slice(0, 500),
      debug: {
        raw: allItems.length > 0 ? allItems[0] : null,
        mapped: records.length > 0 ? records[0] : null,
        sync_fields: SYNC_FIELDS,
        filters: filter,
        mode,
      }
    };

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[maxlist-import] Fatal error:`, err.message);
    return errorResponse(err.message || "Erro interno", 500);
  }
});
