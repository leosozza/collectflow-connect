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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Loader2, HandCoins } from "lucide-react";

interface PaymentConfirmationTabProps {
  tenantId: string;
}

const PaymentConfirmationTab = ({ tenantId }: PaymentConfirmationTabProps) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<ManualPaymentWithDetails | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["manual-payments-pending", tenantId],
    queryFn: () => manualPaymentService.fetchPending(tenantId),
    enabled: !!tenantId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["manual-payments-pending", tenantId] });
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
                <TableCell className="font-medium">{p.agreement?.client_name || "—"}</TableCell>
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
