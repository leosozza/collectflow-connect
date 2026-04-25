import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { manualPaymentService, ManualPaymentWithDetails } from "@/services/manualPaymentService";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatCredorName } from "@/lib/formatters";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Loader2, HandCoins, Pencil } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface PaymentConfirmationTabProps {
  tenantId: string;
}

const PAYMENT_METHODS = ["PIX", "Boleto", "Cartão", "Dinheiro", "Transferência", "Outro"];
const RECEIVERS = ["CREDOR", "COBRADORA"];

const PaymentConfirmationTab = ({ tenantId }: PaymentConfirmationTabProps) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<ManualPaymentWithDetails | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [editDialog, setEditDialog] = useState<ManualPaymentWithDetails | null>(null);
  const [editForm, setEditForm] = useState({ amount_paid: 0, payment_date: "", payment_method: "", receiver: "", notes: "" });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["manual-payments-pending", tenantId],
    queryFn: () => manualPaymentService.fetchPending(tenantId),
    enabled: !!tenantId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["manual-payments-pending", tenantId] });
  };

  const openEditDialog = (p: ManualPaymentWithDetails) => {
    setEditForm({
      amount_paid: p.amount_paid,
      payment_date: p.payment_date,
      payment_method: p.payment_method,
      receiver: p.receiver,
      notes: p.notes || "",
    });
    setEditDialog(p);
  };

  const handleEdit = async () => {
    if (!editDialog) return;
    setProcessingId(editDialog.id);
    try {
      // 1. Fetch current payment row to capture oldAmount + status
      const { data: currentRow, error: fetchErr } = await supabase
        .from("manual_payments" as any)
        .select("*")
        .eq("id", editDialog.id)
        .single();
      if (fetchErr) throw fetchErr;
      const current = currentRow as any;
      const oldAmount = Number(current.amount_paid || 0);
      const newAmount = Number(editForm.amount_paid || 0);
      const wasConfirmed = current.status === "confirmed";

      // 2. Update the manual_payments row
      const { error } = await supabase
        .from("manual_payments" as any)
        .update({
          amount_paid: newAmount,
          payment_date: editForm.payment_date,
          payment_method: editForm.payment_method,
          receiver: editForm.receiver,
          notes: editForm.notes || null,
        })
        .eq("id", editDialog.id);
      if (error) throw error;

      // 3. If already confirmed → propagate delta to wallet + agreement status
      if (wasConfirmed) {
        const delta = newAmount - oldAmount;
        const { registerAgreementPayment, reverseAgreementPayment, syncInstallmentValueFromPayment } = await import("@/services/agreementService");
        const agr = editDialog.agreement;
        if (agr && Math.abs(delta) > 0.001) {
          if (delta > 0) {
            await registerAgreementPayment(agr.client_cpf, agr.credor, delta);
          } else {
            await reverseAgreementPayment(agr.client_cpf, agr.credor, Math.abs(delta));
          }
        }

        // 3b. Sync installment scheduled value to match new paid amount
        if (agr) {
          try {
            const sync = await syncInstallmentValueFromPayment(
              current.agreement_id,
              current.installment_key,
              current.installment_number,
              newAmount,
            );
            if (sync.synced) {
              await supabase.from("client_events").insert({
                tenant_id: tenantId,
                client_cpf: agr.client_cpf,
                event_type: "installment_value_synced",
                event_source: "admin",
                event_value: "edit",
                metadata: {
                  manual_payment_id: editDialog.id,
                  agreement_id: current.agreement_id,
                  installment_key: sync.resolvedKey,
                  old_value: sync.oldValue,
                  new_value: sync.newValue,
                  edited_by: profile?.id,
                },
              } as any);
            }
          } catch (e) {
            console.warn("[PaymentConfirmationTab] sync installment value failed", e);
          }
        }

        // 4. Recalculate consolidated total and sync agreement/client status
        if (agr) {
          const agreementId = current.agreement_id as string;
          const [{ data: agreementRow }, { data: mps }, { data: cobs }] = await Promise.all([
            supabase.from("agreements").select("id, proposed_total, status, client_cpf, credor, tenant_id").eq("id", agreementId).single(),
            supabase.from("manual_payments" as any).select("amount_paid").eq("agreement_id", agreementId).eq("status", "confirmed"),
            supabase.from("negociarie_cobrancas" as any).select("valor_pago").eq("agreement_id", agreementId).eq("status", "pago"),
          ]);

          const manualTotal = ((mps as any[]) || []).reduce((s, p) => s + Number(p.amount_paid || 0), 0);
          const cobrancaTotal = ((cobs as any[]) || []).reduce((s, c) => s + Number(c.valor_pago || 0), 0);
          const totalPaid = manualTotal + cobrancaTotal;
          const ag = agreementRow as any;

          if (ag && ag.proposed_total > 0) {
            const isFullyPaid = totalPaid >= ag.proposed_total - 0.01;
            if (isFullyPaid && ag.status !== "completed") {
              await supabase.from("agreements").update({ status: "completed" } as any).eq("id", agreementId);
              await supabase
                .from("clients")
                .update({ status: "pago" } as any)
                .eq("cpf", ag.client_cpf)
                .eq("credor", ag.credor)
                .eq("status", "em_acordo");
            } else if (!isFullyPaid && ag.status === "completed") {
              await supabase.from("agreements").update({ status: "pending" } as any).eq("id", agreementId);
              await supabase
                .from("clients")
                .update({ status: "em_acordo" } as any)
                .eq("cpf", ag.client_cpf)
                .eq("credor", ag.credor)
                .eq("status", "pago");
            }
          }

          // 5. Audit event
          try {
            await supabase.from("client_events").insert({
              tenant_id: ag?.tenant_id || tenantId,
              client_cpf: agr.client_cpf,
              event_type: "manual_payment_edited",
              event_source: "admin",
              event_value: "edited",
              metadata: {
                manual_payment_id: editDialog.id,
                agreement_id: agreementId,
                old_amount: oldAmount,
                new_amount: newAmount,
                delta,
                edited_by: profile?.id,
              },
            } as any);
          } catch {}
        }
      }

      // Invalidate detail queries so the agreement detail UI refreshes
      if (editDialog.agreement?.client_cpf) {
        queryClient.invalidateQueries({ queryKey: ["client-agreements", editDialog.agreement.client_cpf] });
        queryClient.invalidateQueries({ queryKey: ["agreement-cobrancas"] });
      }

      toast({ title: "Dados da parcela atualizados!", description: wasConfirmed ? "Carteira e acordo sincronizados." : undefined });
      setEditDialog(null);
      refresh();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirm = async (payment: ManualPaymentWithDetails) => {
    if (!profile) return;
    setProcessingId(payment.id);
    try {
      await manualPaymentService.confirm(payment.id, profile.id);

      // After confirm: sync the scheduled installment value if it diverges
      try {
        const { syncInstallmentValueFromPayment } = await import("@/services/agreementService");
        const sync = await syncInstallmentValueFromPayment(
          (payment as any).agreement_id,
          (payment as any).installment_key,
          payment.installment_number,
          Number(payment.amount_paid || 0),
        );
        if (sync.synced && payment.agreement?.client_cpf) {
          await supabase.from("client_events").insert({
            tenant_id: tenantId,
            client_cpf: payment.agreement.client_cpf,
            event_type: "installment_value_synced",
            event_source: "admin",
            event_value: "confirm",
            metadata: {
              manual_payment_id: payment.id,
              agreement_id: (payment as any).agreement_id,
              installment_key: sync.resolvedKey,
              old_value: sync.oldValue,
              new_value: sync.newValue,
              confirmed_by: profile?.id,
            },
          } as any);
        }
      } catch (e) {
        console.warn("[PaymentConfirmationTab] sync on confirm failed", e);
      }

      if (payment.agreement?.client_cpf) {
        queryClient.invalidateQueries({ queryKey: ["client-agreements", payment.agreement.client_cpf] });
        queryClient.invalidateQueries({ queryKey: ["agreement-cobrancas"] });
      }

      toast({ title: "Pagamento confirmado!", description: "A baixa foi efetivada com sucesso." });
      refresh();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog || !profile || !rejectNotes.trim()) return;
    setProcessingId(rejectDialog.id);
    try {
      await manualPaymentService.reject(rejectDialog.id, profile.id, rejectNotes.trim());
      toast({ title: "Pagamento recusado." });
      setRejectDialog(null);
      setRejectNotes("");
      refresh();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const getInstallmentLabel = (p: ManualPaymentWithDetails) => {
    const key = (p as any).installment_key as string | null | undefined;
    // Multi-entrada via installment_key (entrada, entrada_2, entrada_3, ...)
    if (key && key.startsWith("entrada")) {
      const idx = key === "entrada" ? 1 : parseInt(key.replace("entrada_", "")) || 1;
      return `Entrada ${idx}`;
    }
    if (p.installment_number === 0) return "Entrada";
    const total = p.agreement
      ? (p.agreement.entrada_value && p.agreement.entrada_value > 0 ? 1 : 0) + p.agreement.new_installments
      : 0;
    return total > 0 ? `${p.installment_number}/${total}` : String(p.installment_number);
  };

  if (isLoading) {
    return <p className="text-muted-foreground text-center py-8">Carregando...</p>;
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <HandCoins className="w-10 h-10 mx-auto text-muted-foreground/40" />
        <p className="text-muted-foreground">Nenhuma baixa manual pendente de confirmação.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Credor</TableHead>
              <TableHead className="text-center">Parcela</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Data Pgto</TableHead>
              <TableHead>Meio</TableHead>
              <TableHead>Recebedor</TableHead>
              <TableHead>Operador</TableHead>
              <TableHead>Solicitado em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {p.agreement?.client_cpf ? (
                    <Link
                      to={`/carteira/${p.agreement.client_cpf.replace(/\D/g, "")}?tab=acordo`}
                      className="font-medium text-primary hover:underline"
                    >
                      {p.agreement?.client_name || "—"}
                    </Link>
                  ) : (
                    <span className="font-medium">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{formatCredorName(p.agreement?.credor)}</TableCell>
                <TableCell className="text-center text-sm">{getInstallmentLabel(p)}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(p.amount_paid)}</TableCell>
                <TableCell className="text-sm">{format(new Date(p.payment_date + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{p.payment_method}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={p.receiver === "CREDOR" ? "default" : "secondary"} className="text-[10px]">
                    {p.receiver}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{p.requester?.full_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(p.created_at), "dd/MM/yyyy HH:mm")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(p)}
                      disabled={processingId === p.id}
                      title="Editar informações da parcela"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleConfirm(p)}
                      disabled={processingId === p.id}
                      title="Confirmar pagamento"
                    >
                      {processingId === p.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setRejectDialog(p); setRejectNotes(""); }}
                      disabled={processingId === p.id}
                      title="Recusar pagamento"
                    >
                      <XCircle className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Informações da Parcela</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {editDialog?.agreement?.client_name} — Parcela {editDialog ? getInstallmentLabel(editDialog) : ""}
            </p>

            <div className="space-y-2">
              <Label>Valor Pago</Label>
              <CurrencyInput
                value={editForm.amount_paid}
                onValueChange={(v) => setEditForm(f => ({ ...f, amount_paid: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={editForm.payment_date}
                onChange={(e) => setEditForm(f => ({ ...f, payment_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Meio de Pagamento</Label>
              <Select value={editForm.payment_method} onValueChange={(v) => setEditForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Recebedor</Label>
              <Select value={editForm.receiver} onValueChange={(v) => setEditForm(f => ({ ...f, receiver: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECEIVERS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Observações opcionais..."
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditDialog(null)}>Cancelar</Button>
              <Button
                onClick={handleEdit}
                disabled={!editForm.amount_paid || !editForm.payment_date || processingId === editDialog?.id}
              >
                {processingId === editDialog?.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar Baixa Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe o motivo da recusa para {rejectDialog?.agreement?.client_name}.
            </p>
            <Textarea
              value={rejectNotes}
              onChange={e => setRejectNotes(e.target.value)}
              placeholder="Motivo da recusa..."
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectNotes.trim() || processingId === rejectDialog?.id}
              >
                {processingId === rejectDialog?.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Recusar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PaymentConfirmationTab;
