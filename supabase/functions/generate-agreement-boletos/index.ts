import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NEGOCIARIE_BASE = "https://sistema.negociarie.com.br/api/v2";
const LOGIN_URL = "https://sistema.negociarie.com.br/api/login";

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
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
  cachedToken = data.access_token || data.token;
  if (!cachedToken) throw new Error("Token não retornado pela API Negociarie");
  tokenExpiry = Date.now() + 50 * 60 * 1000;
  return cachedToken;
}

async function negociarieRequest(method: string, endpoint: string, body?: unknown) {
  const token = await getToken();
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

  // Collect all entrada keys (entrada, entrada_2, entrada_3, ...)
  const entradaKeys: string[] = [];
  if ((agreement.entrada_value || 0) > 0) {
    entradaKeys.push("entrada");
  }
  for (const k of Object.keys(customValues)) {
    if (k.startsWith("entrada_") && !k.endsWith("_method")) {
      if (!entradaKeys.includes(k)) entradaKeys.push(k);
    }
  }
  // Sort: "entrada" first, then "entrada_2", "entrada_3", etc.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    // Validate caller
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

    // Fetch agreement
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

    // Only generate for active agreements
    if (!["pending", "approved"].includes(agreement.status)) {
      return new Response(JSON.stringify({ error: `Acordo com status '${agreement.status}' não permite geração de boletos` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client profile
    const cleanCpf = String(agreement.client_cpf).replace(/\D/g, "");
    const { data: clientProfile } = await supabaseAdmin
      .from("client_profiles")
      .select("*")
      .eq("tenant_id", agreement.tenant_id)
      .eq("cpf", cleanCpf)
      .maybeSingle();

    // Fallback: try from clients table
    let clientData: any = clientProfile || {};
    if (!clientData.email || !clientData.cep) {
      const { data: clientRow } = await supabaseAdmin
        .from("clients")
        .select("email, phone, cep, endereco, bairro, cidade, uf, nome_completo")
        .eq("tenant_id", agreement.tenant_id)
        .or(`cpf.eq.${cleanCpf},cpf.eq.${cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`)
        .limit(1)
        .maybeSingle();
      if (clientRow) {
        for (const f of ["email", "phone", "cep", "endereco", "bairro", "cidade", "uf", "nome_completo"]) {
          if (!clientData[f] && (clientRow as any)[f]) clientData[f] = (clientRow as any)[f];
        }
      }
    }

    // Check required fields
    const requiredFields = ["email", "phone", "cep", "endereco", "cidade", "uf"];
    const missingFields = requiredFields.filter(f => !String(clientData[f] || "").trim());

    if (missingFields.length > 0) {
      console.log(`[generate-agreement-boletos] Missing fields: ${missingFields.join(", ")} — marking boleto_pendente`);
      await supabaseAdmin.from("agreements").update({ boleto_pendente: true }).eq("id", agreement_id);
      return new Response(JSON.stringify({
        success: 0, failed: 0, boleto_pendente: true,
        message: `Dados cadastrais incompletos (${missingFields.join(", ")}). Boletos poderão ser gerados manualmente após correção.`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build installments
    const installments = buildInstallments(agreement);
    const today = getTodayIso();

    // Build CALLBACK_URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const CALLBACK_URL = `${supabaseUrl}/functions/v1/negociarie-callback`;

    const result = { total: installments.length, success: 0, failed: 0, errors: [] as string[] };

    for (const inst of installments) {
      try {
        // Skip past-due installments
        if (inst.dueDate < today) {
          console.log(`[generate-agreement-boletos] Skipping installment ${inst.number} — past due (${inst.dueDate})`);
          continue;
        }

        const installmentKey = `${agreement_id}:${inst.key}`;
        const shortId = agreement_id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
        const idParcela = inst.isEntrada
          ? String(Date.now()).slice(-8)
          : `${shortId}-${inst.key}-${Date.now().toString(36)}`;

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
        const idGeral = `RIVO-${shortId}-${Date.now()}`;

        const payload = {
          cliente: {
            documento: cleanCpf,
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

        console.log(`[generate-agreement-boletos] Generating boleto for installment ${inst.number}`);
        const apiResult = await negociarieRequest("POST", "/cobranca/nova", payload);

        const parcelaResult = Array.isArray(apiResult?.parcelas) && apiResult.parcelas.length > 0
          ? apiResult.parcelas[0] : apiResult || {};

        const linkBoleto = parcelaResult?.link || parcelaResult?.link_boleto || parcelaResult?.url_boleto ||
          apiResult?.link_boleto || apiResult?.url_boleto || null;

        // Mark previous boletos as substituido
        await supabaseAdmin
          .from("negociarie_cobrancas")
          .update({ status: "substituido" } as any)
          .eq("agreement_id", agreement_id)
          .eq("installment_key", installmentKey)
          .neq("status", "pago");

        // Save new cobranca
        await supabaseAdmin
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
          } as any);

        result.success++;
        console.log(`[generate-agreement-boletos] Boleto ${inst.number} generated successfully`);
      } catch (err: any) {
        result.failed++;
        const msg = `Parcela ${inst.number === 0 ? "Entrada" : inst.number}: ${err.message || "Erro desconhecido"}`;
        result.errors.push(msg);
        console.error(`[generate-agreement-boletos] Error for installment ${inst.number}:`, err.message);
      }
    }

    // Clear boleto_pendente if at least one generated
    if (result.success > 0) {
      await supabaseAdmin.from("agreements").update({ boleto_pendente: false }).eq("id", agreement_id);
    }

    console.log(`[generate-agreement-boletos] Done: ${result.success}/${result.total} success, ${result.failed} failed`);

    return new Response(JSON.stringify(result), {
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
