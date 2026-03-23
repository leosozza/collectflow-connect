import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAtendimentoModal } from "@/hooks/useAtendimentoModal";
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
  const { updateAtendimento, isOpen: modalIsOpen } = useAtendimentoModal();
  const navigate = useNavigate();
  const hasOpened = useRef(false);

  // Query by CPF when available
  const { data: clientByCpf, isLoading: cpfLoading } = useQuery({
    queryKey: ["client-by-cpf", cleanCpf],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("cpf", cleanCpf)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!cleanCpf && cleanCpf.length >= 11 && !clientDbId,
  });

  // Determine resolved client: priority ID > CPF > phone
  const resolvedId = clientDbId || clientByCpf?.id || clientByPhone?.id;
  const isLoading = (!clientDbId && cleanCpf.length >= 11 && cpfLoading) || phoneLoading;

  console.log("[3CPlus] resolved — clientDbId:", clientDbId, "cpfResult:", clientByCpf?.id, "phoneResult:", clientByPhone?.id, "final:", resolvedId, "isLoading:", isLoading);

  // Open atendimento modal when client is resolved
  useEffect(() => {
    if (resolvedId && !hasOpened.current) {
      hasOpened.current = true;
      console.log("[Telefonia] Cliente encontrado, atualizando widget para", resolvedId);
      updateAtendimento(resolvedId, agentId, callId);
    }
  }, [resolvedId, updateAtendimento, agentId, callId]);

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

  if (isLoading) {
    return <div className="p-4 text-center text-muted-foreground text-sm">Buscando cliente...</div>;
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
  if (status === 3 || s === "paused") return "Em pausa";
  return String(status ?? "Desconhecido");
};

