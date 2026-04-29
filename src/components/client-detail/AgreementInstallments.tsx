import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, formatCPF } from "@/lib/formatters";
import { addMonths, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { negociarieService } from "@/services/negociarieService";
import { updateInstallmentDate, updateInstallmentValue, cancelInstallment, reactivateInstallment } from "@/services/agreementService";
import { manualPaymentService } from "@/services/manualPaymentService";
import { getClientProfile, upsertClientProfile } from "@/services/clientProfileService";
import { logAction } from "@/services/auditService";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ManualPaymentDialog from "@/components/acordos/ManualPaymentDialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ExternalLink, FileText, ClipboardCopy,
  CheckCircle2, Clock, AlertTriangle, Loader2, FileBarChart, DollarSign, Pencil, FileCheck, ChevronDown,
  Trash2, RotateCcw, XCircle,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";

interface AgreementInstallmentsProps {
  agreementId: string;
  agreement: any;
  cpf: string;
  tenantId?: string;
  onRefresh?: () => void;
}

const AgreementInstallments = ({ agreementId, agreement, cpf, tenantId, onRefresh }: AgreementInstallmentsProps) => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [generatingIdx, setGeneratingIdx] = useState<number | null>(null);
  const [editingValueIdx, setEditingValueIdx] = useState<number | null>(null);
  const [editValueInput, setEditValueInput] = useState("");
  const [manualPaymentInst, setManualPaymentInst] = useState<{ number: number; value: number; key: string; label: string } | null>(null);
  const [unconfirmingIdx, setUnconfirmingIdx] = useState<number | null>(null);
  const [cancellingIdx, setCancellingIdx] = useState<number | null>(null);
  const [cancelInstallmentDialog, setCancelInstallmentDialog] = useState<{ inst: any; idx: number } | null>(null);
  const [cancellingInstallmentIdx, setCancellingInstallmentIdx] = useState<number | null>(null);

  // Boleto pendente states
  const [generatingAllBoletos, setGeneratingAllBoletos] = useState(false);
  const [boletoPendenteMissingOpen, setBoletoPendenteMissingOpen] = useState(false);
  const [boletoPendenteMissing, setBoletoPendenteMissing] = useState<Record<string, string>>({});
  const [boletoPendenteFound, setBoletoPendenteFound] = useState<Record<string, string>>({});
  const [savingBoletoPendente, setSavingBoletoPendente] = useState(false);

  // Date edit dialog state
  const [dateEditDialogOpen, setDateEditDialogOpen] = useState(false);
  const [selectedInstallmentForDateEdit, setSelectedInstallmentForDateEdit] = useState<any>(null);
  const [selectedDateForEdit, setSelectedDateForEdit] = useState<Date | undefined>(undefined);
  const [savingDate, setSavingDate] = useState(false);

  const { data: cobrancas = [], refetch: refetchCobrancas } = useQuery({
    queryKey: ["agreement-cobrancas", cpf, agreementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("negociarie_cobrancas" as any)
        .select("*")
        .eq("agreement_id", agreementId)
        .neq("status", "substituido")
        .order("data_vencimento", { ascending: true });
      if (error) return [];
      return (data as any[]) || [];
    },
    enabled: !!agreementId,
  });

  // Realtime: refetch quando boletos forem inseridos/atualizados em background
  useEffect(() => {
    if (!agreementId) return;
    const channel = supabase
      .channel(`negociarie_cobrancas_${agreementId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "negociarie_cobrancas", filter: `agreement_id=eq.${agreementId}` },
        () => {
          refetchCobrancas();
          queryClient.invalidateQueries({ queryKey: ["agreement-real-payments", agreementId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [agreementId, refetchCobrancas, queryClient]);

  const { data: manualPayments = [] } = useQuery({
    queryKey: ["manual-payments", agreementId],
    queryFn: () => manualPaymentService.fetchByAgreement(agreementId),
    enabled: !!agreementId,
  });

  // Fetch real payments linked to THIS agreement via client_events + manual_payments
  const { data: agreementPaymentsTotal = 0 } = useQuery({
    queryKey: ["agreement-real-payments", agreementId],
    queryFn: async () => {
      let total = 0;

      // 1. Payment events from client_events
      const { data: paymentEvents } = await supabase
        .from("client_events")
        .select("metadata")
        .eq("event_type", "payment_confirmed")
        .filter("metadata->>agreement_id", "eq", agreementId);

      if (paymentEvents) {
        total += paymentEvents.reduce((sum: number, ev: any) => {
          const val = Number(ev.metadata?.valor_pago || 0);
          return sum + val;
        }, 0);
      }

      // 2. Confirmed manual payments
      const confirmedManual = manualPayments.filter((mp: any) => mp.status === "confirmed");
      total += confirmedManual.reduce((sum: number, mp: any) => sum + Number(mp.amount_paid || 0), 0);

      // 3. Paid cobrancas from negociarie
      const paidCobrancas = cobrancas.filter((c: any) => c.status === "pago");
      total += paidCobrancas.reduce((sum: number, c: any) => sum + Number(c.valor || 0), 0);

      return total;
    },
    enabled: !!agreementId,
  });

  const totalPaidFromClients = agreementPaymentsTotal;

  const customDates: Record<string, string> = agreement.custom_installment_dates || {};
  const customValues: Record<string, number> = agreement.custom_installment_values || {};
  const cancelledMap: Record<string, any> = (agreement as any).cancelled_installments || {};

  const hasEntrada = agreement.entrada_value > 0;
  const installments: any[] = [];

  // Collect all entrada* keys (entrada, entrada_2, entrada_3, ...) — excluding *_method
  const entradaKeysFromCustom = Object.keys(customValues)
    .filter(k => k.startsWith("entrada") && !k.endsWith("_method"))
    .sort((a, b) => {
      const numA = a === "entrada" ? 1 : parseInt(a.replace("entrada_", "")) || 1;
      const numB = b === "entrada" ? 1 : parseInt(b.replace("entrada_", "")) || 1;
      return numA - numB;
    });
  const entradaKeys: string[] = hasEntrada
    ? (entradaKeysFromCustom.length > 0 ? entradaKeysFromCustom : ["entrada"])
    : [];

  entradaKeys.forEach((customKey, idx) => {
    const defaultDate = agreement.entrada_date
      ? new Date(agreement.entrada_date + "T00:00:00")
      : new Date(agreement.first_due_date + "T00:00:00");
    const dueDate = customDates[customKey] ? new Date(customDates[customKey] + "T00:00:00") : defaultDate;
    // Fallback: if only one entrada and no custom value, use entrada_value column
    const value = customValues[customKey] ?? (entradaKeys.length === 1 ? agreement.entrada_value : 0);
    // Cobranca lookup: first entrada uses :0 (legacy), additional use :entrada_N
    const expectedKey = idx === 0 ? `${agreementId}:0` : `${agreementId}:${customKey}`;
    const cobranca = cobrancas.find((c: any) => c.installment_key === expectedKey);
    installments.push({
      number: 0,
      displayNumber: idx + 1,
      dueDate,
      value,
      cobranca,
      isEntrada: true,
      entradaIndex: idx,
      entradaCount: entradaKeys.length,
      customKey,
    });
  });

  for (let i = 0; i < agreement.new_installments; i++) {
    const defaultDate = addMonths(new Date(agreement.first_due_date + "T00:00:00"), i);
    // Canonical key matches what the boleto generator persists in negociarie_cobrancas:
    // first non-entrada parcela = ":1", second = ":2", etc. (independent of entrada count).
    const canonicalNum = i + 1;
    const customKey = String(canonicalNum);
    // Display label keeps the visual offset when there is an entrada: "2/12, 3/12...".
    const displayNumber = (hasEntrada ? 1 : 0) + i + 1;
    const dueDate = customDates[customKey] ? new Date(customDates[customKey] + "T00:00:00") : defaultDate;
    const value = customValues[customKey] ?? agreement.new_installment_value;
    // Lookup by canonical key first; fall back to legacy display-based key for old data.
    const expectedKey = `${agreementId}:${canonicalNum}`;
    const legacyKey = `${agreementId}:${displayNumber}`;
    const cobranca =
      cobrancas.find((c: any) => c.installment_key === expectedKey) ||
      (canonicalNum !== displayNumber
        ? cobrancas.find((c: any) => c.installment_key === legacyKey)
        : undefined);
    installments.push({
      number: canonicalNum,
      displayNumber,
      dueDate,
      value,
      cobranca,
      isEntrada: false,
      customKey,
    });
  }

  const totalInstallments = installments.length;
  const activeInstallmentsCount = installments.filter((i) => !cancelledMap[i.customKey]).length;

  let remainingPaid = totalPaidFromClients;
  const installmentsWithStatus = installments.map((inst) => {
    const isCancelled = !!cancelledMap[inst.customKey];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDay = new Date(inst.dueDate); dueDay.setHours(0, 0, 0, 0);
    const isOverdue = dueDay < today;
    const instValue = Number(inst.value);

    if (isCancelled) {
      return { ...inst, status: "cancelled", isOverdue: false, pendingManual: undefined, isCancelled: true };
    }

    let isPaidManually = false;
    if (remainingPaid >= instValue) {
      isPaidManually = true;
      remainingPaid -= instValue;
    } else {
      remainingPaid = 0;
    }
    const matchesInst = (mp: any) =>
      (mp.installment_key && mp.installment_key === inst.customKey) ||
      (!mp.installment_key && mp.installment_number === inst.number);

    const pendingManual = manualPayments.find(
      (mp: any) => matchesInst(mp) && mp.status === "pending_confirmation"
    );

    const confirmedManualForThis = manualPayments
      .filter((mp: any) => matchesInst(mp) && mp.status === "confirmed")
      .reduce((s: number, mp: any) => s + Number(mp.amount_paid || 0), 0);
    const isPaidByManual = confirmedManualForThis >= instValue - 0.01;

    const status = pendingManual
      ? "pending_confirmation"
      : inst.cobranca?.status === "pago"
      ? "pago"
      : isPaidByManual
      ? "pago"
      : inst.cobranca?.status || (isPaidManually ? "pago" : (isOverdue ? "vencido" : "pendente"));
    return { ...inst, status, isOverdue, pendingManual, isCancelled: false };
  });

  const paidCount = installmentsWithStatus.filter(i => i.status === "pago").length;
  const progressPercent = activeInstallmentsCount > 0 ? Math.round((paidCount / activeInstallmentsCount) * 100) : 0;

  const handleGenerateBoleto = async (inst: any, idx: number) => {
    if (!tenantId) {
      toast({ title: "Erro", description: "Tenant não identificado.", variant: "destructive" });
      return;
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(inst.dueDate); due.setHours(0, 0, 0, 0);
    if (due < today) {
      toast({
        title: "Data de vencimento inválida",
        description: "Edite o vencimento para uma data futura antes de reemitir o boleto.",
        variant: "destructive",
      });
      return;
    }
    setGeneratingIdx(idx);
    try {
      const hasPreviousBoleto = inst.cobranca?.link_boleto;
      await negociarieService.generateSingleBoleto(
        { id: agreementId, client_cpf: cpf, credor: agreement.credor, tenant_id: tenantId, client_name: agreement.client_name },
        { number: inst.number, value: inst.value, dueDate: inst.dueDate.toISOString().split("T")[0] }
      );
      if (hasPreviousBoleto) {
        toast({ title: "Novo boleto gerado com sucesso!", description: "O boleto anterior foi substituído no sistema." });
      } else {
        toast({ title: "Boleto gerado com sucesso!" });
      }
      refetchCobrancas();
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Erro ao gerar boleto", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingIdx(null);
    }
  };

  const handleOpenDateEdit = (inst: any) => {
    setSelectedInstallmentForDateEdit(inst);
    setSelectedDateForEdit(inst.dueDate);
    setDateEditDialogOpen(true);
  };

  const handleSaveDateEdit = async () => {
    if (!selectedDateForEdit || !selectedInstallmentForDateEdit) return;
    setSavingDate(true);
    const inst = selectedInstallmentForDateEdit;
    const dateStr = format(selectedDateForEdit, "yyyy-MM-dd");
    try {
      const updated = await updateInstallmentDate(agreementId, inst.customKey, dateStr);
      // Atualização local imediata para que a próxima ação (ex: Reemitir Boleto) já use a data nova
      if (agreement) {
        (agreement as any).custom_installment_dates = updated || {
          ...((agreement as any).custom_installment_dates || {}),
          [inst.customKey]: dateStr,
        };
      }
      toast({ title: "Data atualizada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["agreement-cobrancas", cpf, agreementId] });
      queryClient.invalidateQueries({ queryKey: ["client-agreements", cpf] });
      queryClient.invalidateQueries({ queryKey: ["client-detail", cpf] });
      await Promise.resolve(onRefresh?.());
      setDateEditDialogOpen(false);
      setSelectedInstallmentForDateEdit(null);
      setSelectedDateForEdit(undefined);
    } catch (err: any) {
      toast({ title: "Erro ao atualizar data", description: err.message, variant: "destructive" });
    } finally {
      setSavingDate(false);
    }
  };

  const handleEditValue = async (inst: any) => {
    const newValue = parseFloat(editValueInput.replace(",", "."));
    if (isNaN(newValue) || newValue <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    try {
      await updateInstallmentValue(agreementId, inst.customKey, newValue);
      toast({ title: "Valor atualizado!" });
      setEditingValueIdx(null);
      setEditValueInput("");
      onRefresh?.();
      queryClient.invalidateQueries({ queryKey: ["client-agreements", cpf] });
    } catch (err: any) {
      toast({ title: "Erro ao atualizar valor", description: err.message, variant: "destructive" });
    }
  };

  const handleDownloadReceipt = (inst: any) => {
    const receiptContent = `
RECIBO DE PAGAMENTO
====================
Cliente: ${agreement.client_name}
CPF: ${cpf}
Credor: ${agreement.credor}
Parcela: ${inst.isEntrada ? "Entrada" : `${inst.displayNumber}/${totalInstallments}`}
Valor: ${formatCurrency(Number(inst.value))}
Vencimento: ${formatDate(inst.dueDate.toISOString().split("T")[0])}
Status: Pago
Data: ${new Date().toLocaleDateString("pt-BR")}
====================
    `.trim();

    const blob = new Blob([receiptContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recibo_parcela_${inst.displayNumber}_${cpf}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const handleUnconfirmPayment = async (inst: any, idx: number) => {
    const confirmedPayment = manualPayments.find(
      (mp: any) => (
        (mp.installment_key && mp.installment_key === inst.customKey) ||
        (!mp.installment_key && mp.installment_number === inst.number)
      ) && mp.status === "confirmed"
    );
    if (!confirmedPayment) {
      toast({ title: "Nenhuma baixa manual confirmada encontrada para esta parcela.", variant: "destructive" });
      return;
    }
    setUnconfirmingIdx(idx);
    try {
      const { error } = await supabase
        .from("manual_payments" as any)
        .update({
          status: "pending_confirmation",
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null,
        })
        .eq("id", confirmedPayment.id);
      if (error) throw error;
      toast({ title: "Baixa revertida para pendente de confirmação." });
      queryClient.invalidateQueries({ queryKey: ["manual-payments", agreementId] });
      queryClient.invalidateQueries({ queryKey: ["agreement-real-payments", agreementId] });
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Erro ao desconfirmar", description: err.message, variant: "destructive" });
    } finally {
      setUnconfirmingIdx(null);
    }
  };

  const handleCancelPendingPayment = async (inst: any, idx: number) => {
    if (!inst.pendingManual) return;
    setCancellingIdx(idx);
    try {
      const { error } = await supabase
        .from("manual_payments" as any)
        .delete()
        .eq("id", inst.pendingManual.id);
      if (error) throw error;
      toast({ title: "Solicitação de baixa cancelada." });
      queryClient.invalidateQueries({ queryKey: ["manual-payments", agreementId] });
      queryClient.invalidateQueries({ queryKey: ["agreement-real-payments", agreementId] });
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Erro ao cancelar", description: err.message, variant: "destructive" });
    } finally {
      setCancellingIdx(null);
    }
  };

  const handleRefundCobranca = async (inst: any, idx: number) => {
    if (!inst.cobranca?.id) return;
    const ok = window.confirm(
      "Tem certeza que deseja estornar este pagamento?\n\nO valor sairá das métricas do operador e do dashboard. Esta ação ficará registrada na timeline do cliente."
    );
    if (!ok) return;
    setUnconfirmingIdx(idx);
    try {
      const { error } = await supabase
        .from("negociarie_cobrancas" as any)
        .update({
          status: "estornado",
          valor_pago: 0,
          data_pagamento: null,
        })
        .eq("id", inst.cobranca.id);
      if (error) throw error;

      // Audit event in client timeline
      try {
        await supabase.from("client_events").insert({
          tenant_id: tenantId,
          client_cpf: cpf,
          event_source: "operator",
          event_type: "payment_refunded",
          metadata: {
            agreement_id: agreementId,
            cobranca_id: inst.cobranca.id,
            installment_key: inst.customKey,
            valor_estornado: Number(inst.cobranca.valor_pago || inst.cobranca.valor || 0),
            refunded_by: profile?.id,
          },
        } as any);
      } catch (e) {
        // non-blocking
      }

      try {
        await logAction({
          action: "refund_payment",
          entity_type: "agreement",
          entity_id: agreementId,
          details: { cobranca_id: inst.cobranca.id, installment_key: inst.customKey },
        });
      } catch {}

      toast({ title: "Pagamento estornado com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["agreement-cobrancas", cpf, agreementId] });
      queryClient.invalidateQueries({ queryKey: ["agreement-real-payments", agreementId] });
      queryClient.invalidateQueries({ queryKey: ["client-agreements", cpf] });
      refetchCobrancas();
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Erro ao estornar pagamento", description: err.message, variant: "destructive" });
    } finally {
      setUnconfirmingIdx(null);
    }
  };

  const statusIcon = (status: string) => {
    if (status === "pago") return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
    if (status === "vencido") return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
    if (status === "pending_confirmation") return <Clock className="w-3.5 h-3.5 text-blue-600" />;
    return <Clock className="w-3.5 h-3.5 text-warning" />;
  };

  const REQUIRED_FIELDS = ["email", "phone", "cep", "endereco", "bairro", "cidade", "uf"] as const;
  const FIELD_LABELS: Record<string, string> = {
    email: "E-mail", phone: "Telefone", cep: "CEP",
    endereco: "Endereço", bairro: "Bairro", cidade: "Cidade", uf: "UF",
  };

  const handleGenerateAllBoletos = async () => {
    if (!tenantId) return;
    setGeneratingAllBoletos(true);
    try {
      const profileData = await getClientProfile(tenantId, cpf);
      const missing: Record<string, string> = {};
      const found: Record<string, string> = {};
      for (const f of REQUIRED_FIELDS) {
        const val = (profileData as any)[f] || "";
        if (val) found[f] = val;
        else missing[f] = "";
      }
      if (Object.keys(missing).length > 0) {
        setBoletoPendenteMissing(missing);
        setBoletoPendenteFound(found);
        setBoletoPendenteMissingOpen(true);
        setGeneratingAllBoletos(false);
        return;
      }
      await executeBoletosGeneration();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      setGeneratingAllBoletos(false);
    }
  };

  const executeBoletosGeneration = async () => {
    if (!tenantId) return;
    setGeneratingAllBoletos(true);
    try {
      const boletoInstallments = installments.map((inst: any) => ({
        number: inst.number,
        value: inst.value,
        dueDate: inst.dueDate.toISOString().split("T")[0],
      }));
      const result = await negociarieService.generateAgreementBoletos(
        { id: agreementId, client_cpf: cpf, credor: agreement.credor, tenant_id: tenantId, client_name: agreement.client_name },
        boletoInstallments
      );
      // Clear boleto_pendente flag only if at least one boleto was generated
      if (result.success > 0) {
        await supabase.from("agreements").update({ boleto_pendente: false } as any).eq("id", agreementId);
      }
      logAction({
        action: "boleto_gerado_posteriormente",
        entity_type: "agreement",
        entity_id: agreementId,
        details: { cpf, credor: agreement.credor, success: result.success, failed: result.failed },
      });
      if (result.success > 0) {
        toast({ title: `${result.success} boleto(s) gerado(s) com sucesso!` });
      }
      if (result.failed > 0) {
        toast({ title: "Falha parcial", description: result.errors[0], variant: "destructive" });
      }
      refetchCobrancas();
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Erro ao gerar boletos", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingAllBoletos(false);
    }
  };

  const handleSaveBoletoPendenteMissing = async () => {
    if (!tenantId) return;
    setSavingBoletoPendente(true);
    try {
      const rawCpf = cpf.replace(/\D/g, "");
      const updatePayload: Record<string, string> = {};
      for (const [key, val] of Object.entries(boletoPendenteMissing)) {
        if (val.trim()) updatePayload[key] = val.trim();
      }
      if (Object.keys(updatePayload).length > 0) {
        await supabase
          .from("clients")
          .update(updatePayload)
          .or(`cpf.eq.${rawCpf},cpf.eq.${formatCPF(rawCpf)}`)
          .eq("tenant_id", tenantId);
        await upsertClientProfile(tenantId, rawCpf, updatePayload, "manual");
        logAction({
          action: "dados_cliente_atualizados",
          entity_type: "agreement",
          entity_id: agreementId,
          details: { cpf, campos_atualizados: Object.keys(updatePayload) },
        });
      }
      setBoletoPendenteMissingOpen(false);
      await executeBoletosGeneration();
    } catch (err: any) {
      toast({ title: "Erro ao salvar dados", description: err.message, variant: "destructive" });
    } finally {
      setSavingBoletoPendente(false);
    }
  };

  const [open, setOpen] = useState(false);

  return (
    <>
    <Collapsible open={open} onOpenChange={setOpen} className="pt-3 border-t border-border space-y-3">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between hover:bg-muted/30 rounded-md px-1 py-1 transition-colors cursor-pointer">
          <p className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1">
            <FileText className="w-3 h-3" /> Parcelas do Acordo
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{paidCount}/{activeInstallmentsCount} pagas</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </button>
      </CollapsibleTrigger>

      <div className="relative w-full bg-muted rounded-full h-5 overflow-hidden">
        <div
          className="bg-green-500 h-full rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground mix-blend-difference">
          {paidCount}/{activeInstallmentsCount} pagas
        </span>
      </div>

      {/* Boleto Pendente Banner */}
      {(agreement as any).boleto_pendente && cobrancas.length === 0 && (
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="flex items-center justify-between w-full">
            <span className="text-xs">Boletos pendentes — dados incompletos na criação do acordo.</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-3 gap-1.5 text-xs h-7"
              disabled={generatingAllBoletos}
              onClick={handleGenerateAllBoletos}
            >
              {generatingAllBoletos ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileBarChart className="w-3 h-3" />}
              Gerar Boletos
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <CollapsibleContent>

      <div className="max-h-[400px] overflow-y-auto border border-border rounded-md">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[80px]">Parcela</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-center w-[140px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installmentsWithStatus.map((inst, idx) => {
            const hasBoleto = inst.cobranca?.link_boleto;
            const hasLinhaDigitavel = inst.cobranca?.linha_digitavel;
            const hasPix = inst.cobranca?.pix_copia_cola;
            const isPaid = inst.status === "pago";
            const canEdit = !isPaid && inst.status !== "pending_confirmation";

            return (
              <TableRow key={idx}>
                <TableCell className="font-medium text-xs">
                  {inst.isEntrada
                    ? (inst.entradaCount > 1 ? `Entrada ${inst.displayNumber}` : "Entrada")
                    : `${inst.displayNumber}/${totalInstallments}`}
                </TableCell>

                {/* Vencimento + pencil */}
                <TableCell className="text-xs">
                  <span className="inline-flex items-center gap-1">
                    {formatDate(inst.dueDate.toISOString().split("T")[0])}
                    {canEdit && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleOpenDateEdit(inst)}
                              className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted transition-colors"
                            >
                              <Pencil className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>Editar Data</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                </TableCell>

                {/* Valor + pencil */}
                <TableCell className="text-right text-xs">
                  {editingValueIdx === idx ? (
                    <div className="flex items-center gap-1 justify-end">
                      <Input
                        className="h-7 w-24 text-xs"
                        value={editValueInput}
                        onChange={e => setEditValueInput(e.target.value)}
                        placeholder="0,00"
                        onKeyDown={e => { if (e.key === "Enter") handleEditValue(inst); if (e.key === "Escape") { setEditingValueIdx(null); setEditValueInput(""); } }}
                        autoFocus
                      />
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleEditValue(inst)}>
                        <CheckCircle2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      {formatCurrency(Number(inst.value))}
                      {canEdit && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => {
                                  setEditingValueIdx(idx);
                                  setEditValueInput(String(Number(inst.value).toFixed(2)).replace(".", ","));
                                }}
                                className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted transition-colors"
                              >
                                <Pencil className="w-3 h-3 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>Editar Valor</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </span>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell className="text-center">
                  <Badge variant="outline" className={cn(
                    "gap-1 text-[10px]",
                    inst.status === "pago" ? "bg-green-500/10 text-green-600 border-green-500/30" :
                    inst.status === "vencido" ? "bg-destructive/10 text-destructive border-destructive/30" :
                    inst.status === "pending_confirmation" ? "bg-blue-500/10 text-blue-600 border-blue-500/30" :
                    "bg-warning/10 text-warning border-warning/30"
                  )}>
                    {statusIcon(inst.status)}
                    {inst.status === "pago" ? "Pago" : inst.status === "vencido" ? "Vencido" : inst.status === "pending_confirmation" ? "Aguardando" : "Em Aberto"}
                  </Badge>
                </TableCell>

                {/* Inline action icons */}
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TooltipProvider delayDuration={200}>
                      {/* Gerar/Reemitir Boleto */}
                      {!isPaid && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/10"
                              disabled={generatingIdx === idx}
                              onClick={() => handleGenerateBoleto(inst, idx)}
                            >
                              {generatingIdx === idx ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <FileBarChart className="w-4 h-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>{hasBoleto ? "Reemitir Boleto" : "Gerar Boleto"}</p></TooltipContent>
                        </Tooltip>
                      )}

                      {/* Abrir boleto */}
                      {hasBoleto && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                              asChild
                            >
                              <a href={inst.cobranca.link_boleto} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>{isPaid ? "2ª Via Boleto" : "Abrir Boleto"}</p></TooltipContent>
                        </Tooltip>
                      )}

                      {/* Copiar linha digitável */}
                      {hasLinhaDigitavel && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                              onClick={() => handleCopy(inst.cobranca.linha_digitavel, "Linha digitável")}
                            >
                              <ClipboardCopy className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>Copiar Linha Digitável</p></TooltipContent>
                        </Tooltip>
                      )}

                      {/* Copiar PIX */}
                      {hasPix && !hasLinhaDigitavel && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                              onClick={() => handleCopy(inst.cobranca.pix_copia_cola, "PIX")}
                            >
                              <ClipboardCopy className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>Copiar PIX</p></TooltipContent>
                        </Tooltip>
                      )}

                      {/* Baixar manualmente (pendente) ou Desconfirmar (pago) */}
                      {canEdit && tenantId && profile && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                              onClick={() => setManualPaymentInst({
                                number: inst.number,
                                value: Number(inst.value),
                                key: inst.customKey,
                                label: inst.isEntrada
                                  ? (inst.entradaCount > 1 ? `Entrada ${inst.entradaIndex + 1}` : "Entrada")
                                  : `Parcela ${inst.displayNumber}/${totalInstallments}`,
                              })}
                            >
                              <DollarSign className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>Baixar Manualmente</p></TooltipContent>
                        </Tooltip>
                      )}

                      {/* Cancelar baixa pendente */}
                      {inst.status === "pending_confirmation" && inst.pendingManual && tenantId && profile && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-500/10"
                              disabled={cancellingIdx === idx}
                              onClick={() => handleCancelPendingPayment(inst, idx)}
                            >
                              {cancellingIdx === idx ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <DollarSign className="w-4 h-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>Cancelar Solicitação de Baixa</p></TooltipContent>
                        </Tooltip>
                      )}

                      {isPaid && tenantId && profile && (() => {
                        const hasConfirmedManual = manualPayments.some(
                          (mp: any) => (
                            (mp.installment_key && mp.installment_key === inst.customKey) ||
                            (!mp.installment_key && mp.installment_number === inst.number)
                          ) && mp.status === "confirmed"
                        );
                        const isCobrancaPaga = inst.cobranca?.status === "pago";
                        const showButton = hasConfirmedManual || isCobrancaPaga;
                        if (!showButton) return null;
                        const tooltipLabel = hasConfirmedManual
                          ? "Desconfirmar Pagamento"
                          : "Estornar Pagamento";
                        const handler = hasConfirmedManual
                          ? () => handleUnconfirmPayment(inst, idx)
                          : () => handleRefundCobranca(inst, idx);
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                                disabled={unconfirmingIdx === idx}
                                onClick={handler}
                              >
                                {unconfirmingIdx === idx ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <DollarSign className="w-4 h-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>{tooltipLabel}</p></TooltipContent>
                          </Tooltip>
                        );
                      })()}

                      {/* Baixar recibo */}
                      {isPaid && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                              onClick={() => handleDownloadReceipt(inst)}
                            >
                              <FileCheck className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>Baixar Recibo</p></TooltipContent>
                        </Tooltip>
                      )}
                    </TooltipProvider>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>

      {manualPaymentInst && tenantId && profile && (
        <ManualPaymentDialog
          open={!!manualPaymentInst}
          onOpenChange={(open) => !open && setManualPaymentInst(null)}
          agreementId={agreementId}
          installmentNumber={manualPaymentInst.number}
          installmentKey={manualPaymentInst.key}
          installmentLabel={manualPaymentInst.label}
          installmentValue={manualPaymentInst.value}
          tenantId={tenantId}
          profileId={profile.id}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["manual-payments", agreementId] });
            onRefresh?.();
          }}
        />
      )}
      </CollapsibleContent>
    </Collapsible>

    {/* Date Edit Dialog */}
    <Dialog open={dateEditDialogOpen} onOpenChange={(o) => {
      if (!o) {
        setDateEditDialogOpen(false);
        setSelectedInstallmentForDateEdit(null);
        setSelectedDateForEdit(undefined);
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar vencimento da parcela</DialogTitle>
          <DialogDescription>
            {selectedInstallmentForDateEdit?.isEntrada
              ? "Entrada"
              : selectedInstallmentForDateEdit
                ? `Parcela ${selectedInstallmentForDateEdit.displayNumber}/${totalInstallments}`
                : ""}
            {selectedInstallmentForDateEdit && (
              <> — Data atual: {formatDate(selectedInstallmentForDateEdit.dueDate.toISOString().split("T")[0])}</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
          <Calendar
            mode="single"
            selected={selectedDateForEdit}
            onSelect={setSelectedDateForEdit}
            className={cn("p-3 pointer-events-auto")}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setDateEditDialogOpen(false);
            setSelectedInstallmentForDateEdit(null);
            setSelectedDateForEdit(undefined);
          }}>
            Cancelar
          </Button>
          <Button onClick={handleSaveDateEdit} disabled={savingDate || !selectedDateForEdit}>
            {savingDate && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Boleto Pendente Missing Fields Dialog */}
    <Dialog open={boletoPendenteMissingOpen} onOpenChange={(o) => !o && setBoletoPendenteMissingOpen(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            Complete os dados para gerar os boletos
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Preencha os campos faltantes para gerar os boletos deste acordo:
        </p>

        {(() => {
          const found = Object.entries(boletoPendenteFound).filter(([key]) => !boletoPendenteMissing.hasOwnProperty(key));
          return found.length > 0 ? (
            <div className="bg-muted/50 rounded-md p-3 space-y-1">
              <p className="text-[10px] uppercase font-medium text-muted-foreground mb-1">Dados encontrados</p>
              {found.map(([key, val]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                  <span className="text-muted-foreground">{FIELD_LABELS[key] || key}:</span>
                  <span className="font-medium truncate">{String(val)}</span>
                </div>
              ))}
            </div>
          ) : null;
        })()}

        <div className="space-y-3 py-2">
          <p className="text-[10px] uppercase font-medium text-muted-foreground">Campos faltantes</p>
          {Object.keys(boletoPendenteMissing).map((field) => (
            <div key={field} className="space-y-1">
              <Label className="text-xs font-medium">{FIELD_LABELS[field] || field}</Label>
              <Input
                value={boletoPendenteMissing[field]}
                onChange={(e) => setBoletoPendenteMissing((prev) => ({ ...prev, [field]: e.target.value }))}
                placeholder={`Informe o ${(FIELD_LABELS[field] || field).toLowerCase()}`}
                className="h-9"
              />
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setBoletoPendenteMissingOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSaveBoletoPendenteMissing} disabled={savingBoletoPendente}>
            {savingBoletoPendente ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar e Gerar Boletos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default AgreementInstallments;
