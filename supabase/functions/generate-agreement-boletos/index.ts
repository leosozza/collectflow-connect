import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NEGOCIARIE_BASE = "https://sistema.negociarie.com.br/api/v2";
const LOGIN_URL = "https://sistema.negociarie.com.br/api/login";
const CONCURRENCY = 5;

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(admin: any): Promise<string> {
  // 1. In-memory cache (warm invocations)
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  // 2. DB cache (survives cold starts)
  try {
    const { data: row } = await admin
      .from("integration_tokens")
      .select("access_token, expires_at")
      .eq("provider", "negociarie")
      .is("tenant_id", null)
      .maybeSingle();
    if (row?.access_token && row?.expires_at && new Date(row.expires_at).getTime() > Date.now() + 60_000) {
      cachedToken = row.access_token;
      tokenExpiry = new Date(row.expires_at).getTime();
      return cachedToken;
    }
  } catch (e) {
    console.warn("[generate-agreement-boletos] integration_tokens read failed:", (e as Error).message);
  }

  // 3. Fresh login
  const clientId = Deno.env.get("NEGOCIARIE_CLIENT_ID");
  const clientSecret = Deno.env.get("NEGOCIARIE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Credenciais Negociarie não configuradas");

  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha ao autenticar na Negociarie: ${res.status} - ${txt.substring(0, 200)}`);
  }
  const data = await res.json();
  const token = data.access_token || data.token;
  if (!token) throw new Error("Token não retornado pela API Negociarie");

  cachedToken = token;
  const expiresAt = new Date(Date.now() + 50 * 60 * 1000);
  tokenExpiry = expiresAt.getTime();

  // Persist to DB cache (best-effort)
  try {
    await admin
      .from("integration_tokens")
      .upsert(
        { provider: "negociarie", tenant_id: null, access_token: token, expires_at: expiresAt.toISOString() },
        { onConflict: "provider,tenant_id" } as any,
      );
  } catch (e) {
    // upsert with COALESCE-based unique index may not match; fallback to delete+insert
    try {
      await admin.from("integration_tokens").delete().eq("provider", "negociarie").is("tenant_id", null);
      await admin.from("integration_tokens").insert({ provider: "negociarie", tenant_id: null, access_token: token, expires_at: expiresAt.toISOString() });
    } catch (e2) {
      console.warn("[generate-agreement-boletos] integration_tokens write failed:", (e2 as Error).message);
    }
  }

  return token;
}

async function negociarieRequest(admin: any, method: string, endpoint: string, body?: unknown) {
  const token = await getToken(admin);
  const url = `${NEGOCIARIE_BASE}${endpoint}`;
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  };
  if (body && method === "POST") opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(json.message || json.error || JSON.stringify(json) || `Negociarie ${res.status}`);
  return json;
}

function formatCep(cep: string): string {
  const d = (cep || "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep || "";
}

function normalizePhone(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d;
}

function getTodayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

interface InstallmentInfo {
  number: number;
  key: string;
  value: number;
  dueDate: string;
  isEntrada: boolean;
}

function buildInstallments(agreement: any): InstallmentInfo[] {
  const installments: InstallmentInfo[] = [];
  const customValues: Record<string, number> = agreement.custom_installment_values || {};
  const customDates: Record<string, string> = agreement.custom_installment_dates || {};

  const entradaKeys: string[] = [];
  if ((agreement.entrada_value || 0) > 0) entradaKeys.push("entrada");
  for (const k of Object.keys(customValues)) {
    if (k.startsWith("entrada_") && !k.endsWith("_method")) {
      if (!entradaKeys.includes(k)) entradaKeys.push(k);
    }
  }
  entradaKeys.sort((a, b) => {
    if (a === "entrada") return -1;
    if (b === "entrada") return 1;
    const na = parseInt(a.split("_")[1] || "0");
    const nb = parseInt(b.split("_")[1] || "0");
    return na - nb;
  });

  for (const eKey of entradaKeys) {
    const defaultDate = agreement.entrada_date || agreement.first_due_date;
    const date = customDates[eKey] || defaultDate;
    const value = customValues[eKey] ?? agreement.entrada_value;
    installments.push({
      number: installments.length,
      key: eKey,
      value,
      dueDate: String(date).slice(0, 10),
      isEntrada: true,
    });
  }

  const baseDate = new Date(agreement.first_due_date + "T00:00:00");
  for (let i = 0; i < agreement.new_installments; i++) {
    const instNum = i + 1;
    const customKey = String(instNum);
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + i);
    const defaultDateStr = d.toISOString().split("T")[0];
    const date = customDates[customKey] || defaultDateStr;
    const value = customValues[customKey] ?? agreement.new_installment_value;
    installments.push({
      number: entradaKeys.length + instNum,
      key: customKey,
      value,
      dueDate: String(date).slice(0, 10),
      isEntrada: false,
    });
  }

  return installments;
}

// Limit-concurrency runner
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        const value = await worker(items[i], i);
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { agreement_id } = body;
    if (!agreement_id) {
      return new Response(JSON.stringify({ error: "agreement_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[generate-agreement-boletos] Starting for agreement ${agreement_id}`);

    // ---- Parallel initial queries ----
    const tQ0 = Date.now();
    const cleanCpf = String("").length; // placeholder; need agreement first for tenant
    // We must read agreement first to know tenant/cpf, then run profile+clients in parallel.
    const { data: agreement, error: agErr } = await supabaseAdmin
      .from("agreements")
      .select("*")
      .eq("id", agreement_id)
      .single();
    if (agErr || !agreement) {
      return new Response(JSON.stringify({ error: "Acordo não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["pending", "approved"].includes(agreement.status)) {
      return new Response(JSON.stringify({ error: `Acordo com status '${agreement.status}' não permite geração de boletos` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanCpfStr = String(agreement.client_cpf).replace(/\D/g, "");
    const formattedCpf = cleanCpfStr.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

    const [profileRes, clientsRes] = await Promise.all([
      supabaseAdmin
        .from("client_profiles")
        .select("*")
        .eq("tenant_id", agreement.tenant_id)
        .eq("cpf", cleanCpfStr)
        .maybeSingle(),
      supabaseAdmin
        .from("clients")
        .select("email, phone, cep, endereco, bairro, cidade, uf, nome_completo")
        .eq("tenant_id", agreement.tenant_id)
        .or(`cpf.eq.${cleanCpfStr},cpf.eq.${formattedCpf}`),
    ]);

    const clientProfile = profileRes.data;
    const clientRows = clientsRes.data;

    let clientData: any = { ...(clientProfile || {}) };
    const fallbackFields = ["email", "phone", "cep", "endereco", "bairro", "cidade", "uf", "nome_completo"];
    if (Array.isArray(clientRows) && clientRows.length > 0) {
      for (const f of fallbackFields) {
        if (String(clientData[f] || "").trim()) continue;
        for (const row of clientRows) {
          const v = (row as any)[f];
          if (v && String(v).trim()) {
            clientData[f] = String(v).trim();
            break;
          }
        }
      }
    }
    const queries_ms = Date.now() - tQ0;

    const requiredFields = ["email", "phone", "cep", "endereco", "bairro", "cidade", "uf"];
    const missingFields = requiredFields.filter(f => !String(clientData[f] || "").trim());

    if (missingFields.length > 0) {
      console.log(`[generate-agreement-boletos] Missing fields: ${missingFields.join(", ")} — marking boleto_pendente`);
      await supabaseAdmin.from("agreements").update({ boleto_pendente: true }).eq("id", agreement_id);
      return new Response(JSON.stringify({
        success: 0, failed: 0, boleto_pendente: true,
        message: `Dados cadastrais incompletos (${missingFields.join(", ")}). Boletos poderão ser gerados manualmente após correção.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const installments = buildInstallments(agreement);
    const today = getTodayIso();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const CALLBACK_URL = `${supabaseUrl}/functions/v1/negociarie-callback`;

    const result = { total: installments.length, success: 0, failed: 0, skipped_non_boleto: 0, errors: [] as string[] };
    const cvAll: Record<string, any> = agreement.custom_installment_values || {};
    const defaultParcMethod = String(cvAll["1_method"] || "BOLETO").toUpperCase();

    // Pre-warm token before fanning out
    const tAuth0 = Date.now();
    await getToken(supabaseAdmin);
    const auth_ms = Date.now() - tAuth0;

    // Filter installments to actually process (skip past-due / non-boleto)
    type Job = { inst: InstallmentInfo };
    const jobs: Job[] = [];
    for (const inst of installments) {
      if (inst.dueDate < today) {
        console.log(`[generate-agreement-boletos] Skipping installment ${inst.key} — past due (${inst.dueDate})`);
        continue;
      }
      const rawMethod = cvAll[`${inst.key}_method`] ?? (inst.isEntrada ? "BOLETO" : defaultParcMethod);
      const method = String(rawMethod || "BOLETO").toUpperCase();
      if (method !== "BOLETO") {
        console.log(`[generate-agreement-boletos] Skipping installment ${inst.key} — payment method = ${method}`);
        result.skipped_non_boleto++;
        continue;
      }
      jobs.push({ inst });
    }

    const tNeg0 = Date.now();
    const per_installment_ms: number[] = new Array(jobs.length);

    await runWithConcurrency(jobs, CONCURRENCY, async ({ inst }, idx) => {
      const tI0 = Date.now();
      try {
        const installmentKey = `${agreement_id}:${inst.key}`;
        const shortId = agreement_id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
        const idParcela = inst.isEntrada
          ? String(Date.now()).slice(-8) + idx
          : `${shortId}-${inst.key}-${Date.now().toString(36)}-${idx}`;

        let endereco = (clientData.endereco || "").trim();
        let numero = "";
        if (endereco.includes(",")) {
          const parts = endereco.split(",");
          endereco = parts[0].trim();
          numero = (parts[1] || "").trim();
        }
        if (!numero) numero = "SN";

        const celular = normalizePhone(clientData.phone || "");
        const entradaLabel = inst.key === "entrada" ? "Entrada" : `Entrada ${inst.key.split("_")[1] || ""}`;
        const instLabel = `Acordo ${agreement_id.substring(0, 8)} - ${inst.isEntrada ? entradaLabel : `Parcela ${inst.key}`}`;
        const idGeral = `RIVO-${shortId}-${Date.now()}-${idx}`;

        const payload = {
          cliente: {
            documento: cleanCpfStr,
            nome: (clientData.nome_completo || agreement.client_name || "").trim(),
            razao_social: "",
            cep: formatCep(clientData.cep || ""),
            endereco,
            numero,
            complemento: "",
            bairro: (clientData.bairro || "").trim(),
            cidade: (clientData.cidade || "").trim(),
            uf: (clientData.uf || "").trim().toUpperCase(),
            email: (clientData.email || "").trim(),
            telefones: celular ? [celular] : [],
          },
          id_geral: idGeral,
          parcelas: [{
            id_parcela: idParcela,
            data_vencimento: inst.dueDate,
            valor: parseFloat(inst.value.toFixed(2)),
            valor_mora_dia: 0.10,
            valor_multa: 2.00,
            mensagem: `${instLabel.slice(0, 40)}`,
            callback_url: CALLBACK_URL,
          }],
        };

        const apiResult = await negociarieRequest(supabaseAdmin, "POST", "/cobranca/nova", payload);

        const parcelaResult = Array.isArray(apiResult?.parcelas) && apiResult.parcelas.length > 0
          ? apiResult.parcelas[0] : apiResult || {};

        const linkBoleto = parcelaResult?.link || parcelaResult?.link_boleto || parcelaResult?.url_boleto ||
          apiResult?.link_boleto || apiResult?.url_boleto || null;

        // Mark previous + insert new in parallel
        await Promise.all([
          supabaseAdmin
            .from("negociarie_cobrancas")
            .update({ status: "substituido" } as any)
            .eq("agreement_id", agreement_id)
            .eq("installment_key", installmentKey)
            .neq("status", "pago"),
          supabaseAdmin
            .from("negociarie_cobrancas")
            .insert({
              tenant_id: agreement.tenant_id,
              agreement_id: agreement_id,
              id_geral: apiResult?.id_geral || apiResult?.id || idGeral,
              id_parcela: parcelaResult?.id_parcela || idParcela,
              data_vencimento: parcelaResult?.data_vencimento || inst.dueDate,
              valor: Number(parcelaResult?.valor || inst.value),
              status: "pendente",
              link_boleto: linkBoleto,
              linha_digitavel: parcelaResult?.linha_digitavel || apiResult?.linha_digitavel || null,
              pix_copia_cola: parcelaResult?.pix_copia_cola || apiResult?.pix_copia_cola || null,
              callback_data: apiResult || null,
              installment_key: installmentKey,
            } as any),
        ]);

        result.success++;
        per_installment_ms[idx] = Date.now() - tI0;
      } catch (err: any) {
        result.failed++;
        const label = inst.isEntrada ? (inst.key === "entrada" ? "Entrada" : `Entrada ${inst.key.split("_")[1]}`) : `Parcela ${inst.key}`;
        const msg = `${label}: ${err?.message || "Erro desconhecido"}`;
        result.errors.push(msg);
        per_installment_ms[idx] = Date.now() - tI0;
        console.error(`[generate-agreement-boletos] Error for installment ${inst.key}:`, err?.message);
      }
    });

    const negociarie_total_ms = Date.now() - tNeg0;

    if (result.success > 0) {
      await supabaseAdmin.from("agreements").update({ boleto_pendente: false }).eq("id", agreement_id);
    }

    const total_ms = Date.now() - t0;
    console.log(`[generate-agreement-boletos] Done: ${result.success}/${result.total} success, ${result.failed} failed | timing: total=${total_ms}ms auth=${auth_ms}ms queries=${queries_ms}ms negociarie=${negociarie_total_ms}ms per=${JSON.stringify(per_installment_ms)}`);

    return new Response(JSON.stringify({ ...result, timing: { total_ms, auth_ms, queries_ms, negociarie_total_ms, per_installment_ms } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[generate-agreement-boletos] ERROR: ${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