const statusColor = (status: any): string => {
  const s = String(status ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (status === 1 || ["idle", "available"].includes(s)) return "bg-emerald-500";
  if (status === 2 || ["on_call", "ringing"].includes(s)) return "bg-destructive";
  if (status === 4 || s === "acw") return "bg-amber-500";
  if (status === 3 || s === "paused") return "bg-amber-500";
  return "bg-muted-foreground";
};

const statusBgClass = (status: any): string => {
  const s = String(status ?? "").toLowerCase().replace(/[\s-]/g, "_");
  if (status === 2 || ["on_call", "ringing"].includes(s)) return "bg-destructive text-destructive-foreground";
  if (status === 4 || s === "acw") return "bg-amber-500 text-white";
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
  const [interval, setRefreshInterval] = useState(isOperatorView ? 10 : 30);
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
  const hasRehydrated = useRef(false);

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
      // Transition from on_call (2) to paused (3) = ACW
      if (prevStatus === 2 && currentStatus === 3) {
        console.log("[Telefonia] ACW detected — showing disposition screen");
        setIsACW(true);
        setActivePauseName("");
        sessionStorage.removeItem("3cp_active_pause_name");
      }
      // Transition from paused (3) to idle (1) = ACW ended or unpause
      if (prevStatus === 3 && currentStatus === 1) {
        setIsACW(false);
        setSelectedQualification("");
        setQualifyNotes("");
        sessionStorage.removeItem("3cp_qualified_from_disposition");
        sessionStorage.removeItem("3cp_last_call_id");
      }
    }

    previousStatusRef.current = currentStatus;
  }, [isOperatorView, myAgent?.status]);

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

  const { openWaiting, setPauseControls, closeAtendimento } = useAtendimentoModal();

  // Load campaign qualifications
  const loadCampaignQualifications = useCallback(async (campaignId: number) => {
    try {
      const data = await invoke("campaign_qualifications", { campaign_id: campaignId });
      const list = Array.isArray(data) ? data : data?.data || [];
      console.log("[Telefonia] Campaign qualifications loaded:", list.length, list);
      setCampaignQualifications(list);
    } catch (err) {
      console.warn("[Telefonia] Failed to load campaign qualifications:", err);
      setCampaignQualifications([]);
    }
  }, [invoke]);

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

        // Open widget in waiting mode immediately
        openWaiting(operatorAgentId);

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
        closeAtendimento();
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

  // Load pause intervals from campaign's work_break_group_id
  const loadPauseIntervals = useCallback(async (campaignId: number) => {
    try {
      // Search in both campaigns (admin) and agentCampaigns (operator)
      const allCampaigns = [...campaigns, ...agentCampaigns];
      const campaign = allCampaigns.find((c: any) => c.id === campaignId || String(c.id) === String(campaignId));
      let groupId = campaign?.work_break_group_id || campaign?.work_break_group?.id;
      
      if (!groupId) {
        console.log("[Telefonia] work_break_group_id não encontrado no listing, buscando detalhes da campanha", campaignId);
        try {
          const details = await invoke("campaign_details", { campaign_id: campaignId });
          const campaignData = details?.data || details;
          groupId = campaignData?.work_break_group_id || campaignData?.work_break_group?.id || campaignData?.dialer_settings?.work_break_group_id;
          console.log("[Telefonia] campaign_details response — work_break_group_id:", groupId, "keys:", Object.keys(campaignData || {}));
        } catch (e) {
          console.warn("[Telefonia] Falha ao buscar detalhes da campanha:", e);
        }
      }
      
      if (!groupId) {
        console.log("[Telefonia] Campanha sem work_break_group_id, sem intervalos de pausa");
        setPauseIntervals([]);
        return;
      }

      console.log("[Telefonia] Carregando intervalos do grupo:", groupId);
      const data = await invoke("list_work_break_group_intervals", { group_id: groupId });
      const list = Array.isArray(data) ? data : data?.data || [];
      console.log("[Telefonia] Intervalos de pausa carregados:", list.length, list);
      setPauseIntervals(list);
    } catch {
      setPauseIntervals([]);
    }
  }, [invoke, campaigns, agentCampaigns]);

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
        toast.error(result.detail || result.message || "Erro ao retomar");
      } else {
        setActivePauseName("");
        sessionStorage.removeItem("3cp_active_pause_name");
        toast.success("Pausa removida");
      }
      fetchAll();
    } catch (err: any) {
      console.error("[Telefonia] handleUnpause error:", err);
      toast.error(err?.message || "Erro ao retomar");
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
      fetchAll();
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

  // Rehydrate widget when operator is already online after page refresh
  useEffect(() => {
    if (isOperatorView && isAgentOnline && operatorAgentId && !hasRehydrated.current) {
      hasRehydrated.current = true;
      openWaiting(operatorAgentId);
    }
  }, [isOperatorView, isAgentOnline, operatorAgentId, openWaiting]);

  // Feed pause controls into the floating widget
  const isPausedStatus = myAgent?.status === 3 || String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_") === "paused";
  useEffect(() => {
    if (isOperatorView && isAgentOnline) {
      setPauseControls({
        intervals: pauseIntervals,
        isPaused: isPausedStatus,
        pausingWith,
        unpausing,
        onPause: handlePause,
        onUnpause: handleUnpause,
        agentStatus: myAgent?.status,
        agentName: myAgent?.name,
      });
    } else {
      setPauseControls(null);
    }
  }, [isOperatorView, isAgentOnline, pauseIntervals, isPausedStatus, pausingWith, unpausing, setPauseControls, myAgent?.status, myAgent?.name]);

  const isOnCall = myAgent?.status === 2 || String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_") === "on_call";
  const isPaused = myAgent?.status === 3 || String(myAgent?.status ?? "").toLowerCase().replace(/[\s-]/g, "_") === "paused";
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
      const callId = call.call_id || call.id;
      if (callId) {
        setLastCallId(callId);
        sessionStorage.setItem("3cp_last_call_id", String(callId));
      }
      const phone = call.phone || "";
      if (phone) setLastCallPhone(phone);
    }
  }, [activeCall, lastFinishedCall]);

  // Get mailing fields from active call
  const mailingCpf = activeCall?.identifier || activeCall?.mailing_identifier || "";
  const mailingClientId = activeCall?.Extra3 || activeCall?.extra3 || activeCall?.mailing_extra3 || "";
  const activeCallPhone = activeCall?.phone || myAgent?.phone || myAgent?.remote_phone || "";

  // ACW fallback: agent is paused (status 3) with no manual pause name and a finished call exists
  // Skip if qualify was already done from the disposition panel during the call
  const qualifiedFromDisposition = !!sessionStorage.getItem("3cp_qualified_from_disposition");
  const isACWFallback = isPaused && !activePauseName && !isACW && !qualifiedFromDisposition && (
    !!lastFinishedCall || !!sessionStorage.getItem("3cp_last_call_id")
  );
  const effectiveACW = (isACW || isACWFallback) && !qualifiedFromDisposition;

  // Auto-load qualifications when ACW fallback is detected
  useEffect(() => {
    if (effectiveACW && campaignQualifications.length === 0 && myCampaignId) {
      loadCampaignQualifications(Number(myCampaignId));
    }
  }, [effectiveACW, campaignQualifications.length, myCampaignId, loadCampaignQualifications]);

  if (isOperatorView && myAgent) {
    console.log("[3CPlus] myAgent status:", myAgent.status, "isOnCall:", isOnCall, "isPaused:", isPaused, "isACW:", isACW, "effectiveACW:", effectiveACW, "activePauseName:", activePauseName);
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

    // State: On call → show atendimento (unified)
    if (isOnCall && (activeCallPhone || mailingCpf || mailingClientId)) {
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
            callId={activeCall?.call_id || myAgent?.call_id || myAgent?.current_call_id}
            clientCpf={mailingCpf}
            clientDbId={mailingClientId}
          />
        </div>
      );
    }

    // State: ACW (After Call Work) → show disposition screen
    if (effectiveACW && isPaused) {
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
              {isPaused && activePauseName
                ? `Em pausa: ${activePauseName} (${formatTimer(timerSeconds)})`
                : `${statusLabel(myAgent?.status)} (${formatTimer(timerSeconds)})`
              }
            </span>
          </div>

          {/* Right spacer */}
          <div className="w-4" />
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
              invoke("click2call", { agent_id: operatorAgentId, phone }).then(() => {
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
      />
    </div>
  );
};

export default TelefoniaDashboard;
