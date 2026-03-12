import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addMonths, subMonths, isSameDay, isToday, getDate, getDaysInMonth, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Day {
  date: Date;
  isToday: boolean;
  isSelected: boolean;
}

interface GlassCalendarProps extends React.HTMLAttributes<HTMLDivElement> {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  className?: string;
}

const ScrollbarHide = () => (
  <style>{`
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
  `}</style>
);

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

    const monthDays = React.useMemo(() => {
      const start = startOfMonth(currentMonth);
      const totalDays = getDaysInMonth(currentMonth);
      const days: Day[] = [];
      for (let i = 0; i < totalDays; i++) {
        const date = new Date(start.getFullYear(), start.getMonth(), i + 1);
        days.push({
          date,
          isToday: isToday(date),
          isSelected: isSameDay(date, selectedDate),
        });
      }
      return days;
    }, [currentMonth, selectedDate]);

    const handleDateClick = (date: Date) => {
      setSelectedDate(date);
      onDateSelect?.(date);
    };

    return (
      <div
        ref={ref}
        className={cn(
          "w-full max-w-[360px] rounded-2xl p-4 shadow-2xl overflow-hidden",
          "bg-card/95 backdrop-blur-xl border border-border",
          "text-card-foreground font-sans",
          className
        )}
        {...props}
      >
        <ScrollbarHide />
        <div className="mb-4 flex items-center justify-between">
          <motion.p
            key={format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-lg font-bold tracking-tight capitalize"
          >
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </motion.p>
          <div className="flex items-center space-x-1">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 rounded-full text-muted-foreground transition-colors hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 rounded-full text-muted-foreground transition-colors hover:bg-muted">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex space-x-3">
            {monthDays.map((day) => (
              <div key={format(day.date, "yyyy-MM-dd")} className="flex flex-col items-center space-y-1.5 flex-shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  {format(day.date, "EEE", { locale: ptBR }).charAt(0)}
                </span>
                <button
                  onClick={() => handleDateClick(day.date)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200 relative",
                    day.isSelected
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  {day.isToday && !day.isSelected && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary"></span>
                  )}
                  {getDate(day.date)}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
);

GlassCalendar.displayName = "GlassCalendar";
