import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import AtendimentoPage from "@/pages/AtendimentoPage";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Minimize2, Maximize2, GripHorizontal, Phone, Loader2, Coffee, Play, ChevronDown, MessageSquare, Globe, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PauseControls {
  intervals: any[];
  isPaused: boolean;
  pausingWith: number | null;
  unpausing: boolean;
  onPause: (intervalId: number) => void;
  onUnpause: () => void;
  agentStatus?: number | string;
  agentName?: string;
}

interface AtendimentoModalState {
  isOpen: boolean;
  clientId: string | null;
  agentId?: number;
  callId?: string | number;
  waitingForCall?: boolean;
  sessionId?: string;
  channel?: string;
  conversationId?: string;
}

interface AtendimentoModalContextType {
  openAtendimento: (clientId: string, agentId?: number, callId?: string | number, opts?: { sessionId?: string; channel?: string; conversationId?: string }) => void;
  openWaiting: (agentId: number) => void;
  updateAtendimento: (clientId: string, agentId?: number, callId?: string | number, opts?: { sessionId?: string; channel?: string; conversationId?: string }) => void;
  closeAtendimento: () => void;
  setPauseControls: (controls: PauseControls | null) => void;
  setAgentStatus: (status: number | string | undefined) => void;
  setOnFinishDisposition: (fn: (() => Promise<void>) | null) => void;
  agentStatus: number | string | undefined;
  onFinishDisposition: (() => Promise<void>) | null;
  isOpen: boolean;
}

const AtendimentoModalContext = createContext<AtendimentoModalContextType | undefined>(undefined);

export const useAtendimentoModal = () => {
  const ctx = useContext(AtendimentoModalContext);
  if (!ctx) throw new Error("useAtendimentoModal must be used within AtendimentoModalProvider");
  return ctx;
};

const noopAsync = async () => {};
const noop = () => {};

