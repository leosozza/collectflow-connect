import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { recalcScoreForCpf } from "@/hooks/useScoreRecalc";
import { cleanCPF } from "@/lib/cpfUtils";

const MODULE = "debtorProfileAutoService";

export type DebtorProfile = "ocasional" | "recorrente" | "insatisfeito" | "resistente";

/**
 * Map disposition keys -> suggested debtor profile.
 * Keys present here will auto-fill `clients.debtor_profile` ONLY when it's NULL.
 * Unmapped keys never change the profile.
 */
const DISPOSITION_TO_PROFILE: Record<string, DebtorProfile> = {
  // WhatsApp dispositions
  wa_acordo_formalizado: "ocasional",
  wa_em_dia: "ocasional",
  wa_quitado: "ocasional",
  wa_em_negociacao: "ocasional",
  wa_cpc: "ocasional",
  wa_risco_processo: "resistente",
  wa_sem_interesse_financeiro: "resistente",
  wa_sem_interesse_produto: "insatisfeito",
  // Discador (call) dispositions
  cpc: "ocasional",
  em_dia: "ocasional",
  negotiated: "ocasional",
  // Não mapeados (sem alteração): no_answer, voicemail, interrupted, wrong_contact,
  // wa_cpe, wa_sem_contato — são neutros / contato errado.
};

export function inferDebtorProfileFromDisposition(key: string | null | undefined): DebtorProfile | null {
  if (!key) return null;
  return DISPOSITION_TO_PROFILE[key] ?? null;
}

/**
 * Apply auto profile to all clients of a given CPF/Tenant — only if currently NULL.
 * Never overrides a manually set profile. Logs to client_events on success.
 */
export async function applyAutoProfileFromDisposition(params: {
  tenantId: string;
  cpf: string;
  dispositionKey: string;
  channel?: "whatsapp" | "voice";
}): Promise<DebtorProfile | null> {
  const { tenantId, dispositionKey } = params;
  const cleanCpf = cleanCPF(params.cpf || "");
  if (!tenantId || !cleanCpf) return null;

  const suggested = inferDebtorProfileFromDisposition(dispositionKey);
  if (!suggested) return null;

  try {
    // Buscar todos os clientes desse CPF/tenant que ainda não têm perfil definido.
    const { data: rows, error: selErr } = await supabase
      .from("clients")
      .select("id, debtor_profile")
      .eq("tenant_id", tenantId)
      .eq("cpf", cleanCpf);

    if (selErr) throw selErr;
    if (!rows || rows.length === 0) return null;

    const targets = rows.filter((r: any) => !r.debtor_profile);
    if (targets.length === 0) return null;

    const ids = targets.map((r: any) => r.id);

    const { error: updErr } = await supabase
      .from("clients")
      .update({ debtor_profile: suggested } as any)
      .in("id", ids)
      .is("debtor_profile" as any, null);

    if (updErr) throw updErr;

    // Auditoria: registrar evento no client_events
    await supabase.from("client_events").insert({
      client_cpf: cleanCpf,
      tenant_id: tenantId,
      event_type: "debtor_profile_changed",
      event_source: "auto_disposition",
      event_channel: params.channel || "whatsapp",
      event_value: suggested,
      metadata: {
        disposition_key: dispositionKey,
        affected_client_ids: ids,
        reason: "auto_inferred_from_disposition",
      },
    });

    // Recalcular score em background
    recalcScoreForCpf(cleanCpf);

    logger.info(MODULE, "applyAutoProfileFromDisposition", {
      tenantId,
      cpf: cleanCpf,
      dispositionKey,
      profile: suggested,
      affected: ids.length,
    });

    return suggested;
  } catch (err) {
    logger.error(MODULE, "applyAutoProfileFromDisposition", err, { tenantId, cpf: cleanCpf, dispositionKey });
    return null;
  }
}
