import { useState, useMemo, useEffect, useRef } from "react";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useSearchParams, useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useAtendimentoModalSafe } from "@/hooks/useAtendimentoModal";
import { formatCPF } from "@/lib/formatters";
import { createDisposition, fetchDispositions, qualifyOn3CPlus, saveCallLog, type DispositionType } from "@/services/dispositionService";
import { executeAutomations } from "@/services/dispositionAutomationService";
import { fetchCredorRules } from "@/services/cadastrosService";
import { findOrCreateSession, type SessionChannel } from "@/services/atendimentoSessionService";
import { acquireLock, renewLock, releaseLock, takeoverLock } from "@/services/lockService";
import { logAction } from "@/services/auditService";
import { ArrowLeft, Home, Phone, PhoneOff, Coffee, Clock, CheckCircle2, Loader2, MessageSquare, Globe, Bot, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import ClientHeader from "@/components/atendimento/ClientHeader";
import DispositionPanel from "@/components/atendimento/DispositionPanel";
import DebtorCategoryPanel from "@/components/atendimento/DebtorCategoryPanel";
import AgreementCalculator from "@/components/client-detail/AgreementCalculator";
import ClientTimeline, { ClientObservations } from "@/components/atendimento/ClientTimeline";

interface AtendimentoPageProps {
  clientId?: string;
  agentId?: number;
  callId?: string | number;
  embedded?: boolean;
  sessionId?: string;
  channel?: SessionChannel;
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  call: <Phone className="w-3.5 h-3.5" />,
  whatsapp: <MessageSquare className="w-3.5 h-3.5" />,
  portal: <Globe className="w-3.5 h-3.5" />,
  ai_whatsapp: <Bot className="w-3.5 h-3.5" />,
  ai_voice: <Bot className="w-3.5 h-3.5" />,
};

const CHANNEL_LABELS: Record<string, string> = {
  call: "Telefonia",
  whatsapp: "WhatsApp",
  portal: "Portal",
  ai_whatsapp: "IA WhatsApp",
  ai_voice: "IA Voz",
};

const AtendimentoPage = ({ clientId: propClientId, agentId: propAgentId, callId: propCallId, embedded, sessionId: propSessionId, channel: propChannel }: AtendimentoPageProps) => {
  const { clientId: paramClientId } = useParams<{ clientId: string }>();
  const [searchParams] = useSearchParams();
  const id = propClientId || paramClientId || searchParams.get("clientId");
  const navigate = useNavigate();
  const location = useLocation();
  const originBack = (location.state as any)?.from || "/carteira";
  const { user, profile } = useAuth();
  const { tenant, tenantUser } = useTenant();
  const queryClient = useQueryClient();
  const { trackAction } = useActivityTracker();
  const { agentStatus, onFinishDisposition } = useAtendimentoModalSafe();

  // Read agentId/callId/channel from URL params when not provided as props
  const agentId = propAgentId || (searchParams.get("agentId") ? Number(searchParams.get("agentId")) : undefined);
  const callId = propCallId || searchParams.get("callId") || undefined;
  const activeChannel = propChannel || (searchParams.get("channel") as SessionChannel | undefined) || (callId ? "call" : undefined);

  const [showNegotiation, setShowNegotiation] = useState(false);
  const [callingPhone, setCallingPhone] = useState(false);
  const [hangingUp, setHangingUp] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [finishingDisposition, setFinishingDisposition] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(propSessionId || searchParams.get("sessionId") || null);
  const [callHungUp, setCallHungUp] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockOwner, setLockOwner] = useState<string | null>(null);
  const lockRenewalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settings = (tenant?.settings as Record<string, any>) || {};
  const effectiveCallId = callId || sessionStorage.getItem("3cp_last_call_id");

  // Lock lifecycle
  useEffect(() => {
    if (!id || !tenant?.id || !profile?.id) return;

    const tryAcquire = async () => {
      const result = await acquireLock(
        tenant.id,
        id,
        profile.user_id || profile.id,
        profile.full_name || "Operador",
        activeChannel
      );
      if (!result.acquired) {
        setIsLocked(true);
        setLockOwner(result.existingOperator || "Outro operador");
        toast.warning(`Este cliente está em atendimento por ${result.existingOperator || "outro operador"}`, { duration: 6000 });
      } else {
        setIsLocked(false);
        setLockOwner(null);
        // Renew every 5 minutes
        lockRenewalRef.current = setInterval(() => {
          renewLock(tenant.id, id!, profile.user_id || profile.id);
        }, 5 * 60 * 1000);
      }
    };

    tryAcquire();

    return () => {
      if (lockRenewalRef.current) clearInterval(lockRenewalRef.current);
      if (tenant?.id && id && profile) {
        releaseLock(tenant.id, id, profile.user_id || profile.id);
      }
    };
  }, [id, tenant?.id, profile?.id]);

  // Fetch client
  const { data: client, isLoading: clientLoading } = useQuery<any>({
    queryKey: ["atendimento-client", id],
    queryFn: async () => {
      let q = supabase.from("clients").select("*").eq("id", id!);
      if (tenant?.id) q = q.eq("tenant_id", tenant.id);
      const { data, error } = await q.single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch all records for this CPF
  const { data: clientRecords = [] } = useQuery({
    queryKey: ["atendimento-records", client?.cpf],
    queryFn: async () => {
      const cpf = client!.cpf;
      const rawCpf = cpf.replace(/\D/g, "");
      let q = supabase
        .from("clients").select("*")
        .or(`cpf.eq.${rawCpf},cpf.eq.${formatCPF(rawCpf)}`)
        .order("numero_parcela", { ascending: true });
      if (tenant?.id) q = q.eq("tenant_id", tenant.id);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.cpf,
  });

  const { data: credorRules } = useQuery({
    queryKey: ["credor-rules", client?.credor, tenant?.id],
    queryFn: () => fetchCredorRules(tenant!.id, client!.credor),
    enabled: !!client?.credor && !!tenant?.id,
  });

  const { data: dispositions = [] } = useQuery({
    queryKey: ["dispositions", id],
    queryFn: () => fetchDispositions(id!),
    enabled: !!id,
  });

  const { data: agreements = [] } = useQuery({
    queryKey: ["atendimento-agreements", client?.cpf],
    queryFn: async () => {
      const cpf = client!.cpf;
      const rawCpf = cpf.replace(/\D/g, "");
      let q = supabase
        .from("agreements").select("*, profiles:created_by(full_name)")
        .or(`client_cpf.eq.${rawCpf},client_cpf.eq.${formatCPF(rawCpf)}`)
        .order("created_at", { ascending: false });
      if (tenant?.id) q = q.eq("tenant_id", tenant.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((a: any) => ({
        ...a,
        creator_name: a.profiles?.full_name || null,
        profiles: undefined,
      }));
    },
    enabled: !!client?.cpf,
  });

  const { data: callLogs = [] } = useQuery({
    queryKey: ["atendimento-call-logs", client?.cpf],
    queryFn: async () => {
      const cpf = client!.cpf;
      const rawCpf = cpf.replace(/\D/g, "");
      let q = supabase
        .from("call_logs" as any).select("*")
        .or(`client_cpf.eq.${rawCpf},client_cpf.eq.${formatCPF(rawCpf)}`)
        .order("called_at", { ascending: false });
      if (tenant?.id) q = q.eq("tenant_id", tenant.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!client?.cpf,
  });

  const effectiveAgentId = agentId || ((profile as any)?.threecplus_agent_id as number | undefined);

  // Disposition mutation
  const dispositionMutation = useMutation({
    mutationFn: async ({ type, notes, scheduledCallback }: { type: DispositionType; notes?: string; scheduledCallback?: string }) => {
      if (!tenant?.id || !profile?.id) throw new Error("Dados do operador não encontrados");
      return createDisposition({
        client_id: id!,
        tenant_id: tenant.id,
        operator_id: profile.id,
        disposition_type: type,
        notes,
        scheduled_callback: scheduledCallback,
      });
    },
    onSuccess: (_, variables) => {
      trackAction("tabulacao", { tipo: variables.type, client_id: id });
      queryClient.invalidateQueries({ queryKey: ["dispositions", id] });
      setCallHungUp(false);
      if (tenant?.id && id) {
        executeAutomations(tenant.id, variables.type, id, profile?.user_id || "").catch(console.error);
      }
      // Save call log from 3CPlus after disposition
      if (effectiveAgentId && settings.threecplus_domain && tenant?.id && client?.cpf) {
        saveCallLog({
          tenantId: tenant.id,
          clientId: id!,
          clientCpf: client.cpf,
          agentId: effectiveAgentId,
          tenantSettings: settings,
          operatorName: profile?.full_name || undefined,
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["atendimento-call-logs"] });
        }).catch(console.error);
      }
      if (effectiveAgentId && settings.threecplus_domain) {
        // Set flag IMMEDIATELY to prevent ACW screen from appearing while qualify is async
        sessionStorage.setItem("3cp_qualified_from_disposition", "true");
        qualifyOn3CPlus({ dispositionType: variables.type, tenantSettings: settings, agentId: effectiveAgentId, callId, tenantId: tenant?.id })
          .then((success) => {
            if (success) {
              sessionStorage.removeItem("3cp_last_call_id");
              toast.success("Qualificação enviada automaticamente para a 3CPlus");
            } else {
              console.warn("[Atendimento] qualifyOn3CPlus retornou false — ACW fallback será exibido");
              toast.warning("Tabulação salva no RIVO, mas falhou ao sincronizar com a 3CPlus", {
                description: "A qualificação pode precisar ser feita manualmente no discador.",
                duration: 8000,
              });
            }
          })
          .catch((err) => {
            console.error("[Atendimento] qualifyOn3CPlus error:", err);
            toast.warning("Tabulação salva no RIVO, mas erro ao enviar para 3CPlus");
          });
      }
    },
  });

  const handleAgreementCreated = () => {
    trackAction("criar_acordo_atendimento", { client_id: id });
    toast.success("Acordo criado com sucesso!");
    setShowNegotiation(false);
    queryClient.invalidateQueries({ queryKey: ["atendimento-agreements"] });
    if (tenant?.id && profile?.id) {
      createDisposition({ client_id: id!, tenant_id: tenant.id, operator_id: profile.id, disposition_type: "negotiated", notes: "Acordo gerado" })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["dispositions", id] });
          if (effectiveAgentId && settings.threecplus_domain) {
            qualifyOn3CPlus({ dispositionType: "negotiated", tenantSettings: settings, agentId: effectiveAgentId, callId, tenantId: tenant?.id });
          }
        });
    }
  };

  // Save observation
  const handleSaveNote = async (note: string) => {
    if (!client?.id) return;
    setSavingNote(true);
    try {
      const timestamp = new Date().toLocaleDateString("pt-BR") + " - " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const opName = profile?.full_name || "Operador";
      const entry = `${timestamp} | ${opName}\n${note}`;
      const current = client.observacoes || "";
      const updated = current ? `${entry}\n---\n${current}` : entry;
      const { error } = await supabase.from("clients").update({ observacoes: updated }).eq("id", client.id);
      if (error) throw error;

      // Also register as structured event
      if (tenant?.id) {
        await supabase.from("client_events").insert({
          tenant_id: tenant.id,
          client_id: client.id,
          client_cpf: client.cpf?.replace(/\D/g, "") || "",
          event_type: "observation_added",
          event_source: "operator",
          event_value: "note",
          metadata: { note, operator_name: opName, session_id: activeSessionId },
          session_id: activeSessionId,
        } as any);
      }

      logAction({ action: "observation_added", entity_type: "client", entity_id: client.id, details: { module: "atendimento", note: note.substring(0, 200) } });
      toast.success("Observação salva");
      queryClient.invalidateQueries({ queryKey: ["atendimento-client", client.id] });
      queryClient.invalidateQueries({ queryKey: ["client-events-timeline"] });
    } catch {
      toast.error("Erro ao salvar observação");
    } finally {
      setSavingNote(false);
    }
  };

  const totalAberto = clientRecords.filter((c) => c.status === "pendente").reduce((sum, c) => sum + Number(c.valor_parcela), 0);
  const totalPago = clientRecords.reduce((sum, c) => sum + Number(c.valor_pago), 0);

  // Calculate dias de atraso
  const diasAtraso = useMemo(() => {
    const pendentes = clientRecords.filter(c => c.status === "pendente" && c.data_vencimento);
    if (pendentes.length === 0) return 0;
    const oldest = pendentes.reduce((min, c) => {
      const d = new Date(c.data_vencimento);
      return d < min ? d : min;
    }, new Date(pendentes[0].data_vencimento));
    const diff = Math.floor((Date.now() - oldest.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [clientRecords]);

  if (clientLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  }

  if (!client) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        {!embedded && <Button variant="outline" onClick={() => navigate(originBack)}><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>}
      </div>
    );
  }

  const handleDisposition = async (type: DispositionType, notes?: string, scheduledCallback?: string) => {
    await dispositionMutation.mutateAsync({ type, notes, scheduledCallback });
  };

  const handleCall = async (phone: string) => {
    const callAgentId = effectiveAgentId;
    if (!callAgentId) { toast.error("Seu perfil não possui um agente 3CPlus vinculado"); return; }
    const { data: tenantData } = await supabase.from("tenants").select("settings").eq("id", tenant!.id).single();
    const tenantSettings = (tenantData?.settings as any) || {};
    const domain = tenantSettings.threecplus_domain;
    const apiToken = tenantSettings.threecplus_api_token;
    if (!domain || !apiToken) { toast.error("Telefonia 3CPlus não configurada neste tenant"); return; }
    setCallingPhone(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "click2call", domain, api_token: apiToken, agent_id: callAgentId, phone_number: phone.replace(/\D/g, "") },
      });
      if (error) throw error;
      if (data?.status && data.status >= 400) {
        const detail = data.detail || data.message || (Array.isArray(data.errors) ? data.errors[0] : null) || "Erro ao discar";
        toast.error(detail.toLowerCase().includes("não está online") || detail.toLowerCase().includes("not online")
          ? "Agente não está online no 3CPlus. Faça login na plataforma de telefonia antes de discar." : detail);
      } else {
        toast.success("Ligação iniciada");
      }
    } catch { toast.error("Erro ao iniciar ligação"); }
    finally { setCallingPhone(false); }
  };

  const handleHangup = async () => {
    const callAgentId = effectiveAgentId;
    if (!callAgentId) { toast.error("Agente não vinculado"); return; }
    const activeCallId = effectiveCallId;
    if (!activeCallId) { toast.error("Nenhuma chamada ativa para desligar"); return; }
    const domain = settings.threecplus_domain;
    const apiToken = settings.threecplus_api_token;
    if (!domain || !apiToken) { toast.error("3CPlus não configurada"); return; }
    console.log("[Hangup] Desligando — agentId:", callAgentId, "callId:", activeCallId, "domain:", domain);
    setHangingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "hangup_call", domain, api_token: apiToken, agent_id: callAgentId, call_id: activeCallId },
      });
      console.log("[Hangup] Response:", JSON.stringify(data), "error:", error);
      if (error) throw error;
      if (data?.status && data.status >= 400) {
        toast.error(data.detail || data.message || "Erro ao desligar");
      } else {
        toast.success("Ligação encerrada");
        setCallHungUp(true);
        // Register call_hangup event
        if (tenant?.id && client?.cpf) {
          supabase.from("client_events").insert({
            tenant_id: tenant.id,
            client_id: client.id,
            client_cpf: client.cpf?.replace(/\D/g, "") || "",
            event_type: "call_hangup",
            event_source: "operator",
            event_channel: "call",
            event_value: "hangup",
            metadata: { call_id: activeCallId, operator_name: profile?.full_name, agent_id: callAgentId, session_id: activeSessionId },
          } as any).then(({ error: evErr }) => {
            if (evErr) console.error("[Hangup] Erro ao registrar evento:", evErr);
          });
          queryClient.invalidateQueries({ queryKey: ["client-events-timeline"] });
        }
      }
    } catch (e) {
      console.error("[Hangup] Exception:", e);
      toast.error("Erro ao desligar ligação");
    } finally { setHangingUp(false); }
  };

  const getStatusConfig = () => {
    const s = Number(agentStatus);
    const hasManualPause = !!sessionStorage.getItem("3cp_active_pause_name");
    if (s === 2) return { label: "Em Ligação", icon: Phone, bgClass: "bg-emerald-500 text-white", pulse: true };
    if (s === 4) return { label: "TPA — Pós-atendimento", icon: Clock, bgClass: "bg-amber-500 text-white", pulse: false };
    if (s === 3 && hasManualPause) return { label: `Em Pausa: ${sessionStorage.getItem("3cp_active_pause_name")}`, icon: Coffee, bgClass: "bg-amber-500 text-white", pulse: false };
    if (s === 3) return { label: "TPA — Pós-atendimento", icon: Clock, bgClass: "bg-amber-500 text-white", pulse: false };
    if (s === 1) return { label: "Ocioso — Aguardando", icon: CheckCircle2, bgClass: "bg-muted text-muted-foreground", pulse: false };
    return null;
  };

  // Show status banner when agentId is present (telephony context)
  const statusConfig = agentId ? getStatusConfig() : null;
  // Show "Finalizar Tabulação" only for TPA (status 4) or status 3 without manual pause name (ACW)
  const isTPA = Number(agentStatus) === 4 || (Number(agentStatus) === 3 && !sessionStorage.getItem("3cp_active_pause_name"));
  const showFinishButton = onFinishDisposition && isTPA;

  const handleFinishDisposition = async () => {
    setFinishingDisposition(true);
    try {
      // Set flag BEFORE navigating back to prevent TelefoniaDashboard from showing ACW screen
      sessionStorage.setItem("3cp_qualified_from_disposition", "true");
      if (onFinishDisposition) await onFinishDisposition();
      toast.success("Tabulação finalizada — retornando à fila");
      // Navigate back to the dashboard
      navigate(-1);
    } catch (e) {
      console.error("[Atendimento] Erro ao finalizar tabulação:", e);
      toast.error("Erro ao finalizar. Tente novamente.");
    } finally {
      setFinishingDisposition(false);
    }
  };

  const canTakeover = tenantUser && ["admin", "gerente", "supervisor", "super_admin"].includes(tenantUser.role);

  const handleTakeover = async () => {
    if (!tenant?.id || !id || !profile) return;
    const lock = await takeoverLock(tenant.id, id, profile.user_id || profile.id, profile.full_name || "Operador", activeChannel);
    if (lock) {
      setIsLocked(false);
      setLockOwner(null);
      // Start renewal
      if (lockRenewalRef.current) clearInterval(lockRenewalRef.current);
      lockRenewalRef.current = setInterval(() => {
        renewLock(tenant.id, id!, profile.user_id || profile.id);
      }, 5 * 60 * 1000);
      logAction({ action: "atendimento_takeover", entity_type: "client", entity_id: id, details: { module: "atendimento", previous_operator: lockOwner } });
      toast.success("Atendimento assumido com sucesso");
    } else {
      toast.error("Erro ao assumir atendimento");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Lock Warning Banner */}
      {isLocked && lockOwner && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 text-white">
          <Lock className="w-4 h-4" />
          Cliente em atendimento por: {lockOwner} — Modo somente leitura
          {canTakeover && (
            <Button
              onClick={handleTakeover}
              size="sm"
              variant="secondary"
              className="ml-4 gap-1 bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              Assumir Atendimento
            </Button>
          )}
        </div>
      )}
      {/* 3CPlus Status Banner */}
      {statusConfig && (
        <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${statusConfig.bgClass} ${statusConfig.pulse ? "animate-pulse" : ""}`}>
          <statusConfig.icon className="w-4 h-4" />
          {statusConfig.label}
          {showFinishButton && (
            <Button
              onClick={handleFinishDisposition}
              disabled={finishingDisposition}
              size="sm"
              variant="secondary"
              className="ml-4 gap-1 bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              {finishingDisposition ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {finishingDisposition ? "Finalizando..." : "Finalizar Tabulação"}
            </Button>
          )}
        </div>
      )}

      {/* Breadcrumb */}
      {!embedded && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Home className="w-3.5 h-3.5" />
          <span>/</span>
          <span className="font-medium text-foreground">Atendimento em Curso</span>
          {activeChannel && (
            <Badge variant="outline" className="text-[10px] h-5 gap-1 ml-1">
              {CHANNEL_ICONS[activeChannel]}
              {CHANNEL_LABELS[activeChannel] || activeChannel}
            </Badge>
          )}
        </div>
      )}

      {/* Client Header */}
      <ClientHeader
        client={{ ...client, id: client.id } as any}
        clientRecords={clientRecords}
        totalAberto={totalAberto}
        totalPago={totalPago}
        totalParcelas={clientRecords.length}
        parcelasPagas={clientRecords.filter((c) => c.status === "pago").length}
        diasAtraso={diasAtraso}
        onCall={isLocked ? undefined : handleCall}
        callingPhone={callingPhone}
        onNegotiate={isLocked ? undefined : () => setShowNegotiation(true)}
        onHangup={isLocked ? undefined : handleHangup}
        hangingUp={hangingUp}
        hasActiveCall={!!effectiveCallId && !callHungUp}
      />

      {/* Main content — 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <DispositionPanel
            onDisposition={handleDisposition}
            loading={dispositionMutation.isPending}
            disabled={isLocked}
          />
          <DebtorCategoryPanel
            clientId={client.id}
            credorName={client.credor}
            currentCategoryId={client.debtor_category_id}
            tenantId={tenant?.id}
            clientCpf={client.cpf}
            disabled={isLocked}
          />
          {!isLocked && (
            <Dialog open={showNegotiation} onOpenChange={setShowNegotiation}>
              <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Formalizar Acordo — {client.nome_completo}</DialogTitle>
                </DialogHeader>
                <AgreementCalculator
                  clients={clientRecords}
                  cpf={client.cpf}
                  clientName={client.nome_completo}
                  credor={client.credor}
                  onAgreementCreated={handleAgreementCreated}
                  hasActiveAgreement={agreements.some((a: any) => a.status === "approved" || a.status === "pending")}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
        <div>
          <ClientTimeline
            dispositions={dispositions}
            agreements={agreements}
            callLogs={callLogs}
            clientCpf={client.cpf}
          />
        </div>
        <div>
          <ClientObservations
            observacoes={client.observacoes}
            onSaveNote={isLocked ? undefined : handleSaveNote}
            savingNote={savingNote}
          />
        </div>
      </div>

    </div>
  );
};

export default AtendimentoPage;
