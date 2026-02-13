import { useState, useEffect, useCallback, useRef } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import CampaignOverview from "./CampaignOverview";

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

      // Enrich campaigns with statistics
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

      // Include non-active campaigns without enrichment
      const activeIds = new Set(enriched.map((c: any) => c.id));
      const rest = campList.filter((c: any) => !activeIds.has(c.id));
      setCampaigns([...enriched, ...rest]);

      setCompanyCalls(callsData);
      setLastUpdate(new Date());
    } catch {
      // silent – individual calls already handle errors
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchAll, interval * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
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
  const onlineCount = agents.length;
  // 3CPlus returns status as number: 0=offline, 1=online/idle, 2=on_call, 3=paused, 4=ACW etc.
  const statusStr = (s: any) => String(s ?? "").toLowerCase().replace(/[\s-]/g, '_');
  const onCallCount = agents.filter((a: any) => a.status === 2 || ['on_call', 'ringing'].includes(statusStr(a.status))).length;
  const pausedCount = agents.filter((a: any) => a.status === 3 || statusStr(a.status) === 'paused').length;
  const idleCount = agents.filter((a: any) => a.status === 1 || ['idle', 'available'].includes(statusStr(a.status))).length;
  const activeCalls = companyCalls?.active ?? companyCalls?.data?.active ?? "—";
  const completedCalls = companyCalls?.completed ?? companyCalls?.data?.completed ?? "—";

  const kpis = [
    { label: "Agentes Online", value: onlineCount, icon: Users, color: "text-emerald-600" },
    { label: "Em Ligação", value: onCallCount, icon: Headphones, color: "text-destructive" },
    { label: "Em Pausa", value: pausedCount, icon: Coffee, color: "text-yellow-600" },
    { label: "Ociosos", value: idleCount, icon: Users, color: "text-blue-600" },
    { label: "Chamadas Ativas", value: activeCalls, icon: PhoneCall, color: "text-primary" },
    { label: "Completadas Hoje", value: completedCalls, icon: PhoneOff, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={lastUpdate ? "border-emerald-500/40 text-emerald-700" : "border-destructive/40 text-destructive"}>
            {lastUpdate ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
            {lastUpdate ? "Conectado" : "Desconectado"}
          </Badge>
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              Atualizado: {lastUpdate.toLocaleTimeString("pt-BR")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="auto-refresh" />
            <Label htmlFor="auto-refresh" className="text-xs">Auto</Label>
          </div>
          <Select value={String(interval)} onValueChange={(v) => setRefreshInterval(Number(v))}>
            <SelectTrigger className="w-[80px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15s</SelectItem>
              <SelectItem value="30">30s</SelectItem>
              <SelectItem value="60">60s</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4 text-center">
              {loading && !lastUpdate ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <>
                  <kpi.icon className={`w-5 h-5 mx-auto mb-1 ${kpi.color}`} />
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{kpi.label}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent Status Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status dos Agentes</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentStatusTable
            agents={agents}
            loading={loading}
            onLogout={handleLogout}
            loggingOut={loggingOut}
            domain={domain}
            apiToken={apiToken}
          />
        </CardContent>
      </Card>

      {/* Campaigns Overview */}
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
