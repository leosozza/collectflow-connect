import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ScheduledCallback } from "@/hooks/useScheduledCallbacks";
import { Clock } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callbacks: ScheduledCallback[];
  showOperator: boolean;
}

export default function ScheduledCallbacksDialog({ open, onOpenChange, callbacks, showOperator }: Props) {
  const navigate = useNavigate();

  const handleClick = (cb: ScheduledCallback) => {
    const cpf = cb.client_cpf?.replace(/\D/g, "");
    if (cpf) {
      onOpenChange(false);
      navigate(`/carteira/${cpf}`);
    }
  };

  const now = new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Agendados do Dia ({callbacks.length})
          </DialogTitle>
        </DialogHeader>

        {callbacks.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum agendamento para hoje.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Horário</TableHead>
                <TableHead>Cliente</TableHead>
                {showOperator && <TableHead>Operador</TableHead>}
                <TableHead>Tipo</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callbacks.map((cb) => {
                const cbTime = new Date(cb.scheduled_callback);
                const isPast = cbTime < now;
                const isNear = !isPast && cbTime.getTime() - now.getTime() < 5 * 60 * 1000;

                return (
                  <TableRow
                    key={cb.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleClick(cb)}
                  >
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          isPast
                            ? "border-destructive/30 text-destructive"
                            : isNear
                            ? "border-warning/30 text-warning animate-pulse"
                            : "border-border"
                        }
                      >
                        {format(cbTime, "HH:mm")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{cb.client_name}</TableCell>
                    {showOperator && (
                      <TableCell className="text-muted-foreground text-sm">{cb.operator_name || "—"}</TableCell>
                    )}
                    <TableCell className="text-sm text-muted-foreground">{cb.disposition_type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {cb.notes || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
