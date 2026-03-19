import { useState, useMemo } from "react";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { formatCPF } from "@/lib/formatters";
import { createDisposition, fetchDispositions, qualifyOn3CPlus, saveCallLog, type DispositionType } from "@/services/dispositionService";
import { executeAutomations } from "@/services/dispositionAutomationService";
import { fetchCredorRules } from "@/services/cadastrosService";
import { ArrowLeft, Home } from "lucide-react";
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
}

const AtendimentoPage = ({ clientId: propClientId, agentId, callId, embedded }: AtendimentoPageProps) => {
  const { clientId: paramClientId } = useParams<{ clientId: string }>();
  const [searchParams] = useSearchParams();
  const id = propClientId || paramClientId || searchParams.get("clientId");
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const { trackAction } = useActivityTracker();
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [callingPhone, setCallingPhone] = useState(false);
  const [hangingUp, setHangingUp] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const settings = (tenant?.settings as Record<string, any>) || {};

  // Fetch client
  const { data: client, isLoading: clientLoading } = useQuery<any>({
    queryKey: ["atendimento-client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id!).single();
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
      const { data, error } = await supabase
        .from("clients").select("*")
        .or(`cpf.eq.${rawCpf},cpf.eq.${formatCPF(rawCpf)}`)
        .order("numero_parcela", { ascending: true });
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
      const { data, error } = await supabase
        .from("agreements").select("*, profiles:created_by(full_name)")
        .or(`client_cpf.eq.${rawCpf},client_cpf.eq.${formatCPF(rawCpf)}`)
        .order("created_at", { ascending: false });
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
      const { data, error } = await supabase
        .from("call_logs" as any).select("*")
        .or(`client_cpf.eq.${rawCpf},client_cpf.eq.${formatCPF(rawCpf)}`)
        .order("called_at", { ascending: false });
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
        qualifyOn3CPlus({ dispositionType: variables.type, tenantSettings: settings, agentId: effectiveAgentId, callId });
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
            qualifyOn3CPlus({ dispositionType: "negotiated", tenantSettings: settings, agentId: effectiveAgentId, callId });
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
      toast.success("Observação salva");
      queryClient.invalidateQueries({ queryKey: ["atendimento-client", client.id] });
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
        {!embedded && <Button variant="outline" onClick={() => navigate("/carteira")}><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>}
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
    const domain = settings.threecplus_domain;
    const apiToken = settings.threecplus_api_token;
    if (!domain || !apiToken) { toast.error("3CPlus não configurada"); return; }
    console.log("[Hangup] Desligando — agentId:", callAgentId, "domain:", domain);
    setHangingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "hangup_call", domain, api_token: apiToken, agent_id: callAgentId },
      });
      console.log("[Hangup] Response:", JSON.stringify(data), "error:", error);
      if (error) throw error;
      if (data?.status && data.status >= 400) {
        toast.error(data.detail || data.message || "Erro ao desligar");
      } else {
        toast.success("Ligação encerrada");
      }
    } catch (e) {
      console.error("[Hangup] Exception:", e);
      toast.error("Erro ao desligar ligação");
    } finally { setHangingUp(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      {!embedded && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Home className="w-3.5 h-3.5" />
          <span>/</span>
          <span className="font-medium text-foreground">Atendimento em Curso</span>
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
        onCall={handleCall}
        callingPhone={callingPhone}
        onNegotiate={() => setShowNegotiation(true)}
        onHangup={handleHangup}
        hangingUp={hangingUp}
        hasActiveCall={!!effectiveAgentId && !!settings.threecplus_domain}
      />

      {/* Main content — 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <DispositionPanel
            onDisposition={handleDisposition}
            loading={dispositionMutation.isPending}
          />
          <DebtorCategoryPanel
            clientId={client.id}
            credorName={client.credor}
            currentCategoryId={client.debtor_category_id}
            tenantId={tenant?.id}
            clientCpf={client.cpf}
          />
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
        </div>
        <div>
          <ClientTimeline
            dispositions={dispositions}
            agreements={agreements}
            callLogs={callLogs}
          />
        </div>
        <div>
          <ClientObservations
            observacoes={client.observacoes}
            onSaveNote={handleSaveNote}
            savingNote={savingNote}
          />
        </div>
      </div>
    </div>
  );
};

export default AtendimentoPage;
