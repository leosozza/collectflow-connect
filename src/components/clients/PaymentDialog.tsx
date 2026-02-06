import { useState } from "react";
import { Client } from "@/services/clientService";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface PaymentDialogProps {
  client: Client | null;
  onClose: () => void;
  onConfirm: (valor: number) => void;
  submitting: boolean;
}

const PaymentDialog = ({ client, onClose, onConfirm, submitting }: PaymentDialogProps) => {
  const [valor, setValor] = useState("");

  const handleOpen = () => {
    if (client) {
      setValor(client.valor_parcela.toString());
    }
  };

  if (!client) return null;

  return (
    <Dialog open={!!client} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm" onOpenAutoFocus={handleOpen}>
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="font-medium text-card-foreground">{client.nome_completo}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Valor da Parcela</p>
            <p className="font-medium text-card-foreground">{formatCurrency(Number(client.valor_parcela))}</p>
          </div>
          <div className="space-y-2">
            <Label>Valor Pago (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
            {parseFloat(valor) > 0 && parseFloat(valor) < Number(client.valor_parcela) && (
              <p className="text-xs text-destructive">
                Quebra: {formatCurrency(Number(client.valor_parcela) - parseFloat(valor))}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(parseFloat(valor) || 0)}
            disabled={submitting || !parseFloat(valor)}
          >
            {submitting ? "Registrando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;
