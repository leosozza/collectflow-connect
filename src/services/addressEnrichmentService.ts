import { supabase } from "@/integrations/supabase/client";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

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

/**
 * Enrich client address data by fetching from MaxSystem API.
 * Looks up unique cod_contrato values for the given CPF, fetches address,
 * and updates the clients table.
 *
 * Optimisations vs original:
 * - Limited to 3 most-recent contracts (avoids excessive requests).
 * - 8 s timeout per request (was 30 s).
 * - Early exit as soon as a valid address is found.
 * - Update of clients table wrapped in isolated try/catch — failures
 *   do not prevent the address from being returned.
 */
export async function enrichClientAddress(
  cpf: string,
  tenantId: string,
  onProgress?: (msg: string) => void
): Promise<AddressData | null> {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, cod_contrato, endereco, created_at")
    .eq("cpf", cpf)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error || !clients?.length) return null;

  // Check if already has address
  const hasAddress = clients.some((c: any) => c.endereco && c.endereco.trim() !== "");
  if (hasAddress) {
    const withAddr = clients.find((c: any) => c.endereco && c.endereco.trim() !== "");
    const { data: full } = await supabase
      .from("clients")
      .select("endereco, cep, bairro, cidade, uf, email")
      .eq("id", withAddr!.id)
      .single();
    return full as AddressData || null;
  }

  const uniqueContracts = [...new Set(
    clients
      .map((c: any) => (c.cod_contrato || "").trim())
      .filter(Boolean)
  )].slice(0, 3); // Limit to 3 most-recent contracts

  if (uniqueContracts.length === 0) return null;

  onProgress?.("Buscando endereço...");

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token || "";
  const cache = new Map<string, AddressData>();

  // Fetch sequentially with early exit on first valid address
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

  // Update all client records — isolated so failures don't block the return
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
    console.warn("[address-enrichment] client update failed (non-blocking):", updateErr);
  }

  return bestAddress;
}
