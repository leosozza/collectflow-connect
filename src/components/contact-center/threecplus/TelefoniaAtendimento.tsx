import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { formatCPF } from "@/lib/formatters";
import { createAgreement } from "@/services/agreementService";
import { createDisposition, fetchDispositions, qualifyOn3CPlus, type DispositionType } from "@/services/dispositionService";
import { executeAutomations } from "@/services/dispositionAutomationService";
import { toast } from "sonner";
import ClientHeader from "@/components/atendimento/ClientHeader";
import DispositionPanel from "@/components/atendimento/DispositionPanel";
import NegotiationPanel from "@/components/atendimento/NegotiationPanel";
import ClientTimeline from "@/components/atendimento/ClientTimeline";
import { Card, CardContent } from "@/components/ui/card";
import { UserX } from "lucide-react";

interface TelefoniaAtendimentoProps {
  clientPhone: string;
  agentId: number;
  callId?: string | number;
}

const TelefoniaAtendimento = ({ clientPhone, agentId, callId }: TelefoniaAtendimentoProps) => {
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [showNegotiation, setShowNegotiation] = useState(false);
  const settings = (tenant?.settings as Record<string, any>) || {};

  // Normalize phone for lookup — match last 8+ digits
  const normalizedPhone = clientPhone.replace(/\D/g, "");
  const phoneSuffix = normalizedPhone.length >= 8 ? normalizedPhone.slice(-8) : normalizedPhone;

  // Fetch client by phone
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["telefonia-client", phoneSuffix],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .or(`phone.ilike.%${phoneSuffix},phone2.ilike.%${phoneSuffix},phone3.ilike.%${phoneSuffix}`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!phoneSuffix && phoneSuffix.length >= 8,
  });

  // Fetch all records for this CPF
  const { data: clientRecords = [] } = useQuery({
    queryKey: ["telefonia-records", client?.cpf],
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

  // Fetch credor rules
  const { data: credorRules } = useQuery({
    queryKey: ["credor-rules", client?.credor, tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credores" as any)
        .select("desconto_maximo, parcelas_max, entrada_minima_valor, entrada_minima_tipo")
        .eq("tenant_id", tenant!.id)
        .eq("razao_social", client!.credor)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as { desconto_maximo: number; parcelas_max: number; entrada_minima_valor: number; entrada_minima_tipo: string } | null;
    },
    enabled: !!client?.credor && !!tenant?.id,
  });

  // Fetch dispositions
  const { data: dispositions = [] } = useQuery({
    queryKey: ["dispositions", client?.id],
    queryFn: () => fetchDispositions(client!.id),
    enabled: !!client?.id,
  });

  // Fetch agreements
  const { data: agreements = [] } = useQuery({
    queryKey: ["telefonia-agreements", client?.cpf],
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

  // Fetch message logs
  const { data: messageLogs = [] } = useQuery({
    queryKey: ["telefonia-messages", client?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_logs")
        .select("*")
        .eq("client_id", client!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!client?.id,
  });

  // Disposition mutation
  const dispositionMutation = useMutation({
    mutationFn: async ({ type, notes, scheduledCallback }: { type: DispositionType; notes?: string; scheduledCallback?: string }) => {
      if (!tenant?.id || !profile?.id) throw new Error("Dados do operador não encontrados");
      return createDisposition({
        client_id: client!.id,
        tenant_id: tenant.id,
        operator_id: profile.id,
        disposition_type: type,
        notes,
        scheduled_callback: scheduledCallback,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["dispositions", client?.id] });
      // Execute post-disposition automations
      if (tenant?.id && client?.id) {
        executeAutomations(tenant.id, variables.type, client.id, profile?.user_id || "").catch(console.error);
      }
      // Auto-qualify on 3CPlus
      qualifyOn3CPlus({
        dispositionType: variables.type,
        tenantSettings: settings,
        agentId,
        callId,
      });
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
      requiresApproval?: boolean;
      approvalReason?: string;
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
        tenant.id,
        { requiresApproval: data.requiresApproval, approvalReason: data.approvalReason }
      );
    },
    onSuccess: () => {
      toast.success("Acordo criado com sucesso!");
      setShowNegotiation(false);
      queryClient.invalidateQueries({ queryKey: ["telefonia-agreements"] });
      // Register negotiation disposition
      if (tenant?.id && profile?.id && client?.id) {
        createDisposition({
          client_id: client.id,
          tenant_id: tenant.id,
          operator_id: profile.id,
          disposition_type: "negotiated",
          notes: "Acordo gerado via telefonia",
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["dispositions", client?.id] });
          // Also qualify on 3CPlus
          qualifyOn3CPlus({
            dispositionType: "negotiated",
            tenantSettings: settings,
            agentId,
            callId,
          });
        });
      }
    },
    onError: () => {
      toast.error("Erro ao criar acordo");
    },
  });

  if (clientLoading) {
    return <div className="p-4 text-center text-muted-foreground text-sm">Buscando cliente pelo telefone...</div>;
  }

  if (!client) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 py-6">
          <UserX className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Cliente não encontrado no CRM</p>
            <p className="text-xs text-muted-foreground">Telefone: {clientPhone}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalAberto = clientRecords
    .filter((c) => c.status === "pendente")
    .reduce((sum, c) => sum + Number(c.valor_parcela), 0);
  const totalPago = clientRecords.reduce((sum, c) => sum + Number(c.valor_pago), 0);

  const handleDisposition = async (type: DispositionType, notes?: string, scheduledCallback?: string) => {
    await dispositionMutation.mutateAsync({ type, notes, scheduledCallback });
  };

  return (
    <div className="space-y-3">
      <ClientHeader
        client={client as any}
        totalAberto={totalAberto}
        totalPago={totalPago}
        totalParcelas={clientRecords.length}
        parcelasPagas={clientRecords.filter((c) => c.status === "pago").length}
        onCall={() => {}}
        callingPhone={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-1 space-y-3">
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
              credorRules={credorRules}
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

export default TelefoniaAtendimento;
