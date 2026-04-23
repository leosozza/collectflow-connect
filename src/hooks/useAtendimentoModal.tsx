import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useThreeCPlusStatus, type ThreeCPlusAgentState } from "./useThreeCPlusStatus";
import { useTenant } from "./useTenant";
import { useAuth } from "./useAuth";
import { dialClientPhone, getPendingCall, clearPendingCall } from "@/services/callService";

interface AtendimentoModalContextType {
  setAgentStatus: (status: number | string | undefined) => void;
  setOnFinishDisposition: (fn: (() => Promise<void>) | null) => void;
  agentStatus: number | string | undefined;
  onFinishDisposition: (() => Promise<void>) | null;
  /** Live 3CPlus status from independent polling — always available */
  liveAgentState: ThreeCPlusAgentState;
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
    };
  }
  return ctx;
};

export const AtendimentoModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [agentStatusState, setAgentStatusState] = useState<number | string | undefined>(undefined);
  const onFinishDispositionRef = useRef<(() => Promise<void>) | null>(null);
  const [, forceUpdate] = useState(0);
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const lastDispatchedRef = useRef<string | null>(null);

  // Shared live polling — runs independently of TelefoniaDashboard
  const liveAgentState = useThreeCPlusStatus();

  const setAgentStatus = useCallback((status: number | string | undefined) => {
    setAgentStatusState(status);
  }, []);

  const setOnFinishDisposition = useCallback((fn: (() => Promise<void>) | null) => {
    onFinishDispositionRef.current = fn;
    forceUpdate((n) => n + 1);
  }, []);

  // Sync: when TelefoniaDashboard is NOT pushing status, use live polling as source
  // When TelefoniaDashboard IS mounted, it calls setAgentStatus, which takes priority
  // The liveAgentState is always available as a separate field for consumers
  useEffect(() => {
    // If live polling detects the agent is online but agentStatusState is undefined,
    // it means TelefoniaDashboard is not mounted — use live data as agentStatus
    if (liveAgentState.isOnline && liveAgentState.status !== undefined && agentStatusState === undefined) {
      setAgentStatusState(liveAgentState.status);
    }
    // If live polling detects agent went offline, clear the status
    if (!liveAgentState.isOnline && liveAgentState.lastPoll && agentStatusState !== undefined) {
      // Only clear if it was set by live polling, not by TelefoniaDashboard
      // We can't perfectly distinguish, so we let TelefoniaDashboard's setAgentStatus win
    }
  }, [liveAgentState.status, liveAgentState.isOnline, liveAgentState.lastPoll, agentStatusState]);

  // Dispatcher: quando o agente fica idle (status 1) e há um pendingCall recente, disca automaticamente.
  useEffect(() => {
    const status = liveAgentState.status;
    const isIdle = status === 1 || status === "idle" || status === "available";
    if (!isIdle || !liveAgentState.isOnline) return;
    const tenantId = tenant?.id;
    const agentId = (profile as any)?.threecplus_agent_id as number | null | undefined;
    if (!tenantId || !agentId) return;

    const pending = getPendingCall();
    if (!pending) return;
    if (pending.tenantId !== tenantId) return;
    // Idempotência: evita disparar 2x para a mesma intenção
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
    });
  }, [liveAgentState.status, liveAgentState.isOnline, tenant?.id, profile]);

  return (
    <AtendimentoModalContext.Provider
      value={{
        setAgentStatus,
        setOnFinishDisposition,
        agentStatus: agentStatusState,
        onFinishDisposition: onFinishDispositionRef.current,
        liveAgentState,
      }}
    >
      {children}
    </AtendimentoModalContext.Provider>
  );
};
