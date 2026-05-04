import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useUrlState } from "@/hooks/useUrlState";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, formatCurrency, formatDate, formatCredorName } from "@/lib/formatters";
import { ArrowLeft, Pencil, Trash2, User, RotateCcw, CheckSquare, ChevronDown, ArrowUpRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { logAction } from "@/services/auditService";
import { recalcScoreForCpf } from "@/hooks/useScoreRecalc";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CraftButton, CraftButtonLabel, CraftButtonIcon } from "@/components/ui/craft-button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "sonner";
import ClientAttachments from "@/components/clients/ClientAttachments";
import ClientDetailHeader from "@/components/client-detail/ClientDetailHeader";
import ClientUpdateHistory from "@/components/client-detail/ClientUpdateHistory";
import ClientTimeline from "@/components/atendimento/ClientTimeline";
import AgreementCalculator from "@/components/client-detail/AgreementCalculator";
import ClientDocuments from "@/components/client-detail/ClientDocuments";
import ClientSignature from "@/components/client-detail/ClientSignature";
import AgreementInstallments from "@/components/client-detail/AgreementInstallments";
import { cancelAgreement, updateAgreement, reopenAgreement, AgreementFormData } from "@/services/agreementService";
import { getEffectiveAgreementSummary } from "@/lib/installmentUtils";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";

const statusLabelsMap: Record<string, string> = {
  approved: "Acordo Vigente",
  completed: "Quitado",
  pending: "Acordo Vigente",
  pending_approval: "Aguardando Liberação",
  rejected: "Rejeitado",
  cancelled: "Quebra de Acordo",
  overdue: "Acordo Atrasado",
};

const statusVariantMap: Record<string, "default" | "outline" | "secondary" | "destructive"> = {
  approved: "default",
  completed: "default",
  pending: "outline",
  pending_approval: "outline",
  overdue: "destructive",
  cancelled: "secondary",
  rejected: "secondary",
};

// Statuses that show installments
const installmentStatuses = ["pending", "pending_approval", "approved", "overdue", "completed", "cancelled"];
// Statuses that allow edit
const editableStatuses = ["pending", "pending_approval", "approved", "overdue", "cancelled"];
// Statuses that allow cancel
const cancellableStatuses = ["pending", "pending_approval", "approved", "overdue"];

