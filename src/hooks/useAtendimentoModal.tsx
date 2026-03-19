import { createContext, useContext, useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import AtendimentoPage from "@/pages/AtendimentoPage";

interface AtendimentoModalState {
  isOpen: boolean;
  clientId: string | null;
  agentId?: number;
  callId?: string | number;
}

interface AtendimentoModalContextType {
  openAtendimento: (clientId: string, agentId?: number, callId?: string | number) => void;
  closeAtendimento: () => void;
  isOpen: boolean;
}

const AtendimentoModalContext = createContext<AtendimentoModalContextType | undefined>(undefined);

export const useAtendimentoModal = () => {
  const ctx = useContext(AtendimentoModalContext);
  if (!ctx) throw new Error("useAtendimentoModal must be used within AtendimentoModalProvider");
  return ctx;
};

export const AtendimentoModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<AtendimentoModalState>({
    isOpen: false,
    clientId: null,
  });

  const openAtendimento = useCallback((clientId: string, agentId?: number, callId?: string | number) => {
    console.log("[AtendimentoModal] Opening for client:", clientId, "agent:", agentId, "call:", callId);
    setState({ isOpen: true, clientId, agentId, callId });
  }, []);

  const closeAtendimento = useCallback(() => {
    console.log("[AtendimentoModal] Closing");
    setState({ isOpen: false, clientId: null });
  }, []);

  return (
    <AtendimentoModalContext.Provider value={{ openAtendimento, closeAtendimento, isOpen: state.isOpen }}>
      {children}
      <Dialog open={state.isOpen} onOpenChange={(open) => { if (!open) closeAtendimento(); }}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto p-4 sm:p-6">
          {state.isOpen && state.clientId && (
            <AtendimentoPage
              clientId={state.clientId}
              agentId={state.agentId}
              callId={state.callId}
              embedded
            />
          )}
        </DialogContent>
      </Dialog>
    </AtendimentoModalContext.Provider>
  );
};
