import { useState } from "react";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { formatCPF } from "@/lib/formatters";
import { createAgreement } from "@/services/agreementService";
import { createDisposition, fetchDispositions, type DispositionType } from "@/services/dispositionService";
import { executeAutomations } from "@/services/dispositionAutomationService";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ClientHeader from "@/components/atendimento/ClientHeader";
import DispositionPanel from "@/components/atendimento/DispositionPanel";
import NegotiationPanel from "@/components/atendimento/NegotiationPanel";
import ClientTimeline from "@/components/atendimento/ClientTimeline";

const AtendimentoPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const { trackAction } = useActivityTracker();
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [callingPhone, setCallingPhone] = useState(false);

  // Fetch client by ID
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["atendimento-client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch all records for this CPF (for totals)
  const { data: clientRecords = [] } = useQuery({
    queryKey: ["atendimento-records", client?.cpf],
    queryFn: async () => {
      const cpf = client!.cpf;
      const rawCpf = cpf.replace(/\D/g, "");
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .or(`cpf.eq.${rawCpf},cpf.eq.${formatCPF(rawCpf)}`)
        .order("numero_parcela", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.cpf,
  });

  // Fetch dispositions
  const { data: dispositions = [] } = useQuery({
    queryKey: ["dispositions", id],
    queryFn: () => fetchDispositions(id!),
    enabled: !!id,
  });

  // Fetch agreements for this CPF
  const { data: agreements = [] } = useQuery({
    queryKey: ["atendimento-agreements", client?.cpf],
    queryFn: async () => {
      const cpf = client!.cpf;
      const rawCpf = cpf.replace(/\D/g, "");
      const { data, error } = await supabase
        .from("agreements")
        .select("*")
        .or(`client_cpf.eq.${rawCpf},client_cpf.eq.${formatCPF(rawCpf)}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.cpf,
  });

  // Fetch message logs for this client
  const { data: messageLogs = [] } = useQuery({
    queryKey: ["atendimento-messages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_logs")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

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
      // Execute post-disposition automations
      if (tenant?.id && id) {
        executeAutomations(tenant.id, variables.type, id, profile?.user_id || "").catch(console.error);
      }
    },
  });

  // Agreement mutation
  const agreementMutation = useMutation({
    mutationFn: async (data: {
      discount_percent: number;
      new_installments: number;
      proposed_total: number;
      new_installment_value: number;
      first_due_date: string;
      notes?: string;
    }) => {
      if (!user?.id || !tenant?.id || !client) throw new Error("Dados não encontrados");
      return createAgreement(
        {
          client_cpf: client.cpf,
          client_name: client.nome_completo,
          credor: client.credor,
          original_total: totalAberto,
          proposed_total: data.proposed_total,
          discount_percent: data.discount_percent,
          new_installments: data.new_installments,
          new_installment_value: data.new_installment_value,
          first_due_date: data.first_due_date,
          notes: data.notes,
        },
        user.id,
        tenant.id
      );
    },
    onSuccess: () => {
      trackAction("criar_acordo_atendimento", { client_id: id });
      toast.success("Acordo criado com sucesso!");
      setShowNegotiation(false);
      queryClient.invalidateQueries({ queryKey: ["atendimento-agreements"] });
      // Also register negotiation disposition
      if (tenant?.id && profile?.id) {
        createDisposition({
          client_id: id!,
          tenant_id: tenant.id,
          operator_id: profile.id,
          disposition_type: "negotiated",
          notes: "Acordo gerado",
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["dispositions", id] });
        });
      }
    },
    onError: () => {
      toast.error("Erro ao criar acordo");
    },
  });

  if (clientLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  }

  if (!client) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" onClick={() => navigate("/carteira")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const totalAberto = clientRecords
    .filter((c) => c.status === "pendente")
    .reduce((sum, c) => sum + Number(c.valor_parcela), 0);
  const totalPago = clientRecords.reduce((sum, c) => sum + Number(c.valor_pago), 0);

  const handleDisposition = async (type: DispositionType, notes?: string, scheduledCallback?: string) => {
    await dispositionMutation.mutateAsync({ type, notes, scheduledCallback });
  };

  const handleCall = async (phone: string) => {
    if (!profile?.threecplus_agent_id) {
      toast.error("Seu perfil não possui um agente 3CPlus vinculado");
      return;
    }
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("settings")
      .eq("id", tenant!.id)
      .single();
    const settings = (tenantData?.settings as any) || {};
    const domain = settings.threecplus_domain;
    const apiToken = settings.threecplus_api_token;
    if (!domain || !apiToken) {
      toast.error("Telefonia 3CPlus não configurada neste tenant");
      return;
    }
    setCallingPhone(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: {
          action: "click2call",
          domain,
          api_token: apiToken,
          agent_id: profile.threecplus_agent_id,
          phone_number: phone.replace(/\D/g, ""),
        },
      });
      if (error) throw error;
      if (data?.status && data.status >= 400) {
        toast.error(data.detail || data.message || "Erro ao discar");
      } else {
        toast.success("Ligação iniciada");
      }
    } catch {
      toast.error("Erro ao iniciar ligação");
    } finally {
      setCallingPhone(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back button */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Atendimento</h1>
          <p className="text-sm text-muted-foreground">Tela do operador</p>
        </div>
      </div>

      {/* Client Header */}
      <ClientHeader
        client={client as any}
        totalAberto={totalAberto}
        totalPago={totalPago}
        totalParcelas={clientRecords.length}
        parcelasPagas={clientRecords.filter((c) => c.status === "pago").length}
        onCall={handleCall}
        callingPhone={callingPhone}
      />

      {/* Main content - two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <DispositionPanel
            onDisposition={handleDisposition}
            onNegotiate={() => setShowNegotiation(true)}
            loading={dispositionMutation.isPending}
          />

          {showNegotiation && (
            <NegotiationPanel
              totalAberto={totalAberto}
              clientCpf={client.cpf}
              clientName={client.nome_completo}
              credor={client.credor}
              onClose={() => setShowNegotiation(false)}
              onCreateAgreement={async (data) => { await agreementMutation.mutateAsync(data); }}
              loading={agreementMutation.isPending}
            />
          )}
        </div>

        <div className="lg:col-span-2">
          <ClientTimeline
            dispositions={dispositions}
            agreements={agreements}
            messages={messageLogs}
          />
        </div>
      </div>
    </div>
  );
};

export default AtendimentoPage;
