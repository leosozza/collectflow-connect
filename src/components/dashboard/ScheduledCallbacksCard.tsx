import { Link } from "react-router-dom";
import { format, isSameDay } from "date-fns";
import { Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { ScheduledCallback } from "@/hooks/useScheduledCallbacks";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GlassCalendar } from "@/components/ui/glass-calendar";

interface Props {
  callbacks: ScheduledCallback[];
  showOperator: boolean;
  selectedDate: Date;
  onDateChange: (d: Date) => void;
}

export default function ScheduledCallbacksCard({ callbacks, showOperator, selectedDate, onDateChange }: Props) {
  const now = new Date();
  const isToday = isSameDay(selectedDate, now);

  const abbreviate = (s?: string) =>
    (s || "").trim().split(/\s+/).slice(0, 2).join(" ");

  const navigate = (dir: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir);
    onDateChange(d);
  };

  const dateLabel = isToday ? "HOJE" : format(selectedDate, "dd/MM/yyyy");

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm w-full">
      <div className="px-4 pt-3 pb-2 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-card-foreground">Agendados</h2>
          </div>
          <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md bg-primary text-primary-foreground text-xs font-bold">
            {callbacks.length}
          </span>
        </div>

        <div className="flex items-center gap-1 justify-center">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-sm font-semibold text-primary min-w-[110px] text-center px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer">
                {dateLabel}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-0 bg-transparent shadow-none z-50" align="center" side="bottom" sideOffset={8}>
              <GlassCalendar
                selectedDate={selectedDate}
                onDateSelect={(date) => onDateChange(date)}
              />
            </PopoverContent>
          </Popover>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {callbacks.length === 0 ? (
        <div className="p-5 text-center text-muted-foreground text-xs">
          Nenhum agendamento para esta data
        </div>
      ) : (
        <div className="overflow-auto max-h-[420px]">
          <Table>
            <TableBody>
              {callbacks.map((cb) => {
                const cbTime = new Date(cb.scheduled_callback);
                const isPast = isToday && cbTime < now;
                const isNear = isToday && !isPast && cbTime.getTime() - now.getTime() < 5 * 60 * 1000;
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
