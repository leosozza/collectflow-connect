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
import { Textarea } from "@/components/ui/textarea";
import { updateInstallmentDate, updateInstallmentValue, cancelInstallment, reactivateInstallment } from "@/services/agreementService";
import { manualPaymentService } from "@/services/manualPaymentService";
import { TEMPLATE_DEFAULTS } from "@/lib/documentDefaults";
import { renderDocument } from "@/services/documentRenderer";
import { downloadPdf } from "@/services/documentPdfService";
import { wrapDocumentInA4Page } from "@/services/documentLayoutService";
import { getClientProfile, upsertClientProfile } from "@/services/clientProfileService";
import { logAction } from "@/services/auditService";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ManualPaymentDialog from "@/components/acordos/ManualPaymentDialog";
import ReconciliationAlertModal from "@/components/acordos/ReconciliationAlertModal";
import { useReconciliationAlerts } from "@/hooks/useReconciliationAlerts";
import type { ReconciliationAlert } from "@/services/reconciliationAlertService";
import { fetchSSOTInstallments, type SSOTInstallment } from "@/lib/agreementInstallmentsSSOT";
import { extractFunctionError } from "@/lib/extractFunctionError";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ExternalLink, FileText, ClipboardCopy,
  CheckCircle2, Clock, AlertTriangle, Loader2, FileBarChart, DollarSign, Pencil, FileCheck, ChevronDown,
  Trash2, RotateCcw, XCircle, Ban,
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

