import { supabase } from "@/integrations/supabase/client";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { upsertClientProfile } from "@/services/clientProfileService";
import { cleanCPF, formatCPFDisplay } from "@/lib/cpfUtils";

const UF_MAP: Record<number, string> = {
  1: "AC", 2: "AL", 3: "AP", 4: "AM", 5: "BA", 6: "CE", 7: "DF", 8: "ES",
  9: "GO", 10: "MA", 11: "MT", 12: "MS", 13: "MG", 14: "PA", 15: "PB",
  16: "PR", 17: "PE", 18: "PI", 19: "RJ", 20: "RN", 21: "RS", 22: "RO",
  23: "RR", 24: "SC", 25: "SP", 26: "SE", 27: "TO",
};

export interface AddressData {
  endereco: string | null;
  cep: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  email: string | null;
  model_name: string | null;
}

const REQUEST_TIMEOUT_MS = 8_000;

async function fetchAddressForContract(
  contractNumber: string,
  token: string,
  cache: Map<string, AddressData>
): Promise<AddressData | null> {
  if (cache.has(contractNumber)) return cache.get(contractNumber)!;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
    const searchResp = await fetchWithTimeout(
      `${supabaseUrl}/functions/v1/maxsystem-proxy?action=model-search&contractNumber=${contractNumber}`,
      { headers, timeoutMs: REQUEST_TIMEOUT_MS }
    );
    if (!searchResp.ok) { cache.set(contractNumber, emptyAddress()); return null; }
    const searchJson = await searchResp.json();
    const modelId = searchJson.item?.Id;
    if (!modelId) { cache.set(contractNumber, emptyAddress()); return null; }

    const detResp = await fetchWithTimeout(
      `${supabaseUrl}/functions/v1/maxsystem-proxy?action=model-details&modelId=${modelId}`,
      { headers, timeoutMs: REQUEST_TIMEOUT_MS }
    );
    if (!detResp.ok) { cache.set(contractNumber, emptyAddress()); return null; }
    const raw = await detResp.json();

    const addr: AddressData = {
      endereco: raw.Address || null,
      cep: raw.CEP || null,
      bairro: raw.Neighborhood || null,
      cidade: raw.City || null,
      uf: typeof raw.State === "number" ? (UF_MAP[raw.State] || null) : (raw.State || null),
      email: raw.Email || null,
      model_name: raw.ModelName || null,
    };
    cache.set(contractNumber, addr);
    return addr;
  } catch (err) {
    console.warn("[address-enrichment] failed for contract", contractNumber, err);
    cache.set(contractNumber, emptyAddress());
    return null;
  }
}

function emptyAddress(): AddressData {
  return { endereco: null, cep: null, bairro: null, cidade: null, uf: null, email: null, model_name: null };
}

/** Build ".or" filter that matches both raw and formatted CPF in the clients table */
function cpfOrFilter(rawCpf: string): string {
  const formatted = formatCPFDisplay(rawCpf);
  return `cpf.eq.${rawCpf},cpf.eq.${formatted}`;
}

/** Sync canonical client_profiles with the resolved address (best-effort) */
async function syncProfileFromAddress(
  tenantId: string,
  rawCpf: string,
  addr: Partial<AddressData>,
  source: string
): Promise<void> {
  try {
    const payload: Record<string, string> = {};
    if (addr.endereco) payload.endereco = addr.endereco;
    if (addr.cep) payload.cep = addr.cep;
    if (addr.bairro) payload.bairro = addr.bairro;
    if (addr.cidade) payload.cidade = addr.cidade;
    if (addr.uf) payload.uf = addr.uf;
    if (addr.email) payload.email = addr.email;
    if (Object.keys(payload).length === 0) return;
    await upsertClientProfile(tenantId, rawCpf, payload as any, source);
  } catch (err) {
    console.warn("[address-enrichment] profile sync failed (non-blocking):", err);
  }
}

/**
 * Enrich client address data by fetching from MaxSystem API.
 *
 * Canonical source of truth is `client_profiles`. This function ensures that
 * BOTH `clients` and `client_profiles` are kept in sync, regardless of where
 * the address ultimately comes from (existing clients row or MaxSystem).
 *
 * CPF lookup is normalized: matches BOTH raw (11 digits) and formatted
 * (000.000.000-00) variants, since the codebase historically uses both.
 */
export async function enrichClientAddress(
  cpf: string,
  tenantId: string,
  onProgress?: (msg: string) => void
): Promise<AddressData | null> {
  const rawCpf = cleanCPF(cpf);
  if (!tenantId || !rawCpf) return null;

  // Match both raw and formatted CPF
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, cod_contrato, endereco, cep, bairro, cidade, uf, email, created_at")
    .or(cpfOrFilter(rawCpf))
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error || !clients?.length) return null;

  // If at least one row already has an address, consolidate from clients and
  // sync the canonical profile, then return.
  const hasAddress = clients.some((c: any) => c.endereco && String(c.endereco).trim() !== "");
  if (hasAddress) {
    const consolidated: Partial<AddressData> = {
      endereco: null, cep: null, bairro: null, cidade: null, uf: null, email: null, model_name: null,
    };
    const fields: (keyof AddressData)[] = ["endereco", "cep", "bairro", "cidade", "uf", "email"];
    for (const field of fields) {
      for (const c of clients as any[]) {
        const val = c[field];
        if (val && String(val).trim()) {
          (consolidated as any)[field] = String(val).trim();
          break;
        }
      }
    }

    // Sync canonical profile (best-effort)
    await syncProfileFromAddress(tenantId, rawCpf, consolidated, "consolidation_existing");

    return {
      endereco: consolidated.endereco ?? null,
      cep: consolidated.cep ?? null,
      bairro: consolidated.bairro ?? null,
      cidade: consolidated.cidade ?? null,
      uf: consolidated.uf ?? null,
      email: consolidated.email ?? null,
      model_name: null,
    };
  }

  // No address present → query MaxSystem via contracts
  const uniqueContracts = [...new Set(
    clients
      .map((c: any) => (c.cod_contrato || "").trim())
      .filter(Boolean)
  )].slice(0, 3);

  if (uniqueContracts.length === 0) return null;

  onProgress?.("Buscando endereço...");

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token || "";
  const cache = new Map<string, AddressData>();

  let bestAddress: AddressData | null = null;
  for (const contract of uniqueContracts) {
    const addr = await fetchAddressForContract(contract, token, cache);
    if (addr?.endereco) {
      bestAddress = addr;
      break;
    }
  }

  if (!bestAddress) return null;

  onProgress?.("Atualizando endereço...");

  // Update all client rows of same CPF (raw + formatted) — non-blocking on failure
  try {
    const clientIds = clients.map((c: any) => c.id);
    await supabase
      .from("clients")
      .update({
        endereco: bestAddress.endereco,
        cep: bestAddress.cep,
        bairro: bestAddress.bairro,
        cidade: bestAddress.cidade,
        uf: bestAddress.uf,
        email: bestAddress.email,
        model_name: bestAddress.model_name || undefined,
      } as any)
      .in("id", clientIds);
  } catch (updateErr) {
    console.warn("[address-enrichment] clients update failed (non-blocking):", updateErr);
  }

  // Sync canonical profile so generate-agreement-boletos sees the data
  await syncProfileFromAddress(tenantId, rawCpf, bestAddress, "maxsystem_enrichment");

  return bestAddress;
}