const ClientDetailPage = () => {
  const { cpf } = useParams<{ cpf: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const credorFilter = searchParams.get("credor");
  const { tenant } = useTenant();
  const { canReopenParcelas } = usePermissions();
  const [showAcordoDialog, setShowAcordoDialog] = useState(false);
  const [activeTab, setActiveTab] = useUrlState("tab", "titulos");

  // Auto-open "Formalizar Acordo" dialog when ?action=formalizar is present
  useEffect(() => {
    if (searchParams.get("action") === "formalizar") {
      setShowAcordoDialog(true);
    }
  }, [searchParams]);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reopenId, setReopenId] = useState<string | null>(null);
  const [editingAgreement, setEditingAgreement] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<Partial<AgreementFormData>>({});
  const [editEntradas, setEditEntradas] = useState<Array<{ key: string; date: string; value: number }>>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [reactivateAgreement, setReactivateAgreement] = useState<any | null>(null);
  const [selectedPagoIds, setSelectedPagoIds] = useState<string[]>([]);
  const [showReopenParcelasDialog, setShowReopenParcelasDialog] = useState(false);
  const [reopeningParcelas, setReopeningParcelas] = useState(false);
  const [expandedAgreements, setExpandedAgreements] = useState<Set<string>>(new Set());



  const handleTogglePagoSelection = (id: string) => {
    setSelectedPagoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const handleToggleAllPago = () => {
    setSelectedPagoIds(allPagoSelected ? [] : pagoClients.map(c => c.id));
  };

  const handleReopenParcelas = async () => {
    if (selectedPagoIds.length === 0) return;
    setReopeningParcelas(true);
    console.time("[reopen-parcelas] total");
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Agrupa parcelas por novo status para fazer no máximo 2 UPDATEs em paralelo
      const vencidoIds: string[] = [];
      const pendenteIds: string[] = [];
      for (const id of selectedPagoIds) {
        const client = clients.find(c => c.id === id);
        if (!client) continue;
        const dueDate = new Date(client.data_vencimento);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate < today) vencidoIds.push(id);
        else pendenteIds.push(id);
      }

      const updates: Array<Promise<any>> = [];
      if (vencidoIds.length > 0) {
        updates.push(
          Promise.resolve(supabase.from("clients").update({ status: "vencido", valor_pago: 0 } as any).in("id", vencidoIds))
        );
      }
      if (pendenteIds.length > 0) {
        updates.push(
          Promise.resolve(supabase.from("clients").update({ status: "pendente", valor_pago: 0 } as any).in("id", pendenteIds))
        );
      }
      const results = await Promise.all(updates);
      const firstError = results.find((r: any) => r?.error)?.error;
      if (firstError) throw firstError;

      const rawCpf = (cpf || "").replace(/\D/g, "");
      const tenantId = clients[0]?.tenant_id;

      // Pós-processamento em background — não bloqueia o operador
      recalcScoreForCpf(rawCpf).catch(() => {});
      if (tenantId) {
        supabase.functions.invoke("auto-status-sync", { body: { tenant_id: tenantId } }).catch(() => {});
      }
      logAction({
        action: "reabrir_parcelas",
        entity_type: "client",
        entity_id: rawCpf,
        details: { parcelas_reabertas: selectedPagoIds, quantidade: selectedPagoIds.length },
      }).catch(() => {});

      toast.success(`${selectedPagoIds.length} parcela(s) reaberta(s) com sucesso.`);
      setSelectedPagoIds([]);
      setShowReopenParcelasDialog(false);
      refetch(); // sem await — UI já liberada
    } catch (err) {
      console.error(err);
      toast.error("Erro ao reabrir parcelas.");
    } finally {
      console.timeEnd("[reopen-parcelas] total");
      setReopeningParcelas(false);
    }
  };

  const backTo = (location.state as any)?.from || "/carteira";

  const { data: clients = [], isLoading, refetch } = useQuery({
    queryKey: ["client-detail", cpf, credorFilter],
    queryFn: async () => {
      const rawCpf = (cpf || "").replace(/\D/g, "");
      let query = supabase
        .from("clients")
        .select("*")
        .or(`cpf.eq.${rawCpf},cpf.eq.${formatCPF(rawCpf)}`);
      if (credorFilter) {
        query = query.eq("credor", credorFilter);
      }
      const { data, error } = await query.order("numero_parcela", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!cpf,
  });

  const { data: agreements = [], refetch: refetchAgreements } = useQuery({
    queryKey: ["client-agreements", cpf, credorFilter],
    queryFn: async () => {
      const rawCpf = (cpf || "").replace(/\D/g, "");
      let query = supabase
        .from("agreements")
        .select("*")
        .or(`client_cpf.eq.${rawCpf},client_cpf.eq.${formatCPF(rawCpf)}`);
      if (credorFilter) {
        query = query.eq("credor", credorFilter);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch creator profiles for all agreements
      const creatorIds = [...new Set((data || []).map((a: any) => a.created_by).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", creatorIds);
        if (profiles) {
          profiles.forEach((p: any) => { profilesMap[p.user_id] = p.full_name; });
        }
      }

      return (data || []).map((a: any) => ({
        ...a,
        creator_name: profilesMap[a.created_by] || (a.portal_origin ? "Portal" : null),
      }));
    },
    enabled: !!cpf,
  });

  // Initialize first agreement as expanded when agreements load
  useEffect(() => {
    if (agreements.length > 0 && expandedAgreements.size === 0) {
      setExpandedAgreements(new Set([agreements[0].id]));
    }
  }, [agreements]);

  const pagoClients = useMemo(() => clients.filter(c => c.status === "pago"), [clients]);
  const allPagoSelected = pagoClients.length > 0 && pagoClients.every(c => selectedPagoIds.includes(c.id));

  // Consolidate contact/address fields across all records for the same CPF
  // Must be before early returns to maintain consistent hook order
  const first = useMemo(() => {
    if (clients.length === 0) return null;
    const base = { ...clients[0] };
    const contactFields = ["email", "phone", "endereco", "bairro", "cidade", "uf", "cep"] as const;
    for (const c of clients) {
      for (const field of contactFields) {
        if (!base[field] && c[field]) base[field] = c[field];
      }
    }
    return base;
  }, [clients]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-28" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Skeleton className="h-10 w-full max-w-lg" />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!first || clients.length === 0) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" onClick={() => navigate("/carteira")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const lastAgreement = agreements[0] || null;

  const handleAgreementCreated = () => {
    setShowAcordoDialog(false);
    setReactivateAgreement(null);
    refetch();
    refetchAgreements();
  };

  const hasActiveAgreement = agreements.some((a: any) => ["pending", "approved", "overdue", "pending_approval"].includes(a.status));

  const handleReactivateAgreement = (agreement: any) => {
    setReactivateAgreement(agreement);
    setShowAcordoDialog(true);
  };

  const handleReopenAgreement = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Detect past-due installments to warn operator
      let pastDueCount = 0;
      try {
        const { data: ag } = await supabase
          .from("agreements")
          .select("*")
          .eq("id", id)
          .single();
        if (ag) {
          const { buildInstallmentSchedule } = await import("@/lib/agreementInstallmentClassifier");
          const schedule = buildInstallmentSchedule(ag as any);
          const today = new Date().toISOString().split("T")[0];
          pastDueCount = schedule.filter((s: any) => s.dueDate < today).length;
        }
      } catch { /* best-effort */ }

      console.time("[reopen-agreement] total");
      await reopenAgreement(id, user.id);
      console.timeEnd("[reopen-agreement] total");
      toast.success("Acordo reaberto. Regerando boletos das parcelas futuras…");
      if (pastDueCount > 0) {
        toast.warning(
          `Atenção: ${pastDueCount} ${pastDueCount === 1 ? "parcela está" : "parcelas estão"} com data vencida e NÃO ${pastDueCount === 1 ? "terá" : "terão"} boleto gerado. Corrija as datas em "Acordos do cliente" e clique em "Reemitir" para essas parcelas.`,
          { duration: 10000 }
        );
      }
      // refetch em background — não bloqueia o feedback ao operador
      refetch();
      refetchAgreements();
    } catch (err: any) {
      toast.error(err.message || "Erro ao reabrir acordo");
    }
  };

  const handleCancelAgreement = async (id: string) => {
    try {
      await cancelAgreement(id);
      toast.success("Acordo cancelado com sucesso.");
      refetch();
      refetchAgreements();
    } catch (err: any) {
      toast.error("Erro ao cancelar acordo: " + err.message);
    }
    setCancelId(null);
  };

  const handleEditOpen = (agreement: any) => {
    setEditingAgreement(agreement);

    // Reconstruct entrada list from custom_installment_values (supports multi-entrada)
    const cv: Record<string, any> = agreement.custom_installment_values || {};
    const cd: Record<string, any> = agreement.custom_installment_dates || {};
    const entradaKeys = Object.keys(cv)
      .filter(k => k.startsWith("entrada") && !k.endsWith("_method"))
      .sort((a, b) => {
        const numA = a === "entrada" ? 1 : parseInt(a.replace("entrada_", "")) || 1;
        const numB = b === "entrada" ? 1 : parseInt(b.replace("entrada_", "")) || 1;
        return numA - numB;
      });

    let entradas: Array<{ key: string; date: string; value: number }> = [];
    if (entradaKeys.length > 0) {
      entradas = entradaKeys.map(k => ({
        key: k,
        date: cd[k] || agreement.entrada_date || "",
        value: Number(cv[k] || 0),
      }));
    } else if ((agreement.entrada_value || 0) > 0) {
      entradas = [{
        key: "entrada",
        date: agreement.entrada_date || "",
        value: Number(agreement.entrada_value || 0),
      }];
    }
    setEditEntradas(entradas);

    const totalEntrada = entradas.reduce((s, e) => s + Number(e.value || 0), 0);
    setEditForm({
      proposed_total: agreement.proposed_total,
      new_installments: agreement.new_installments,
      new_installment_value: agreement.new_installment_value,
      first_due_date: agreement.first_due_date,
      entrada_value: totalEntrada,
      entrada_date: entradas[0]?.date || agreement.entrada_date || "",
      notes: agreement.notes || "",
    });
  };

  const recalcInstallmentValue = (proposed: number, entrada: number, installments: number) => {
    const remaining = Math.max(proposed - entrada, 0);
    return installments > 0 ? Math.round((remaining / installments) * 100) / 100 : remaining;
  };

  const sumEntradas = (list: Array<{ value: number }>) =>
    list.reduce((s, e) => s + Number(e.value || 0), 0);

  const handleEditProposed = (proposed: number) => {
    const installments = editForm.new_installments || 1;
    const entrada = sumEntradas(editEntradas);
    setEditForm({ ...editForm, proposed_total: proposed, new_installment_value: recalcInstallmentValue(proposed, entrada, installments) });
  };

  // handleEditInstallments removed — installment count cannot be changed on existing agreements

  const updateEntradaAt = (idx: number, patch: Partial<{ date: string; value: number }>) => {
    const next = editEntradas.map((e, i) => i === idx ? { ...e, ...patch } : e);
    setEditEntradas(next);
    const totalEntrada = sumEntradas(next);
    const proposed = editForm.proposed_total || 0;
    const installments = editForm.new_installments || 1;
    setEditForm({
      ...editForm,
      entrada_value: totalEntrada,
      entrada_date: next[0]?.date || editForm.entrada_date,
      new_installment_value: recalcInstallmentValue(proposed, totalEntrada, installments),
    });
  };

  const handleEditSubmit = async () => {
    if (!editingAgreement) return;
    setEditLoading(true);
    try {
      // Rebuild custom_installment_values / dates preserving non-entrada keys + _method keys
      const liveAgreement = agreements.find((a: any) => a.id === editingAgreement.id) || editingAgreement;
      const baseValues: Record<string, any> = { ...(liveAgreement.custom_installment_values || {}) };
      const baseDates: Record<string, any> = { ...(liveAgreement.custom_installment_dates || {}) };

      // Strip existing entrada* (non-method) keys, will be re-added from editEntradas
      Object.keys(baseValues).forEach(k => {
        if (k.startsWith("entrada") && !k.endsWith("_method")) delete baseValues[k];
      });
      Object.keys(baseDates).forEach(k => {
        if (k.startsWith("entrada") && !k.endsWith("_method")) delete baseDates[k];
      });

      editEntradas.forEach(e => {
        baseValues[e.key] = Number(e.value || 0);
        if (e.date) baseDates[e.key] = e.date;
      });

      const payload: Partial<AgreementFormData> = {
        ...editForm,
        entrada_value: sumEntradas(editEntradas),
        entrada_date: editEntradas[0]?.date || editForm.entrada_date,
        custom_installment_values: baseValues,
        custom_installment_dates: baseDates,
      };

      await updateAgreement(editingAgreement.id, payload);
      toast.success("Acordo atualizado com sucesso.");
      setEditingAgreement(null);
      refetchAgreements();
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <ClientDetailHeader
        client={first}
        clients={clients}
        cpf={cpf || ""}
        agreements={agreements}
        onFormalizarAcordo={() => setShowAcordoDialog(true)}
        backTo={backTo}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap gap-2 bg-transparent p-0 h-auto">
          {[
            { value: "titulos", label: "Títulos em Aberto" },
            { value: "acordo", label: "Acordos" },
            { value: "historico", label: "Histórico" },
            { value: "documentos", label: "Documentos" },
            { value: "assinatura", label: "Assinatura" },
            { value: "anexos", label: "Anexos" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              asChild
            >
              <CraftButton
                size="sm"
                className="data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:border-primary/30"
              >
                <CraftButtonLabel>{tab.label}</CraftButtonLabel>
                <CraftButtonIcon>
                  <ArrowUpRight className="size-3 stroke-2 transition-transform duration-500 group-hover:rotate-45" />
                </CraftButtonIcon>
              </CraftButton>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="titulos">
          <Card>
            <CardContent className="p-0">
              {canReopenParcelas && pagoClients.length > 0 && selectedPagoIds.length > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox checked={allPagoSelected} onCheckedChange={handleToggleAllPago} />
                    <span>Selecionar todas as parcelas pagas ({pagoClients.length})</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setShowReopenParcelasDialog(true)}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Reabrir {selectedPagoIds.length} parcela(s)
                  </Button>
                </div>
              )}
              {clients.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">Nenhum título encontrado</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {canReopenParcelas && pagoClients.length > 0 && <TableHead className="w-10"></TableHead>}
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Devolução</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Saldo Devedor</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      {canReopenParcelas && pagoClients.length > 0 && <TableHead className="w-16 text-center">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((c) => {
                      const hasDevolucao = !!(c as any).data_devolucao;
                      const isOverdue = c.status === "vencido" || (c.status === "pendente" && new Date(c.data_vencimento) < new Date());
                      const isEmAcordo = c.status === "em_acordo";
                      const isPago = c.status === "pago";
                      const statusLabel = hasDevolucao ? "Cheque Devolvido" : isPago ? "Pago" : isEmAcordo ? "Em Acordo" : isOverdue ? "Vencido" : c.status === "quebrado" ? "Quebrado" : "Em Aberto";
                      const statusClass = hasDevolucao
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : isPago
                          ? "bg-green-500/10 text-green-600 border-green-500/30"
                          : isOverdue
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : c.status === "quebrado"
                              ? "bg-muted text-muted-foreground border-muted"
                              : isEmAcordo
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                                : "bg-warning/10 text-warning border-warning/30";
                      const valorEfetivo = Number(c.valor_parcela) || Number(c.valor_saldo) || 0;
                      // Cheque devolvido: ignora valor_pago (não houve liquidação financeira real)
                      const pagoLinha = hasDevolucao ? 0 : Number(c.valor_pago);
                      const saldoDevedor = Math.max(0, valorEfetivo - pagoLinha);
                      return (
                        <TableRow key={c.id}>
                          {canReopenParcelas && pagoClients.length > 0 && (
                            <TableCell className="w-10">
                              {isPago && (
                                <Checkbox
                                  checked={selectedPagoIds.includes(c.id)}
                                  onCheckedChange={() => handleTogglePagoSelection(c.id)}
                                />
                              )}
                            </TableCell>
                          )}
                          <TableCell>{c.numero_parcela}/{c.total_parcelas}</TableCell>
                          <TableCell>{formatDate(c.data_vencimento)}</TableCell>
                          <TableCell>{hasDevolucao ? formatDate((c as any).data_devolucao) : "—"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(valorEfetivo)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(pagoLinha)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(saldoDevedor)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={statusClass}>
                              {statusLabel}
                            </Badge>
                          </TableCell>
                          {canReopenParcelas && pagoClients.length > 0 && (
                            <TableCell className="text-center">
                              {isPago && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  title="Reabrir parcela"
                                  onClick={() => { setSelectedPagoIds([c.id]); setShowReopenParcelasDialog(true); }}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acordo">
          <Card>
            <CardContent className="p-6">
              {agreements.length === 0 ? (
                <p className="text-center text-muted-foreground">Nenhum acordo registrado</p>
              ) : (
                <div className="space-y-6">
                  {agreements.map((agreement: any, index: number) => (
                    <Collapsible
                      key={agreement.id}
                      open={expandedAgreements.has(agreement.id)}
                      onOpenChange={(open) => {
                        setExpandedAgreements(prev => {
                          const newSet = new Set(prev);
                          if (open) newSet.add(agreement.id);
                          else newSet.delete(agreement.id);
                          return newSet;
                        });
                      }}
                      className="border-b border-border pb-6 last:border-0 last:pb-0"
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${expandedAgreements.has(agreement.id) ? 'rotate-180' : ''}`} />
                            <h3 className="font-semibold text-foreground text-left">
                              Acordo — {new Date(agreement.created_at).toLocaleDateString("pt-BR")}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={agreement.status === "pending" ? undefined : (statusVariantMap[agreement.status] || "secondary")}
                              className={agreement.status === "pending" ? "bg-green-50 text-green-700 border border-green-300" : ""}
                            >
                              {statusLabelsMap[agreement.status] || agreement.status}
                            </Badge>
                            {editableStatuses.includes(agreement.status) && (
                              <Button size="sm" variant="ghost" onClick={() => handleEditOpen(agreement)} title="Editar Acordo">
                                <Pencil className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            )}
                            {cancellableStatuses.includes(agreement.status) && (
                              <Button size="sm" variant="ghost" onClick={() => setCancelId(agreement.id)} title="Cancelar Acordo">
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            )}
                            {["cancelled", "completed"].includes(agreement.status) && !hasActiveAgreement && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs gap-1"
                                onClick={() => setReopenId(agreement.id)}
                                title="Reabrir Acordo"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Reabrir
                              </Button>
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Valor Original</p>
                            <p className="text-sm font-semibold">{formatCurrency(Number(agreement.original_total))}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Valor Proposto</p>
                            <p className="text-sm font-semibold">{formatCurrency(getEffectiveAgreementSummary(agreement).effectiveTotal)}</p>
                          </div>
                          {agreement.discount_percent > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Desconto</p>
                              <p className="text-sm font-semibold text-green-600">{agreement.discount_percent}%</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Parcelas</p>
                            <p className="text-sm font-semibold">{getEffectiveAgreementSummary(agreement).label}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">1º Vencimento</p>
                            <p className="text-sm font-semibold">{formatDate(agreement.first_due_date)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Credor</p>
                            <p className="text-sm font-semibold">{formatCredorName(agreement.credor)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Operador / Canal</p>
                            <p className="text-sm font-semibold flex items-center gap-1">
                              <User className="w-3 h-3 text-muted-foreground" />
                              {agreement.creator_name || (agreement.portal_origin ? "Portal" : "—")}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Data do Acordo</p>
                            <p className="text-sm font-semibold">{new Date(agreement.created_at).toLocaleDateString("pt-BR")}</p>
                          </div>
                        </div>

                        {agreement.approval_reason && (
                          <div className="pt-2 border-t border-border">
                            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Motivo da Liberação</p>
                            <p className="text-sm text-orange-600">{agreement.approval_reason}</p>
                          </div>
                        )}
                        {agreement.notes && (
                          <div className="pt-2 border-t border-border">
                            <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Observações</p>
                            <p className="text-sm text-foreground">{agreement.notes}</p>
                          </div>
                        )}

                        {/* Installments for all active statuses */}
                        {installmentStatuses.includes(agreement.status) && (
                          <AgreementInstallments
                            agreementId={agreement.id}
                            agreement={agreement}
                            cpf={cpf || ""}
                            tenantId={tenant?.id}
                            onRefresh={() => { refetch(); refetchAgreements(); }}
                          />
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <ClientTimeline
            dispositions={[]}
            agreements={agreements}
            clientCpf={cpf}
          />
        </TabsContent>

        <TabsContent value="documentos">
          <ClientDocuments
            client={first}
            clients={clients}
            cpf={cpf || ""}
            totalAberto={clients
              .filter((c) => c.status !== "pago")
              .reduce((sum, c) => sum + Math.max(0, (Number(c.valor_parcela) || Number(c.valor_saldo) || 0) - Number(c.valor_pago)), 0)}
            lastAgreement={lastAgreement}
          />
        </TabsContent>

        <TabsContent value="assinatura">
          <ClientSignature client={first} lastAgreement={lastAgreement} />
        </TabsContent>

        <TabsContent value="anexos">
          <ClientAttachments cpf={cpf || ""} />
        </TabsContent>
      </Tabs>

      <Dialog open={showAcordoDialog} onOpenChange={(open) => { setShowAcordoDialog(open); if (!open) setReactivateAgreement(null); }}>
        <DialogContent className="max-w-[95vw] xl:max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{reactivateAgreement ? "Reativar Acordo" : "Formalizar Acordo"}</DialogTitle>
          </DialogHeader>
          <AgreementCalculator
            clients={clients}
            cpf={cpf || ""}
            clientName={first.nome_completo}
            credor={first.credor}
            onAgreementCreated={handleAgreementCreated}
            hasActiveAgreement={hasActiveAgreement}
            reactivateFrom={reactivateAgreement}
          />
        </DialogContent>
      </Dialog>

      {/* Cancel Agreement Dialog */}
      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Acordo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este acordo? Os títulos originais permanecerão em aberto para futuras negociações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelId && handleCancelAgreement(cancelId)}
            >
              Sim, cancelar acordo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reopen Agreement Dialog */}
      <AlertDialog open={!!reopenId} onOpenChange={(open) => !open && setReopenId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir Acordo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja reabrir este acordo? Ele voltará ao status Vigente e os títulos serão marcados como "em acordo". Parcelas já pagas permanecem pagas — se precisar estornar pagamentos, use a opção de reabrir parcela individualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (reopenId) { handleReopenAgreement(reopenId); setReopenId(null); } }}
            >
              Sim, reabrir acordo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reopen Parcelas Dialog */}
      <AlertDialog open={showReopenParcelasDialog} onOpenChange={(open) => !open && setShowReopenParcelasDialog(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir Parcelas Pagas</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja reabrir {selectedPagoIds.length} parcela(s)? O status será atualizado conforme a data de vencimento
              (Vencido ou Pendente) e o valor pago será zerado. O status do cliente será recalculado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopeningParcelas}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReopenParcelas} disabled={reopeningParcelas}>
              {reopeningParcelas ? "Reabrindo..." : "Confirmar Reabertura"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingAgreement} onOpenChange={(open) => !open && setEditingAgreement(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle>Editar Acordo</DialogTitle>
              {editingAgreement && (
                <Badge
                  variant={editingAgreement.status === "pending" ? undefined : (statusVariantMap[editingAgreement.status] || "secondary")}
                  className={editingAgreement.status === "pending" ? "bg-green-50 text-green-700 border border-green-300" : ""}
                >
                  {statusLabelsMap[editingAgreement.status] || editingAgreement.status}
                </Badge>
              )}
            </div>
          </DialogHeader>
          {editingAgreement && (
            <div className="space-y-5">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium">{editingAgreement.client_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">CPF</span>
                  <span className="font-medium">{editingAgreement.client_cpf}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Credor</span>
                  <span className="font-medium">{formatCredorName(editingAgreement.credor)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Valores</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Valor Original</Label>
                    <Input disabled value={`R$ ${editingAgreement.original_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  </div>
                  <div>
                    <Label className="text-xs">Desconto</Label>
                    <Input disabled value={`${editingAgreement.discount_percent ?? 0}%`} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Valor do Acordo</Label>
                  <CurrencyInput value={editForm.proposed_total || 0} onValueChange={handleEditProposed} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                    {editEntradas.length > 1 ? `Entradas (${editEntradas.length})` : "Entrada"}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    Total: R$ {sumEntradas(editEntradas).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {editEntradas.length === 0 ? (
                  <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground text-center">
                    Acordo sem entrada.
                  </div>
                ) : (
                  editEntradas.map((ent, idx) => (
                    <div key={ent.key} className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">
                          {editEntradas.length > 1 ? `Valor da Entrada ${idx + 1}` : "Valor da Entrada"}
                        </Label>
                        <CurrencyInput
                          value={ent.value}
                          onValueChange={(v) => updateEntradaAt(idx, { value: v })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">
                          {editEntradas.length > 1 ? `Data da Entrada ${idx + 1}` : "Data da Entrada"}
                        </Label>
                        <Input
                          type="date"
                          value={ent.date || ""}
                          onChange={(e) => updateEntradaAt(idx, { date: e.target.value })}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Parcelamento</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Nº de Parcelas</Label>
                    <Input type="number" disabled value={editForm.new_installments || 1} className="bg-muted cursor-not-allowed" />
                    <p className="text-[10px] text-muted-foreground mt-1">Para alterar a quantidade de parcelas, cancele o acordo atual e gere um novo.</p>
                  </div>
                  <div>
                    <Label className="text-xs">Valor da Parcela</Label>
                    <Input disabled value={`R$ ${(editForm.new_installment_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">1º Vencimento das Parcelas</Label>
                  <Input type="date" value={editForm.first_due_date || ""} onChange={e => setEditForm({ ...editForm, first_due_date: e.target.value })} />
                </div>
                <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground text-center">
                  {(() => {
                    const liveAgreement = agreements.find((a: any) => a.id === editingAgreement?.id);
                    const summary = getEffectiveAgreementSummary({
                      entrada_value: (editForm as any).entrada_value,
                      new_installments: editForm.new_installments || 1,
                      new_installment_value: editForm.new_installment_value || 0,
                      custom_installment_values: liveAgreement?.custom_installment_values,
                    });
                    return summary.label;
                  })()}
                </div>
              </div>

              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={2} />
              </div>

              <AgreementInstallments agreementId={editingAgreement.id} agreement={agreements.find((a: any) => a.id === editingAgreement.id) || editingAgreement} cpf={cpf || ""} tenantId={tenant?.id} onRefresh={() => { refetch(); refetchAgreements(); }} />

              <Button className="w-full" onClick={handleEditSubmit} disabled={editLoading}>
                {editLoading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDetailPage;
