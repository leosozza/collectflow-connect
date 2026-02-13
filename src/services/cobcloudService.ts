import { supabase } from "@/integrations/supabase/client";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cobcloud-proxy`;

async function callProxy(action: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...body }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

export interface PreviewResult {
  total: number;
  byStatus: Record<string, number>;
}

export interface ImportFilters {
  cpf?: string;
  status?: string;
  date_type?: string;
  date_value?: string;
}

export const cobcloudService = {
  testConnection: () => callProxy("status"),

  preview: (filters?: { date_type?: string; date_value?: string }): Promise<PreviewResult> =>
    callProxy("preview", filters || {}),

  importTitulos: (filters?: { page?: number; limit?: number; cpf?: string; status?: string }) =>
    callProxy("import-titulos", filters || {}),

  importAll: (filters?: ImportFilters) =>
    callProxy("import-all", (filters || {}) as Record<string, unknown>),

  exportDevedores: (clientIds: string[]) =>
    callProxy("export-devedores", { clientIds }),

  baixarTitulo: (tituloId: string, valorPago?: number, dataPagamento?: string) =>
    callProxy("baixar-titulo", { tituloId, valorPago, dataPagamento }),
};
