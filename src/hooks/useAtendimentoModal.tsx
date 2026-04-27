import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useThreeCPlusStatus, type ThreeCPlusAgentState, dismissCallId } from "./useThreeCPlusStatus";
import { useThreeCPlusSocket, THREECPLUS_EVENTS, type SocketStatus } from "./useThreeCPlusSocket";
import { useTenant } from "./useTenant";
import { useAuth } from "./useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { dialClientPhone, getPendingCall, clearPendingCall } from "@/services/callService";
import { normalizePhone } from "@/lib/cpfUtils";
import { toast } from "sonner";

interface AtendimentoModalContextType {
  setAgentStatus: (status: number | string | undefined) => void;
  setOnFinishDisposition: (fn: (() => Promise<void>) | null) => void;
  agentStatus: number | string | undefined;
  onFinishDisposition: (() => Promise<void>) | null;
  /** Live 3CPlus status from independent polling — always available */
  liveAgentState: ThreeCPlusAgentState;
  /** Realtime socket status (for badges in panels) */
  socketStatus: SocketStatus;
  socketLastEventAt: Date | null;
  socketLastEventName: string | null;
  socketErrorMessage: string | null;
  socketReconnect: () => void;
}

const AtendimentoModalContext = createContext<AtendimentoModalContextType | undefined>(undefined);

export const useAtendimentoModal = () => {
  const ctx = useContext(AtendimentoModalContext);
  if (!ctx) throw new Error("useAtendimentoModal must be used within AtendimentoModalProvider");
  return ctx;
};

const noop = () => {};

const defaultLiveState: ThreeCPlusAgentState = { status: undefined, callId: null, isOnline: false, lastPoll: null, activeCallPhone: null, activeCallCpf: null, activeCallClientDbId: null };

/** Safe version that returns no-op defaults when used outside the provider */
export const useAtendimentoModalSafe = (): AtendimentoModalContextType => {
  const ctx = useContext(AtendimentoModalContext);
  if (!ctx) {
    return {
      setAgentStatus: noop,
      setOnFinishDisposition: noop,
      agentStatus: undefined,
      onFinishDisposition: null,
      liveAgentState: defaultLiveState,
      socketStatus: "idle",
      socketLastEventAt: null,
      socketLastEventName: null,
      socketErrorMessage: null,
      socketReconnect: noop,
    };
  }
  return ctx;
};

/** Map raw socket payload to canonical fields used by RIVO */
function extractCallMeta(payload: any) {
  const p = payload || {};
  const call = p.call || p.data || p;
  const callId = call?.telephony_id || call?.call_id || call?.id || p?.telephony_id || p?.call_id || p?.id || null;
  const phone = call?.phone || p?.phone || call?.remote_phone || null;
  const cpf = call?.identifier || call?.mailing_identifier || p?.identifier || null;
  const clientDbId = call?.Extra3 || call?.extra3 || call?.mailing_extra3 || p?.Extra3 || p?.extra3 || null;
  const agentId = call?.agent || call?.agent_id || p?.agent || p?.agent_id || null;
  const campaignId = call?.campaign_id || call?.campaign?.id || p?.campaign_id || null;
  return { callId, phone, cpf, clientDbId, agentId, campaignId };
}

