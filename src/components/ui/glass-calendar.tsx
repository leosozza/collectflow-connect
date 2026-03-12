import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, isSameDay, isToday, getDate, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCalendarProps extends React.HTMLAttributes<HTMLDivElement> {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  className?: string;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const GlassCalendar = React.forwardRef<HTMLDivElement, GlassCalendarProps>(
  ({ className, selectedDate: propSelectedDate, onDateSelect, ...props }, ref) => {
    const [currentMonth, setCurrentMonth] = React.useState(propSelectedDate || new Date());
    const [selectedDate, setSelectedDate] = React.useState(propSelectedDate || new Date());

    React.useEffect(() => {
      if (propSelectedDate) {
        setSelectedDate(propSelectedDate);
        setCurrentMonth(propSelectedDate);
      }
    }, [propSelectedDate]);

    const calendarCells = React.useMemo(() => {
      const start = startOfMonth(currentMonth);
      const totalDays = getDaysInMonth(currentMonth);
      const startDow = getDay(start); // 0=Sun
      const cells: (Date | null)[] = [];
      for (let i = 0; i < startDow; i++) cells.push(null);
      for (let i = 1; i <= totalDays; i++) {
        cells.push(new Date(start.getFullYear(), start.getMonth(), i));
      }
      return cells;
    }, [currentMonth]);

    const handleDateClick = (date: Date) => {
      setSelectedDate(date);
      onDateSelect?.(date);
    };

    return (
      <div
        ref={ref}
        className={cn(
          "w-[320px] rounded-2xl p-4 shadow-2xl",
          "bg-card border border-border",
          "text-card-foreground font-sans pointer-events-auto",
          className
        )}
        {...props}
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded-full text-muted-foreground transition-colors hover:bg-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <motion.span
            key={format(currentMonth, "yyyy-MM")}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="text-sm font-bold capitalize"
          >
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </motion.span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded-full text-muted-foreground transition-colors hover:bg-muted">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d) => (
            <span key={d} className="text-[10px] font-semibold text-muted-foreground text-center">
              {d}
            </span>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((date, idx) => (
            <div key={idx} className="flex items-center justify-center">
              {date ? (
                <button
                  onClick={() => handleDateClick(date)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all duration-150 relative",
                    isSameDay(date, selectedDate)
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  {isToday(date) && !isSameDay(date, selectedDate) && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
                  )}
                  {getDate(date)}
                </button>
              ) : (
                <span className="h-8 w-8" />
              )}
            </div>
          ))}
        </div>

        {/* Today shortcut */}
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => handleDateClick(new Date())}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Hoje
          </button>
        </div>
      </div>
    );
  }
);

GlassCalendar.displayName = "GlassCalendar";
