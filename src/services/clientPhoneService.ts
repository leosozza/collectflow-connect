import { supabase } from "@/integrations/supabase/client";

export type PhoneSlot = "phone" | "phone2" | "phone3";

interface BaseParams {
  cpf: string;
  credor: string;
  tenantId: string;
}

interface PromoteParams extends BaseParams {
  slotOrigem: PhoneSlot;
}

export interface PhoneSlotMetadata {
  slot: PhoneSlot;
  observacao: string | null;
  is_inactive: boolean;
}

/**
 * Lê metadados (observação + inativo) de todos os slots para o CPF+credor.
 */
export async function fetchPhoneMetadata({
  cpf,
  credor,
  tenantId,
}: BaseParams): Promise<Record<PhoneSlot, PhoneSlotMetadata>> {
  const empty: Record<PhoneSlot, PhoneSlotMetadata> = {
    phone: { slot: "phone", observacao: null, is_inactive: false },
    phone2: { slot: "phone2", observacao: null, is_inactive: false },
    phone3: { slot: "phone3", observacao: null, is_inactive: false },
  };

  const { data, error } = await supabase
    .from("client_phone_metadata")
    .select("slot, observacao, is_inactive")
    .eq("tenant_id", tenantId)
    .eq("cpf", cpf)
    .eq("credor", credor);

  if (error) throw error;

  (data || []).forEach((row: any) => {
    if (row.slot in empty) {
      empty[row.slot as PhoneSlot] = {
        slot: row.slot,
        observacao: row.observacao,
        is_inactive: !!row.is_inactive,
      };
    }
  });

  return empty;
}

async function upsertPhoneMetadata({
  cpf,
  credor,
  tenantId,
  slot,
  patch,
}: BaseParams & { slot: PhoneSlot; patch: { observacao?: string | null; is_inactive?: boolean } }) {
  const { error } = await supabase
    .from("client_phone_metadata")
    .upsert(
      {
        tenant_id: tenantId,
        cpf,
        credor,
        slot,
        ...patch,
      },
      { onConflict: "tenant_id,cpf,credor,slot" }
    );
  if (error) throw error;
}

/**
 * Atualiza a observação textual de um slot.
 */
export async function updatePhoneObservation(
  params: BaseParams & { slot: PhoneSlot; observacao: string | null }
) {
  await upsertPhoneMetadata({
    cpf: params.cpf,
    credor: params.credor,
    tenantId: params.tenantId,
    slot: params.slot,
    patch: { observacao: params.observacao },
  });
}

/**
 * Alterna o flag de inativo. Se o slot inativado for o "phone" (Hot), promove
 * o próximo slot ativo a Hot automaticamente.
 */
export async function togglePhoneInactive(
  params: BaseParams & { slot: PhoneSlot; isInactive: boolean }
): Promise<{ promotedFrom?: PhoneSlot }> {
  await upsertPhoneMetadata({
    cpf: params.cpf,
    credor: params.credor,
    tenantId: params.tenantId,
    slot: params.slot,
    patch: { is_inactive: params.isInactive },
  });

  // Auto-promote se o Hot foi inativado
  if (params.slot === "phone" && params.isInactive) {
    const { data: current } = await supabase
      .from("clients")
      .select("phone, phone2, phone3")
      .eq("tenant_id", params.tenantId)
      .eq("cpf", params.cpf)
      .eq("credor", params.credor)
      .limit(1)
      .maybeSingle();

    if (!current) return {};
    const meta = await fetchPhoneMetadata(params);
    // Procura próximo slot com número e ativo
    for (const s of ["phone2", "phone3"] as PhoneSlot[]) {
      const val = (current as any)[s];
      if (val && !meta[s].is_inactive) {
        await promotePhoneToHot({
          cpf: params.cpf,
          credor: params.credor,
          tenantId: params.tenantId,
          slotOrigem: s,
        });
        return { promotedFrom: s };
      }
    }
  }
  return {};
}

/**
 * Atualiza o NÚMERO em si de um slot (texto), em todos os registros do CPF+credor
 * e propaga para client_profiles. Registra evento na timeline.
 */
export async function updatePhoneNumber(
  params: BaseParams & { slot: PhoneSlot; newValue: string | null }
) {
  const update: any = { [params.slot]: params.newValue || null };

  const { data: prev } = await supabase
    .from("clients")
    .select(params.slot)
    .eq("tenant_id", params.tenantId)
    .eq("cpf", params.cpf)
    .eq("credor", params.credor)
    .limit(1)
    .maybeSingle();

  const { error: updErr } = await supabase
    .from("clients")
    .update(update)
    .eq("tenant_id", params.tenantId)
    .eq("cpf", params.cpf)
    .eq("credor", params.credor);
  if (updErr) throw updErr;

  await supabase
    .from("client_profiles")
    .update(update)
    .eq("tenant_id", params.tenantId)
    .eq("cpf", params.cpf);

  const { data: userData } = await supabase.auth.getUser();
  await supabase.from("client_events").insert({
    tenant_id: params.tenantId,
    client_cpf: params.cpf,
    event_source: "operator",
    event_type: "phone_updated",
    event_value: params.newValue,
    metadata: {
      slot: params.slot,
      old_value: (prev as any)?.[params.slot] ?? null,
      new_value: params.newValue,
      credor: params.credor,
      operator_id: userData?.user?.id ?? null,
    },
  });
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
    newP1 = p2;
    newP2 = p1;
    newP3 = p3;
  } else {
    newP1 = p3;
    newP2 = p1;
    newP3 = p2;
  }

  const { error: updErr } = await supabase
    .from("clients")
    .update({ phone: newP1, phone2: newP2, phone3: newP3 })
    .eq("tenant_id", tenantId)
    .eq("cpf", cpf)
    .eq("credor", credor);

  if (updErr) throw updErr;

  await supabase
    .from("client_profiles")
    .update({ phone: newP1, phone2: newP2, phone3: newP3 })
    .eq("tenant_id", tenantId)
    .eq("cpf", cpf);

  // Rotaciona também os METADATA (observação/inativo) seguindo a mesma rotação
  const meta = await fetchPhoneMetadata({ cpf, credor, tenantId });
  let mP1 = meta.phone;
  let mP2 = meta.phone2;
  let mP3 = meta.phone3;
  let nM1, nM2, nM3;
  if (slotOrigem === "phone2") {
    nM1 = mP2; nM2 = mP1; nM3 = mP3;
  } else {
    nM1 = mP3; nM2 = mP1; nM3 = mP2;
  }
  await Promise.all([
    upsertPhoneMetadata({ cpf, credor, tenantId, slot: "phone", patch: { observacao: nM1.observacao, is_inactive: nM1.is_inactive } }),
    upsertPhoneMetadata({ cpf, credor, tenantId, slot: "phone2", patch: { observacao: nM2.observacao, is_inactive: nM2.is_inactive } }),
    upsertPhoneMetadata({ cpf, credor, tenantId, slot: "phone3", patch: { observacao: nM3.observacao, is_inactive: nM3.is_inactive } }),
  ]);

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