/** Safe version that returns no-op defaults when used outside the provider */
export const useAtendimentoModalSafe = (): AtendimentoModalContextType => {
  const ctx = useContext(AtendimentoModalContext);
  if (!ctx) {
    return {
      openAtendimento: noop as any,
      openWaiting: noop as any,
      updateAtendimento: noop as any,
      closeAtendimento: noop,
      setPauseControls: noop,
      setAgentStatus: noop,
      setOnFinishDisposition: noop,
      agentStatus: undefined,
      onFinishDisposition: null,
      isOpen: false,
    };
  }
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
  const [pauseControls, setPauseControlsState] = useState<PauseControls | null>(null);
  const [agentStatusState, setAgentStatusState] = useState<number | string | undefined>(undefined);
  const onFinishDispositionRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!state.isOpen) { setElapsed(0); return; }
    openedAt.current = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - openedAt.current) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [state.isOpen]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
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

  const openAtendimento = useCallback((clientId: string, agentId?: number, callId?: string | number, opts?: { sessionId?: string; channel?: string; conversationId?: string }) => {
    console.log("[AtendimentoModal] Opening for client:", clientId, "agent:", agentId, "call:", callId, "opts:", opts);
    setState({ isOpen: true, clientId, agentId, callId, waitingForCall: false, sessionId: opts?.sessionId, channel: opts?.channel, conversationId: opts?.conversationId });
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
    setPosition({ x: window.innerWidth - 420, y: window.innerHeight - 64 });
    setHasCustomPosition(true);
  }, []);

  const updateAtendimento = useCallback((clientId: string, agentId?: number, callId?: string | number, opts?: { sessionId?: string; channel?: string; conversationId?: string }) => {
    console.log("[AtendimentoModal] Updating with client:", clientId, "call:", callId, "opts:", opts);
    setState((prev) => ({
      ...prev,
      isOpen: true,
      clientId,
      agentId: agentId ?? prev.agentId,
      callId: callId ?? prev.callId,
      waitingForCall: false,
      sessionId: opts?.sessionId ?? prev.sessionId,
      channel: opts?.channel ?? prev.channel,
      conversationId: opts?.conversationId ?? prev.conversationId,
    }));
    // Force expand and center when call arrives
    setIsMinimized(false);
    centerPosition();
  }, [centerPosition]);

  const closeAtendimento = useCallback(() => {
    console.log("[AtendimentoModal] Closing");
    setState({ isOpen: false, clientId: null });
    setIsMinimized(false);
    setPauseControlsState(null);
  }, []);

  const setPauseControls = useCallback((controls: PauseControls | null) => {
    setPauseControlsState(controls);
  }, []);

  const setAgentStatus = useCallback((status: number | string | undefined) => {
    setAgentStatusState(status);
  }, []);

  const setOnFinishDisposition = useCallback((fn: (() => Promise<void>) | null) => {
    onFinishDispositionRef.current = fn;
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
    centerPosition();
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    setPosition({ x: window.innerWidth - 420, y: window.innerHeight - 64 });
    setHasCustomPosition(true);
  };

  const clientName = clientData?.nome_completo || "Cliente";

  return (
    <AtendimentoModalContext.Provider value={{ openAtendimento, openWaiting, updateAtendimento, closeAtendimento, setPauseControls, setAgentStatus, setOnFinishDisposition, agentStatus: agentStatusState, onFinishDisposition: onFinishDispositionRef.current, isOpen: state.isOpen }}>
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
              width: isMinimized ? "auto" : "min(95vw, 1600px)",
              height: isMinimized ? "auto" : (state.waitingForCall ? "auto" : "min(85vh, 900px)"),
            }}
          >
            {/* ── MINIMIZED BAR ── */}
            {isMinimized ? (
              <div
                ref={headerRef}
                onMouseDown={handleMouseDown}
                className="flex items-center gap-2 px-3 py-2 select-none cursor-grab active:cursor-grabbing"
              >
                <GripHorizontal className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                {/* Agent status indicator */}
                {pauseControls && (
                  <>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      pauseControls.agentStatus === 2 ? "bg-destructive" :
                      pauseControls.isPaused ? "bg-amber-500" :
                      "bg-emerald-500"
                    }`} />
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {pauseControls.agentStatus === 2 ? "Em ligação" :
                       pauseControls.isPaused ? "Em pausa" :
                       "Aguardando"}
                    </span>
                  </>
                )}

                {/* Timer */}
                <span className="text-sm font-mono tabular-nums font-semibold text-foreground">{formatTime(elapsed)}</span>

                {/* Pause/Resume button */}
                {pauseControls && (
                  pauseControls.isPaused ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs px-2"
                      disabled={pauseControls.unpausing}
                      onClick={() => pauseControls.onUnpause()}
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <Play className="w-3.5 h-3.5 text-emerald-500" />
                      {pauseControls.unpausing ? "..." : "Retomar"}
                    </Button>
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1.5 text-xs px-2"
                          onMouseDown={e => e.stopPropagation()}
                        >
                          <Coffee className="w-3.5 h-3.5 text-amber-500" />
                          Pausa
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-1" align="start" side="top">
                        <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">Selecione a pausa</div>
                        {pauseControls.intervals.length === 0 ? (
                          <div className="text-xs text-muted-foreground px-2 py-2">Nenhuma pausa disponível</div>
                        ) : (
                          pauseControls.intervals.map((iv: any) => (
                            <button
                              key={iv.id}
                              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                              disabled={pauseControls.pausingWith === iv.id}
                              onClick={() => pauseControls.onPause(iv.id)}
                            >
                              {pauseControls.pausingWith === iv.id ? "Pausando..." : (iv.name || iv.description || `Pausa ${iv.id}`)}
                            </button>
                          ))
                        )}
                      </PopoverContent>
                    </Popover>
                  )
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Expand — always visible */}
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleExpand} onMouseDown={e => e.stopPropagation()}>
                  <Maximize2 className="w-3.5 h-3.5" />
                </Button>

                {/* Close */}
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-destructive hover:text-destructive" onClick={closeAtendimento} onMouseDown={e => e.stopPropagation()}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              /* ── EXPANDED HEADER ── */
              <div
                ref={headerRef}
                onMouseDown={handleMouseDown}
                className="flex items-center gap-2 px-3 py-2.5 border-b border-border select-none cursor-grab active:cursor-grabbing bg-muted/50 rounded-t-xl"
              >
                <GripHorizontal className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                {state.channel === "whatsapp" ? <MessageSquare className="w-4 h-4 text-green-500 flex-shrink-0" /> :
                 state.channel === "portal" ? <Globe className="w-4 h-4 text-teal-500 flex-shrink-0" /> :
                 state.channel?.startsWith("ai_") ? <Bot className="w-4 h-4 text-purple-500 flex-shrink-0" /> :
                 <Phone className="w-4 h-4 text-green-500 flex-shrink-0" />}
                <span className="text-sm font-semibold truncate flex-1">Atendimento — {clientName}</span>
                <span className="text-xs text-muted-foreground font-mono tabular-nums mr-2">{formatTime(elapsed)}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleMinimize} onMouseDown={e => e.stopPropagation()}>
                  <Minimize2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-destructive hover:text-destructive" onClick={closeAtendimento} onMouseDown={e => e.stopPropagation()}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

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
