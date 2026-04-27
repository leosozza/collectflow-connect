import { Link } from "react-router-dom";
import { format } from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GlassCalendar } from "@/components/ui/glass-calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";

export interface VencimentoRow {
  agreement_id: string;
  client_cpf: string;
  client_name: string;
  credor: string;
  numero_parcela: number;
  valor_parcela: number;
  agreement_status: string;
  effective_status?: string;
}

interface Props {
  vencimentos: VencimentoRow[];
  browseDate: Date;
  onNavigateDate: (dir: number) => void;
  onPickDate: (d: Date) => void;
}

export default function ParcelasProgramadasCard({
  vencimentos,
  browseDate,
  onNavigateDate,
  onPickDate,
}: Props) {
  const isToday = format(browseDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm w-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Parcelas Programadas</h2>
          </div>
        </div>
      </div>

      {/* Banner data + total + contadores */}
      {(() => {
        const pagas = vencimentos.filter((v) => v.effective_status === "paid").length;
        const andamento = vencimentos.filter(
          (v) => v.effective_status !== "paid" && v.effective_status !== "overdue"
        ).length;
        const totalDia = vencimentos.reduce(
          (acc, v) => acc + Number(v.valor_parcela || 0),
          0,
        );
        return (
          <div className="px-3 pb-3 shrink-0 flex items-center gap-2 relative">
            <div className="inline-flex items-center bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg px-1 py-1 gap-0.5">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-white hover:bg-white/20 hover:text-white"
                onClick={() => onNavigateDate(-1)}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-xs font-bold text-white tracking-wide text-center px-2 py-0.5 cursor-pointer min-w-[88px]">
                    {isToday ? "HOJE" : format(browseDate, "dd/MM/yyyy")}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 border-0 bg-transparent shadow-none z-50"
                  align="center"
                  side="bottom"
                  sideOffset={8}
                >
                  <GlassCalendar selectedDate={browseDate} onDateSelect={onPickDate} />
                </PopoverContent>
              </Popover>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-white hover:bg-white/20 hover:text-white"
                onClick={() => onNavigateDate(1)}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Valor total a receber no dia */}
            <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex flex-col items-center leading-tight pointer-events-none">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                A receber
              </span>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {formatCurrency(totalDia)}
              </span>
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {/* Quadradinho: Andamento */}
              <div
                className="flex items-center justify-center h-8 min-w-[32px] px-2 rounded-md bg-blue-500/15 text-blue-600 text-xs font-bold tabular-nums"
                title={`${andamento} em andamento`}
              >
                {andamento}
              </div>

              {/* Quadradinho: Pagas */}
              <div
                className="flex items-center justify-center h-8 min-w-[32px] px-2 rounded-md bg-success text-success-foreground text-xs font-bold tabular-nums"
                title={`${pagas} pagas`}
              >
                {pagas}
              </div>
            </div>
          </div>
        );
      })()}

      {vencimentos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-5 py-10 text-muted-foreground">
          <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
            <CalendarClock className="w-5 h-5 text-muted-foreground/70" />
          </div>
          <p className="text-xs font-medium">Nenhum vencimento</p>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">para esta data</p>
        </div>
      ) : (
        <div className="overflow-auto max-h-[420px]">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Nome
                </TableHead>
                <TableHead className="h-9 px-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Credor
                </TableHead>
                <TableHead className="h-9 px-4 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Valor
                </TableHead>
                <TableHead className="h-9 px-4 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vencimentos.map((v, idx) => {
                const credorShort = (v.credor || "").trim().split(/\s+/).slice(0, 2).join(" ");
                const status = v.effective_status;
                const statusLabel =
                  status === "paid" ? "QUITADO" : status === "overdue" ? "ATRASADO" : "ANDAMENTO";
                const statusClass =
                  status === "paid"
                    ? "bg-success/15 text-success"
                    : status === "overdue"
                      ? "bg-destructive/15 text-destructive"
                      : "bg-blue-500/15 text-blue-600";
                return (
                  <TableRow
                    key={`${v.agreement_id}-${v.numero_parcela}-${idx}`}
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="py-2.5 px-4 text-sm font-medium">
                      <Link
                        to={`/carteira/${encodeURIComponent(v.client_cpf.replace(/\D/g, ""))}`}
                        className="text-primary hover:underline underline-offset-2"
                      >
                        {v.client_name}
                      </Link>
                    </TableCell>
                    <TableCell className="py-2.5 px-4 text-sm text-muted-foreground">
                      {credorShort}
                    </TableCell>
                    <TableCell className="py-2.5 px-4 text-sm text-right text-foreground tabular-nums">
                      {formatCurrency(Number(v.valor_parcela))}
                    </TableCell>
                    <TableCell className="py-2.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-[96px] rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
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