// Defensive: if an error message is a stringified JSON blob (e.g. raw provider
// response leaking through), extract a human-readable field. Else return as-is.
function humanizeErrorMessage(msg: unknown): string {
  const s = typeof msg === "string" ? msg.trim() : String(msg ?? "");
  if (!s) return "Erro desconhecido";
  const m = s.match(/^(.*?):\s*(\{.*\})\s*$/s);
  const prefix = m ? `${m[1]}: ` : "";
  const candidate = m ? m[2] : (s.startsWith("{") ? s : null);
  if (!candidate) return s;
  try {
    const j = JSON.parse(candidate);
    const inner = j?.mensagem || j?.message || j?.error || j?.erro
      || (Array.isArray(j?.erros) ? j.erros.join("; ") : null)
      || (Array.isArray(j?.errors) ? j.errors.join("; ") : null);
    if (inner) return `${prefix}${inner}`;
  } catch { /* not JSON */ }
  return s;
}

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
  const [cancelInstallmentDialog, setCancelInstallmentDialog] = useState<{ inst: any; idx: number; hasActiveBoleto: boolean } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
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

  // Reconciliation alert state (agreement-level, no installment binding)
  const [openAlert, setOpenAlert] = useState<ReconciliationAlert | null>(null);
  const { data: reconAlerts = [], refetch: refetchAlerts } = useReconciliationAlerts(agreementId, tenantId);
  const pendingAgreementAlerts = reconAlerts.filter(
    (a) => a.status === "pending" || a.status === "pending_admin_approval"
  );

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
      .channel(`agreement_inst_realtime_${agreementId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "negociarie_cobrancas", filter: `agreement_id=eq.${agreementId}` },
        () => {
          refetchCobrancas();
          queryClient.invalidateQueries({ queryKey: ["agreement-installments-ssot", agreementId] });
      queryClient.invalidateQueries({ queryKey: ["carteira-grouped"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agreement_installments", filter: `agreement_id=eq.${agreementId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["agreement-installments-ssot", agreementId] });
      queryClient.invalidateQueries({ queryKey: ["carteira-grouped"] });
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

  const { data: credorReceipt } = useQuery({
    queryKey: ["credor-receipt-template", agreement?.credor],
    queryFn: async () => {
      const { data } = await supabase
        .from("credores")
        .select("razao_social, nome_fantasia, cnpj, portal_logo_url, document_logo_url, endereco, numero, complemento, bairro, cidade, uf, cep, email, template_recibo")
        .or(`razao_social.eq.${agreement.credor},nome_fantasia.eq.${agreement.credor}`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!agreement?.credor,
  });

  const { data: tenantReceiptTemplate } = useQuery({
    queryKey: ["tenant-receipt-template", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_templates")
        .select("content")
        .eq("tenant_id", tenantId!)
        .eq("type", "recibo")
        .maybeSingle();
      return data?.content || null;
    },
    enabled: !!tenantId,
  });

  const { data: portalPayments = [] } = useQuery({
    queryKey: ["portal-payments", agreementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_payments" as any)
        .select("amount")
        .eq("agreement_id", agreementId)
        .eq("status", "paid");
      if (error) return [];
      return (data as any[]) || [];
    },
    enabled: !!agreementId,
  });

  // SSOT — fonte canônica do "esta parcela está paga?".
  // Lemos `agreement_installments` e sobrescrevemos status/paidAt do classifier legado
  // sempre que houver linha SSOT correspondente. Mantemos o objeto `inst` intacto
  // (com `cobranca`, `customKey`, etc) para preservar todas as ações de escrita.
  const { data: ssotMap } = useQuery({
    queryKey: ["agreement-installments-ssot", agreementId],
    queryFn: async () => {
      const m = await fetchSSOTInstallments([agreementId]);
      const rows = m.get(agreementId) || [];
      const byKey = new Map<string, SSOTInstallment>();
      for (const r of rows) byKey.set(r.installment_key, r);
      return byKey;
    },
    enabled: !!agreementId,
  });

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

  // RIVO_FIX: Anti-vazamento de cobranças entre parcelas.
  // Acordos legados gravavam `installment_key` com offset da entrada (ex.: parcela 1 → :2),
  // enquanto o gerador atual usa chave canônica (parcela 1 → :1). Isso causa colisão:
  // a parcela 2 (canônica) encontraria a cobrança legada da parcela 1 e herdaria o status "pago".
  // Solução: rastrear cobranças já reivindicadas e priorizar match por data_vencimento.
  const usedCobrancaIds = new Set<string>();
  const pickCobranca = (
    candidateKeys: string[],
    dueDate: Date,
  ): any | undefined => {
    const dueIso = format(dueDate, "yyyy-MM-dd");
    // Prioridade 1: chave válida + data de vencimento idêntica + não usada.
    for (const key of candidateKeys) {
      const match = cobrancas.find((c: any) =>
        c.installment_key === key &&
        !usedCobrancaIds.has(c.id) &&
        String(c.data_vencimento || "").slice(0, 10) === dueIso
      );
      if (match) {
        usedCobrancaIds.add(match.id);
        return match;
      }
    }
    // Prioridade 2: chave válida + não usada (qualquer data).
    for (const key of candidateKeys) {
      const match = cobrancas.find((c: any) =>
        c.installment_key === key && !usedCobrancaIds.has(c.id)
      );
      if (match) {
        usedCobrancaIds.add(match.id);
        return match;
      }
    }
    return undefined;
  };

  entradaKeys.forEach((customKey, idx) => {
    const defaultDate = agreement.entrada_date
      ? new Date(agreement.entrada_date + "T00:00:00")
      : new Date(agreement.first_due_date + "T00:00:00");
    const dueDate = customDates[customKey] ? new Date(customDates[customKey] + "T00:00:00") : defaultDate;
    // Fallback: if only one entrada and no custom value, use entrada_value column
    const value = customValues[customKey] ?? (entradaKeys.length === 1 ? agreement.entrada_value : 0);
    // Cobranca lookup: chave canônica é `${agreementId}:${customKey}` (entrada, entrada_2, ...)
    // Mantém fallback legado `:0` para a primeira entrada (registros antigos).
    const expectedKey = `${agreementId}:${customKey}`;
    const legacyEntradaKey = idx === 0 ? `${agreementId}:0` : null;
    const candidateKeys = [expectedKey, ...(legacyEntradaKey ? [legacyEntradaKey] : [])];
    const cobranca = pickCobranca(candidateKeys, dueDate);
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
    const candidateKeys = canonicalNum !== displayNumber
      ? [expectedKey, legacyKey]
      : [expectedKey];
    const cobranca = pickCobranca(candidateKeys, dueDate);
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

  // RIVO_FIX v2: Pagamentos manuais respeitam o ALVO declarado (installment_key/number).
  // Passo A: match direto na parcela alvo. Passo B: pool residual FIFO só para pagamentos
  // sem alvo (legado) ou excedente. NÃO REMOVER — evita vazamento entre parcelas
  // (ex.: pagamento da parcela 2 sendo engolido pela parcela 1 vencida).
  const confirmedManual = manualPayments
    .filter((mp: any) => ["confirmed", "approved"].includes(mp.status))
    .sort((a, b) => new Date(a.payment_date || a.created_at).getTime() - new Date(b.payment_date || b.created_at).getTime())
    .map(mp => ({ ...mp, remaining: Number(mp.amount_paid || 0) }));

  // Pool residual: pagamentos sem installment_key e sem installment_number válido.
  const residualPool = confirmedManual.filter(
    (mp: any) => !mp.installment_key && (mp.installment_number === null || mp.installment_number === undefined),
  );
  // Pagamentos com alvo definido — aplicados diretamente na parcela correspondente.
  const targetedPayments = confirmedManual.filter(
    (mp: any) => mp.installment_key || mp.installment_number !== null,
  );

  const installmentsWithStatus = installments.map((inst) => {
    const isCancelled = !!cancelledMap[inst.customKey];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDay = new Date(inst.dueDate); dueDay.setHours(0, 0, 0, 0);
    const isOverdue = dueDay < today;
    const instValue = Number(inst.value);

    if (isCancelled) {
      return { ...inst, status: "cancelled", isOverdue: false, pendingManual: undefined, isCancelled: true };
    }

    // 1. Verificar se está pago via Negociarie (Cobranca oficial)
    const isPaidByCobranca = inst.cobranca?.status === "pago";
    
    // 2. Verificar se há baixa pendente específica
    const pendingManual = manualPayments.find(
      (mp: any) => (
        (mp.installment_key && mp.installment_key === inst.customKey) ||
        (!mp.installment_key && mp.installment_number === inst.number)
      ) && mp.status === "pending_confirmation"
    );

    // 3a. Pagamentos manuais COM alvo declarado (installment_key/number) — match direto.
    let paidByManual = 0;
    let lastManualDate: string | undefined;
    for (const mp of targetedPayments) {
      const matchesKey = mp.installment_key && mp.installment_key === inst.customKey;
      const matchesNumber = !mp.installment_key && mp.installment_number === inst.number;
      if (!matchesKey && !matchesNumber) continue;
      if (mp.remaining <= 0) continue;
      if (paidByManual >= instValue - 0.01) break;
      const need = instValue - paidByManual;
      const take = Math.min(mp.remaining, need);
      mp.remaining -= take;
      paidByManual += take;
      if (take > 0) {
        lastManualDate = mp.payment_date || (mp as any).confirmed_at || mp.created_at;
      }
    }

    // 3b. Pool residual FIFO — só pagamentos sem alvo (legado). NÃO consome excedente
    // de pagamentos com alvo (esse excedente fica reservado à parcela alvo declarada).
    for (const mp of residualPool) {
      if (paidByManual >= instValue - 0.01) break;
      if (mp.remaining <= 0) continue;
      const need = instValue - paidByManual;
      const take = Math.min(mp.remaining, need);
      mp.remaining -= take;
      paidByManual += take;
      if (take > 0) {
        lastManualDate = mp.payment_date || (mp as any).confirmed_at || mp.created_at;
      }
    }

    const isPaidByManual = paidByManual >= instValue - 0.01;
    const isPaid = isPaidByCobranca || isPaidByManual;

    const status = pendingManual
      ? "pending_confirmation"
      : isPaid
        ? "pago"
        : isOverdue ? "vencido" : "pendente";

    // Data de pagamento: Fonte Negociarie tem prioridade, depois FIFO manual.
    let paidAt: string | undefined;
    if (isPaid) {
      paidAt = isPaidByCobranca 
        ? inst.cobranca?.data_pagamento 
        : lastManualDate;
    }

    return { ...inst, status, isOverdue, pendingManual, paidAt, isCancelled: false };
  }).map((inst) => {
    // SSOT overlay — se houver linha materializada para essa installment_key,
    // a SSOT decide o status final (paid / cancelled / pending_confirmation).
    // Demais campos (cobranca, value, dueDate) permanecem do classifier para preservar ações.
    const ssotRow = ssotMap?.get(inst.customKey);
    if (!ssotRow) return inst;
    if (ssotRow.cancelled) {
      return { ...inst, status: "cancelled", isCancelled: true };
    }
    if (ssotRow.paid) {
      return {
        ...inst,
        status: "pago",
        // Prioriza data REAL da baixa (manual_payments.payment_date / negociarie.data_pagamento)
        // já calculada pelo classifier — só cai no paid_at da SSOT se o classifier não tiver data.
        paidAt: inst.paidAt || ssotRow.paid_at,
      };
    }
    if (ssotRow.pending_confirmation) {
      return { ...inst, status: "pending_confirmation" };
    }
    // SSOT diz não-pago: revoga eventual "pago" do classifier (anti-leak).
    if (inst.status === "pago") {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const dueDay = new Date(inst.dueDate); dueDay.setHours(0, 0, 0, 0);
      return { ...inst, status: dueDay < today ? "vencido" : "pendente", paidAt: undefined };
    }
    return inst;
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
      const { data, error } = await supabase.functions.invoke("generate-agreement-boletos", {
        body: { agreement_id: agreementId, installment_key: inst.customKey },
      });
      if (error || data?.error) {
        throw new Error(await extractFunctionError(error, data, "Erro ao gerar boleto"));
      }
      if ((data?.success ?? 0) === 0) {
        const detail = data?.errors?.[0] || data?.message || "Não foi possível gerar o boleto";
        throw new Error(detail);
      }
      if (hasPreviousBoleto) {
        toast({ title: "Novo boleto gerado com sucesso!", description: "O boleto anterior foi substituído no sistema." });
      } else {
        toast({ title: "Boleto gerado com sucesso!" });
      }
      refetchCobrancas();
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Erro ao gerar boleto", description: humanizeErrorMessage(err.message), variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["agreement-installments-ssot", agreementId] });
      queryClient.invalidateQueries({ queryKey: ["carteira-grouped"] });
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

  const handleDownloadReceipt = async (inst: any) => {
    try {
      // Resolve template: credor → tenant → default
      let templateContent: string | null = null;
      let templateSource: "credor" | "tenant" | "default" = "default";
      if (credorReceipt?.template_recibo?.trim()) {
        templateContent = credorReceipt.template_recibo;
        templateSource = "credor";
      } else if (tenantReceiptTemplate?.trim()) {
        templateContent = tenantReceiptTemplate;
        templateSource = "tenant";
      } else if (TEMPLATE_DEFAULTS["template_recibo"]) {
        templateContent = TEMPLATE_DEFAULTS["template_recibo"];
        templateSource = "default";
      }
      if (!templateContent) {
        toast({ title: "Modelo de recibo não configurado", variant: "destructive" });
        return;
      }

      // Find payment date from confirmed manual payment for this installment
      const confirmed = manualPayments.find(
        (mp: any) =>
          ((mp.installment_key && mp.installment_key === inst.customKey) ||
            (!mp.installment_key && mp.installment_number === inst.number)) &&
          mp.status === "confirmed"
      );
      const paymentDate = confirmed?.payment_date
        ? formatDate(confirmed.payment_date)
        : new Date().toLocaleDateString("pt-BR");

      const installmentLabel = inst.isEntrada
        ? "Entrada"
        : `${inst.displayNumber}/${totalInstallments}`;

      const vars: Record<string, string> = {
        "{nome_devedor}": agreement.client_name || "",
        "{cpf_devedor}": formatCPF(cpf),
        "{credor}": agreement.credor || "",
        "{numero_parcela}": String(inst.displayNumber ?? ""),
        "{total_parcelas}": String(totalInstallments),
        "{parcela}": installmentLabel,
        "{valor_parcela}": formatCurrency(Number(inst.value)),
        "{valor_pago}": formatCurrency(Number(inst.value)),
        "{data_vencimento}": formatDate(inst.dueDate.toISOString().split("T")[0]),
        "{data_pagamento}": paymentDate,
        "{data_atual}": new Date().toLocaleDateString("pt-BR"),
      };

      const rendered = renderDocument(templateContent, vars, templateSource);
      const wrappedHtml = wrapDocumentInA4Page({
        bodyHtml: rendered.html,
        title: "Recibo de Pagamento",
        credor: credorReceipt,
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      const safeName = (agreement.client_name || "devedor").replace(/\s+/g, "_");
      const filename = `recibo_parcela_${inst.displayNumber}_${safeName}_${dateStr}.pdf`;

      await downloadPdf(wrappedHtml, filename);

      // Register event (best effort)
      if (tenantId) {
        try {
          await supabase.from("client_events").insert({
            tenant_id: tenantId,
            client_cpf: cpf,
            event_type: "document_generated",
            event_source: "system",
            event_value: "Recibo de Pagamento",
            metadata: {
              document_type: "recibo",
              template_source: templateSource,
              installment: installmentLabel,
              agreement_id: agreementId,
            },
          });
        } catch (err) {
          console.error("Erro ao registrar evento de recibo:", err);
        }
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar recibo", description: err.message, variant: "destructive" });
    }
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
      queryClient.invalidateQueries({ queryKey: ["agreement-installments-ssot", agreementId] });
      queryClient.invalidateQueries({ queryKey: ["carteira-grouped"] });
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
      queryClient.invalidateQueries({ queryKey: ["agreement-installments-ssot", agreementId] });
      queryClient.invalidateQueries({ queryKey: ["carteira-grouped"] });
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
      } catch { }

      toast({ title: "Pagamento estornado com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["agreement-cobrancas", cpf, agreementId] });
      queryClient.invalidateQueries({ queryKey: ["agreement-installments-ssot", agreementId] });
      queryClient.invalidateQueries({ queryKey: ["carteira-grouped"] });
      queryClient.invalidateQueries({ queryKey: ["client-agreements", cpf] });
      refetchCobrancas();
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Erro ao estornar pagamento", description: err.message, variant: "destructive" });
    } finally {
      setUnconfirmingIdx(null);
    }
  };

  const handleConfirmCancelInstallment = async () => {
    if (!cancelInstallmentDialog) return;
    const { inst, idx, hasActiveBoleto } = cancelInstallmentDialog;
    const reason = cancelReason.trim();
    if (reason.length < 5) {
      toast({ title: "Motivo obrigatório", description: "Informe um motivo com no mínimo 5 caracteres.", variant: "destructive" });
      return;
    }
    setCancellingInstallmentIdx(idx);
    try {
      await cancelInstallment(agreementId, inst.customKey, reason);
      try {
        await supabase.from("client_events").insert({
          tenant_id: tenantId,
          client_cpf: cpf,
          event_source: "operator",
          event_type: "installment_cancelled",
          metadata: {
            agreement_id: agreementId,
            installment_key: inst.customKey,
            installment_label: inst.isEntrada
              ? (inst.entradaCount > 1 ? `Entrada ${inst.entradaIndex + 1}` : "Entrada")
              : `Parcela ${inst.displayNumber}/${totalInstallments}`,
            valor: Number(inst.value),
            reason,
            boleto_cancelled: hasActiveBoleto,
            cancelled_by: profile?.id,
          },
        } as any);
      } catch { }
      toast({
        title: "Parcela cancelada",
        description: hasActiveBoleto
          ? "Parcela e boleto cancelados com sucesso."
          : "A parcela foi marcada como cancelada.",
      });
      queryClient.invalidateQueries({ queryKey: ["client-agreements", cpf] });
      queryClient.invalidateQueries({ queryKey: ["client-detail", cpf] });
      queryClient.invalidateQueries({ queryKey: ["agreement-installments-ssot", agreementId] });
      queryClient.invalidateQueries({ queryKey: ["agreement-cobrancas", cpf, agreementId] });
      queryClient.invalidateQueries({ queryKey: ["carteira-grouped"] });
      onRefresh?.();
      setCancelInstallmentDialog(null);
      setCancelReason("");
    } catch (err: any) {
      toast({ title: "Erro ao cancelar parcela", description: humanizeErrorMessage(err?.message), variant: "destructive" });
    } finally {
      setCancellingInstallmentIdx(null);
    }
  };

  const handleReactivateInstallment = async (inst: any, idx: number) => {
    setCancellingInstallmentIdx(idx);
    try {
      await reactivateInstallment(agreementId, inst.customKey);
      try {
        await supabase.from("client_events").insert({
          tenant_id: tenantId,
          client_cpf: cpf,
          event_source: "operator",
          event_type: "installment_reactivated",
          metadata: {
            agreement_id: agreementId,
            installment_key: inst.customKey,
            reactivated_by: profile?.id,
          },
        } as any);
      } catch { }
      toast({ title: "Parcela reativada" });
      queryClient.invalidateQueries({ queryKey: ["client-agreements", cpf] });
      queryClient.invalidateQueries({ queryKey: ["client-detail", cpf] });
      queryClient.invalidateQueries({ queryKey: ["agreement-installments-ssot", agreementId] });
      queryClient.invalidateQueries({ queryKey: ["carteira-grouped"] });
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Erro ao reativar parcela", description: humanizeErrorMessage(err?.message), variant: "destructive" });
    } finally {
      setCancellingInstallmentIdx(null);
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
      const { data, error } = await supabase.functions.invoke("generate-agreement-boletos", {
        body: { agreement_id: agreementId },
      });
      if (error || data?.error) {
        throw new Error(await extractFunctionError(error, data, "Erro ao gerar boletos"));
      }
      const result = {
        success: data?.success ?? 0,
        failed: data?.failed ?? 0,
        errors: data?.errors ?? [],
      };
      // Edge already clears boleto_pendente when at least one boleto succeeds (batch mode).
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
        toast({ title: "Falha parcial", description: humanizeErrorMessage(result.errors[0]), variant: "destructive" });
      }
      if (result.success === 0 && result.failed === 0 && data?.message) {
        toast({ title: "Não foi possível gerar", description: data.message, variant: "destructive" });
      }
      refetchCobrancas();
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Erro ao gerar boletos", description: humanizeErrorMessage(err.message), variant: "destructive" });
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
                  {/* RIVO_FIX: Coluna obrigatoria */}
                  <TableHead className="text-center">Pagamento</TableHead>
                  <TableHead className="text-center w-[140px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installmentsWithStatus.map((inst, idx) => {
                  const isCancelled = !!inst.isCancelled;
                  const hasBoleto = inst.cobranca?.link_boleto;
                  const hasLinhaDigitavel = inst.cobranca?.linha_digitavel;
                  const hasPix = inst.cobranca?.pix_copia_cola;
                  const isPaid = inst.status === "pago";
                  const canEdit = !isPaid && !isCancelled && inst.status !== "pending_confirmation";
                  const hasActiveBoleto = !!inst.cobranca && !["cancelado", "substituido", "estornado"].includes(inst.cobranca.status);
                  const isOnlyEntrada = inst.isEntrada && inst.entradaCount === 1;
                  const agreementClosed = ["completed", "cancelled", "broken"].includes(String((agreement as any)?.status || ""));
                  // RIVO: cancelamento agora cancela boleto no gateway automaticamente — não bloqueia mais por hasActiveBoleto.
                  const canCancel = !isPaid && !isCancelled && inst.status !== "pending_confirmation"
                    && !isOnlyEntrada && activeInstallmentsCount > 1 && !agreementClosed;

                  return (
                    <TableRow key={idx} className={cn(isCancelled && "opacity-60 [&_td]:line-through [&_td]:decoration-muted-foreground")}>
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
                      <TableCell className="text-center no-underline [text-decoration:none]">
                        {isCancelled ? (
                          <Badge variant="outline" className="gap-1 text-[10px] bg-muted text-muted-foreground border-border no-underline [text-decoration:none]">
                            <XCircle className="w-3.5 h-3.5" /> Cancelada
                          </Badge>
                        ) : (
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
                        )}
                      </TableCell>

                      {/* (alertas Maxlist agora são exibidos como banner no topo do acordo) */}
                      {false && (
                        <span />
                      )}
                      <TableCell className="hidden">{null}</TableCell>


                      {/* RIVO_FIX: Coluna obrigatoria */}
                      <TableCell className="text-center text-xs text-muted-foreground font-medium">
                        {inst.status === "pago" && inst.paidAt ? formatDate(inst.paidAt) : "—"}
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
                                ) && ["confirmed", "approved"].includes(mp.status)
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

                            {/* Cancelar parcela */}
                            {canCancel && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    disabled={cancellingInstallmentIdx === idx}
                                    onClick={() => setCancelInstallmentDialog({ inst, idx, hasActiveBoleto })}
                                  >
                                    {cancellingInstallmentIdx === idx ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Ban className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Cancelar Parcela</p></TooltipContent>
                              </Tooltip>
                            )}

                            {/* Reativar parcela cancelada (oculto se boleto foi cancelado no gateway) */}
                            {isCancelled && !cancelledMap[inst.customKey]?.boleto_cancelled && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                                    disabled={cancellingInstallmentIdx === idx}
                                    onClick={() => handleReactivateInstallment(inst, idx)}
                                  >
                                    {cancellingInstallmentIdx === idx ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <RotateCcw className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Reativar Parcela</p></TooltipContent>
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
      queryClient.invalidateQueries({ queryKey: ["agreement-installments-ssot", agreementId] });
      queryClient.invalidateQueries({ queryKey: ["carteira-grouped"] });
                onRefresh?.();
              }}
            />
          )}

          {openAlert && tenantId && profile && (
            <ReconciliationAlertModal
              open={!!openAlert}
              onOpenChange={(open) => !open && setOpenAlert(null)}
              alert={openAlert.alert}
              installmentNumber={openAlert.inst.number}
              installmentKey={openAlert.inst.customKey}
              installmentLabel={openAlert.inst.isEntrada
                ? (openAlert.inst.entradaCount > 1 ? `Entrada ${openAlert.inst.displayNumber}` : "Entrada")
                : `Parcela ${openAlert.inst.displayNumber}/${totalInstallments}`}
              installmentValue={Number(openAlert.inst.value)}
              tenantId={tenantId}
              profileId={profile.id}
              agreementId={agreementId}
              onResolved={() => {
                refetchAlerts();
                queryClient.invalidateQueries({ queryKey: ["manual-payments", agreementId] });
                queryClient.invalidateQueries({ queryKey: ["agreement-installments-ssot", agreementId] });
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

      {/* Cancel Installment Confirmation */}
      <AlertDialog
        open={!!cancelInstallmentDialog}
        onOpenChange={(o) => { if (!o) { setCancelInstallmentDialog(null); setCancelReason(""); } }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar parcela?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {cancelInstallmentDialog ? (
                <div className="space-y-3">
                  <div>
                    A parcela{" "}
                    <b>
                      {cancelInstallmentDialog.inst.isEntrada
                        ? (cancelInstallmentDialog.inst.entradaCount > 1
                          ? `Entrada ${cancelInstallmentDialog.inst.entradaIndex + 1}`
                          : "Entrada")
                        : `${cancelInstallmentDialog.inst.displayNumber}/${totalInstallments}`}
                    </b>{" "}
                    ({formatCurrency(Number(cancelInstallmentDialog.inst.value))}) será marcada como
                    cancelada e desconsiderada do progresso do acordo.
                  </div>

                  {/* Impacto no total */}
                  {(() => {
                    const prev = Number((agreement as any)?.proposed_total || 0);
                    const next = Math.max(0, prev - Number(cancelInstallmentDialog.inst.value || 0));
                    return (
                      <div className="text-xs bg-muted/50 rounded-md p-2 border border-border">
                        Total do acordo: <b>{formatCurrency(prev)}</b> → <b>{formatCurrency(next)}</b>
                      </div>
                    );
                  })()}

                  {/* Alerta de boleto ativo */}
                  {cancelInstallmentDialog.hasActiveBoleto && (
                    <Alert variant="destructive" className="py-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Esta parcela tem boleto ativo no gateway. Ele será cancelado automaticamente e
                        <b> não poderá ser restaurado</b> — para reabrir, será necessário gerar um novo
                        boleto manualmente.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Motivo obrigatório */}
                  <div className="space-y-1">
                    <Label htmlFor="cancel-reason" className="text-xs font-medium">
                      Motivo do cancelamento <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="cancel-reason"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Ex: cliente solicitou exclusão dessa parcela do acordo"
                      rows={3}
                      maxLength={500}
                      disabled={cancellingInstallmentIdx !== null}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Mínimo 5 caracteres. Ficará registrado na auditoria e na timeline do cliente.
                    </p>
                  </div>
                </div>
              ) : <div />}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancellingInstallmentIdx !== null}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancelInstallment}
              disabled={cancellingInstallmentIdx !== null || cancelReason.trim().length < 5}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancellingInstallmentIdx !== null && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Cancelar Parcela
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
