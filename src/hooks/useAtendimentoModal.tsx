import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { useThreeCPlusStatus, type ThreeCPlusAgentState } from "./useThreeCPlusStatus";

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

const defaultLiveState: ThreeCPlusAgentState = { status: undefined, callId: null, isOnline: false, lastPoll: null };

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
