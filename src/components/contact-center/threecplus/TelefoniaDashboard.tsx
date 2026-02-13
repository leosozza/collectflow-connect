import { useState, useEffect, useCallback, useRef } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, Users, PhoneCall, PhoneOff, Coffee, Headphones, Wifi, WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import AgentStatusTable from "./AgentStatusTable";
import AgentDetailSheet from "./AgentDetailSheet";
import CampaignOverview from "./CampaignOverview";

interface KpiItem {
  label: string;
  value: string | number;
  icon: React.ElementType;
  bgClass: string;
  iconClass: string;
}

const TelefoniaDashboard = () => {
  const { tenant } = useTenant();
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // KPI computations
  const statusStr = (s: any) => String(s ?? "").toLowerCase().replace(/[\s-]/g, "_");
  const onlineCount = agents.length;
  const onCallCount = agents.filter((a) => a.status === 2 || ["on_call", "ringing"].includes(statusStr(a.status))).length;
  const pausedCount = agents.filter((a) => a.status === 3 || statusStr(a.status) === "paused").length;
  const idleCount = agents.filter((a) => a.status === 1 || ["idle", "available"].includes(statusStr(a.status))).length;
  const activeCalls = companyCalls?.active ?? companyCalls?.data?.active ?? "—";
  const completedCalls = companyCalls?.completed ?? companyCalls?.data?.completed ?? "—";

  const kpis: KpiItem[] = [
    { label: "Agentes Online", value: onlineCount, icon: Users, bgClass: "bg-emerald-500/10", iconClass: "text-emerald-600" },
    { label: "Em Ligação", value: onCallCount, icon: Headphones, bgClass: "bg-destructive/10", iconClass: "text-destructive" },
    { label: "Em Pausa", value: pausedCount, icon: Coffee, bgClass: "bg-amber-500/10", iconClass: "text-amber-600" },
    { label: "Ociosos", value: idleCount, icon: Users, bgClass: "bg-blue-500/10", iconClass: "text-blue-600" },
    { label: "Chamadas Ativas", value: activeCalls, icon: PhoneCall, bgClass: "bg-primary/10", iconClass: "text-primary" },
    { label: "Completadas Hoje", value: completedCalls, icon: PhoneOff, bgClass: "bg-muted", iconClass: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <Card className="shadow-none border-border/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3 px-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                lastUpdate
                  ? "border-emerald-500/40 text-emerald-700 gap-1.5"
                  : "border-destructive/40 text-destructive gap-1.5"
              }
            >
              {lastUpdate ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {lastUpdate ? "Conectado" : "Desconectado"}
            </Badge>
            {lastUpdate && (
              <span className="text-xs text-muted-foreground">
                {lastUpdate.toLocaleTimeString("pt-BR")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="auto-refresh" />
              <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground">Auto</Label>
            </div>
            <Select value={String(interval)} onValueChange={(v) => setRefreshInterval(Number(v))}>
              <SelectTrigger className="w-[72px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15s</SelectItem>
                <SelectItem value="30">30s</SelectItem>
                <SelectItem value="60">60s</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-1.5 h-8 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="shadow-none border-border/60">
            <CardContent className="p-4 flex flex-col items-center gap-2">
              {loading && !lastUpdate ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.bgClass}`}>
                    <kpi.icon className={`w-5 h-5 ${kpi.iconClass}`} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight text-center">{kpi.label}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Status */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold">Agentes de Relacionamento ({agents.length})</h3>
            <p className="text-xs text-muted-foreground">Clique em um agente para detalhes</p>
          </div>
        </div>
        <AgentStatusTable
          agents={agents}
          loading={loading}
          onLogout={handleLogout}
          loggingOut={loggingOut}
          domain={domain}
          apiToken={apiToken}
          onAgentClick={(agent) => setSelectedAgent(agent)}
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
      />

      {/* Campaigns */}
      <div>
        <h3 className="text-base font-semibold mb-3">Campanhas</h3>
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
