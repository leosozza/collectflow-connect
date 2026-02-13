import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Ear, LogOut, Loader2, Phone, Clock, Coffee, Headphones,
  PhoneCall, BarChart3, Activity, CircleDot, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Agent {
  id: number;
  name: string;
  status: string | number;
  campaign?: string;
  campaign_name?: string;
  status_time?: string;
  pause_name?: string;
}

interface AgentDetailSheetProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  apiToken: string;
  onLogout: (agentId: number) => void;
  loggingOut: number | null;
}

const numericStatusMap: Record<number, string> = {
  0: "offline", 1: "idle", 2: "on_call", 3: "paused", 4: "acw", 5: "manual",
};

const statusLabels: Record<string, string> = {
  idle: "Ocioso", available: "Disponível", on_call: "Em Ligação",
  ringing: "Tocando", paused: "Em Pausa", acw: "ACW",
  manual: "Manual", offline: "Offline",
};

function normalizeStatus(s: string | number): string {
  if (typeof s === "number") return numericStatusMap[s] || "offline";
  return s?.toLowerCase().replace(/[\s-]/g, "_") || "offline";
}

function getInitials(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AgentDetailSheet = ({
  agent, open, onOpenChange, domain, apiToken, onLogout, loggingOut,
}: AgentDetailSheetProps) => {
  const [tab, setTab] = useState("escuta");
  const [extension, setExtension] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [spyLoading, setSpyLoading] = useState(false);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfData, setPerfData] = useState<any>(null);
  const [callsData, setCallsData] = useState<any[]>([]);
  const [actLoading, setActLoading] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  // Fetch performance data when tab changes
  useEffect(() => {
    if (!agent || tab !== "performance") return;
    const fetchPerf = async () => {
      setPerfLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];
        const [agentsReport, callsReport] = await Promise.all([
          invoke("agents_report", { startDate: today, endDate: today }).catch(() => null),
          invoke("calls_report", { startDate: today, endDate: today, agent_id: agent.id }).catch(() => null),
        ]);

        // Find this agent in the report
        const agentsList = agentsReport?.data || agentsReport || [];
        const found = Array.isArray(agentsList)
          ? agentsList.find((a: any) => a.id === agent.id || a.agent_id === agent.id)
          : null;
        setPerfData(found || agentsReport);

        const calls = callsReport?.data || callsReport || [];
        setCallsData(Array.isArray(calls) ? calls.slice(0, 10) : []);
      } catch {
        // silent
      } finally {
        setPerfLoading(false);
      }
    };
    fetchPerf();
  }, [agent, tab, invoke]);

  // Fetch activity data when tab changes
  useEffect(() => {
    if (!agent || tab !== "atividade") return;
    const fetchActivity = async () => {
      setActLoading(true);
      try {
        // Load profiles with threecplus_agent_id mapping
        const { data: profs } = await supabase.from("profiles").select("id, user_id, full_name, threecplus_agent_id" as any);
        setProfiles(profs || []);

        // Match agent by threecplus_agent_id first, then fallback to name
        const matched = (profs || []).find(
          (p: any) => p.threecplus_agent_id === agent.id
        ) || (profs || []).find(
          (p: any) => p.full_name?.toLowerCase().trim() === agent.name?.toLowerCase().trim()
        );

        if (matched) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const { data: logs } = await supabase
            .from("user_activity_logs" as any)
            .select("*")
            .eq("user_id", (matched as any).user_id)
            .gte("created_at", today.toISOString())
            .order("created_at", { ascending: false })
            .limit(50) as any;
          setActivities(logs || []);
        } else {
          setActivities([]);
        }
      } catch {
        setActivities([]);
      } finally {
        setActLoading(false);
      }
    };
    fetchActivity();
  }, [agent, tab]);

  const handleSpy = async () => {
    if (!agent) return;
    if (!extension && !phoneNumber) {
      toast.error("Informe um ramal ou telefone");
      return;
    }
    setSpyLoading(true);
    try {
      await invoke("spy_agent", {
        agent_id: agent.id,
        extension: extension || undefined,
        phone_number: phoneNumber.replace(/\D/g, "") || undefined,
      });
      toast.success(`Espionagem iniciada para ${agent.name}. Aguarde a ligação.`);
    } catch (err: any) {
      toast.error("Erro ao espionar: " + (err.message || "Tente novamente"));
    } finally {
      setSpyLoading(false);
    }
  };

  if (!agent) return null;

  const status = normalizeStatus(agent.status);
  const isOnCall = status === "on_call" || status === "ringing";
  const matchedProfile = profiles.find(
    (p: any) => p.threecplus_agent_id === agent.id
  ) || profiles.find(
    (p: any) => p.full_name?.toLowerCase().trim() === agent.name?.toLowerCase().trim()
  );

  const perfMetrics = perfData ? [
    { label: "Tempo Logado", value: perfData.logged_time || perfData.login_time || "—", icon: Clock },
    { label: "Em Ligação", value: perfData.call_time || perfData.on_call_time || "—", icon: PhoneCall },
    { label: "Em Pausa", value: perfData.pause_time || perfData.paused_time || "—", icon: Coffee },
    { label: "Ocioso", value: perfData.idle_time || perfData.available_time || "—", icon: Activity },
    { label: "Ligações", value: perfData.total_calls || perfData.calls || "—", icon: Phone },
    { label: "TMA", value: perfData.tma || perfData.average_call_time || "—", icon: BarChart3 },
  ] : [];

  // Activity analysis
  const firstActivity = activities.length > 0 ? activities[activities.length - 1] : null;
  const lastActivity = activities.length > 0 ? activities[0] : null;
  const minutesSinceLast = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity.created_at).getTime()) / 60000)
    : null;
  const isInactive = minutesSinceLast !== null && minutesSinceLast > 10;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/15 text-primary text-lg font-semibold">
                {getInitials(agent.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-left truncate">{agent.name || `Agente ${agent.id}`}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={`text-xs gap-1 ${isOnCall ? "border-destructive/40 text-destructive" : status === "paused" ? "border-amber-500/40 text-amber-700" : "border-emerald-500/40 text-emerald-700"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnCall ? "bg-destructive animate-pulse" : status === "paused" ? "bg-amber-500" : "bg-emerald-500"}`} />
                  {statusLabels[status] || status}
                </Badge>
                {agent.pause_name && <span className="text-xs text-muted-foreground">({agent.pause_name})</span>}
                {agent.status_time && <span className="text-xs text-muted-foreground">{agent.status_time}</span>}
              </div>
              {(agent.campaign_name || agent.campaign) && (
                <p className="text-xs text-muted-foreground mt-0.5">{agent.campaign_name || agent.campaign}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => onLogout(agent.id)}
              disabled={loggingOut === agent.id}
            >
              {loggingOut === agent.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              Deslogar
            </Button>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-3 grid grid-cols-3">
            <TabsTrigger value="escuta" className="text-xs gap-1"><Ear className="w-3.5 h-3.5" />Escuta</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs gap-1"><BarChart3 className="w-3.5 h-3.5" />Performance</TabsTrigger>
            <TabsTrigger value="atividade" className="text-xs gap-1"><Eye className="w-3.5 h-3.5" />Atividade</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 pb-6">
            {/* Escuta Tab */}
            <TabsContent value="escuta" className="mt-4 space-y-4">
              <Card className="border-border/60">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CircleDot className={`w-4 h-4 ${isOnCall ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
                    <span className="text-sm font-medium">{isOnCall ? "Em ligação — pode espionar" : "Sem ligação ativa — escuta de ambiente"}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Ramal</Label>
                      <Input placeholder="Ex: 1001" value={extension} onChange={(e) => setExtension(e.target.value)} className="h-9" />
                    </div>
                    <div className="text-center text-xs text-muted-foreground">ou</div>
                    <div className="space-y-1">
                      <Label className="text-xs">Telefone</Label>
                      <Input placeholder="DDD + Número" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="h-9" />
                    </div>
                  </div>
                  <Button onClick={handleSpy} disabled={spyLoading} className="w-full gap-2" size="sm">
                    {spyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ear className="w-4 h-4" />}
                    {isOnCall ? "Espionar Chamada" : "Escutar Ambiente"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="mt-4 space-y-4">
              {perfLoading ? (
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {perfMetrics.map((m) => (
                      <Card key={m.label} className="border-border/60">
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <m.icon className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{m.value}</p>
                            <p className="text-[10px] text-muted-foreground">{m.label}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {perfMetrics.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Sem dados de performance disponíveis para hoje</p>
                  )}

                  {callsData.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Últimas Chamadas</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Telefone</TableHead>
                            <TableHead className="text-xs">Duração</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Hora</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {callsData.map((call: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs">{call.phone || call.phone_number || "—"}</TableCell>
                              <TableCell className="text-xs">{call.duration || call.call_duration || "—"}</TableCell>
                              <TableCell className="text-xs">{call.qualification || call.status || "—"}</TableCell>
                              <TableCell className="text-xs">
                                {call.created_at || call.start_time
                                  ? new Date(call.created_at || call.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Atividade Tab */}
            <TabsContent value="atividade" className="mt-4 space-y-4">
              {actLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : !matchedProfile ? (
                <Card className="border-border/60">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Agente <strong>{agent.name}</strong> não foi vinculado a um usuário do sistema.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      O nome do agente no 3CPlus precisa corresponder ao nome completo do perfil no CollectFlow.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 gap-2">
                    <Card className="border-border/60">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground">Primeiro acesso</p>
                        <p className="text-sm font-semibold">
                          {firstActivity
                            ? new Date(firstActivity.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/60">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground">Último acesso</p>
                        <p className="text-sm font-semibold">
                          {lastActivity
                            ? new Date(lastActivity.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Active/Inactive indicator */}
                  {minutesSinceLast !== null && (
                    <Badge variant="outline" className={`gap-1.5 ${isInactive ? "border-destructive/40 text-destructive" : "border-emerald-500/40 text-emerald-700"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isInactive ? "bg-destructive" : "bg-emerald-500 animate-pulse"}`} />
                      {isInactive ? `Inativo há ${minutesSinceLast} min` : "Ativo na plataforma"}
                    </Badge>
                  )}

                  {/* Activity timeline */}
                  <div>
                    <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Timeline do Dia</h4>
                    {activities.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Sem atividade registrada hoje</p>
                    ) : (
                      <div className="space-y-1">
                        {activities.map((act: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 py-1.5 border-b border-border/40 last:border-0">
                            <span className="text-[10px] text-muted-foreground w-12 shrink-0 pt-0.5">
                              {new Date(act.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">
                                {act.activity_type === "page_view" ? `Navegou para ${act.page_path}` : act.action_detail || act.activity_type}
                              </p>
                              {act.activity_type === "action" && act.page_path && (
                                <p className="text-[10px] text-muted-foreground">{act.page_path}</p>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-[9px] shrink-0">
                              {act.activity_type === "page_view" ? "Navegação" : "Ação"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default AgentDetailSheet;
