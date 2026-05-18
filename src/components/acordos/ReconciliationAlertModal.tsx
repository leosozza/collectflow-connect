import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, HandCoins, CheckCheck, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ignoreAlert, type ReconciliationAlert } from "@/services/reconciliationAlertService";
import ManualPaymentDialog from "@/components/acordos/ManualPaymentDialog";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";

interface ReconciliationAlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: ReconciliationAlert;
  tenantId: string;
  profileId: string;
  agreementId: string;
  onResolved: () => void;
}

const formatDateBR = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch { return iso; }
};

const ReconciliationAlertModal = ({
  open, onOpenChange, alert, tenantId, profileId, agreementId, onResolved,
}: ReconciliationAlertModalProps) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [ignoreOpen, setIgnoreOpen] = useState(false);
  const [ignoreNotes, setIgnoreNotes] = useState("Já reconhecido neste acordo.");
  const [ignoring, setIgnoring] = useState(false);

  const isAwaiting = alert.status === "pending_admin_approval";

  const handlePaymentSuccess = async () => {
    try {
      const { data: lastMp } = await supabase
        .from("manual_payments")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("agreement_id", agreementId)
        .eq("status", "pending_confirmation")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastMp?.id) {
        await supabase
          .from("manual_payments")
          .update({ reconciliation_alert_id: alert.id })
          .eq("id", lastMp.id);

        await supabase
          .from("agreement_reconciliation_alerts")
          .update({
            status: "pending_admin_approval",
            linked_manual_payment_id: lastMp.id,
            assigned_operator_id: profileId,
            resolution_notes: `Baixa registrada via alerta Maxlist (R$ ${alert.maxlist_payment_value.toFixed(2)} em ${formatDateBR(alert.maxlist_payment_date)}).`,
          })
          .eq("id", alert.id);
      }

      toast({
        title: "Baixa enviada para confirmação",
        description: "O administrador receberá o pedido na fila de Confirmação de Pagamento.",
      });
      qc.invalidateQueries({ queryKey: ["reconciliation-alerts"] });
      onResolved();
      onOpenChange(false);
    } catch {
      toast({ title: "Aviso", description: "Baixa criada, mas não foi possível vincular ao alerta automaticamente.", variant: "destructive" });
    }
  };

  const handleIgnore = async () => {
    if (!ignoreNotes.trim()) {
      toast({ title: "Informe uma observação", description: "Descreva por que este aviso já está reconhecido.", variant: "destructive" });
      return;
    }
    setIgnoring(true);
    try {
      await ignoreAlert({ alertId: alert.id, notes: ignoreNotes.trim(), resolvedBy: profileId });
      toast({ title: "Aviso resolvido", description: "Marcado como já reconhecido neste acordo." });
      qc.invalidateQueries({ queryKey: ["reconciliation-alerts"] });
      onResolved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao resolver aviso", description: e.message, variant: "destructive" });
    } finally {
      setIgnoring(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Pagamento detectado no Maxsystem
            </DialogTitle>
            <DialogDescription>
              O Maxsystem registrou a liquidação de um boleto original do cliente. Verifique se ele já consta neste acordo.
            </DialogDescription>
          </DialogHeader>

          {isAwaiting && (
            <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-700 flex gap-2 items-start">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Já existe baixa registrada aguardando confirmação do administrador para este aviso.</span>
            </div>
          )}

          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-border p-3 bg-muted/30 space-y-1">
              <div className="flex justify-between">
                <Label className="text-[10px] uppercase text-muted-foreground">Valor pago</Label>
                <span className="font-semibold">{formatCurrency(alert.maxlist_payment_value)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Data</span>
                <span>{formatDateBR(alert.maxlist_payment_date)}</span>
              </div>
              {alert.maxlist_source_meta?.cod_contrato && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Contrato Maxlist</span>
                  <span className="font-mono">{alert.maxlist_source_meta.cod_contrato}</span>
                </div>
              )}
              {alert.maxlist_source_meta?.numero_parcela && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Parcela original</span>
                  <span className="font-mono">{alert.maxlist_source_meta.numero_parcela}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Credor</span>
                <span>{alert.credor}</span>
              </div>
            </div>

            <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-xs text-orange-700">
              Este pagamento <strong>não</strong> está vinculado a uma parcela específica deste acordo.
              Se ele já foi recebido aqui (via Negociarie, portal ou baixa manual), marque como reconhecido.
              Caso seja um pagamento novo a ser creditado neste acordo, registre a baixa manual.
            </div>
          </div>

          {!ignoreOpen ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setIgnoreOpen(true)} disabled={isAwaiting}>
                <CheckCheck className="w-4 h-4 mr-2" /> Já reconhecido neste acordo
              </Button>
              <Button size="sm" onClick={() => setPaymentDialogOpen(true)} disabled={isAwaiting}>
                <HandCoins className="w-4 h-4 mr-2" /> Registrar baixa manual
              </Button>
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              <Label className="text-xs">Observação *</Label>
              <Textarea
                value={ignoreNotes}
                onChange={(e) => setIgnoreNotes(e.target.value)}
                rows={3}
                placeholder="Ex.: pagamento já recebido via Negociarie; cliente confirmou; etc."
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setIgnoreOpen(false); }}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleIgnore} disabled={ignoring}>
                  {ignoring && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {paymentDialogOpen && (
        <ManualPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          agreementId={agreementId}
          installmentNumber={0}
          installmentLabel="Pagamento do Maxsystem"
          installmentValue={alert.maxlist_payment_value || 0}
          tenantId={tenantId}
          profileId={profileId}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
};

export default ReconciliationAlertModal;
