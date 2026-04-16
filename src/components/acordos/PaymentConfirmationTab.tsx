import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { manualPaymentService, ManualPaymentWithDetails } from "@/services/manualPaymentService";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
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
import { useNavigate } from "react-router-dom";
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
      const { error } = await supabase
        .from("manual_payments" as any)
        .update({
          amount_paid: editForm.amount_paid,
          payment_date: editForm.payment_date,
          payment_method: editForm.payment_method,
          receiver: editForm.receiver,
          notes: editForm.notes || null,
        })
        .eq("id", editDialog.id);

      if (error) throw error;
      toast({ title: "Dados da parcela atualizados!" });
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
              <TableHead>CPF</TableHead>
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
                  <span
                    className="font-medium cursor-pointer text-primary hover:underline"
                    onClick={() => {
                      const cpf = p.agreement?.client_cpf?.replace(/\D/g, "");
                      if (cpf) navigate(`/carteira/${cpf}?tab=acordo`);
                    }}
                  >
                    {p.agreement?.client_name || "—"}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{p.agreement?.client_cpf || "—"}</TableCell>
                <TableCell className="text-sm">{p.agreement?.credor || "—"}</TableCell>
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
