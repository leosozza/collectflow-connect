import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, HandCoins, EyeOff, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ignoreAlert, type ReconciliationAlert } from "@/services/reconciliationAlertService";
import ManualPaymentDialog from "@/components/acordos/ManualPaymentDialog";
import { manualPaymentService } from "@/services/manualPaymentService";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";

interface ReconciliationAlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: ReconciliationAlert;
  installmentNumber: number;
  installmentKey?: string;
  installmentLabel: string;
  installmentValue: number;
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
  open, onOpenChange, alert, installmentNumber, installmentKey, installmentLabel,
  installmentValue, tenantId, profileId, agreementId, onResolved,
}: ReconciliationAlertModalProps) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [ignoreOpen, setIgnoreOpen] = useState(false);
  const [ignoreNotes, setIgnoreNotes] = useState("");
  const [ignoring, setIgnoring] = useState(false);

  const diff = (alert.maxlist_payment_value || 0) - installmentValue;
  const isAwaiting = alert.status === "pending_admin_approval";

  const handlePaymentSuccess = async () => {
    // Encontrar o último manual_payment criado para essa parcela e linkar ao alerta
    try {
      const { data: lastMp } = await supabase
        .from("manual_payments")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("agreement_id", agreementId)
        .eq("installment_number", installmentNumber)
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
    } catch (e: any) {
      toast({ title: "Aviso", description: "Baixa criada, mas não foi possível vincular ao alerta automaticamente.", variant: "destructive" });
    }
  };

  const handleIgnore = async () => {
    if (!ignoreNotes.trim()) {
      toast({ title: "Informe o motivo", description: "Descreva por que este alerta deve ser ignorado.", variant: "destructive" });
      return;
    }
    setIgnoring(true);
    try {
      await ignoreAlert({ alertId: alert.id, notes: ignoreNotes.trim(), resolvedBy: profileId });
      toast({ title: "Alerta ignorado", description: "Marcado como resolvido sem baixa." });
      qc.invalidateQueries({ queryKey: ["reconciliation-alerts"] });
      onResolved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao ignorar alerta", description: e.message, variant: "destructive" });
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
              Conciliação Pendente — {installmentLabel}
            </DialogTitle>
            <DialogDescription>
              O Maxlist informou um pagamento que pode pertencer a este acordo. Analise e tome a ação adequada.
            </DialogDescription>
          </DialogHeader>

          {isAwaiting && (
            <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-blue-700 flex gap-2 items-start">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Já existe baixa registrada aguardando confirmação do administrador para este alerta.</span>
            </div>
          )}

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 bg-muted/30">
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Maxlist informou</Label>
                <p className="font-semibold">{formatCurrency(alert.maxlist_payment_value)}</p>
                <p className="text-xs text-muted-foreground">em {formatDateBR(alert.maxlist_payment_date)}</p>
              </div>
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Valor da parcela</Label>
                <p className="font-semibold">{formatCurrency(installmentValue)}</p>
                <p className={`text-xs ${Math.abs(diff) < 0.01 ? "text-green-600" : diff > 0 ? "text-blue-600" : "text-orange-600"}`}>
                  {Math.abs(diff) < 0.01
                    ? "Valor exato"
                    : diff > 0
                      ? `Pago R$ ${diff.toFixed(2)} a mais`
                      : `Faltam R$ ${Math.abs(diff).toFixed(2)}`}
                </p>
              </div>
            </div>

            {alert.maxlist_source_meta && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {alert.maxlist_source_meta.cod_contrato && (
                  <div>Contrato Maxlist: <span className="font-mono">{alert.maxlist_source_meta.cod_contrato}</span></div>
                )}
                {alert.maxlist_source_meta.numero_parcela && (
                  <div>Parcela original: <span className="font-mono">{alert.maxlist_source_meta.numero_parcela}</span></div>
                )}
              </div>
            )}

            <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-xs text-orange-700">
              <strong>Como resolver:</strong> ajuste o acordo se necessário, cancele boletos Rivo desta parcela
              e registre a baixa manual abaixo. O administrador receberá o pedido na fila de Confirmação de Pagamento.
            </div>
          </div>

          {!ignoreOpen ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setIgnoreOpen(true)} disabled={isAwaiting}>
                <EyeOff className="w-4 h-4 mr-2" /> Ignorar alerta
              </Button>
              <Button size="sm" onClick={() => setPaymentDialogOpen(true)} disabled={isAwaiting}>
                <HandCoins className="w-4 h-4 mr-2" /> Registrar baixa manual
              </Button>
            </div>
          ) : (
            <div className="space-y-2 pt-2">
              <Label className="text-xs">Motivo para ignorar *</Label>
              <Textarea
                value={ignoreNotes}
                onChange={(e) => setIgnoreNotes(e.target.value)}
                rows={3}
                placeholder="Ex.: pagamento Maxlist se refere a outro contrato; cliente já confirmado por outro canal..."
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setIgnoreOpen(false); setIgnoreNotes(""); }}>
                  Cancelar
                </Button>
                <Button size="sm" variant="destructive" onClick={handleIgnore} disabled={ignoring}>
                  {ignoring && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar ignorar
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
          installmentNumber={installmentNumber}
          installmentKey={installmentKey}
          installmentLabel={installmentLabel}
          installmentValue={alert.maxlist_payment_value || installmentValue}
          tenantId={tenantId}
          profileId={profileId}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
};

export default ReconciliationAlertModal;
