import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { cleanCPF } from "@/lib/cpfUtils";

const MODULE = "clientProfileService";

export interface ClientProfile {
  nome_completo: string;
  cpf: string;
  email: string;
  phone: string;
  phone2: string;
  phone3: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  source: string;
}

const EMPTY_PROFILE: ClientProfile = {
  nome_completo: "", cpf: "", email: "", phone: "", phone2: "", phone3: "",
  cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "",
  source: "none",
};

/** Consolidate client data from multiple clients rows (fallback) */
function consolidateFromClients(rows: any[]): Partial<ClientProfile> {
  const fields = ["nome_completo", "email", "phone", "phone2", "phone3", "cep", "endereco", "bairro", "cidade", "uf"] as const;
  const result: Record<string, string> = {};
  for (const field of fields) {
    result[field] = "";
    for (const row of rows) {
      const val = row[field];
      if (val && String(val).trim()) {
        result[field] = String(val).trim();
        break;
      }
    }
  }
  return result as Partial<ClientProfile>;
}

/** Merge: only overwrite if new value is non-empty */
function mergeProfile(existing: Partial<ClientProfile>, incoming: Partial<ClientProfile>): Partial<ClientProfile> {
  const merged = { ...existing };
  for (const [key, val] of Object.entries(incoming)) {
    if (val && String(val).trim()) {
      (merged as any)[key] = String(val).trim();
    }
  }
  return merged;
}

/**
 * Get canonical client profile for a tenant + CPF.
 * 1. Try client_profiles table
 * 2. Fallback: consolidate from clients rows and auto-upsert
 */
export async function getClientProfile(tenantId: string, cpf: string): Promise<ClientProfile> {
  const clean = cleanCPF(cpf);
  if (!tenantId || !clean) return { ...EMPTY_PROFILE, cpf: clean };

  try {
    // 1. Try canonical table
    const { data: profile } = await supabase
      .from("client_profiles" as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("cpf", clean)
      .maybeSingle();

    // Build base from canonical profile (may be partial / missing fields)
    const baseFromProfile: Partial<ClientProfile> = profile
      ? {
          nome_completo: (profile as any).nome_completo || "",
          email: (profile as any).email || "",
          phone: (profile as any).phone || "",
          phone2: (profile as any).phone2 || "",
          phone3: (profile as any).phone3 || "",
          cep: (profile as any).cep || "",
          endereco: (profile as any).endereco || "",
          numero: (profile as any).numero || "",
          complemento: (profile as any).complemento || "",
          bairro: (profile as any).bairro || "",
          cidade: (profile as any).cidade || "",
          uf: (profile as any).uf || "",
        }
      : {};

    // Determine which fields are still missing
    const checkFields = [
      "nome_completo", "email", "phone", "phone2", "phone3",
      "cep", "endereco", "bairro", "cidade", "uf",
    ] as const;
    const missingFields = checkFields.filter(
      (f) => !String((baseFromProfile as any)[f] || "").trim()
    );

    // If profile fully populated for the relevant fields, return as-is
    if (profile && missingFields.length === 0) {
      return {
        ...EMPTY_PROFILE,
        ...baseFromProfile,
        cpf: clean,
        source: (profile as any).source || "client_profiles",
      };
    }

    // Otherwise, fall back to clients to fill missing fields
    const { data: clientRows } = await supabase
      .from("clients")
      .select("nome_completo, email, phone, phone2, phone3, cep, endereco, bairro, cidade, uf")
      .eq("tenant_id", tenantId)
      .or(`cpf.eq.${clean},cpf.eq.${formatCPFDisplay(clean)}`);

    if (!profile && (!clientRows || clientRows.length === 0)) {
      return { ...EMPTY_PROFILE, cpf: clean };
    }

    const consolidated = clientRows && clientRows.length > 0
      ? consolidateFromClients(clientRows)
      : {};

    // Merge: profile values take precedence; fall back to consolidated for empty fields
    const merged: Partial<ClientProfile> = { ...baseFromProfile };
    const filledFromFallback: Partial<ClientProfile> = {};
    for (const f of checkFields) {
      const current = String((merged as any)[f] || "").trim();
      if (!current) {
        const fallback = String((consolidated as any)[f] || "").trim();
        if (fallback) {
          (merged as any)[f] = fallback;
          (filledFromFallback as any)[f] = fallback;
        }
      }
    }

    // Auto-heal canonical profile in background if we filled anything from clients
    if (Object.keys(filledFromFallback).length > 0) {
      const healSource = profile ? "auto_heal_partial" : "auto_consolidation";
      // fire-and-forget — never block boleto generation
      void upsertClientProfile(tenantId, clean, filledFromFallback, healSource).catch((e) => {
        logger.error(MODULE, "auto_heal_fallback", e);
      });
    }

    return {
      ...EMPTY_PROFILE,
      ...merged,
      cpf: clean,
      source: profile ? "merged_profile_clients" : "fallback_clients",
    };
  } catch (err) {
    logger.error(MODULE, "getClientProfile", err, { tenantId, cpf: clean });
    return { ...EMPTY_PROFILE, cpf: clean };
  }
}

/**
 * Upsert client profile — merge non-destructively (never erases existing data).
 */
export async function upsertClientProfile(
  tenantId: string,
  cpf: string,
  data: Partial<ClientProfile>,
  source: string = "system"
): Promise<void> {
  const clean = cleanCPF(cpf);
  if (!tenantId || !clean) return;

  try {
    // Get existing profile first for merge
    const { data: existing } = await supabase
      .from("client_profiles" as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("cpf", clean)
      .maybeSingle();

    const merged = existing
      ? mergeProfile(existing as any, data)
      : data;

    const payload: Record<string, any> = {
      tenant_id: tenantId,
      cpf: clean,
      source,
      updated_at: new Date().toISOString(),
    };

    // Only set fields that have values
    const profileFields = ["nome_completo", "email", "phone", "phone2", "phone3", "cep", "endereco", "numero", "complemento", "bairro", "cidade", "uf"] as const;
    for (const field of profileFields) {
      const val = (merged as any)[field];
      if (val && String(val).trim()) {
        payload[field] = String(val).trim();
      }
    }

    const { error } = await supabase
      .from("client_profiles" as any)
      .upsert(payload as any, { onConflict: "tenant_id,cpf" });

    if (error) throw error;
    logger.info(MODULE, "upsert", { tenantId, cpf: clean, source });
  } catch (err) {
    logger.error(MODULE, "upsertClientProfile", err, { tenantId, cpf: clean });
    throw err;
  }
}

/** Simple CPF formatting helper */
function formatCPFDisplay(cpf: string): string {
  const d = cpf.replace(/\D/g, "").padStart(11, "0");
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
}

export const clientProfileService = {
  getClientProfile,
  upsertClientProfile,
};
