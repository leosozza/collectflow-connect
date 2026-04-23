import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatPhone } from "@/lib/formatters";

/**
 * Centraliza a discagem ativa via 3CPlus (click2call).
 *
 * Comportamentos:
 * - Operador conectado e idle/paused → dispara `click2call` direto.
 * - Operador sem agent_id ou desconectado → grava intenção em pendingCall e
 *   redireciona para a tela de Telefonia (onde ele se conecta). Quando o
 *   `useThreeCPlusStatus` detectar status `idle`, o dispatcher (registrado no
 *   AtendimentoModalProvider) vai consumir o pendingCall e discar automaticamente.
 * - Operador em on_call/acw → bloqueia e mostra toast.
 */

export interface PendingCall {
  phone: string;
  clientId?: string | null;
  tenantId: string;
  createdAt: number;
}

const PENDING_CALL_KEY = "rivo_pending_call_v1";
const PENDING_CALL_TTL_MS = 2 * 60 * 1000;

export function setPendingCall(call: PendingCall) {
  try {
    sessionStorage.setItem(PENDING_CALL_KEY, JSON.stringify(call));
  } catch {
    // ignore
  }
}

export function getPendingCall(): PendingCall | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CALL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingCall;
    if (Date.now() - parsed.createdAt > PENDING_CALL_TTL_MS) {
      sessionStorage.removeItem(PENDING_CALL_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingCall() {
  try {
    sessionStorage.removeItem(PENDING_CALL_KEY);
  } catch {
    // ignore
  }
}

interface DialOptions {
  tenantId: string;
  agentId: number | null | undefined;
  phone: string;
  clientId?: string | null;
  /** Status atual do agente no 3CPlus (do useThreeCPlusStatus). */
  agentStatus?: number | string | undefined;
  /** Se true, considera o operador conectado mesmo sem status definido (ex.: AtendimentoPage). */
  assumeConnected?: boolean;
  /** Callback opcional para navegar para a tela de telefonia (caso desconectado). */
  onNeedsConnection?: () => void;
}

interface DialResult {
  outcome: "dialed" | "queued" | "blocked";
  message?: string;
}

const isBusyStatus = (status: number | string | undefined): boolean => {
  // 3CPlus status: 1=idle, 2=on_call, 3=acw/wrap-up, 4=paused
  if (status === 2 || status === 3) return true;
  if (status === "on_call" || status === "acw" || status === "wrap-up") return true;
  return false;
};

const isConnectedStatus = (status: number | string | undefined): boolean => {
  if (status === undefined || status === null) return false;
  if (status === 0 || status === "offline") return false;
  return true;
};

export async function dialClientPhone(opts: DialOptions): Promise<DialResult> {
  const { tenantId, agentId, phone, clientId, agentStatus, assumeConnected, onNeedsConnection } = opts;

  const cleanPhone = (phone || "").replace(/\D/g, "");
  if (!cleanPhone) {
    toast.error("Telefone inválido");
    return { outcome: "blocked", message: "phone_invalid" };
  }

  if (isBusyStatus(agentStatus)) {
    toast.error("Finalize a chamada atual antes de discar para outro número");
    return { outcome: "blocked", message: "agent_busy" };
  }

  if (!agentId) {
    toast.error("Seu usuário não está vinculado a um ramal 3CPlus", {
      description: "Solicite ao administrador em Cadastros → Usuários.",
    });
    return { outcome: "blocked", message: "no_agent_id" };
  }

  // Carrega credenciais do tenant
  const { data: tenantData, error: tenantErr } = await supabase
    .from("tenants")
    .select("settings")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantErr) {
    toast.error("Erro ao consultar credenciais 3CPlus");
    return { outcome: "blocked", message: "tenant_fetch_error" };
  }

  const settings = (tenantData?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain;
  const apiToken = settings.threecplus_api_token;

  if (!domain || !apiToken) {
    toast.error("3CPlus não configurada para este tenant");
    return { outcome: "blocked", message: "no_credentials" };
  }

  // Operador desconectado → grava pendente e pede conexão
  const connected = assumeConnected || isConnectedStatus(agentStatus);
  if (!connected) {
    setPendingCall({ phone: cleanPhone, clientId: clientId ?? null, tenantId, createdAt: Date.now() });
    toast.info("Conecte-se ao 3CPlus para discar", {
      description: `Após conectar, ligaremos automaticamente para ${formatPhone(cleanPhone)}.`,
      duration: 6000,
    });
    if (onNeedsConnection) {
      onNeedsConnection();
    } else {
      // Fallback: navega via window.location (não temos router aqui)
      window.location.href = "/contact-center/telefonia";
    }
    return { outcome: "queued", message: "needs_connection" };
  }

  // Conectado → dispara click2call
  try {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: {
        action: "click2call",
        domain,
        api_token: apiToken,
        agent_id: agentId,
        phone_number: cleanPhone,
        client_id: clientId ?? undefined,
      },
    });

    if (error) throw error;

    if (data?.status && data.status >= 400) {
      const detail =
        data.detail ||
        data.message ||
        (Array.isArray(data.errors) ? data.errors[0] : null) ||
        "Erro ao discar";
      const lower = String(detail).toLowerCase();
      if (lower.includes("não está online") || lower.includes("not online")) {
        toast.error("Agente não está online no 3CPlus", {
          description: "Faça login na plataforma de telefonia antes de discar.",
        });
      } else {
        toast.error(detail);
      }
      return { outcome: "blocked", message: detail };
    }

    toast.success(`Discando para ${formatPhone(cleanPhone)}…`);
    return { outcome: "dialed" };
  } catch (e: any) {
    toast.error(e?.message || "Erro ao iniciar ligação");
    return { outcome: "blocked", message: e?.message };
  }
}
