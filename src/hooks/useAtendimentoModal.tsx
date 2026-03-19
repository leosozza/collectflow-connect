import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import AtendimentoPage from "@/pages/AtendimentoPage";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Minimize2, Maximize2, GripHorizontal, Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AtendimentoModalState {
  isOpen: boolean;
  clientId: string | null;
  agentId?: number;
  callId?: string | number;
  waitingForCall?: boolean;
}

interface AtendimentoModalContextType {
  openAtendimento: (clientId: string, agentId?: number, callId?: string | number) => void;
  openWaiting: (agentId: number) => void;
  updateAtendimento: (clientId: string, agentId?: number, callId?: string | number) => void;
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
  const [state, setState] = useState<AtendimentoModalState>({ isOpen: false, clientId: null });
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasCustomPosition, setHasCustomPosition] = useState(false);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const headerRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const openedAt = useRef<number>(0);

  useEffect(() => {
    if (!state.isOpen) { setElapsed(0); return; }
    openedAt.current = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - openedAt.current) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [state.isOpen]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const { data: clientData } = useQuery({
    queryKey: ["atendimento-widget-client", state.clientId],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("nome_completo").eq("id", state.clientId!).single();
      return data;
    },
    enabled: !!state.clientId && state.isOpen,
  });

  const centerPosition = useCallback(() => {
    setPosition({
      x: Math.max(0, (window.innerWidth - window.innerWidth * 0.95) / 2),
      y: Math.max(0, (window.innerHeight - window.innerHeight * 0.85) / 2),
    });
  }, []);

  const openAtendimento = useCallback((clientId: string, agentId?: number, callId?: string | number) => {
    console.log("[AtendimentoModal] Opening for client:", clientId, "agent:", agentId, "call:", callId);
    setState({ isOpen: true, clientId, agentId, callId, waitingForCall: false });
    setIsMinimized(false);
    if (!hasCustomPosition) centerPosition();
  }, [hasCustomPosition, centerPosition]);

  const openWaiting = useCallback((agentId: number) => {
    console.log("[AtendimentoModal] Opening in waiting mode for agent:", agentId);
    setState((prev) => {
      if (prev.isOpen && prev.clientId) return prev;
      return { isOpen: true, clientId: null, agentId, waitingForCall: true };
    });
    setIsMinimized(true);
    setPosition({ x: window.innerWidth - 380, y: window.innerHeight - 64 });
    setHasCustomPosition(true);
  }, []);

  const updateAtendimento = useCallback((clientId: string, agentId?: number, callId?: string | number) => {
    console.log("[AtendimentoModal] Updating with client:", clientId, "call:", callId);
    setState((prev) => ({
      ...prev,
      isOpen: true,
      clientId,
      agentId: agentId ?? prev.agentId,
      callId: callId ?? prev.callId,
      waitingForCall: false,
    }));
    setIsMinimized(false);
    if (!hasCustomPosition) centerPosition();
  }, [hasCustomPosition, centerPosition]);

  const closeAtendimento = useCallback(() => {
    console.log("[AtendimentoModal] Closing");
    setState({ isOpen: false, clientId: null });
    setIsMinimized(false);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    e.preventDefault();
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setHasCustomPosition(true);
      setPosition({
        x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 100)),
        y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 40)),
      });
    };
    const handleMouseUp = () => { isDragging.current = false; };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleExpand = () => {
    setIsMinimized(false);
    if (!hasCustomPosition) centerPosition();
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    setPosition({ x: window.innerWidth - 380, y: window.innerHeight - 64 });
    setHasCustomPosition(true);
  };

  const clientName = clientData?.nome_completo || (state.waitingForCall ? "Aguardando ligação..." : "Cliente");

  return (
    <AtendimentoModalContext.Provider value={{ openAtendimento, openWaiting, updateAtendimento, closeAtendimento, isOpen: state.isOpen }}>
      {children}

      {state.isOpen && (
        <>
          {!isMinimized && !state.waitingForCall && (
            <div className="fixed inset-0 bg-black/40 z-[9998] animate-in fade-in-0 duration-200" onClick={handleMinimize} />
          )}

          <div
            className={`fixed z-[9999] ${isMinimized
              ? "rounded-lg shadow-xl border border-border bg-card"
              : "rounded-xl shadow-2xl border border-border bg-background"
            }`}
            style={{
              left: position.x,
              top: position.y,
              width: isMinimized ? 360 : "min(95vw, 1600px)",
              height: isMinimized ? "auto" : (state.waitingForCall ? "auto" : "min(85vh, 900px)"),
            }}
          >
            <div
              ref={headerRef}
              onMouseDown={handleMouseDown}
              className={`flex items-center gap-2 px-3 select-none ${isMinimized
                ? "py-2 cursor-grab active:cursor-grabbing"
                : "py-2.5 border-b border-border cursor-grab active:cursor-grabbing bg-muted/50 rounded-t-xl"
              }`}
            >
              <GripHorizontal className="w-4 h-4 text-muted-foreground flex-shrink-0" />

              {isMinimized ? (
                <>
                  {state.waitingForCall ? (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
                  ) : (
                    <Phone className="w-3.5 h-3.5 text-green-500 animate-pulse flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium truncate flex-1">{clientName}</span>
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">{formatTime(elapsed)}</span>
                  {!state.waitingForCall && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleExpand} onMouseDown={e => e.stopPropagation()}>
                      <Maximize2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-destructive hover:text-destructive" onClick={closeAtendimento} onMouseDown={e => e.stopPropagation()}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm font-semibold truncate flex-1">Atendimento — {clientName}</span>
                  <span className="text-xs text-muted-foreground font-mono tabular-nums mr-2">{formatTime(elapsed)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleMinimize} onMouseDown={e => e.stopPropagation()}>
                    <Minimize2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-destructive hover:text-destructive" onClick={closeAtendimento} onMouseDown={e => e.stopPropagation()}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>

            {!isMinimized && state.clientId && !state.waitingForCall && (
              <div className="overflow-y-auto p-4 sm:p-6" style={{ height: "calc(100% - 44px)" }}>
                <AtendimentoPage
                  clientId={state.clientId}
                  agentId={state.agentId}
                  callId={state.callId}
                  embedded
                />
              </div>
            )}
          </div>
        </>
      )}
    </AtendimentoModalContext.Provider>
  );
};
