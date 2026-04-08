import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * AUTO-STATUS-SYNC (CPF-CENTRIC VERSION)
 * 
 * Hierarchy of status for a single CPF/Credor:
 * 1. QUITADO (All parcels are 'pago')
 * 2. ACORDO (Vigente, Atrasado or Quebrado)
 * 3. LOCKED (Em negociação)
 * 4. OVERDUE (Vencido / Aguardando acionamento)
 * 5. IN_DAY (Em dia)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let tenant_id: string | null = null;
    try {
      const body = await req.json();
      tenant_id = body?.tenant_id || null;
    } catch { }

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().split("T")[0];

    // 1. Get status types configuration
    const { data: statusList } = await supabase
      .from("tipos_status")
      .select("id, nome, regras")
      .eq("tenant_id", tenant_id);

    const statusMap = new Map<string, string>();
    const statusRegras = new Map<string, any>();
    (statusList || []).forEach((s: any) => {
      statusMap.set(s.nome, s.id);
      statusRegras.set(s.nome, s.regras || {});
    });

    const emDiaId = statusMap.get("Em dia");
    const aguardandoId = statusMap.get("Aguardando acionamento");
    const acordoVigenteId = statusMap.get("Acordo Vigente");
    const acordoAtrasadoId = statusMap.get("Acordo Atrasado"); // New
    const quebraAcordoId = statusMap.get("Quebra de Acordo");
    const quitadoId = statusMap.get("Quitado");
    const emNegociacaoId = statusMap.get("Em negociação");

    if (!emDiaId || !aguardandoId) {
      return new Response(
        JSON.stringify({ error: "Status 'Em dia' ou 'Aguardando acionamento' não encontrados." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch all clients and active agreements relevant for this tenant
    const { data: allClients } = await supabase
      .from("clients")
      .select("id, cpf, credor, status, data_vencimento, status_cobranca_id, status_cobranca_locked_at")
      .eq("tenant_id", tenant_id);

    const { data: agreements } = await supabase
      .from("agreements")
      .select("client_cpf, credor, status")
      .eq("tenant_id", tenant_id)
      .in("status", ["pending", "approved", "overdue", "cancelled"]);

    // 3. Group data by CPF + Credor
    const clientGroups = new Map<string, any[]>();
    (allClients || []).forEach(c => {
      const key = `${c.cpf.replace(/\D/g, "")}|${c.credor}`;
      if (!clientGroups.has(key)) clientGroups.set(key, []);
      clientGroups.get(key)!.push(c);
    });

    const agreementMap = new Map<string, string>(); // key -> agreement_status
    (agreements || []).forEach(a => {
      const key = `${a.client_cpf.replace(/\D/g, "")}|${a.credor}`;
      // Prioritize active over cancelled if multiple exist (though schema usually prevents)
      if (!agreementMap.has(key) || a.status !== "cancelled") {
        agreementMap.set(key, a.status);
      }
    });

    const updates: { id: string, status_cobranca_id: string | null, clearLock?: boolean }[] = [];
    let counts = { quitado: 0, acordo: 0, quebra: 0, vencido: 0, em_dia: 0, negociacao_mantida: 0 };

    // 4. Determine status for each group
    for (const [key, parcels] of clientGroups.entries()) {
      const agreementStatus = agreementMap.get(key);
      
      let targetStatusId: string | null = null;

      // Rule 1: All paid?
      const allPaid = parcels.every(p => p.status === "pago");
      
      if (allPaid) {
        targetStatusId = quitadoId || null;
        counts.quitado++;
      } 
      // Rule 2: Active Agreement?
      else if (agreementStatus && ["pending", "approved", "overdue"].includes(agreementStatus)) {
        if (agreementStatus === "overdue" && acordoAtrasadoId) {
          targetStatusId = acordoAtrasadoId;
        } else {
          targetStatusId = acordoVigenteId || null;
        }
        counts.acordo++;
      }
      // Rule 3: Broken Agreement?
      else if (agreementStatus === "cancelled") {
        targetStatusId = quebraAcordoId || null;
        counts.quebra++;
      }
      // Rule 4: Overdue Title?
      else {
        const hasOverdue = parcels.some(p => p.data_vencimento < today && p.status !== "pago");
        if (hasOverdue) {
          targetStatusId = aguardandoId;
          counts.vencido++;
        } else {
          targetStatusId = emDiaId;
          counts.em_dia++;
        }
      }

      // Final check: Is it currently locked in negotiation?
      // We only override if it's not locked, OR if it's paid (payment always breaks negotiation lock eventually)
      for (const p of parcels) {
        const isLocked = p.status_cobranca_id === emNegociacaoId;
        const shouldOverride = !isLocked || allPaid || agreementStatus;

        if (shouldOverride && p.status_cobranca_id !== targetStatusId) {
          updates.push({ 
            id: p.id, 
            status_cobranca_id: targetStatusId,
            clearLock: allPaid || (agreementStatus && agreementStatus !== "cancelled")
          });
        } else if (isLocked) {
          counts.negociacao_mantida++;
        }
      }
    }

    // 5. Execute Updates in batches
    if (updates.length > 0) {
      console.log(`[auto-status-sync] Updating ${updates.length} records for tenant ${tenant_id}`);
      const BATCH_SIZE = 100;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        
        // Group by status_id to minimize queries
        const byStatus: Record<string, string[]> = {};
        for (const up of batch) {
          const sid = up.status_cobranca_id || "null";
          if (!byStatus[sid]) byStatus[sid] = [];
          byStatus[sid].push(up.id);
        }

        for (const [statusId, ids] of Object.entries(byStatus)) {
          const payload: any = { status_cobranca_id: statusId === "null" ? null : statusId };
          
          await supabase
            .from("clients")
            .update(payload)
            .in("id", ids);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, tenant_id, updates: updates.length, summary: counts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error(`[auto-status-sync] ERROR:`, err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
