import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAtendimentoModalSafe } from "@/hooks/useAtendimentoModal";
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
import { Textarea } from "@/components/ui/textarea";
import {
  RefreshCw, Users, PhoneCall, PhoneOff, Coffee, Headphones, Wifi, WifiOff, LogIn, LogOut, Pause, Play,
  Phone, MessageSquare, UserX, FileCheck2, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import AgentStatusTable from "./AgentStatusTable";
import AgentDetailSheet from "./AgentDetailSheet";
import CampaignOverview from "./CampaignOverview";
import ScriptPanel from "./ScriptPanel";
import OperatorCallHistory from "./OperatorCallHistory";
import RealtimeStatusBadge from "./RealtimeStatusBadge";
import { useClientByPhone } from "@/hooks/useClientByPhone";


/** Wrapper that resolves client by mailing data (ID/CPF) or phone – navigates to /atendimento/:clientId when found */
const TelefoniaAtendimentoWrapper = ({
  clientPhone,
  agentId,
  callId,
  clientCpf,
  clientDbId,
}: {
  clientPhone: string;
  agentId: number;
  callId?: string | number;
  clientCpf?: string;
  clientDbId?: string;
}) => {
  const cleanCpf = clientCpf?.replace(/\D/g, "") || "";
  console.log("[3CPlus] TelefoniaAtendimentoWrapper rendered — clientPhone:", clientPhone, "clientCpf:", cleanCpf, "clientDbId:", clientDbId, "agentId:", agentId, "callId:", callId);

  const { client: clientByPhone, isLoading: phoneLoading } = useClientByPhone(clientPhone);
  const navigate = useNavigate();
  const hasOpened = useRef(false);

  // Query by CPF when available — run in parallel (no clientDbId exclusion)
  const { data: clientByCpf, isLoading: cpfLoading } = useQuery({
    queryKey: ["client-by-cpf", cleanCpf],
    queryFn: async () => {
      const { data: tenantIdResult } = await supabase.rpc("get_my_tenant_id");
      let q = supabase
        .from("clients")
        .select("*")
        .eq("cpf", cleanCpf)
        .limit(1);
      if (tenantIdResult) q = q.eq("tenant_id", tenantIdResult);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!cleanCpf && cleanCpf.length >= 11,
  });

  // Determine resolved client: priority ID > CPF > phone
  const resolvedId = clientDbId || clientByCpf?.id || clientByPhone?.id;
  const isLoading = (!clientDbId && cleanCpf.length >= 11 && cpfLoading) || phoneLoading;

  console.log("[3CPlus] resolved — clientDbId:", clientDbId, "cpfResult:", clientByCpf?.id, "phoneResult:", clientByPhone?.id, "final:", resolvedId, "isLoading:", isLoading);

  // Navigate to client file when client is resolved
  useEffect(() => {
    if (resolvedId && !hasOpened.current) {
      hasOpened.current = true;
      console.log("[Telefonia] Cliente encontrado, navegando para ficha:", resolvedId);
      const params = new URLSearchParams();
      if (agentId) params.set("agentId", String(agentId));
      if (callId) params.set("callId", String(callId));
      params.set("channel", "call");
      navigate(`/atendimento/${resolvedId}?${params.toString()}`);
    }
  }, [resolvedId, navigate, agentId, callId]);

  // Reset flag when inputs change
  useEffect(() => {
    hasOpened.current = false;
  }, [clientPhone, clientCpf, clientDbId]);

  // Show error toast if lookup fails after loading
  useEffect(() => {
    if (!isLoading && !resolvedId && (clientPhone || cleanCpf)) {
      const details = `Phone: ${clientPhone || "N/A"}\nCPF: ${cleanCpf || "N/A"}\nDB ID: ${clientDbId || "N/A"}\nCPF query result: ${clientByCpf === null ? "null" : JSON.stringify(clientByCpf)}\nPhone query result: ${clientByPhone === null ? "null" : JSON.stringify(clientByPhone)}`;
      console.warn("[3CPlus] Cliente não encontrado. Detalhes:", details);
      toast.error("Cliente não encontrado no CRM", {
        description: "Clique para copiar log detalhado",
        duration: 15000,
        action: {
          label: "Copiar log",
          onClick: () => {
            navigator.clipboard.writeText(details).then(() => {
              console.log("[3CPlus] Log de erro copiado:\n", details);
              toast.success("Log copiado para a área de transferência");
            });
          },
        },
      });
    }
  }, [isLoading, resolvedId, clientPhone, cleanCpf, clientDbId, clientByCpf, clientByPhone]);

  // Loader: while we don't have ANY identifier yet (call just started, polling not done)
  if (!clientPhone && !cleanCpf && !clientDbId) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Aguardando dados da chamada...
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground text-sm">Buscando cliente...</div>;
  }

  // No client found in CRM but we DO have a phone — auto-navigate to /atendimento?phone=...
  // so the operator always lands on a working ficha (page handles unknown clients via querystring).
  if (!resolvedId && clientPhone) {
    if (!hasOpened.current) {
      hasOpened.current = true;
      const params = new URLSearchParams();
      params.set("phone", clientPhone);
      if (cleanCpf) params.set("cpf", cleanCpf);
      if (agentId) params.set("agentId", String(agentId));
      if (callId) params.set("callId", String(callId));
      params.set("channel", "call");
      console.log("[Telefonia] Cliente não encontrado, abrindo ficha por telefone:", clientPhone);
      navigate(`/atendimento?${params.toString()}`);
    }
    return (
      <div className="p-6 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Abrindo ficha de atendimento...
      </div>
    );
  }

  if (!resolvedId) {
    return (
      <Card className="border-dashed m-3">
        <CardContent className="py-6 space-y-4">
          <div className="flex items-center gap-3">
            <UserX className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-foreground">Cliente não encontrado no CRM</p>
              <p className="text-xs text-muted-foreground">
                {cleanCpf ? `CPF: ${cleanCpf}` : `Telefone: ${clientPhone}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => navigate(`/cadastro?phone=${encodeURIComponent(clientPhone)}${cleanCpf ? `&cpf=${encodeURIComponent(cleanCpf)}` : ""}`)}
            >
              <Users className="w-3.5 h-3.5" />
              Cadastrar Cliente
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(`/atendimento?phone=${encodeURIComponent(clientPhone)}`)}
            >
              <Phone className="w-3.5 h-3.5" />
              Abrir Atendimento
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <div className="p-4 text-center text-muted-foreground text-sm">Abrindo ficha do cliente...</div>;
};

interface TelefoniaDashboardProps {
  menuButton?: React.ReactNode;
  isOperatorView?: boolean;
}

const statusLabel = (status: any): string => {
  const s = String(status ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (status === 1 || ["idle", "available"].includes(s)) return "Aguardando ligação";
  if (status === 2 || ["on_call", "ringing"].includes(s)) return "Em ligação";
  if (status === 4 || s === "acw") return "TPA — Pós-atendimento";
  if (status === 6 || s === "work_break") return "Em Intervalo";
  if (status === 3 || s === "paused") return "Em pausa";
  return String(status ?? "Desconhecido");
};

const statusColor = (status: any): string => {
  const s = String(status ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (status === 1 || ["idle", "available"].includes(s)) return "bg-emerald-500";
  if (status === 2 || ["on_call", "ringing"].includes(s)) return "bg-destructive";
  if (status === 4 || s === "acw") return "bg-amber-500";
  if (status === 6 || s === "work_break") return "bg-amber-500";
  if (status === 3 || s === "paused") return "bg-amber-500";
  return "bg-muted-foreground";
};

const statusBgClass = (status: any): string => {
  const s = String(status ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (status === 2 || ["on_call", "ringing"].includes(s)) return "bg-destructive text-destructive-foreground";
  if (status === 4 || s === "acw") return "bg-amber-500 text-white";
  if (status === 6 || s === "work_break") return "bg-amber-500 text-white";
  if (status === 3 || s === "paused") return "bg-amber-500 text-white";
  return "bg-primary text-primary-foreground";
};

/** Format seconds into HH:MM:SS or MM:SS */
const formatTimer = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const totalSec = Math.floor(seconds);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/** Parse a start time from 3CPlus API into epoch ms */
const parseStartTime = (value: any): number | null => {
  if (!value) return null;
  if (typeof value === "number") {
    if (value < 1e12) return value * 1000;
    return value;
  }
  const str = String(value);
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getTime() > 0) return d.getTime();
  const num = Number(str);
  if (!isNaN(num) && num > 0) {
    if (num < 1e12) return num * 1000;
    return num;
  }
  return null;
};

const TelefoniaDashboard = ({ menuButton, isOperatorView }: TelefoniaDashboardProps) => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [agents, setAgents] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [agentCampaigns, setAgentCampaigns] = useState<any[]>([]);
  const [companyCalls, setCompanyCalls] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [interval, setRefreshInterval] = useState(isOperatorView ? 3 : 15);
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
  const [reconnectingSip, setReconnectingSip] = useState(false);

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [activePauseName, setActivePauseName] = useState<string>(() => sessionStorage.getItem("3cp_active_pause_name") || "");

  // ACW (After Call Work) state
  const previousStatusRef = useRef<number | null>(null);
  const [isACW, setIsACW] = useState(false);
  const [lastCallId, setLastCallId] = useState<string | number | null>(null);
  const [lastCallPhone, setLastCallPhone] = useState<string>("");
  const [campaignQualifications, setCampaignQualifications] = useState<any[]>([]);
  const [selectedQualification, setSelectedQualification] = useState<string>("");
  const [qualifyNotes, setQualifyNotes] = useState("");
  const [qualifying, setQualifying] = useState(false);

  const operatorAgentId = (profile as any)?.threecplus_agent_id as number | null | undefined;
  const operatorExtension = (profile as any)?.threecplus_extension as string | null | undefined;

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
        .select("operator_id, disposition_type")
        .gte("created_at", todayStart);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const { data: cpcDispositionKeys = [] } = useQuery({
    queryKey: ["cpc-disposition-keys"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_disposition_types")
        .select("key")
        .eq("is_cpc", true);
      if (error) throw error;
      return (data || []).map((d: any) => d.key);
    },
    staleTime: 300000,
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

  const cpcKeySet = useMemo(() => new Set(cpcDispositionKeys), [cpcDispositionKeys]);

  const agentMetrics = useMemo(() => {
    const metrics: Record<number, { contacts: number; agreements: number; cpc: number }> = {};
    const profileIdToAgent = new Map<string, number>();
    const userIdToAgent = new Map<string, number>();
    for (const p of profileMappings) {
      profileIdToAgent.set(p.id, p.threecplus_agent_id);
      userIdToAgent.set(p.user_id, p.threecplus_agent_id);
    }
    for (const d of todayDispositions) {
      const agentId = profileIdToAgent.get(d.operator_id);
      if (agentId != null) {
        if (!metrics[agentId]) metrics[agentId] = { contacts: 0, agreements: 0, cpc: 0 };
        metrics[agentId].contacts++;
        if (cpcKeySet.has(d.disposition_type)) {
          metrics[agentId].cpc++;
        }
      }
    }
    for (const a of todayAgreements) {
      const agentId = userIdToAgent.get(a.created_by);
      if (agentId != null) {
        if (!metrics[agentId]) metrics[agentId] = { contacts: 0, agreements: 0, cpc: 0 };
        metrics[agentId].agreements++;
      }
    }
    return metrics;
  }, [profileMappings, todayDispositions, todayAgreements, cpcKeySet]);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    // CORRECTION 7: Check success flag from proxy to detect masked 3CPlus errors
    if (data && data.success === false) {
      throw new Error(data.detail || data.title || `Erro da 3CPlus (${data.status})`);
    }
    return data;
  }, [domain, apiToken]);

  const fetchAll = useCallback(async () => {
    try {
      const promises: Promise<any>[] = [
        invoke("agents_status").catch(() => []),
        invoke("company_calls").catch(() => null),
      ];

      if (!isOperatorView) {
        promises.push(invoke("list_campaigns").catch(() => []));
      }

      if (operatorAgentId) {
        promises.push(
          invoke("agent_available_campaigns", { agent_id: operatorAgentId }).catch(() => [])
        );
      }

      const results = await Promise.all(promises);
      const agentsData = results[0];
      const callsData = results[1];

      const agentList = Array.isArray(agentsData) ? agentsData : agentsData?.data || [];
      console.log("[3CPlus] agents_status response:", JSON.stringify(agentList));
      console.log("[3CPlus] company_calls response:", JSON.stringify(callsData));
      setAgents(agentList);

      if (operatorAgentId) {
        const foundAgent = agentList.find((a: any) => a.id === operatorAgentId || a.agent_id === operatorAgentId);
        console.log("[3CPlus] operatorAgentId:", operatorAgentId, "myAgent found:", JSON.stringify(foundAgent));
      }

      if (isOperatorView) {
        const agentCampaignsData = operatorAgentId ? results[2] : null;
        if (agentCampaignsData) {
          const agentCampList = Array.isArray(agentCampaignsData) ? agentCampaignsData : agentCampaignsData?.data || [];
          setAgentCampaigns(agentCampList);
        }
      } else {
        const campaignsData = results[2];
        const agentCampaignsData = operatorAgentId ? results[3] : null;

        if (agentCampaignsData) {
          const agentCampList = Array.isArray(agentCampaignsData) ? agentCampaignsData : agentCampaignsData?.data || [];
          setAgentCampaigns(agentCampList);
        }

        const campList = Array.isArray(campaignsData) ? campaignsData : campaignsData?.data || [];

        const enriched = await Promise.all(
          campList
            .filter((c: any) => {
              const s = String(c.status ?? "").toLowerCase();
              return s === "running" || s === "paused" || !c.paused;
            })
            .map(async (c: any) => {
              try {
                const { extractObject } = await import("@/lib/threecplusUtils");
                const stats = await invoke("campaign_statistics", { campaign_id: c.id });
                return { ...c, statistics: extractObject(stats) };
              } catch (err) {
                console.warn(`[Telefonia] campaign_statistics failed for ${c.id}:`, err);
                return c;
              }
            })
        );

        const activeIds = new Set(enriched.map((c: any) => c.id));
        const rest = campList.filter((c: any) => !activeIds.has(c.id));
        setCampaigns([...enriched, ...rest]);
      }

      setCompanyCalls(callsData);
      setLastUpdate(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [invoke, operatorAgentId, isOperatorView]);

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
  // Use sessionStorage fallback for campaign_id since agents_status doesn't return it
  const myCampaignId = myAgent?.campaign_id || myAgent?.campaign?.id || sessionStorage.getItem("3cp_campaign_id");

  const myAgentStartTime = myAgent?.status_start_time || myAgent?.status_time;
  const myAgentStatus = myAgent?.status;

  useEffect(() => {
    if (!isOperatorView || !isAgentOnline) {
      setTimerSeconds(0);
      return;
    }
    const startMs = parseStartTime(myAgentStartTime);
    const calcSeconds = () => {
      if (!startMs) return 0;
      const diff = Math.floor((Date.now() - startMs) / 1000);
      if (diff < 0 || diff > 86400) return 0;
      return diff;
    };
    setTimerSeconds(calcSeconds());
    const id = setInterval(() => setTimerSeconds(calcSeconds()), 1000);
    return () => clearInterval(id);
  }, [isOperatorView, isAgentOnline, myAgentStartTime, myAgentStatus]);

  // ── ACW Detection: track status transitions ──
  useEffect(() => {
    if (!isOperatorView || !myAgent) return;
    const currentStatus = myAgent.status;
    const prevStatus = previousStatusRef.current;

    if (prevStatus !== null && prevStatus !== currentStatus) {
      console.log("[Telefonia] Status transition:", prevStatus, "→", currentStatus);
      // Transition INTO on_call (2): force an immediate fetch so company_calls is populated ASAP
      // — otherwise we have a 3s gap where isOnCall is true but no mailing/phone is known yet.
      if (currentStatus === 2 && prevStatus !== 2) {
        console.log("[Telefonia] Entered on_call — forcing immediate fetchAll() to populate company_calls");
        fetchAll();
        setTimeout(() => fetchAll(), 800);
      }
      // Transition from on_call (2) to paused (3) or ACW/TPA (4) = ACW
      if (prevStatus === 2 && (currentStatus === 3 || currentStatus === 4)) {
        console.log("[Telefonia] ACW/TPA detected — showing disposition screen");
        setIsACW(true);
        setActivePauseName("");
        sessionStorage.removeItem("3cp_active_pause_name");
      }
      // NEW: Transition from on_call (2) to idle (1) = ACW without TPA configured
      if (prevStatus === 2 && currentStatus === 1) {
        const hungUpFlag = !!sessionStorage.getItem("3cp_call_hung_up");
        const pendingCall = lastCallId || sessionStorage.getItem("3cp_last_call_id");
        const alreadyQualified = !!sessionStorage.getItem("3cp_qualified_from_disposition");
        if ((pendingCall || hungUpFlag) && !alreadyQualified) {
          console.log("[Telefonia] ACW forçado: chamada encerrada sem TPA (2→1), callId:", pendingCall, "hungUpFlag:", hungUpFlag);
          setIsACW(true);
        }
      }
      // If hangup was done from AtendimentoPage while polling still shows status 2, force ACW
      if (currentStatus === 2 && !!sessionStorage.getItem("3cp_call_hung_up")) {
        const alreadyQualified = !!sessionStorage.getItem("3cp_qualified_from_disposition");
        if (!alreadyQualified && !isACW) {
          console.log("[Telefonia] Hangup detectado via flag enquanto polling ainda em status 2 — forçando ACW");
          setIsACW(true);
        }
      }
      // Transition from paused/ACW (3 or 4) to idle (1) = ACW ended or unpause
      if ((prevStatus === 3 || prevStatus === 4) && currentStatus === 1) {
        // Only clear ACW if it was already resolved (not forced from 2→1)
        if (!isACW) {
          setSelectedQualification("");
          setQualifyNotes("");
          sessionStorage.removeItem("3cp_qualified_from_disposition");
          sessionStorage.removeItem("3cp_last_call_id");
        }
        setIsACW(false);
      }
      // Sync: clear activePauseName when leaving pause/work_break states
      if ((prevStatus === 3 || prevStatus === 6) && currentStatus !== 3 && currentStatus !== 6) {
        setActivePauseName("");
        sessionStorage.removeItem("3cp_active_pause_name");
      }
    }

    previousStatusRef.current = currentStatus;
  }, [isOperatorView, myAgent?.status, lastCallId, isACW, fetchAll]);

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

  const atendimentoCtx = useAtendimentoModalSafe();
  const { setAgentStatus, setOnFinishDisposition } = atendimentoCtx;

  // Load campaign qualifications — prioritize qualification_list_id from tenant settings
  const loadCampaignQualifications = useCallback(async (campaignId: number) => {
    try {
      // Use qualification_list_id from tenant settings if available (set by sync_dispositions)
      const listId = (tenant?.settings as any)?.threecplus_qualification_list_id;
      const params: any = { campaign_id: campaignId };
      if (listId) {
        params.list_id = listId;
        console.log("[Telefonia] Using qualification_list_id from tenant settings:", listId);
      }
      const data = await invoke("campaign_qualifications", params);
      const list = Array.isArray(data) ? data : data?.data || [];
      console.log("[Telefonia] Campaign qualifications loaded:", list.length, list);
      setCampaignQualifications(list);
    } catch (err) {
      console.warn("[Telefonia] Failed to load campaign qualifications:", err);
      setCampaignQualifications([]);
    }
  }, [invoke, tenant?.settings]);

  const handleCampaignLogin = async () => {
    if (!selectedCampaign || !operatorAgentId) return;
    setLoggingIn(true);
    try {
      const result = await invoke("login_agent_to_campaign", {
        agent_id: operatorAgentId,
        campaign_id: Number(selectedCampaign),
      });
      const isSuccess = result?.success || result?.no_content || (result?.status && result.status >= 200 && result.status < 300);
      const isError = result?.status && result.status >= 400;
      
      if (isError) {
        toast.error(result.detail || result.message || "Erro ao entrar na campanha");
      } else {
        // Persist campaign_id in sessionStorage for interval loading
        sessionStorage.setItem("3cp_campaign_id", selectedCampaign);

        // Load pause intervals and qualifications for this campaign
        loadPauseIntervals(Number(selectedCampaign));
        loadCampaignQualifications(Number(selectedCampaign));

        // Auto-connect SIP/MicroSIP after successful login
        try {
          const connectResult = await invoke("connect_agent", {
            agent_id: operatorAgentId,
          });
          const connectError = connectResult?.status && connectResult.status >= 400;
          
          if (connectError) {
            toast.warning("Logado na campanha, mas falha ao conectar MicroSIP. Conecte manualmente.");
          } else {
            toast.success("Conectado! Atenda o MicroSIP para iniciar.");
          }
        } catch {
          toast.warning("Logado na campanha, mas falha ao conectar MicroSIP.");
        }
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
      const isError = result?.status && result.status >= 400;
      if (isError) {
        toast.error(result.detail || result.message || "Erro ao sair da campanha");
      } else {
        toast.success("Deslogado da campanha");
        setActivePauseName("");
        sessionStorage.removeItem("3cp_active_pause_name");
        sessionStorage.removeItem("3cp_campaign_id");
        setIsACW(false);
        setCampaignQualifications([]);
        previousStatusRef.current = null;
      }
      fetchAll();
    } catch {
      toast.error("Erro ao sair da campanha");
    } finally {
      setLoggingOutSelf(false);
    }
  };

  // Load pause intervals — primary: agent_work_break_intervals (uses agent token directly)
  // Fallback: campaign_details + list_work_break_group_intervals
  const loadPauseIntervals = useCallback(async (campaignId: number) => {
    try {
      // Primary: use agent endpoint that returns intervals directly
      if (operatorAgentId) {
        console.log("[Telefonia] Buscando intervalos via agent_work_break_intervals, agentId:", operatorAgentId);
        try {
          const data = await invoke("agent_work_break_intervals", { agent_id: operatorAgentId });
          const list = Array.isArray(data) ? data : data?.data || [];
          if (list.length > 0) {
            console.log("[Telefonia] Intervalos carregados via agente:", list.length, list);
            setPauseIntervals(list);
            return;
          }
          console.log("[Telefonia] agent_work_break_intervals retornou vazio, tentando fallback");
        } catch (e) {
          console.warn("[Telefonia] agent_work_break_intervals falhou, tentando fallback:", e);
        }
      }

      // Fallback: campaign_details + group intervals
      console.log("[Telefonia] Buscando detalhes da campanha para intervalos:", campaignId);
      const details = await invoke("campaign_details", { campaign_id: campaignId });
      const campaignData = details?.data || details;
      const groupId = campaignData?.work_break_group_id 
        || campaignData?.work_break_group?.id 
        || campaignData?.dialer_settings?.work_break_group_id
        || campaignData?.dialer?.work_break_group_id;
      console.log("[Telefonia] campaign_details — work_break_group_id:", groupId);
      
      if (!groupId) {
        console.log("[Telefonia] Campanha sem work_break_group_id, sem intervalos de pausa");
        setPauseIntervals([]);
        return;
      }

      const data = await invoke("list_work_break_group_intervals", { group_id: groupId });
      const list = Array.isArray(data) ? data : data?.data || [];
      console.log("[Telefonia] Intervalos carregados via grupo:", list.length, list);
      setPauseIntervals(list);
    } catch {
      setPauseIntervals([]);
    }
  }, [invoke, operatorAgentId]);

  const handlePause = async (intervalId: number) => {
    if (!operatorAgentId) return;
    setPausingWith(intervalId);
    const intervalObj = pauseIntervals.find((pi: any) => pi.id === intervalId);
    const pauseName = intervalObj?.name || intervalObj?.description || `Intervalo ${intervalId}`;
    try {
      console.log("[Telefonia] handlePause — agentId:", operatorAgentId, "intervalId:", intervalId);
      const result = await invoke("pause_agent", { agent_id: operatorAgentId, interval_id: intervalId });
      console.log("[Telefonia] handlePause result:", JSON.stringify(result));
      const isError = result?.status && result.status >= 400;
      if (isError) {
        toast.error(result.detail || result.message || "Erro ao pausar");
      } else {
        setActivePauseName(pauseName);
        sessionStorage.setItem("3cp_active_pause_name", pauseName);
        toast.success(`Pausa ativada: ${pauseName}`);
      }
      fetchAll();
    } catch (err: any) {
      console.error("[Telefonia] handlePause error:", err);
      toast.error(err?.message || "Erro ao pausar");
    } finally {
      setPausingWith(null);
    }
  };

  const handleUnpause = async () => {
    if (!operatorAgentId) return;
    setUnpausing(true);
    try {
      console.log("[Telefonia] handleUnpause — agentId:", operatorAgentId);
      const result = await invoke("unpause_agent", { agent_id: operatorAgentId });
      console.log("[Telefonia] handleUnpause result:", JSON.stringify(result));
      const isError = result?.status && result.status >= 400;
      if (isError) {
        const msg = (result.detail || result.message || "").toLowerCase();
        const isNotInInterval =
          msg.includes("não está em intervalo") ||
          msg.includes("nao esta em intervalo") ||
          msg.includes("not in interval") ||
          msg.includes("cannot be removed") ||
          msg.includes("não pode ser removido");
        if (msg.includes("não está em pausa") || msg.includes("not paused") || msg.includes("not in pause")) {
          // Agent already left pause on server — clear local state gracefully
          setActivePauseName("");
          sessionStorage.removeItem("3cp_active_pause_name");
          toast.info("Pausa já encerrada no servidor");
        } else if (isNotInInterval) {
          // TPA masquerading as pause — fallback to qualify_call with first available qualification
          console.warn("[Telefonia] unpause rejected (not in interval), falling back to qualify_call");
          const callIdToQualify = lastCallId || sessionStorage.getItem("3cp_last_call_id");
          const qualId = campaignQualifications.length > 0 ? campaignQualifications[0].id : null;
          if (callIdToQualify && qualId) {
            try {
              const qResult = await invoke("qualify_call", {
                call_id: callIdToQualify,
                qualification_id: Number(qualId),
              });
              console.log("[Telefonia] fallback qualify_call result:", JSON.stringify(qResult));
              const qErr = qResult?.status && qResult.status >= 400;
              if (qErr) {
                toast.error(qResult.detail || "Não foi possível tabular a chamada");
              } else {
                toast.success("Chamada tabulada (TPA encerrada)");
                setActivePauseName("");
                setLastCallId(null);
                sessionStorage.removeItem("3cp_last_call_id");
                sessionStorage.removeItem("3cp_active_pause_name");
              }
            } catch (e: any) {
              toast.error(e?.message || "Erro ao tabular chamada");
            }
          } else {
            // No call/qualification available — open ACW panel for manual selection
            setIsACW(true);
            toast.info("Selecione um motivo para encerrar o TPA");
          }
        } else {
          toast.error(result.detail || result.message || "Erro ao retomar");
        }
      } else {
        setActivePauseName("");
        sessionStorage.removeItem("3cp_active_pause_name");
        toast.success("Pausa removida");
      }
      fetchAll();
    } catch (err: any) {
      console.error("[Telefonia] handleUnpause error:", err);
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("não está em pausa") || msg.includes("not paused") || msg.includes("not in pause")) {
        setActivePauseName("");
        sessionStorage.removeItem("3cp_active_pause_name");
        toast.info("Pausa já encerrada no servidor");
        fetchAll();
      } else {
        toast.error(err?.message || "Erro ao retomar");
      }
    } finally {
      setUnpausing(false);
    }
  };

  // Qualify call (ACW disposition)
  const handleQualifyCall = async () => {
    if (!operatorAgentId || !selectedQualification) return;
    setQualifying(true);
    try {
      const callIdToQualify = lastCallId || sessionStorage.getItem("3cp_last_call_id");
      console.log("[Telefonia] handleQualifyCall — callId:", callIdToQualify, "qualificationId:", selectedQualification, "notes:", qualifyNotes);
      
      if (!callIdToQualify) {
        // If no call_id, try unpause as fallback
        console.warn("[Telefonia] No call_id available for qualification, attempting unpause");
        await handleUnpause();
        setIsACW(false);
        return;
      }

      const result = await invoke("qualify_call", {
        call_id: callIdToQualify,
        qualification_id: Number(selectedQualification),
        notes: qualifyNotes || undefined,
      });
      console.log("[Telefonia] qualify_call result:", JSON.stringify(result));
      const isError = result?.status && result.status >= 400;
      if (isError) {
        toast.error(result.detail || result.message || "Erro ao tabular chamada");
      } else {
        toast.success("Chamada tabulada com sucesso!");
        setIsACW(false);
        setSelectedQualification("");
        setQualifyNotes("");
        setLastCallId(null);
        setLastCallPhone("");
        sessionStorage.removeItem("3cp_last_call_id");
      }
      await fetchAll();
      setTimeout(() => fetchAll(), 1500);
    } catch (err: any) {
      console.error("[Telefonia] handleQualifyCall error:", err);
      toast.error(err?.message || "Erro ao tabular chamada");
    } finally {
      setQualifying(false);
    }
  };

  // Load intervals when agent comes online with a campaign
  useEffect(() => {
    if (isOperatorView && isAgentOnline && myCampaignId) {
      loadPauseIntervals(Number(myCampaignId));
      // Also load qualifications if not loaded yet
      if (campaignQualifications.length === 0) {
        loadCampaignQualifications(Number(myCampaignId));
      }
    }
  }, [isOperatorView, isAgentOnline, myCampaignId, loadPauseIntervals, loadCampaignQualifications]);

  // Detect external pause (status 3 manual or 6 work_break) and resolve a label
  useEffect(() => {
    if (!isOperatorView) return;
    const s = myAgent?.status;
    if ((s === 3 || s === 6) && !activePauseName) {
      const storedName = sessionStorage.getItem("3cp_active_pause_name");
      if (storedName) {
        setActivePauseName(storedName);
      } else {
        // Generic label so the header stays consistent and "Retomar" is reachable
        setActivePauseName(s === 6 ? "Intervalo" : "Pausa");
      }
    }
  }, [isOperatorView, myAgent?.status, activePauseName, pauseIntervals]);

  // No longer needed — widget was removed

  // Derived telephony state: distinguish TPA from manual pause
  // TPA mascarada: a 3CPlus retorna status=3 mas é pós-atendimento (sem intervalo conhecido + chamada recente)
  const _hasKnownPause = !!activePauseName || !!sessionStorage.getItem("3cp_active_pause_name");
  const _hasFinishedCallPending = !!sessionStorage.getItem("3cp_last_call_id");
  const isTPAMasqueradedAsPause = myAgent?.status === 3 && !_hasKnownPause && _hasFinishedCallPending;

  // Pausa manual REAL: status 6 sempre, ou status 3 desde que NÃO seja TPA mascarada
  const isManualPause = (myAgent?.status === 6 || ["work_break"].includes(String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_")))
    || (myAgent?.status === 3 && !isTPAMasqueradedAsPause)
    || (["paused"].includes(String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_")) && !isTPAMasqueradedAsPause);
  const isPausedStatus = myAgent?.status === 3 || myAgent?.status === 4 || myAgent?.status === 6 || String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_") === "paused" || String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_") === "acw" || String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_") === "work_break";

  // No longer needed — pause controls were part of the widget

  // Feed agent status into the modal context
  useEffect(() => {
    if (isOperatorView && isAgentOnline) {
      setAgentStatus(myAgent?.status);
    } else {
      setAgentStatus(undefined);
    }
  }, [isOperatorView, isAgentOnline, myAgent?.status, setAgentStatus]);

  // Provide a finish disposition callback to the modal
  // For TPA (status 4): use qualify_call, NOT unpause_agent
  // For manual pause (status 3 with pause name): use unpause_agent
  useEffect(() => {
    if (isOperatorView && isAgentOnline && operatorAgentId) {
      const finishFn = async () => {
        const currentStatus = myAgent?.status;
        const isTPA = currentStatus === 4 || (currentStatus === 3 && !activePauseName);

        if (isTPA) {
          // TPA: try qualify_call first (correct 3CPlus flow)
          const callIdToQualify = lastCallId || sessionStorage.getItem("3cp_last_call_id");
          if (callIdToQualify) {
            // Check if already qualified from disposition panel
            const alreadyQualified = !!sessionStorage.getItem("3cp_qualified_from_disposition");
            if (!alreadyQualified) {
              // Try to qualify with a generic qualification if available
              try {
                const qualId = campaignQualifications.length > 0 ? campaignQualifications[0].id : null;
                if (qualId) {
                  const result = await invoke("qualify_call", {
                    call_id: callIdToQualify,
                    qualification_id: Number(qualId),
                  });
                  console.log("[Telefonia] qualify_call from finishDisposition result:", JSON.stringify(result));
                } else {
                  console.warn("[Telefonia] No qualifications available for qualify_call, trying unpause fallback");
                  await invoke("unpause_agent", { agent_id: operatorAgentId });
                }
              } catch (e) {
                console.warn("[Telefonia] qualify_call failed, trying unpause fallback:", e);
                try {
                  await invoke("unpause_agent", { agent_id: operatorAgentId });
                } catch (e2) {
                  console.warn("[Telefonia] unpause fallback also failed:", e2);
                }
              }
            } else {
              console.log("[Telefonia] Already qualified from disposition panel, just cleaning up");
            }
          } else {
            // No call ID, try unpause as last resort
            try {
              await invoke("unpause_agent", { agent_id: operatorAgentId });
            } catch (e) {
              console.warn("[Telefonia] unpause fallback failed (no callId):", e);
            }
          }
        } else {
          // Manual pause: use unpause_agent (correct for work_break/exit)
          try {
            await invoke("unpause_agent", { agent_id: operatorAgentId });
            console.log("[Telefonia] unpause_agent success (manual pause)");
          } catch (e) {
            console.warn("[Telefonia] unpause_agent failed:", e);
          }
        }

        setIsACW(false);
        setActivePauseName("");
        sessionStorage.removeItem("3cp_last_call_id");
        sessionStorage.removeItem("3cp_qualified_from_disposition");
        sessionStorage.removeItem("3cp_active_pause_name");
        // Optimistic update + immediate refresh
        await fetchAll();
        setTimeout(() => fetchAll(), 1500);
      };
      setOnFinishDisposition(finishFn);
    } else {
      setOnFinishDisposition(null);
    }
  }, [isOperatorView, isAgentOnline, operatorAgentId, lastCallId, myAgent?.status, activePauseName, campaignQualifications, setOnFinishDisposition]);

  const isOnCall = (myAgent?.status === 2 || String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_") === "on_call") && !sessionStorage.getItem("3cp_call_hung_up");
  const isPaused = myAgent?.status === 3 || myAgent?.status === 6 || String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_") === "paused" || String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_") === "work_break";
  const isTPAStatus = myAgent?.status === 4 || String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_") === "acw";
  const isSipConnected = myAgent?.sip_connected === true || myAgent?.extension_status === "registered" || myAgent?.sip_status === "registered";

  // Extract active call for this agent from company_calls data
  const { activeCall, lastFinishedCall } = useMemo(() => {
    if (!operatorAgentId || !companyCalls) return { activeCall: null, lastFinishedCall: null };
    const callsData = companyCalls?.data || companyCalls;
    const agentIdStr = String(operatorAgentId);
    let allCalls: any[] = [];
    if (Array.isArray(callsData)) {
      allCalls = callsData;
    } else if (typeof callsData === "object" && callsData !== null) {
      for (const statusKey of Object.keys(callsData)) {
        const group = callsData[statusKey];
        if (Array.isArray(group)) allCalls.push(...group);
      }
    }
    const myCalls = allCalls.filter((c: any) => String(c.agent) === agentIdStr || String(c.agent_id) === agentIdStr);
    const live = myCalls.find((c: any) => !c.hangup_time && String(c.status) !== "4") || null;
    const finished = myCalls.find((c: any) => !!c.hangup_time || String(c.status) === "4") || null;
    return { activeCall: live, lastFinishedCall: finished };
  }, [companyCalls, operatorAgentId]);

  // Track active call id for ACW qualification
  useEffect(() => {
    const call = activeCall || lastFinishedCall;
    if (call) {
      // Prefer telephony_id for qualify API, fallback to call_id/id
      const telephonyId = call.telephony_id || call.call_id || call.id;
      if (telephonyId) {
        setLastCallId(telephonyId);
        sessionStorage.setItem("3cp_last_call_id", String(telephonyId));
      }
      const phone = call.phone || "";
      if (phone) setLastCallPhone(phone);
    }
  }, [activeCall, lastFinishedCall]);

  // Get mailing fields from active call
  const mailingCpf = activeCall?.identifier || activeCall?.mailing_identifier || "";
  const mailingClientId = activeCall?.Extra3 || activeCall?.extra3 || activeCall?.mailing_extra3 || "";
  const activeCallPhone = activeCall?.phone || myAgent?.phone || myAgent?.remote_phone || "";

  // ACW fallback: agent is paused (status 3) or TPA (status 4) with no manual pause name and a finished call exists
  // Skip if qualify was already done from the disposition panel during the call
  const qualifiedFromDisposition = !!sessionStorage.getItem("3cp_qualified_from_disposition");
  const isACWFallback = (isPaused || isTPAStatus || isTPAMasqueradedAsPause) && !activePauseName && !isACW && !qualifiedFromDisposition && (
    !!lastFinishedCall || !!sessionStorage.getItem("3cp_last_call_id")
  );
  const effectiveACW = (isACW || isACWFallback || isTPAStatus || isTPAMasqueradedAsPause) && !qualifiedFromDisposition && !isManualPause;

  // Auto-load qualifications when ACW fallback is detected
  useEffect(() => {
    if (effectiveACW && campaignQualifications.length === 0 && myCampaignId) {
      loadCampaignQualifications(Number(myCampaignId));
    }
  }, [effectiveACW, campaignQualifications.length, myCampaignId, loadCampaignQualifications]);

  // Auto-open ACW panel when TPA masqueraded as pause is detected for >3s
  useEffect(() => {
    if (!isTPAMasqueradedAsPause || isACW) return;
    const t = setTimeout(() => {
      console.log("[Telefonia] Auto-opening ACW panel — TPA masquerading as pause detected");
      setIsACW(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [isTPAMasqueradedAsPause, isACW]);

  if (isOperatorView && myAgent) {
    console.log("[3CPlus] myAgent status:", myAgent.status, "isOnCall:", isOnCall, "isPaused:", isPaused, "isTPAStatus:", isTPAStatus, "isACW:", isACW, "effectiveACW:", effectiveACW, "activePauseName:", activePauseName);
    console.log("[3CPlus] activeCall (live):", JSON.stringify(activeCall), "lastFinished:", JSON.stringify(lastFinishedCall));
    console.log("[3CPlus] resolved mailing — CPF:", mailingCpf, "clientDbId:", mailingClientId, "phone:", activeCallPhone);
  }

  const handleReconnectSip = async () => {
    if (!operatorAgentId) return;
    setReconnectingSip(true);
    try {
      const result = await invoke("connect_agent", { agent_id: operatorAgentId });
      const isError = result?.status && result.status >= 400;
      if (isError) {
        toast.error(result.detail || "Falha ao reconectar MicroSIP");
      } else {
        toast.success("Reconectando MicroSIP. Atenda a chamada.");
      }
      fetchAll();
    } catch {
      toast.error("Erro ao reconectar MicroSIP");
    } finally {
      setReconnectingSip(false);
    }
  };

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
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
                  <WifiOff className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Agente não vinculado</h3>
                <p className="text-sm text-muted-foreground">
                  Seu perfil não possui um ID de agente 3CPlus configurado. Solicite ao seu administrador que vincule seu ID de agente no menu <strong>Cadastros → Usuários</strong>.
                </p>
              </div>
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
                    {(agentCampaigns.length > 0 ? agentCampaigns : campaigns)
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

    // State: On call → ALWAYS render the atendimento wrapper, even before company_calls
    // resolves the mailing/phone — the wrapper shows a loader until identifiers arrive.
    if (isOnCall) {
      return (
        <div className="space-y-0">
          <div className={`flex items-center justify-between px-4 py-2.5 ${statusBgClass(myAgent?.status)} animate-pulse`}>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4" />
              <span className="font-semibold text-sm">Em ligação ({formatTimer(timerSeconds)})</span>
            </div>
          </div>
          <TelefoniaAtendimentoWrapper
            clientPhone={activeCallPhone}
            agentId={operatorAgentId!}
            callId={activeCall?.call_id || activeCall?.telephony_id || myAgent?.call_id || myAgent?.current_call_id}
            clientCpf={mailingCpf}
            clientDbId={mailingClientId}
          />
        </div>
      );
    }

    // State: ACW (After Call Work) → show disposition screen (fallback when operator didn't dispose in the client file)
    if (effectiveACW && (isPaused || isTPAStatus || isACW)) {
      return (
        <div className="space-y-4">
          {/* ACW Header */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-500 text-white">
            <div className="flex items-center gap-3">
              <FileCheck2 className="w-4 h-4" />
              <span className="font-semibold text-sm">Pós-atendimento — Tabulação ({formatTimer(timerSeconds)})</span>
            </div>
          </div>

          {/* Disposition Form */}
          <div className="px-4 space-y-4">
            <Card>
              <CardContent className="py-6 space-y-5">
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-bold text-foreground">Tabular Chamada</h3>
                  <p className="text-sm text-muted-foreground">
                    Você não tabulou durante o atendimento. Selecione a qualificação abaixo para retornar à campanha.
                    {lastCallPhone && <span className="block text-xs mt-1">Telefone: {lastCallPhone}</span>}
                  </p>
                </div>

                {/* Qualification selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Qualificação *</Label>
                  {campaignQualifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma qualificação disponível para esta campanha</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                      {campaignQualifications.map((q: any) => (
                        <button
                          key={q.id}
                          onClick={() => setSelectedQualification(String(q.id))}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                            selectedQualification === String(q.id)
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-primary/50 hover:bg-accent"
                          }`}
                        >
                          {q.color && (
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: q.color }}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{q.name || q.label || q.description}</p>
                          </div>
                          {selectedQualification === String(q.id) && (
                            <CheckCircle2 className="w-4 h-4 text-primary ml-auto shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Observações</Label>
                  <Textarea
                    value={qualifyNotes}
                    onChange={(e) => setQualifyNotes(e.target.value)}
                    placeholder="Observações sobre a chamada (opcional)..."
                    rows={3}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleQualifyCall}
                    disabled={!selectedQualification || qualifying}
                    className="flex-1 gap-2"
                    size="lg"
                  >
                    <CheckCircle2 className={`w-4 h-4 ${qualifying ? "animate-spin" : ""}`} />
                    {qualifying ? "Tabulando..." : "Confirmar Tabulação"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsACW(false);
                      handleUnpause();
                    }}
                    disabled={unpausing}
                    size="lg"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Pular
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Exit campaign */}
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

    // State: Logged in, waiting for call (or manual pause)
    return (
      <div className="space-y-4">
        {/* ── Top Status Bar ── */}
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl ${statusBgClass(myAgent?.status)}`}>
          <div className="flex items-center gap-3">
            {/* Interval dropdown — only show "Retomar" for MANUAL pause, not TPA */}
            {isManualPause ? (
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
              {effectiveACW
                ? `TPA — Pós-atendimento (${formatTimer(timerSeconds)})`
                : isPaused && activePauseName
                ? `Em Intervalo: ${activePauseName} (${formatTimer(timerSeconds)})`
                : isPaused && myAgent?.status === 6
                ? `Em Intervalo (${formatTimer(timerSeconds)})`
                : `${statusLabel(myAgent?.status)} (${formatTimer(timerSeconds)})`
              }
            </span>
          </div>

          {/* Right side: Force unpause escape hatch when stuck in pause for >60s */}
          {isPaused && timerSeconds > 60 ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleUnpause}
              disabled={unpausing}
              className="gap-1.5 h-8 text-xs bg-white/20 hover:bg-white/30 border-0"
              title="Pausa travada? Force a saída"
            >
              <Play className={`w-3.5 h-3.5 ${unpausing ? "animate-spin" : ""}`} />
              Forçar saída
            </Button>
          ) : (
            <div className="w-4" />
          )}
        </div>

        {/* ── 4 KPI Cards ── */}
        <div className="grid grid-cols-2 gap-3 px-4">
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

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CPC</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{myMetrics?.cpc ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Contatos com pessoa certa</p>
            </CardContent>
          </Card>

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

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <FileCheck2 className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Acordos</p>
              </div>
              <p className="text-3xl font-bold text-foreground">{myMetrics?.agreements ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">Formalizados hoje</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Last calls table ── */}
        <div className="px-4">
          <OperatorCallHistory onClickToCall={(phone) => {
            if (operatorAgentId) {
              invoke("click2call", {
                agent_id: operatorAgentId,
                phone,
                phone_number: phone,
                extension: operatorExtension && String(operatorExtension).trim()
                  ? String(operatorExtension).trim()
                  : undefined,
              }).then(() => {
                toast.success(`Ligando para ${phone}...`);
              }).catch(() => {
                toast.error("Erro ao iniciar ligação");
              });
            }
          }} />
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
  const onlineAgents = agents.filter((a) => a.status !== 0 && statusStr(a.status) !== "offline");
  const onlineCount = onlineAgents.length;
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-lg font-semibold text-foreground truncate">Dashboard</h2>
          <RealtimeStatusBadge
            status={atendimentoCtx.socketStatus}
            lastEventAt={atendimentoCtx.socketLastEventAt}
            lastEventName={atendimentoCtx.socketLastEventName}
            errorMessage={atendimentoCtx.socketErrorMessage}
            onReconnect={atendimentoCtx.socketReconnect}
          />
        </div>
        <div className="flex items-center gap-2">
          <TestConnectionButton
            socketStatus={atendimentoCtx.socketStatus}
            socketLastEventAt={atendimentoCtx.socketLastEventAt}
            socketReconnect={atendimentoCtx.socketReconnect}
          />
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
                    <SelectItem value="10">10 segundos</SelectItem>
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

      <CampaignOverview
        campaigns={campaigns}
        loading={loading}
        domain={domain}
        apiToken={apiToken}
        onRefresh={fetchAll}
        lastUpdate={lastUpdate}
      />
    </div>
  );
};

export default TelefoniaDashboard;
