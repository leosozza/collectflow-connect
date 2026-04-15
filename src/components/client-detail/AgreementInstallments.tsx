import { useState } from "react";
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
import { updateInstallmentDate, updateInstallmentValue } from "@/services/agreementService";
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
} from "lucide-react";
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
  const [manualPaymentInst, setManualPaymentInst] = useState<{ number: number; value: number } | null>(null);
  const [unconfirmingIdx, setUnconfirmingIdx] = useState<number | null>(null);

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

  const hasEntrada = agreement.entrada_value > 0;
  const installments: any[] = [];

  if (hasEntrada) {
    const defaultDate = agreement.entrada_date
      ? new Date(agreement.entrada_date + "T00:00:00")
      : new Date(agreement.first_due_date + "T00:00:00");
    const customKey = "entrada";
    const dueDate = customDates[customKey] ? new Date(customDates[customKey] + "T00:00:00") : defaultDate;
    const value = customValues[customKey] ?? agreement.entrada_value;
    const expectedKey = `${agreementId}:0`;
    const cobranca = cobrancas.find((c: any) => c.installment_key === expectedKey);
    installments.push({ number: 0, displayNumber: 1, dueDate, value, cobranca, isEntrada: true, customKey });
  }

  for (let i = 0; i < agreement.new_installments; i++) {
    const defaultDate = addMonths(new Date(agreement.first_due_date + "T00:00:00"), i);
    const instNum = (hasEntrada ? 1 : 0) + i + 1;
    const customKey = String(instNum);
    const dueDate = customDates[customKey] ? new Date(customDates[customKey] + "T00:00:00") : defaultDate;
    const value = customValues[customKey] ?? agreement.new_installment_value;
    const expectedKey = `${agreementId}:${instNum}`;
    const cobranca = cobrancas.find((c: any) => c.installment_key === expectedKey);
    installments.push({ number: instNum, displayNumber: instNum, dueDate, value, cobranca, isEntrada: false, customKey });
  }

  const totalInstallments = installments.length;

  let remainingPaid = totalPaidFromClients;
  const installmentsWithStatus = installments.map((inst) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDay = new Date(inst.dueDate); dueDay.setHours(0, 0, 0, 0);
    const isOverdue = dueDay < today;
    const instValue = Number(inst.value);
    let isPaidManually = false;
    if (remainingPaid >= instValue) {
      isPaidManually = true;
      remainingPaid -= instValue;
    } else {
      remainingPaid = 0;
    }
    const pendingManual = manualPayments.find(
      (mp: any) => mp.installment_number === inst.number && mp.status === "pending_confirmation"
    );
    const status = pendingManual
      ? "pending_confirmation"
      : inst.cobranca?.status || (isPaidManually ? "pago" : (isOverdue ? "vencido" : "pendente"));
    return { ...inst, status, isOverdue, pendingManual };
  });

  const paidCount = installmentsWithStatus.filter(i => i.status === "pago").length;
  const progressPercent = totalInstallments > 0 ? Math.round((paidCount / totalInstallments) * 100) : 0;

  const handleGenerateBoleto = async (inst: any, idx: number) => {
    if (!tenantId) {
      toast({ title: "Erro", description: "Tenant não identificado.", variant: "destructive" });
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
      await updateInstallmentDate(agreementId, inst.customKey, dateStr);
      toast({ title: "Data atualizada com sucesso" });
      setDateEditDialogOpen(false);
      setSelectedInstallmentForDateEdit(null);
      setSelectedDateForEdit(undefined);
      onRefresh?.();
      queryClient.invalidateQueries({ queryKey: ["agreement-cobrancas", cpf, agreementId] });
      queryClient.invalidateQueries({ queryKey: ["client-agreements", cpf] });
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
      (mp: any) => mp.installment_number === inst.number && mp.status === "confirmed"
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
            <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
          </p>
          <span className="text-xs text-muted-foreground">{paidCount}/{totalInstallments} pagas</span>
        </button>
      </CollapsibleTrigger>

      <div className="relative w-full bg-muted rounded-full h-5 overflow-hidden">
        <div
          className="bg-green-500 h-full rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground mix-blend-difference">
          {paidCount}/{totalInstallments} pagas
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
                  {inst.isEntrada ? "Entrada" : `${inst.displayNumber}/${totalInstallments}`}
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
                              onClick={() => setManualPaymentInst({ number: inst.number, value: Number(inst.value) })}
                            >
                              <DollarSign className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top"><p>Baixar Manualmente</p></TooltipContent>
                        </Tooltip>
                      )}

                      {isPaid && tenantId && profile && (() => {
                        const hasConfirmedManual = manualPayments.some(
                          (mp: any) => mp.installment_number === inst.number && mp.status === "confirmed"
                        );
                        return hasConfirmedManual ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                                disabled={unconfirmingIdx === idx}
                                onClick={() => handleUnconfirmPayment(inst, idx)}
                              >
                                {unconfirmingIdx === idx ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <DollarSign className="w-4 h-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>Desconfirmar Pagamento</p></TooltipContent>
                          </Tooltip>
                        ) : null;
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

      {manualPaymentInst && tenantId && profile && (
        <ManualPaymentDialog
          open={!!manualPaymentInst}
          onOpenChange={(open) => !open && setManualPaymentInst(null)}
          agreementId={agreementId}
          installmentNumber={manualPaymentInst.number}
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
