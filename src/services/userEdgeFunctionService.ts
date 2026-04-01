import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EdgeFunctionResponse {
  success?: boolean;
  error?: string;
  code?: string;
  message?: string;
  details?: string;
  user_id?: string;
  profile_id?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  SESSION_EXPIRED: "Sessão expirada. Faça logout e login novamente.",
  NO_AUTH_HEADER: "Sessão expirada. Faça logout e login novamente.",
  NO_TENANT: "Seu usuário não possui empresa vinculada.",
  FORBIDDEN: "Apenas administradores podem gerenciar usuários.",
  TENANT_CONFLICT: "Usuário já pertence a outra empresa.",
  VALIDATION_ERROR: "Dados inválidos.",
  AUTH_CREATE_FAILED: "Falha ao criar conta de autenticação.",
  AUTH_CONFLICT: "Conflito de email. Contate o suporte.",
  TENANT_USERS_FAILED: "Falha ao vincular usuário à empresa.",
  PROFILE_FAILED: "Falha ao criar perfil do usuário.",
  PASSWORD_UPDATE_FAILED: "Falha ao atualizar senha.",
  USER_DELETED: "Usuário removido com sucesso!",
  USER_CREATED: "Usuário criado com sucesso!",
  USER_REUSED: "Usuário existente reaproveitado e atualizado.",
  PASSWORD_UPDATED: "Senha alterada com sucesso!",
};

export async function invokeCreateUser(body: Record<string, unknown>): Promise<EdgeFunctionResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw { code: "SESSION_EXPIRED", message: ERROR_MESSAGES.SESSION_EXPIRED };
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });

  const result: EdgeFunctionResponse = await response.json().catch(() => ({
    error: `HTTP ${response.status}`,
    code: "NETWORK_ERROR",
  }));

  if (!response.ok || result.error) {
    const code = result.code || "UNKNOWN";
    const message = result.message || result.error || ERROR_MESSAGES[code] || "Erro desconhecido";
    throw { code, message, details: result.details };
  }

  return result;
}

export function handleEdgeFunctionError(err: any): string {
  const code = err?.code || "";
  const message = err?.message || err?.toString() || "Erro desconhecido";

  // Map known codes to friendly messages
  if (ERROR_MESSAGES[code]) {
    return err.details ? `${ERROR_MESSAGES[code]} ${err.details}` : ERROR_MESSAGES[code];
  }

  // Fallback for generic network/fetch errors
  if (message.includes("401") || message.includes("Unauthorized") || code === "SESSION_EXPIRED") {
    return ERROR_MESSAGES.SESSION_EXPIRED;
  }

  return message;
}

export function showEdgeFunctionResult(result: EdgeFunctionResponse, fallbackName?: string) {
  const code = result.code || "";
  if (code === "USER_REUSED") {
    toast.success(result.message || ERROR_MESSAGES.USER_REUSED);
  } else if (code === "USER_CREATED") {
    toast.success(fallbackName ? `Usuário ${fallbackName} criado com sucesso!` : ERROR_MESSAGES.USER_CREATED);
  } else if (code === "USER_DELETED") {
    toast.success(ERROR_MESSAGES.USER_DELETED);
  } else if (code === "PASSWORD_UPDATED") {
    toast.success(ERROR_MESSAGES.PASSWORD_UPDATED);
  } else {
    toast.success(result.message || "Operação realizada com sucesso!");
  }
}
