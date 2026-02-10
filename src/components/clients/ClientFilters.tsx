import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Filters {
  status: string;
  credor: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

interface ClientFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onSearch?: () => void;
  onExportExcel?: () => void;
}

const ClientFilters = ({ filters, onChange, onSearch, onExportExcel }: ClientFiltersProps) => {
  const update = (key: keyof Filters, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-end gap-2">
        <div className="w-64 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Buscar por nome ou CPF</Label>
          <Input
            placeholder="Nome ou CPF..."
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch?.()}
          />
        </div>
        <Button size="default" onClick={onSearch} className="gap-1.5">
          <Search className="w-4 h-4" />
          Pesquisar
        </Button>
        {onExportExcel && (
          <Button variant="outline" size="default" onClick={onExportExcel} className="gap-1.5">
            <Download className="w-4 h-4" />
            Exportar Excel
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={filters.status} onValueChange={(v) => update("status", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="quebrado">Quebrado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Credor</Label>
          <Select value={filters.credor} onValueChange={(v) => update("credor", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="MAXFAMA">MAXFAMA</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update("dateFrom", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => update("dateTo", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default ClientFilters;
