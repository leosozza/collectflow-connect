/**
 * Centralised ViaCEP lookup used by ClientForm, ClientDetailHeader,
 * CobrancaForm and AgreementCalculator.
 */
export interface ViaCepResult {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export type LookupCepDetailedResult =
  | { ok: true; data: ViaCepResult }
  | { ok: false; reason: "invalid_format" | "not_found" | "network" };

export async function lookupCepDetailed(cep: string): Promise<LookupCepDetailedResult> {
  const clean = (cep || "").replace(/\D/g, "");
  if (clean.length !== 8) return { ok: false, reason: "invalid_format" };
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return { ok: false, reason: "network" };
    const data = await res.json();
    if (data?.erro) return { ok: false, reason: "not_found" };
    return { ok: true, data: data as ViaCepResult };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function lookupCep(cep: string): Promise<ViaCepResult | null> {
  const r = await lookupCepDetailed(cep);
  return r.ok ? r.data : null;
}
