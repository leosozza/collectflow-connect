import { supabase } from "@/integrations/supabase/client";

export type PhoneSlot = "phone" | "phone2" | "phone3";

interface PromoteParams {
  cpf: string;
  credor: string;
  tenantId: string;
  slotOrigem: PhoneSlot;
}

/**
 * Promove um telefone (phone2 ou phone3) ao slot principal (phone = "Hot").
 * Rotaciona os 3 slots preservando todos os números, e propaga para todos
 * os registros do mesmo CPF+credor + para client_profiles (SSOT).
 */
export async function promotePhoneToHot({
  cpf,
  credor,
  tenantId,
  slotOrigem,
}: PromoteParams): Promise<{ oldHot: string | null; newHot: string | null }> {
  if (slotOrigem === "phone") {
    return { oldHot: null, newHot: null };
  }

  // 1) Lê estado atual (qualquer registro do CPF+credor serve)
  const { data: current, error: readErr } = await supabase
    .from("clients")
    .select("phone, phone2, phone3")
    .eq("tenant_id", tenantId)
    .eq("cpf", cpf)
    .eq("credor", credor)
    .limit(1)
    .maybeSingle();

  if (readErr) throw readErr;
  if (!current) throw new Error("Registro do cliente não encontrado");

  const p1 = current.phone ?? null;
  const p2 = current.phone2 ?? null;
  const p3 = current.phone3 ?? null;

  let newP1: string | null;
  let newP2: string | null;
  let newP3: string | null;

  if (slotOrigem === "phone2") {
    // p2 vira p1; p1 antigo desce para p2; p3 permanece
    newP1 = p2;
    newP2 = p1;
    newP3 = p3;
  } else {
    // slotOrigem === "phone3"
    // p3 vira p1; p1 antigo vira p2; p2 antigo vira p3
    newP1 = p3;
    newP2 = p1;
    newP3 = p2;
  }

  // 2) UPDATE em todos os registros do CPF+credor (carteira agrupada)
  const { error: updErr } = await supabase
    .from("clients")
    .update({ phone: newP1, phone2: newP2, phone3: newP3 })
    .eq("tenant_id", tenantId)
    .eq("cpf", cpf)
    .eq("credor", credor);

  if (updErr) throw updErr;

  // 3) UPDATE em client_profiles (SSOT canônica por CPF/tenant)
  await supabase
    .from("client_profiles")
    .update({ phone: newP1, phone2: newP2, phone3: newP3 })
    .eq("tenant_id", tenantId)
    .eq("cpf", cpf);

  // 4) Registra evento na timeline
  const { data: userData } = await supabase.auth.getUser();
  await supabase.from("client_events").insert({
    tenant_id: tenantId,
    client_cpf: cpf,
    event_source: "operator",
    event_type: "phone_promoted_hot",
    event_value: newP1,
    metadata: {
      old_hot: p1,
      new_hot: newP1,
      slot_origem: slotOrigem,
      credor,
      operator_id: userData?.user?.id ?? null,
    },
  });

  return { oldHot: p1, newHot: newP1 };
}
