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
import {
  RefreshCw, Users, PhoneCall, PhoneOff, Coffee, Headphones, Wifi, WifiOff, LogIn, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import AgentStatusTable from "./AgentStatusTable";
import AgentDetailSheet from "./AgentDetailSheet";
import CampaignOverview from "./CampaignOverview";
import DialPad from "./DialPad";

interface TelefoniaDashboardProps {
  menuButton?: React.ReactNode;
  isOperatorView?: boolean;
}

const statusLabel = (status: any): string => {
  const s = String(status ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (status === 1 || ["idle", "available"].includes(s)) return "Disponível";
  if (status === 2 || ["on_call", "ringing"].includes(s)) return "Em Ligação";
  if (status === 3 || s === "paused") return "Em Pausa";
  return String(status ?? "Desconhecido");
};

const statusColor = (status: any): string => {
  const s = String(status ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (status === 1 || ["idle", "available"].includes(s)) return "bg-emerald-500";
  if (status === 2 || ["on_call", "ringing"].includes(s)) return "bg-destructive";
  if (status === 3 || s === "paused") return "bg-amber-500";
  return "bg-muted-foreground";
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

  // Build metrics map: threecplus_agent_id -> { contacts, agreements }
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

  // ── OPERATOR VIEW ──
  if (isOperatorView) {
    const myAgent = operatorAgentId
      ? agents.find((a) => a.id === operatorAgentId || a.agent_id === operatorAgentId)
      : null;
    // Treat status 0 (offline) as not logged in — show campaign selector
    const isAgentOnline = myAgent && myAgent.status !== 0 && myAgent.status !== "offline";
    const myMetrics = operatorAgentId ? agentMetrics[operatorAgentId] : undefined;
    const myStatusStr = statusLabel(myAgent?.status);
    const myStatusColor = statusColor(myAgent?.status);
    const myCampaign = myAgent?.campaign_name || myAgent?.campaign?.name || "—";
    const myExtension = myAgent?.extension || myAgent?.ramal || "—";

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Minha Telefonia</h2>
          <Badge
            variant="outline"
            className={`cursor-default transition-colors ${
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Enlarged operator card */}
          <div className="lg:col-span-3">
            {loading && !lastUpdate ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : !isAgentOnline ? (
              /* Campaign selector when agent is offline */
              <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                {!operatorAgentId ? (
                  <p className="text-sm text-muted-foreground text-center">
                    Seu perfil não possui um ID de agente 3CPlus vinculado.
                  </p>
                ) : (
                  <>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Entrar em uma Campanha</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Selecione a campanha e clique para iniciar seu turno.
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
                    >
                      <LogIn className={`w-4 h-4 ${loggingIn ? "animate-spin" : ""}`} />
                      {loggingIn ? "Entrando..." : "Entrar na Campanha"}
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                {/* Status bar */}
                <div className={`h-2 ${myStatusColor} ${myAgent?.status === 2 ? "animate-pulse" : ""}`} />
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        {myAgent.name || myAgent.agent_name || "Agente"}
                      </h3>
                      <p className="text-sm text-muted-foreground">Ramal: {myExtension}</p>
                    </div>
                    <Badge variant="outline" className="text-sm gap-1.5 px-3 py-1">
                      <span className={`w-2 h-2 rounded-full ${myStatusColor} ${myAgent?.status === 2 ? "animate-pulse" : ""}`} />
                      {myStatusStr}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Campanha</p>
                      <p className="text-sm font-semibold text-foreground truncate mt-0.5">{myCampaign}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tempo no Status</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {myAgent.status_time || myAgent.time_in_status || "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Contatos Hoje</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {myMetrics?.contacts ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Acordos Hoje</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {myMetrics?.agreements ?? 0}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCampaignLogout}
                    disabled={loggingOutSelf}
                    className="w-full gap-2 text-destructive hover:text-destructive"
                  >
                    <LogOut className={`w-4 h-4 ${loggingOutSelf ? "animate-spin" : ""}`} />
                    {loggingOutSelf ? "Saindo..." : "Sair da Campanha"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Dial pad */}
          <div className="lg:col-span-2">
            <DialPad
              domain={domain}
              apiToken={apiToken}
              agentId={operatorAgentId ?? undefined}
            />
          </div>
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
  const activeCalls = companyCalls?.active ?? companyCalls?.data?.active ?? "—";
  const completedCalls = companyCalls?.completed ?? companyCalls?.data?.completed ?? "—";

  const kpis = [
    { label: "Online", value: onlineCount, icon: Users, bgClass: "bg-emerald-500/10", iconClass: "text-emerald-600" },
    { label: "Em Ligação", value: onCallCount, icon: Headphones, bgClass: "bg-destructive/10", iconClass: "text-destructive" },
    { label: "Em Pausa", value: pausedCount, icon: Coffee, bgClass: "bg-amber-500/10", iconClass: "text-amber-600" },
    { label: "Ociosos", value: idleCount, icon: Users, bgClass: "bg-blue-500/10", iconClass: "text-blue-600" },
    { label: "Ativas", value: activeCalls, icon: PhoneCall, bgClass: "bg-primary/10", iconClass: "text-primary" },
    { label: "Completadas", value: completedCalls, icon: PhoneOff, bgClass: "bg-muted", iconClass: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-4">
      {/* Unified header bar */}
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

      {/* Compact KPI row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card p-2.5">
            {loading && !lastUpdate ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <>
                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${kpi.bgClass}`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.iconClass}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-foreground leading-none">{kpi.value}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight truncate">{kpi.label}</p>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Agent Status */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Agentes ({agents.length})</h3>
          <p className="text-[11px] text-muted-foreground">Clique para detalhes</p>
        </div>
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
      </div>

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

      {/* Campaigns */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Campanhas</h3>
        <CampaignOverview
          campaigns={campaigns}
          loading={loading}
          domain={domain}
          apiToken={apiToken}
          onRefresh={fetchAll}
        />
      </div>
    </div>
  );
};

export default TelefoniaDashboard;
