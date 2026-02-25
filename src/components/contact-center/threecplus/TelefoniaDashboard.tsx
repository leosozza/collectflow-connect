import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import {
  RefreshCw, Users, PhoneCall, PhoneOff, Coffee, Headphones, Wifi, WifiOff, LogIn, LogOut, Pause, Play,
  Mic, Keyboard, Phone, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import AgentStatusTable from "./AgentStatusTable";
import AgentDetailSheet from "./AgentDetailSheet";
import CampaignOverview from "./CampaignOverview";
import ScriptPanel from "./ScriptPanel";
import TelefoniaAtendimento from "./TelefoniaAtendimento";
import OperatorCallHistory from "./OperatorCallHistory";

interface TelefoniaDashboardProps {
  menuButton?: React.ReactNode;
  isOperatorView?: boolean;
}

const statusLabel = (status: any): string => {
  const s = String(status ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (status === 1 || ["idle", "available"].includes(s)) return "Aguardando ligação";
  if (status === 2 || ["on_call", "ringing"].includes(s)) return "Em ligação";
  if (status === 3 || s === "paused") return "Em pausa";
  return String(status ?? "Desconhecido");
};

const statusColor = (status: any): string => {
  const s = String(status ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (status === 1 || ["idle", "available"].includes(s)) return "bg-emerald-500";
  if (status === 2 || ["on_call", "ringing"].includes(s)) return "bg-destructive";
  if (status === 3 || s === "paused") return "bg-amber-500";
  return "bg-muted-foreground";
};

const statusBgClass = (status: any): string => {
  const s = String(status ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (status === 2 || ["on_call", "ringing"].includes(s)) return "bg-destructive text-destructive-foreground";
  if (status === 3 || s === "paused") return "bg-amber-500 text-white";
  return "bg-primary text-primary-foreground";
};

/** Format seconds into MM:SS */
const formatTimer = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const TelefoniaDashboard = ({ menuButton, isOperatorView }: TelefoniaDashboardProps) => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [agents, setAgents] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [companyCalls, setCompanyCalls] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [interval, setRefreshInterval] = useState(30);
  const [loggingOut, setLoggingOut] = useState<number | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loggingOutSelf, setLoggingOutSelf] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pause state
  const [pauseIntervals, setPauseIntervals] = useState<any[]>([]);
  const [pausingWith, setPausingWith] = useState<number | null>(null);
  const [unpausing, setUnpausing] = useState(false);

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0);

  const operatorAgentId = (profile as any)?.threecplus_agent_id as number | null | undefined;

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data: profileMappings = [] } = useQuery({
    queryKey: ["agent-profile-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, threecplus_agent_id" as any)
        .not("threecplus_agent_id" as any, "is", null);
      if (error) throw error;
      return (data || []) as unknown as { id: string; user_id: string; threecplus_agent_id: number }[];
    },
  });

  const { data: todayDispositions = [] } = useQuery({
    queryKey: ["agent-dispositions-today", todayStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_dispositions")
        .select("operator_id")
        .gte("created_at", todayStart);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const { data: todayAgreements = [] } = useQuery({
    queryKey: ["agent-agreements-today", todayStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("created_by")
        .gte("created_at", todayStart);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const agentMetrics = useMemo(() => {
    const metrics: Record<number, { contacts: number; agreements: number }> = {};
    const profileIdToAgent = new Map<string, number>();
    const userIdToAgent = new Map<string, number>();
    for (const p of profileMappings) {
      profileIdToAgent.set(p.id, p.threecplus_agent_id);
      userIdToAgent.set(p.user_id, p.threecplus_agent_id);
    }
    for (const d of todayDispositions) {
      const agentId = profileIdToAgent.get(d.operator_id);
      if (agentId != null) {
        if (!metrics[agentId]) metrics[agentId] = { contacts: 0, agreements: 0 };
        metrics[agentId].contacts++;
      }
    }
    for (const a of todayAgreements) {
      const agentId = userIdToAgent.get(a.created_by);
      if (agentId != null) {
        if (!metrics[agentId]) metrics[agentId] = { contacts: 0, agreements: 0 };
        metrics[agentId].agreements++;
      }
    }
    return metrics;
  }, [profileMappings, todayDispositions, todayAgreements]);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const fetchAll = useCallback(async () => {
    try {
      const [agentsData, campaignsData, callsData] = await Promise.all([
        invoke("agents_status").catch(() => []),
        invoke("list_campaigns").catch(() => []),
        invoke("company_calls").catch(() => null),
      ]);

      const agentList = Array.isArray(agentsData) ? agentsData : agentsData?.data || [];
      setAgents(agentList);

      const campList = Array.isArray(campaignsData) ? campaignsData : campaignsData?.data || [];

      const enriched = await Promise.all(
        campList
          .filter((c: any) => {
            const s = String(c.status ?? "").toLowerCase();
            return s === "running" || s === "paused" || !c.paused;
          })
          .map(async (c: any) => {
            try {
              const stats = await invoke("campaign_statistics", { campaign_id: c.id });
              return { ...c, statistics: stats };
            } catch {
              return c;
            }
          })
      );

      const activeIds = new Set(enriched.map((c: any) => c.id));
      const rest = campList.filter((c: any) => !activeIds.has(c.id));
      setCampaigns([...enriched, ...rest]);

      setCompanyCalls(callsData);
      setLastUpdate(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchAll, interval * 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, interval, fetchAll]);

  // ── Real-time timer based on status_start_time ──
  const myAgent = operatorAgentId
    ? agents.find((a) => a.id === operatorAgentId || a.agent_id === operatorAgentId)
    : null;
  const isAgentOnline = myAgent && myAgent.status !== 0 && myAgent.status !== "offline";
  const myCampaignId = myAgent?.campaign_id || myAgent?.campaign?.id;

  useEffect(() => {
    if (!isOperatorView || !isAgentOnline) {
      setTimerSeconds(0);
      return;
    }
    const startTime = myAgent?.status_start_time || myAgent?.status_time;
    const calcSeconds = () => {
      if (!startTime) return 0;
      const start = new Date(startTime).getTime();
      return Math.max(0, Math.floor((Date.now() - start) / 1000));
    };
    setTimerSeconds(calcSeconds());
    const id = setInterval(() => setTimerSeconds(calcSeconds()), 1000);
    return () => clearInterval(id);
  }, [isOperatorView, isAgentOnline, myAgent?.status_start_time, myAgent?.status_time, myAgent?.status]);

  const handleLogout = async (agentId: number) => {
    setLoggingOut(agentId);
    try {
      await invoke("logout_agent", { agent_id: agentId });
      toast.success("Agente deslogado");
      fetchAll();
    } catch {
      toast.error("Erro ao deslogar agente");
    } finally {
      setLoggingOut(null);
    }
  };

  const handleCampaignLogin = async () => {
    if (!selectedCampaign || !operatorAgentId) return;
    setLoggingIn(true);
    try {
      const result = await invoke("login_agent_to_campaign", {
        agent_id: operatorAgentId,
        campaign_id: Number(selectedCampaign),
      });
      if (result?.status && result.status >= 400) {
        toast.error(result.detail || result.message || "Erro ao entrar na campanha");
      } else {
        toast.success("Logado na campanha com sucesso");
        setSelectedCampaign("");
      }
      fetchAll();
    } catch {
      toast.error("Erro ao entrar na campanha");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleCampaignLogout = async () => {
    if (!operatorAgentId) return;
    setLoggingOutSelf(true);
    try {
      const result = await invoke("logout_agent_self", { agent_id: operatorAgentId });
      if (result?.status && result.status >= 400) {
        toast.error(result.detail || result.message || "Erro ao sair da campanha");
      } else {
        toast.success("Deslogado da campanha");
      }
      fetchAll();
    } catch {
      toast.error("Erro ao sair da campanha");
    } finally {
      setLoggingOutSelf(false);
    }
  };

  // Load pause intervals when agent is online
  const loadPauseIntervals = useCallback(async (campaignId: number) => {
    try {
      const data = await invoke("list_work_break_intervals", { campaign_id: campaignId });
      const list = Array.isArray(data) ? data : data?.data || [];
      setPauseIntervals(list);
    } catch {
      setPauseIntervals([]);
    }
  }, [invoke]);

  const handlePause = async (intervalId: number) => {
    if (!operatorAgentId) return;
    setPausingWith(intervalId);
    try {
      await invoke("pause_agent", { agent_id: operatorAgentId, interval_id: intervalId });
      toast.success("Pausa ativada");
      fetchAll();
    } catch {
      toast.error("Erro ao pausar");
    } finally {
      setPausingWith(null);
    }
  };

  const handleUnpause = async () => {
    if (!operatorAgentId) return;
    setUnpausing(true);
    try {
      await invoke("unpause_agent", { agent_id: operatorAgentId });
      toast.success("Pausa removida");
      fetchAll();
    } catch {
      toast.error("Erro ao retomar");
    } finally {
      setUnpausing(false);
    }
  };

  // Load intervals when agent comes online with a campaign
  useEffect(() => {
    if (isOperatorView && isAgentOnline && myCampaignId) {
      loadPauseIntervals(Number(myCampaignId));
    }
  }, [isOperatorView, isAgentOnline, myCampaignId, loadPauseIntervals]);

  const isOnCall = myAgent?.status === 2 || String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_") === "on_call";
  const isPaused = myAgent?.status === 3 || String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_") === "paused";

  // ── OPERATOR VIEW ──
  if (isOperatorView) {
    const myMetrics = operatorAgentId ? agentMetrics[operatorAgentId] : undefined;

    // State 1: No campaign (offline)
    if (loading && !lastUpdate) {
      return (
        <div className="p-4">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      );
    }

    if (!isAgentOnline) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <div className="bg-card rounded-xl border border-border p-8 space-y-5 max-w-md w-full">
            {!operatorAgentId ? (
              <p className="text-sm text-muted-foreground text-center">
                Seu perfil não possui um ID de agente 3CPlus vinculado.
              </p>
            ) : (
              <>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Headphones className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Entrar em uma Campanha</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Selecione a campanha para iniciar seu turno.
                  </p>
                </div>
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma campanha..." />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns
                      .filter((c: any) => {
                        const s = String(c.status ?? "").toLowerCase();
                        return s === "running" || s === "paused" || !c.paused;
                      })
                      .map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleCampaignLogin}
                  disabled={!selectedCampaign || loggingIn}
                  className="w-full gap-2"
                  size="lg"
                >
                  <LogIn className={`w-4 h-4 ${loggingIn ? "animate-spin" : ""}`} />
                  {loggingIn ? "Conectando..." : "Entrar na Campanha"}
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }

    // State 3: On call → show atendimento
    if (isOnCall && (myAgent?.phone || myAgent?.remote_phone)) {
      return (
        <div className="space-y-0">
          {/* Top bar - on call */}
          <div className={`flex items-center justify-between px-4 py-2.5 ${statusBgClass(myAgent?.status)} animate-pulse`}>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4" />
              <span className="font-semibold text-sm">Em ligação ({formatTimer(timerSeconds)})</span>
            </div>
          </div>
          <TelefoniaAtendimento
            clientPhone={myAgent.phone || myAgent.remote_phone}
            agentId={operatorAgentId!}
            callId={myAgent.call_id || myAgent.current_call_id}
          />
        </div>
      );
    }

    // State 2: Logged in, waiting for call
    return (
      <div className="space-y-4">
        {/* ── Top Status Bar ── */}
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl ${statusBgClass(myAgent?.status)}`}>
          <div className="flex items-center gap-3">
            {/* Interval dropdown */}
            {isPaused ? (
              <Button
                size="sm"
                onClick={handleUnpause}
                disabled={unpausing}
                variant="secondary"
                className="gap-1.5 h-8 text-xs bg-white/20 hover:bg-white/30 border-0"
              >
                <Play className={`w-3.5 h-3.5 ${unpausing ? "animate-spin" : ""}`} />
                {unpausing ? "Retomando..." : "Retomar"}
              </Button>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="secondary" className="gap-1.5 h-8 text-xs bg-white/20 hover:bg-white/30 border-0">
                    <Coffee className="w-3.5 h-3.5" />
                    Intervalo
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">Selecione o motivo:</p>
                  {pauseIntervals.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-2 py-2">Nenhum intervalo disponível</p>
                  ) : (
                    pauseIntervals.map((pi: any) => (
                      <button
                        key={pi.id}
                        onClick={() => handlePause(pi.id)}
                        disabled={pausingWith === pi.id}
                        className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors disabled:opacity-50"
                      >
                        <Coffee className="w-3.5 h-3.5 inline mr-2 text-amber-500" />
                        {pausingWith === pi.id ? "Pausando..." : (pi.name || pi.description || `Intervalo ${pi.id}`)}
                      </button>
                    ))
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Status central */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isPaused ? "bg-amber-300" : "bg-white"} ${isOnCall ? "animate-pulse" : ""}`} />
            <span className="font-semibold text-sm">
              {statusLabel(myAgent?.status)} ({formatTimer(timerSeconds)})
            </span>
          </div>

          {/* Right side placeholders */}
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-inherit hover:bg-white/20" disabled>
              <Mic className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-inherit hover:bg-white/20" disabled>
              <Keyboard className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── 4 KPI Cards ── */}
        <div className="grid grid-cols-2 gap-3 px-4">
          {/* Ligações */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <PhoneCall className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ligações</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{myMetrics?.contacts ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Realizadas hoje</p>
            </CardContent>
          </Card>

          {/* CPC */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CPC</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{myMetrics?.agreements ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Contatos com pessoa certa</p>
            </CardContent>
          </Card>

          {/* Tempo de atendimento */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Headphones className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tempo</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{formatTimer(timerSeconds)}</p>
              <p className="text-xs text-muted-foreground mt-1">No status atual</p>
            </CardContent>
          </Card>

          {/* Feedback */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Feedback</p>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Nenhuma avaliação ainda</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Last calls table ── */}
        <div className="px-4">
          <OperatorCallHistory />
        </div>

        {/* ── Exit campaign button ── */}
        <div className="px-4 pb-4">
          <Button
            variant="outline"
            onClick={handleCampaignLogout}
            disabled={loggingOutSelf}
            className="gap-2 text-destructive hover:text-destructive"
          >
            <LogOut className={`w-4 h-4 ${loggingOutSelf ? "animate-spin" : ""}`} />
            {loggingOutSelf ? "Saindo..." : "Sair da Campanha"}
          </Button>
        </div>
      </div>
    );
  }

  // ── ADMIN VIEW ──
  const statusStr = (s: any) => String(s ?? "").toLowerCase().replace(/[\s-]/g, "_");
  const onlineCount = agents.length;
  const onCallCount = agents.filter((a) => a.status === 2 || ["on_call", "ringing"].includes(statusStr(a.status))).length;
  const pausedCount = agents.filter((a) => a.status === 3 || statusStr(a.status) === "paused").length;
  const idleCount = agents.filter((a) => a.status === 1 || ["idle", "available"].includes(statusStr(a.status))).length;

  const kpis = [
    { label: "Online", value: onlineCount, icon: Users, bgClass: "bg-emerald-500/10", iconClass: "text-emerald-600" },
    { label: "Em Ligação", value: onCallCount, icon: Headphones, bgClass: "bg-destructive/10", iconClass: "text-destructive" },
    { label: "Em Pausa", value: pausedCount, icon: Coffee, bgClass: "bg-amber-500/10", iconClass: "text-amber-600" },
    { label: "Ociosos", value: idleCount, icon: Users, bgClass: "bg-blue-500/10", iconClass: "text-blue-600" },
  ];

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {menuButton}
          <h2 className="text-lg font-semibold text-foreground truncate">Dashboard</h2>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-1.5 cursor-pointer">
              <Badge
                variant="outline"
                className={`cursor-pointer transition-colors hover:bg-accent ${
                  lastUpdate
                    ? "border-emerald-500/40 text-emerald-700 gap-1.5"
                    : "border-destructive/40 text-destructive gap-1.5"
                }`}
              >
                {lastUpdate ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {lastUpdate ? "Conectado" : "Desconectado"}
                {lastUpdate && (
                  <span className="text-muted-foreground font-normal ml-1">
                    {lastUpdate.toLocaleTimeString("pt-BR")}
                  </span>
                )}
              </Badge>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 space-y-3" align="end">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-refresh-pop" className="text-xs">Atualização automática</Label>
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="auto-refresh-pop" />
            </div>
            {autoRefresh && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Intervalo</Label>
                <Select value={String(interval)} onValueChange={(v) => setRefreshInterval(Number(v))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 segundos</SelectItem>
                    <SelectItem value="30">30 segundos</SelectItem>
                    <SelectItem value="60">60 segundos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="w-full gap-1.5 h-8 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar agora
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {/* KPI row — 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4 hover:shadow-sm transition-shadow">
            {loading && !lastUpdate ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${kpi.bgClass}`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.iconClass}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground leading-none">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{kpi.label}</p>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Collapsible Agents */}
      <AgentStatusTable
        agents={agents}
        loading={loading}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        domain={domain}
        apiToken={apiToken}
        onAgentClick={(agent) => setSelectedAgent(agent)}
        agentMetrics={agentMetrics}
      />

      <AgentDetailSheet
        agent={selectedAgent}
        open={!!selectedAgent}
        onOpenChange={(open) => { if (!open) setSelectedAgent(null); }}
        domain={domain}
        apiToken={apiToken}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        allAgents={agents}
      />

      {/* Campaigns table */}
      <CampaignOverview
        campaigns={campaigns}
        loading={loading}
        domain={domain}
        apiToken={apiToken}
        onRefresh={fetchAll}
      />
    </div>
  );
};

export default TelefoniaDashboard;
