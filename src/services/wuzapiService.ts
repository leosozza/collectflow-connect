import { supabase } from "@/integrations/supabase/client";

// WuzAPI-specific: only user creation remains provider-specific

async function callWuzapiProxy(action: string, body: Record<string, any>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const resp = await fetch(`${supabaseUrl}/functions/v1/wuzapi-proxy?action=${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await resp.json();
  if (!resp.ok) {
    throw new Error(result?.error || `Erro na ação ${action}`);
  }
  return result;
}

/** Create WuzAPI user (provider-specific, needs serverUrl + adminToken) */
export async function createWuzapiUser(serverUrl: string, adminToken: string, userId: string, userPassword: string) {
  return callWuzapiProxy("create", { serverUrl, adminToken, userId, userPassword });
}
