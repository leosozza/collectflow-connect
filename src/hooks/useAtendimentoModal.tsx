import { createContext, useContext, useState, useCallback, useRef } from "react";

interface AtendimentoModalContextType {
  setAgentStatus: (status: number | string | undefined) => void;
  setOnFinishDisposition: (fn: (() => Promise<void>) | null) => void;
  agentStatus: number | string | undefined;
  onFinishDisposition: (() => Promise<void>) | null;
}

const AtendimentoModalContext = createContext<AtendimentoModalContextType | undefined>(undefined);

export const useAtendimentoModal = () => {
  const ctx = useContext(AtendimentoModalContext);
  if (!ctx) throw new Error("useAtendimentoModal must be used within AtendimentoModalProvider");
  return ctx;
};

const noop = () => {};

/** Safe version that returns no-op defaults when used outside the provider */
export const useAtendimentoModalSafe = (): AtendimentoModalContextType => {
  const ctx = useContext(AtendimentoModalContext);
  if (!ctx) {
    return {
      setAgentStatus: noop,
      setOnFinishDisposition: noop,
      agentStatus: undefined,
      onFinishDisposition: null,
    };
  }
  return ctx;
};

export const AtendimentoModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [agentStatusState, setAgentStatusState] = useState<number | string | undefined>(undefined);
  const onFinishDispositionRef = useRef<(() => Promise<void>) | null>(null);
  const [, forceUpdate] = useState(0);

  const setAgentStatus = useCallback((status: number | string | undefined) => {
    setAgentStatusState(status);
  }, []);

  const setOnFinishDisposition = useCallback((fn: (() => Promise<void>) | null) => {
    onFinishDispositionRef.current = fn;
    forceUpdate((n) => n + 1);
  }, []);

  return (
    <AtendimentoModalContext.Provider
      value={{
        setAgentStatus,
        setOnFinishDisposition,
        agentStatus: agentStatusState,
        onFinishDisposition: onFinishDispositionRef.current,
      }}
    >
      {children}
    </AtendimentoModalContext.Provider>
  );
};
