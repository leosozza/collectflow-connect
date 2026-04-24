import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableRow, TableHead, TableHeader } from "@/components/ui/table";
import type { ScheduledCallback } from "@/hooks/useScheduledCallbacks";

interface Props {
  callbacks: ScheduledCallback[];
  showOperator?: boolean;
}

export default function AgendamentosHojeCard({ callbacks, showOperator }: Props) {
  return (
    <div className="bg-card rounded-xl border border-border/60 shadow-sm w-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Agendamentos para Hoje</h2>
        </div>
        <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-bold">
          {callbacks.length}
        </span>
      </div>

      {callbacks.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
          Nenhum agendamento para hoje
        </div>
      ) : (
        <div className="overflow-auto max-h-[160px]">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/60 hover:bg-transparent">
                <TableHead className="h-8 px-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Nome do Cliente
                </TableHead>
                <TableHead className="h-8 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Data
                </TableHead>
                <TableHead className="h-8 px-4 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Horário
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callbacks.slice(0, 8).map((cb) => {
                const cbTime = new Date(cb.scheduled_callback);
                const cpf = cb.client_cpf?.replace(/\D/g, "") || "";
                return (
                  <TableRow key={cb.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="py-2 px-4 text-xs font-medium">
                      {cpf ? (
                        <Link
                          to={`/carteira/${encodeURIComponent(cpf)}`}
                          className="text-primary hover:underline"
                        >
                          {cb.client_name}
                        </Link>
                      ) : (
                        <span>{cb.client_name}</span>
                      )}
                      {showOperator && cb.operator_name && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {cb.operator_name}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-2 text-xs text-muted-foreground tabular-nums">
                      {format(cbTime, "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="py-2 px-4 text-xs text-right font-semibold tabular-nums">
                      {format(cbTime, "HH:mm")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="px-4 py-2 border-t border-border/40">
        <Link to="/atendimento" className="text-xs text-primary hover:underline font-medium">
          Ver todos
        </Link>
      </div>
    </div>
  );
}
