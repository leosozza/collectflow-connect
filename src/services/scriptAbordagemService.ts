import { supabase } from "@/integrations/supabase/client";

export interface ScriptAbordagem {
  id: string;
  tenant_id: string;
  credor_id: string | null;
  tipo_devedor_id: string | null;
  canal: string;
  titulo: string;
  conteudo: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tipo_devedor?: { nome: string } | null;
}

export const CANAL_OPTIONS = [
  { value: "telefone", label: "Telefone / Discador" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "geral", label: "Geral (todos os canais)" },
];

export const SCRIPT_VARIABLES = [
  { key: "{{nome}}", label: "Nome do devedor" },
  { key: "{{valor}}", label: "Valor da dívida" },
  { key: "{{credor}}", label: "Nome do credor" },
  { key: "{{vencimento}}", label: "Data de vencimento" },
  { key: "{{parcelas}}", label: "Número de parcelas" },
  { key: "{{operador}}", label: "Nome do operador" },
];

export const resolveScriptVariables = (
  template: string,
  vars: {
    nome?: string;
    valor?: string | number;
    credor?: string;
    vencimento?: string;
    parcelas?: string | number;
    operador?: string;
  }
): string => {
  let result = template;
  result = result.replace(/\{\{nome\}\}/g, vars.nome || "cliente");
  result = result.replace(
    /\{\{valor\}\}/g,
    vars.valor != null
      ? Number(vars.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "—"
  );
  result = result.replace(/\{\{credor\}\}/g, vars.credor || "—");
  result = result.replace(
    /\{\{vencimento\}\}/g,
    vars.vencimento
      ? new Date(vars.vencimento).toLocaleDateString("pt-BR")
      : "—"
  );
  result = result.replace(/\{\{parcelas\}\}/g, String(vars.parcelas ?? "—"));
  result = result.replace(/\{\{operador\}\}/g, vars.operador || "—");
  return result;
};

export const fetchScriptsByCredor = async (credorId: string): Promise<ScriptAbordagem[]> => {
  const { data, error } = await supabase
    .from("scripts_abordagem" as any)
    .select("*, tipo_devedor:tipo_devedor_id(nome)")
    .eq("credor_id", credorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as ScriptAbordagem[]) || [];
};

export const fetchScriptForClient = async (params: {
  credorNome: string;
  tipoDevedorId?: string | null;
  canal?: string;
  tenantId: string;
}): Promise<ScriptAbordagem | null> => {
  // Try to find by credor name + tipo_devedor first
  let query = supabase
    .from("scripts_abordagem" as any)
    .select("*, credores!scripts_abordagem_credor_id_fkey(razao_social)")
    .eq("is_active", true)
    .eq("tenant_id", params.tenantId);

  if (params.canal && params.canal !== "geral") {
    query = query.in("canal", [params.canal, "geral"]);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return null;

  const list = data as any[];

  // Priority 1: match credor (by name) + tipo_devedor
  if (params.tipoDevedorId) {
    const match = list.find(
      (s) =>
        s.credores?.razao_social === params.credorNome &&
        s.tipo_devedor_id === params.tipoDevedorId
    );
    if (match) return match as unknown as ScriptAbordagem;
  }

  // Priority 2: match credor only
  const matchCredorOnly = list.find(
    (s) => s.credores?.razao_social === params.credorNome && !s.tipo_devedor_id
  );
  if (matchCredorOnly) return matchCredorOnly as unknown as ScriptAbordagem;

  // Priority 3: tipo_devedor only (global credor)
  if (params.tipoDevedorId) {
    const matchTipo = list.find(
      (s) => !s.credor_id && s.tipo_devedor_id === params.tipoDevedorId
    );
    if (matchTipo) return matchTipo as unknown as ScriptAbordagem;
  }

  // Priority 4: global (no credor, no tipo)
  const global = list.find((s) => !s.credor_id && !s.tipo_devedor_id);
  return (global as unknown as ScriptAbordagem) || null;
};

export const createScript = async (
  script: Omit<ScriptAbordagem, "id" | "created_at" | "updated_at" | "tipo_devedor">
): Promise<ScriptAbordagem> => {
  const { data, error } = await supabase
    .from("scripts_abordagem" as any)
    .insert(script as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ScriptAbordagem;
};

export const updateScript = async (id: string, updates: Partial<ScriptAbordagem>): Promise<void> => {
  const { tipo_devedor: _t, ...rest } = updates as any;
  const { error } = await supabase
    .from("scripts_abordagem" as any)
    .update(rest)
    .eq("id", id);
  if (error) throw error;
};

export const deleteScript = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("scripts_abordagem" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
};
