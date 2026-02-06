import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { FilterMode } from "@/pages/CarteiraPage";

interface CarteiraFiltersProps {
  mode: FilterMode;
  onModeChange: (mode: FilterMode) => void;
  referenceDate: Date;
  onDateChange: (date: Date) => void;
}

const CarteiraFilters = ({ mode, onModeChange, referenceDate, onDateChange }: CarteiraFiltersProps) => {
  const modes: { value: FilterMode; label: string; icon: React.ElementType }[] = [
    { value: "dia", label: "Dia", icon: Calendar },
    { value: "semana", label: "Semana", icon: CalendarDays },
    { value: "mes", label: "Mês", icon: CalendarRange },
  ];

  const formattedDate = format(referenceDate, "yyyy-MM-dd");

  const periodLabel = (() => {
    switch (mode) {
      case "dia":
        return format(referenceDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      case "semana":
        return `Semana de ${format(referenceDate, "dd/MM", { locale: ptBR })}`;
      case "mes":
        return format(referenceDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  })();

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex gap-1">
          {modes.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={mode === value ? "default" : "outline"}
              size="sm"
              onClick={() => onModeChange(value)}
              className="gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Button>
          ))}
        </div>

        <Input
          type="date"
          value={formattedDate}
          onChange={(e) => {
            if (e.target.value) {
              onDateChange(new Date(e.target.value + "T00:00:00"));
            }
          }}
          className="w-auto"
        />

        <span className="text-sm text-muted-foreground capitalize">{periodLabel}</span>
      </div>
    </div>
  );
};

export default CarteiraFilters;
