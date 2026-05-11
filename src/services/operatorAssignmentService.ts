import { supabase } from "@/integrations/supabase/client";
import { logAction } from "@/services/auditService";
import { logger } from "@/lib/logger";

/**
 * "Quem negocia, vira dono"
 *
 * Reatribui (sobrescrevendo) o cliente e a conversa de WhatsApp vinculada
 * ao operador que executou uma ação de engajamento real
 * (Em Negociação ou Acordo Fechado).
 *
 * - Atualiza TODAS as parcelas com mesmo CPF + credor no tenant.
 * - Atualiza TODAS as conversas vinculadas a esses clientes.
 * - Fire-and-forget: nunca lança; loga em caso de falha.
 */
export async function reassignClientToOperator(params: {
  tenantId: string;
  cpf: string;
  credor: string;
  operatorId: string;
  source: "disposition_em_negociacao" | "agreement_created";
}): Promise<{ clients: number; conversations: number }> {
  const { tenantId, cpf, credor, operatorId, source } = params;
  let clientsUpdated = 0;
  let conversationsUpdated = 0;

  try {
    if (!tenantId || !cpf || !credor || !operatorId) return { clients: 0, conversations: 0 };

    const rawCpf = String(cpf).replace(/\D/g, "");
    const fmtCpf =
      rawCpf.length === 11
        ? `${rawCpf.slice(0, 3)}.${rawCpf.slice(3, 6)}.${rawCpf.slice(6, 9)}-${rawCpf.slice(9)}`
        : rawCpf;

    // 1) clients
    const { data: updatedClients, error: cErr } = await supabase
      .from("clients")
      .update({ operator_id: operatorId } as any)
      .eq("tenant_id", tenantId)
      .or(`cpf.eq.${rawCpf},cpf.eq.${fmtCpf}`)
      .eq("credor", credor)
      .select("id");
    if (cErr) throw cErr;
    const clientIds = (updatedClients || []).map((c: any) => c.id);
    clientsUpdated = clientIds.length;

    // 2) conversations vinculadas
    if (clientIds.length > 0) {
      const { data: updatedConvs, error: convErr } = await supabase
        .from("conversations")
        .update({ assigned_to: operatorId } as any)
        .eq("tenant_id", tenantId)
        .in("client_id", clientIds)
        .select("id");
      if (convErr) throw convErr;
      conversationsUpdated = (updatedConvs || []).length;
    }

    // 3) Audit (fire-and-forget)
    void logAction({
      action: "auto_reassign_negotiation",
      entity_type: "client",
      entity_id: clientIds[0],
      details: {
        source,
        cpf: rawCpf,
        credor,
        new_operator_id: operatorId,
        clients_updated: clientsUpdated,
        conversations_updated: conversationsUpdated,
      },
    });

    return { clients: clientsUpdated, conversations: conversationsUpdated };
  } catch (err) {
    logger.error("operatorAssignmentService", "reassignClientToOperator", err);
    return { clients: clientsUpdated, conversations: conversationsUpdated };
  }
}
