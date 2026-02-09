import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, X } from "lucide-react";

interface CarteiraFiltersProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
  onSearch: () => void;
  onClear: () => void;
}

const CarteiraFilters = ({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onSearch,
  onClear,
}: CarteiraFiltersProps) => {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex flex-col sm:flex-row items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Data Inicial</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Data Final</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-auto"
          />
        </div>
        <Button onClick={onSearch} className="gap-2">
          <Search className="w-4 h-4" />
          Pesquisar
        </Button>
        <Button variant="outline" onClick={onClear} className="gap-2">
          <X className="w-4 h-4" />
          Limpar Filtros
        </Button>
      </div>
    </div>
  );
};

export default CarteiraFilters;
