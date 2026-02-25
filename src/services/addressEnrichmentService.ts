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
      { headers }
    );
    if (!searchResp.ok) { cache.set(contractNumber, emptyAddress()); return null; }
    const searchJson = await searchResp.json();
    const modelId = searchJson.item?.Id;
    if (!modelId) { cache.set(contractNumber, emptyAddress()); return null; }

    const detResp = await fetchWithTimeout(
      `${supabaseUrl}/functions/v1/maxsystem-proxy?action=model-details&modelId=${modelId}`,
      { headers }
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
  } catch {
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
 */
export async function enrichClientAddress(
  cpf: string,
  tenantId: string,
  onProgress?: (msg: string) => void
): Promise<AddressData | null> {
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, cod_contrato, endereco")
    .eq("cpf", cpf)
    .eq("tenant_id", tenantId);

  if (error || !clients?.length) return null;

  // Check if already has address
  const hasAddress = clients.some((c: any) => c.endereco && c.endereco.trim() !== "");
  if (hasAddress) {
    const withAddr = clients.find((c: any) => c.endereco && c.endereco.trim() !== "");
    // Return existing address - no need to fetch
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
  )];

  if (uniqueContracts.length === 0) return null;

  onProgress?.("Buscando endereço...");

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token || "";
  const cache = new Map<string, AddressData>();

  // Fetch addresses in parallel batches of 5
  for (let i = 0; i < uniqueContracts.length; i += 5) {
    const batch = uniqueContracts.slice(i, i + 5);
    await Promise.all(batch.map((c) => fetchAddressForContract(c, token, cache)));
  }

  // Find first valid address
  let bestAddress: AddressData | null = null;
  for (const addr of cache.values()) {
    if (addr.endereco) {
      bestAddress = addr;
      break;
    }
  }

  if (!bestAddress) return null;

  onProgress?.("Atualizando endereço...");

  // Update all client records for this CPF with the address
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
      observacoes: bestAddress.model_name ? `Modelo: ${bestAddress.model_name}` : undefined,
    } as any)
    .in("id", clientIds);

  return bestAddress;
}
