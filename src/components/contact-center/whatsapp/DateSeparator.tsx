import { isToday, isYesterday, differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DateSeparatorProps {
  date: Date;
}

const labelFor = (date: Date): string => {
  if (isToday(date)) return "Hoje";
  if (isYesterday(date)) return "Ontem";
  const diff = Math.abs(differenceInCalendarDays(new Date(), date));
  if (diff < 7) {
    // dia da semana, ex.: "quarta-feira"
    return format(date, "EEEE", { locale: ptBR });
  }
  return format(date, "dd/MM/yyyy", { locale: ptBR });
};

const DateSeparator = ({ date }: DateSeparatorProps) => {
  const label = labelFor(date);
  return (
    <div className="flex justify-center my-3 select-none">
      <span className="px-3 py-1 rounded-full bg-muted/70 backdrop-blur-sm border border-border/50 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
};

export default DateSeparator;
