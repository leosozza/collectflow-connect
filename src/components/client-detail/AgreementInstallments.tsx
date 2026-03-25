import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { addMonths, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { negociarieService } from "@/services/negociarieService";
import { updateInstallmentDate } from "@/services/agreementService";
import { manualPaymentService } from "@/services/manualPaymentService";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ManualPaymentDialog from "@/components/acordos/ManualPaymentDialog";
import {
  Download, FileText, Copy, CalendarIcon, MoreHorizontal,
  CheckCircle2, Clock, AlertTriangle, Loader2, Receipt, HandCoins,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [editingDateIdx, setEditingDateIdx] = useState<number | null>(null);
  const [manualPaymentInst, setManualPaymentInst] = useState<{ number: number; value: number } | null>(null);

  const { data: cobrancas = [], refetch: refetchCobrancas } = useQuery({
    queryKey: ["agreement-cobrancas", cpf, agreementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("negociarie_cobrancas" as any)
        .select("*")
        .eq("agreement_id", agreementId)
        .order("data_vencimento", { ascending: true });
      if (error) return [];
      return (data as any[]) || [];
    },
    enabled: !!agreementId,
  });

  // Fetch manual payments for this agreement
  const { data: manualPayments = [] } = useQuery({
    queryKey: ["manual-payments", agreementId],
    queryFn: () => manualPaymentService.fetchByAgreement(agreementId),
    enabled: !!agreementId,
  });

  const { data: clientRecords = [] } = useQuery({
    queryKey: ["agreement-client-payments", cpf, agreementId],
    queryFn: async () => {
      const rawCpf = cpf.replace(/\D/g, "");
      const { data, error } = await supabase
        .from("clients")
        .select("valor_pago, valor_parcela, status")
        .or(`cpf.eq.${rawCpf},cpf.eq.${cpf}`)
        .in("status", ["em_acordo", "pago"]);
      if (error) return [];
      return (data as any[]) || [];
    },
    enabled: !!cpf,
  });

  const totalPaidFromClients = clientRecords.reduce((sum: number, c: any) => sum + Number(c.valor_pago || 0), 0);

  // Custom dates from agreement
  const customDates: Record<string, string> = agreement.custom_installment_dates || {};

  // Generate installments
  const hasEntrada = agreement.entrada_value > 0;
  const installments: any[] = [];

  if (hasEntrada) {
    const defaultDate = agreement.entrada_date
      ? new Date(agreement.entrada_date + "T00:00:00")
      : new Date(agreement.first_due_date + "T00:00:00");
    const customKey = "entrada";
    const dueDate = customDates[customKey] ? new Date(customDates[customKey] + "T00:00:00") : defaultDate;
    const cobranca = cobrancas.find((c: any) => {
      const cDate = new Date(c.data_vencimento);
      return cDate.getMonth() === dueDate.getMonth() && cDate.getFullYear() === dueDate.getFullYear();
    });
    installments.push({
      number: 0,
      displayNumber: 1,
      dueDate,
      value: agreement.entrada_value,
      cobranca,
      isEntrada: true,
      customKey,
    });
  }

  for (let i = 0; i < agreement.new_installments; i++) {
    const defaultDate = addMonths(new Date(agreement.first_due_date + "T00:00:00"), i);
    const instNum = (hasEntrada ? 1 : 0) + i + 1;
    const customKey = String(instNum);
    const dueDate = customDates[customKey] ? new Date(customDates[customKey] + "T00:00:00") : defaultDate;
    const cobranca = cobrancas.find((c: any) => {
      const cDate = new Date(c.data_vencimento);
      return cDate.getMonth() === dueDate.getMonth() && cDate.getFullYear() === dueDate.getFullYear();
    });
    installments.push({
      number: instNum,
      displayNumber: instNum,
      dueDate,
      value: agreement.new_installment_value,
      cobranca,
      isEntrada: false,
      customKey,
    });
  }

  const totalInstallments = installments.length;

  // Calculate paid count
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
    // Check for pending manual payment
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
      await negociarieService.generateSingleBoleto(
        { id: agreementId, client_cpf: cpf, credor: agreement.credor, tenant_id: tenantId, client_name: agreement.client_name },
        { number: inst.number, value: inst.value, dueDate: inst.dueDate.toISOString().split("T")[0] }
      );
      toast({ title: "Boleto gerado com sucesso!" });
      refetchCobrancas();
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Erro ao gerar boleto", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingIdx(null);
    }
  };

  const handleEditDate = async (inst: any, newDate: Date | undefined) => {
    if (!newDate) return;
    const dateStr = format(newDate, "yyyy-MM-dd");
    try {
      await updateInstallmentDate(agreementId, inst.isEntrada ? 0 : inst.number, dateStr);
      toast({ title: "Data atualizada!" });
      setEditingDateIdx(null);
      onRefresh?.();
      queryClient.invalidateQueries({ queryKey: ["agreement-cobrancas", cpf, agreementId] });
    } catch (err: any) {
      toast({ title: "Erro ao atualizar data", description: err.message, variant: "destructive" });
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const statusIcon = (status: string) => {
    if (status === "pago") return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
    if (status === "vencido") return <AlertTriangle className="w-3.5 h-3.5 text-destructive" />;
    if (status === "pending_confirmation") return <HandCoins className="w-3.5 h-3.5 text-blue-600" />;
    return <Clock className="w-3.5 h-3.5 text-warning" />;
  };

  return (
    <div className="pt-3 border-t border-border space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase font-medium flex items-center gap-1">
          <FileText className="w-3 h-3" /> Parcelas do Acordo
        </p>
        <span className="text-xs text-muted-foreground">{paidCount}/{totalInstallments} pagas</span>
      </div>

      <Progress value={progressPercent} className="h-2" />

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[80px]">Parcela</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-center w-[60px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installmentsWithStatus.map((inst, idx) => {
            const hasBoleto = inst.cobranca?.link_boleto;
            const hasLinhaDigitavel = inst.cobranca?.linha_digitavel;
            const hasPix = inst.cobranca?.pix_copia_cola;
            const isPaid = inst.status === "pago";

            return (
              <TableRow key={idx}>
                <TableCell className="font-medium text-xs">
                  {inst.isEntrada ? "Entrada" : `${inst.displayNumber}/${totalInstallments}`}
                </TableCell>
                <TableCell className="text-xs">
                  {editingDateIdx === idx ? (
                    <Popover open onOpenChange={(open) => !open && setEditingDateIdx(null)}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          {formatDate(inst.dueDate.toISOString().split("T")[0])}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={inst.dueDate}
                          onSelect={(d) => handleEditDate(inst, d)}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    formatDate(inst.dueDate.toISOString().split("T")[0])
                  )}
                </TableCell>
                <TableCell className="text-right text-xs">{formatCurrency(Number(inst.value))}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={cn(
                    "gap-1 text-[10px]",
                    inst.status === "pago" ? "bg-green-500/10 text-green-600 border-green-500/30" :
                    inst.status === "vencido" ? "bg-destructive/10 text-destructive border-destructive/30" :
                    inst.status === "pending_confirmation" ? "bg-blue-500/10 text-blue-600 border-blue-500/30" :
                    "bg-warning/10 text-warning border-warning/30"
                  )}>
                    {statusIcon(inst.status)}
                    {inst.status === "pago" ? "Pago" : inst.status === "vencido" ? "Vencido" : inst.status === "pending_confirmation" ? "Aguardando Confirmação" : "Em Aberto"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {/* Generate boleto */}
                      {!hasBoleto && !isPaid && (
                        <DropdownMenuItem
                          onClick={() => handleGenerateBoleto(inst, idx)}
                          disabled={generatingIdx === idx}
                        >
                          {generatingIdx === idx ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Receipt className="w-4 h-4 mr-2" />
                          )}
                          Gerar Boleto
                        </DropdownMenuItem>
                      )}

                      {/* Download boleto / 2ª via */}
                      {hasBoleto && (
                        <DropdownMenuItem onClick={() => window.open(inst.cobranca.link_boleto, "_blank")}>
                          <Download className="w-4 h-4 mr-2" />
                          {isPaid ? "2ª Via Boleto" : "Baixar Boleto"}
                        </DropdownMenuItem>
                      )}

                      {/* Copy linha digitavel */}
                      {hasLinhaDigitavel && (
                        <DropdownMenuItem onClick={() => handleCopy(inst.cobranca.linha_digitavel, "Linha digitável")}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar Linha Digitável
                        </DropdownMenuItem>
                      )}

                      {/* Copy PIX */}
                      {hasPix && (
                        <DropdownMenuItem onClick={() => handleCopy(inst.cobranca.pix_copia_cola, "PIX")}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar PIX
                        </DropdownMenuItem>
                      )}

                      {/* Edit date */}
                      {!isPaid && inst.status !== "pending_confirmation" && (
                        <DropdownMenuItem onClick={() => setEditingDateIdx(idx)}>
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          Editar Data
                        </DropdownMenuItem>
                      )}

                      {/* Manual payment */}
                      {!isPaid && inst.status !== "pending_confirmation" && tenantId && profile && (
                        <DropdownMenuItem onClick={() => setManualPaymentInst({ number: inst.number, value: Number(inst.value) })}>
                          <HandCoins className="w-4 h-4 mr-2" />
                          Baixar Manualmente
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
    </div>
  );
};

export default AgreementInstallments;
