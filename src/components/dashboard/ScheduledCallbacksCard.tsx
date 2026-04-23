import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Clock } from "lucide-react";
import { ScheduledCallback } from "@/hooks/useScheduledCallbacks";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

interface Props {
  callbacks: ScheduledCallback[];
  showOperator: boolean;
}

export default function ScheduledCallbacksCard({ callbacks, showOperator }: Props) {
  const now = new Date();

  const abbreviate = (s?: string) =>
    (s || "").trim().split(/\s+/).slice(0, 2).join(" ");

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm w-full">
      <div className="px-4 pt-3 pb-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-card-foreground">Agendamentos para Hoje</h2>
        </div>
        <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md bg-primary text-primary-foreground text-xs font-bold">
          {callbacks.length}
        </span>
      </div>

      {callbacks.length === 0 ? (
        <div className="p-5 text-center text-muted-foreground text-xs">
          Nenhum agendamento para hoje
        </div>
      ) : (
        <div className="overflow-auto max-h-[420px]">
          <Table>
            <TableBody>
              {callbacks.map((cb) => {
                const cbTime = new Date(cb.scheduled_callback);
                const isPast = cbTime < now;
                const isNear = !isPast && cbTime.getTime() - now.getTime() < 5 * 60 * 1000;
                const cpf = cb.client_cpf?.replace(/\D/g, "") || "";

                return (
                  <TableRow key={cb.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-xs font-medium py-2">
                      {cpf ? (
                        <Link to={`/carteira/${encodeURIComponent(cpf)}`} className="text-primary hover:underline">
                          {cb.client_name}
                        </Link>
                      ) : (
                        <span>{cb.client_name}</span>
                      )}
                      {showOperator && cb.operator_name && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">{cb.operator_name}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-2">
                      {abbreviate(cb.client_credor)}
                    </TableCell>
                    <TableCell className="text-xs text-right py-2 whitespace-nowrap">
                      <div className="text-muted-foreground">{format(cbTime, "dd/MM")}</div>
                      <div
                        className={
                          "font-semibold " +
                          (isPast
                            ? "text-destructive"
                            : isNear
                            ? "text-warning animate-pulse"
                            : "text-foreground")
                        }
                      >
                        {format(cbTime, "HH:mm")}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