export const AtendimentoModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [agentStatusState, setAgentStatusState] = useState<number | string | undefined>(undefined);
  const onFinishDispositionRef = useRef<(() => Promise<void>) | null>(null);
  const [, forceUpdate] = useState(0);
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const lastDispatchedRef = useRef<string | null>(null);

  // Shared live polling — runs independently of TelefoniaDashboard (kept as fallback)
  const liveAgentState = useThreeCPlusStatus();

  // Realtime socket
  const socket = useThreeCPlusSocket();

  // Mirror socket-derived agent state on top of the polling-derived one
  const [socketAgentOverride, setSocketAgentOverride] = useState<Partial<ThreeCPlusAgentState>>({});
  const mergedLiveAgentState: ThreeCPlusAgentState = {
    ...liveAgentState,
    ...socketAgentOverride,
    // socket overrides override only when defined
    status: socketAgentOverride.status !== undefined ? socketAgentOverride.status : liveAgentState.status,
    callId: socketAgentOverride.callId !== undefined ? socketAgentOverride.callId : liveAgentState.callId,
    activeCallPhone: socketAgentOverride.activeCallPhone !== undefined ? socketAgentOverride.activeCallPhone : liveAgentState.activeCallPhone,
    activeCallCpf: socketAgentOverride.activeCallCpf !== undefined ? socketAgentOverride.activeCallCpf : liveAgentState.activeCallCpf,
    activeCallClientDbId: socketAgentOverride.activeCallClientDbId !== undefined ? socketAgentOverride.activeCallClientDbId : liveAgentState.activeCallClientDbId,
    lastPoll: socket.lastEventAt || liveAgentState.lastPoll,
    isOnline: socketAgentOverride.status !== undefined ? socketAgentOverride.status !== 0 : liveAgentState.isOnline,
  };

  const setAgentStatus = useCallback((status: number | string | undefined) => {
    setAgentStatusState(status);
  }, []);

  const setOnFinishDisposition = useCallback((fn: (() => Promise<void>) | null) => {
    onFinishDispositionRef.current = fn;
    forceUpdate((n) => n + 1);
  }, []);

  // Sync polling-derived status into agentStatusState when dashboard is not pushing
  useEffect(() => {
    if (mergedLiveAgentState.isOnline && mergedLiveAgentState.status !== undefined && agentStatusState === undefined) {
      setAgentStatusState(mergedLiveAgentState.status);
    }
  }, [mergedLiveAgentState.status, mergedLiveAgentState.isOnline, agentStatusState]);

  // Dispatcher: idle + pending call → auto dial
  useEffect(() => {
    const status = mergedLiveAgentState.status;
    const isIdle = status === 1 || (status as any) === "idle" || (status as any) === "available";
    if (!isIdle || !mergedLiveAgentState.isOnline) return;
    const tenantId = tenant?.id;
    const agentId = (profile as any)?.threecplus_agent_id as number | null | undefined;
    if (!tenantId || !agentId) return;

    const pending = getPendingCall();
    if (!pending) return;
    if (pending.tenantId !== tenantId) return;
    const key = `${pending.phone}-${pending.createdAt}`;
    if (lastDispatchedRef.current === key) return;
    lastDispatchedRef.current = key;
    clearPendingCall();

    void dialClientPhone({
      tenantId,
      agentId,
      phone: pending.phone,
      clientId: pending.clientId,
      agentStatus: status,
      assumeConnected: true,
      extension: (profile as any)?.threecplus_extension ?? undefined,
    });
  }, [mergedLiveAgentState.status, mergedLiveAgentState.isOnline, tenant?.id, profile]);

  // Track callIds whose ficha was already opened in this tab/session
  const openedCallIdsRef = useRef<Set<string>>(new Set());

  /** Resolve client by Extra3 → CPF → phone, then navigate. */
  const openClientForCall = useCallback(async (meta: ReturnType<typeof extractCallMeta>) => {
    const myAgentId = (profile as any)?.threecplus_agent_id as number | null | undefined;
    if (!myAgentId) return;
    if (meta.agentId != null && Number(meta.agentId) !== Number(myAgentId)) return;
    const callKey = meta.callId ? String(meta.callId) : null;
    if (!callKey) return;
    if (openedCallIdsRef.current.has(callKey)) return;
    openedCallIdsRef.current.add(callKey);

    const params = new URLSearchParams();
    params.set("agentId", String(myAgentId));
    params.set("callId", String(meta.callId));
    params.set("channel", "call");

    let resolvedId: string | null = meta.clientDbId ? String(meta.clientDbId) : null;
    const tenantId = tenant?.id;

    if (!resolvedId && meta.cpf && tenantId) {
      const cleanCpf = String(meta.cpf).replace(/\D/g, "");
      if (cleanCpf.length >= 11) {
        const { data } = await supabase
          .from("clients")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("cpf", cleanCpf)
          .limit(1)
          .maybeSingle();
        if (data?.id) resolvedId = data.id;
      }
    }
    if (!resolvedId && meta.phone && tenantId) {
      const normalized = normalizePhone(String(meta.phone));
      if (normalized && normalized.length >= 8) {
        const { data } = await supabase.rpc("resolve_client_by_phone", {
          _tenant_id: tenantId,
          _phone: normalized,
        });
        if (Array.isArray(data) && data[0]?.client_id) resolvedId = data[0].client_id;
      }
    }

    if (resolvedId) {
      navigate(`/atendimento/${resolvedId}?${params.toString()}`);
    } else if (meta.phone) {
      params.set("phone", String(meta.phone));
      if (meta.cpf) params.set("cpf", String(meta.cpf).replace(/\D/g, ""));
      navigate(`/atendimento?${params.toString()}`);
    }
  }, [navigate, profile, tenant?.id]);

  /** Buffer + flush events to the audit edge function */
  const eventBufferRef = useRef<any[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueAuditEvent = useCallback((eventName: string, payload: any) => {
    const tenantId = tenant?.id;
    if (!tenantId) return;
    const meta = extractCallMeta(payload);
    eventBufferRef.current.push({
      tenant_id: tenantId,
      event_name: eventName,
      external_company_id: payload?.company_id ? String(payload.company_id) : null,
      external_agent_id: meta.agentId != null ? String(meta.agentId) : null,
      external_call_id: meta.callId != null ? String(meta.callId) : null,
      external_campaign_id: meta.campaignId != null ? String(meta.campaignId) : null,
      phone: meta.phone || null,
      payload: payload || {},
      received_at: new Date().toISOString(),
    });
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      const events = eventBufferRef.current.splice(0);
      if (events.length === 0) return;
      void supabase.functions.invoke("threecplus-socket-ingest", { body: { events } }).catch(() => {});
    }, 1500);
  }, [tenant?.id]);

  // Wire socket → state + actions
  useEffect(() => {
    if (socket.isInert || socket.status !== "connected") return;

    const myAgentId = (profile as any)?.threecplus_agent_id as number | null | undefined;
    const isMine = (raw: any) => {
      if (!myAgentId) return true; // admin views: keep all
      const meta = extractCallMeta(raw);
      return meta.agentId == null || Number(meta.agentId) === Number(myAgentId);
    };

    const offs: Array<() => void> = [];
    const sub = (ev: string, handler: (p: any) => void) => {
      offs.push(socket.subscribe(ev, (payload, name) => {
        queueAuditEvent(name, payload);
        handler(payload);
      }));
    };

    // Agent state
    sub(THREECPLUS_EVENTS.agent.isIdle, (p) => {
      if (!isMine(p)) return;
      setSocketAgentOverride((s) => ({ ...s, status: 1, callId: null, activeCallPhone: null, activeCallCpf: null, activeCallClientDbId: null }));
    });
    sub(THREECPLUS_EVENTS.agent.inAcw, (p) => {
      if (!isMine(p)) return;
      setSocketAgentOverride((s) => ({ ...s, status: 4 }));
      sessionStorage.setItem("3cp_call_hung_up", "1");
    });
    sub(THREECPLUS_EVENTS.agent.enteredWorkBreak, (p) => {
      if (!isMine(p)) return;
      setSocketAgentOverride((s) => ({ ...s, status: 6 }));
    });
    sub(THREECPLUS_EVENTS.agent.leftWorkBreak, (p) => {
      if (!isMine(p)) return;
      setSocketAgentOverride((s) => ({ ...s, status: 1 }));
      sessionStorage.removeItem("3cp_active_pause_name");
    });
    sub(THREECPLUS_EVENTS.agent.loggedOut, (p) => {
      if (!isMine(p)) return;
      setSocketAgentOverride({ status: 0, callId: null, activeCallPhone: null, activeCallCpf: null, activeCallClientDbId: null });
    });
    sub(THREECPLUS_EVENTS.agent.loginFailed, () => {
      toast.error("Falha ao logar agente na 3CPLUS");
    });
    sub(THREECPLUS_EVENTS.agent.scheduleNotification, (p) => {
      const desc = p?.client_name || p?.phone || "Confira a agenda do operador";
      toast.info("Novo agendamento da 3CPLUS", { description: String(desc) });
    });

    // Calls — dialer
    const onCallConnected = (p: any) => {
      if (!isMine(p)) return;
      const meta = extractCallMeta(p);
      setSocketAgentOverride((s) => ({
        ...s,
        status: 2,
        callId: meta.callId,
        activeCallPhone: meta.phone || s.activeCallPhone || null,
        activeCallCpf: meta.cpf || s.activeCallCpf || null,
        activeCallClientDbId: meta.clientDbId || s.activeCallClientDbId || null,
      }));
      if (meta.callId) sessionStorage.setItem("3cp_last_call_id", String(meta.callId));
      sessionStorage.removeItem("3cp_call_hung_up");
      void openClientForCall(meta);
    };
    sub(THREECPLUS_EVENTS.call.connected, onCallConnected);
    sub(THREECPLUS_EVENTS.manualCall.connected, onCallConnected);
    sub(THREECPLUS_EVENTS.receptive.connectedToAgent, onCallConnected);

    sub(THREECPLUS_EVENTS.call.created, (p) => { if (!isMine(p)) return; setSocketAgentOverride((s) => ({ ...s, status: 2 })); });
    sub(THREECPLUS_EVENTS.call.answered, (p) => { if (!isMine(p)) return; setSocketAgentOverride((s) => ({ ...s, status: 2 })); });

    const onCallEnded = (p: any) => {
      if (!isMine(p)) return;
      const meta = extractCallMeta(p);
      sessionStorage.setItem("3cp_call_hung_up", "1");
      if (meta.callId) {
        sessionStorage.setItem("3cp_last_call_id", String(meta.callId));
        dismissCallId(meta.callId);
      }
      // Status will move to ACW/idle via the next agent-* event; keep callId visible until then
    };
    sub(THREECPLUS_EVENTS.call.hungUp, onCallEnded);
    sub(THREECPLUS_EVENTS.call.finished, onCallEnded);
    sub(THREECPLUS_EVENTS.call.notAnswered, onCallEnded);
    sub(THREECPLUS_EVENTS.call.failed, onCallEnded);
    sub(THREECPLUS_EVENTS.call.abandoned, onCallEnded);
    sub(THREECPLUS_EVENTS.call.abandonedByAmd, onCallEnded);
    sub(THREECPLUS_EVENTS.manualCall.hungUp, onCallEnded);
    sub(THREECPLUS_EVENTS.manualCall.finished, onCallEnded);
    sub(THREECPLUS_EVENTS.manualCall.notAnswered, onCallEnded);
    sub(THREECPLUS_EVENTS.manualCall.failed, onCallEnded);

    sub(THREECPLUS_EVENTS.mailing.empty, () => {
      toast.warning("Lista de mailing esgotada", { description: "A campanha não tem mais leads para discar." });
    });

    return () => { for (const off of offs) off(); };
  }, [socket.status, socket.isInert, socket.subscribe, profile, openClientForCall, queueAuditEvent]);

  return (
    <AtendimentoModalContext.Provider
      value={{
        setAgentStatus,
        setOnFinishDisposition,
        agentStatus: agentStatusState,
        onFinishDisposition: onFinishDispositionRef.current,
        liveAgentState: mergedLiveAgentState,
        socketStatus: socket.status,
        socketLastEventAt: socket.lastEventAt,
        socketLastEventName: socket.lastEventName,
        socketErrorMessage: socket.errorMessage,
        socketReconnect: socket.forceReconnect,
      }}
    >
      {children}
    </AtendimentoModalContext.Provider>
  );
};
