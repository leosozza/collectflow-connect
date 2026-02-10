import { useState } from "react";
import { Client } from "@/services/clientService";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
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
  onConfirm: (valor: number, dataRecebimento: string) => void;
  submitting: boolean;
}

const PaymentDialog = ({ client, onClose, onConfirm, submitting }: PaymentDialogProps) => {
  const [valor, setValor] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState<Date>(new Date());

  const handleOpen = () => {
    if (client) {
      setValor(client.valor_parcela.toString());
      setDataRecebimento(new Date());
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
          <div className="space-y-2">
            <Label>Data de Recebimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataRecebimento && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataRecebimento
                    ? format(dataRecebimento, "dd/MM/yyyy", { locale: ptBR })
                    : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataRecebimento}
                  onSelect={(d) => d && setDataRecebimento(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onConfirm(
                parseFloat(valor) || 0,
                format(dataRecebimento, "yyyy-MM-dd")
              )
            }
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
