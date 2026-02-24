import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Search, ChevronDown, ChevronUp, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useTenant } from "@/hooks/useTenant";
import { fetchCredores, fetchTiposDevedor, fetchTiposDivida, fetchTiposStatus } from "@/services/cadastrosService";

interface Filters {
  status: string;
  credor: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  tipoDevedorId: string;
  tipoDividaId: string;
  statusCobrancaId: string;
  semAcordo: boolean;
  cadastroDe: string;
  cadastroAte: string;
  quitados: boolean;
  valorAbertoDe: number;
  valorAbertoAte: number;
  semContato: boolean;
}

interface ClientFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onSearch?: () => void;
}

const ClientFilters = ({ filters, onChange, onSearch }: ClientFiltersProps) => {
  const { tenant } = useTenant();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { data: credores = [] } = useQuery({
    queryKey: ["credores", tenant?.id],
    queryFn: () => fetchCredores(tenant!.id),
    enabled: !!tenant?.id,
  });

  const { data: tiposDevedor = [] } = useQuery({
    queryKey: ["tipos_devedor", tenant?.id],
    queryFn: () => fetchTiposDevedor(tenant!.id),
    enabled: !!tenant?.id,
  });

  const { data: tiposDivida = [] } = useQuery({
    queryKey: ["tipos_divida", tenant?.id],
    queryFn: () => fetchTiposDivida(tenant!.id),
    enabled: !!tenant?.id,
  });

  const { data: tiposStatus = [] } = useQuery({
    queryKey: ["tipos_status", tenant?.id],
    queryFn: () => fetchTiposStatus(tenant!.id),
    enabled: !!tenant?.id,
  });

  const update = (key: keyof Filters, value: any) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      {/* Level 1: Always visible */}
      <div className="flex items-end gap-2">
        <div className="flex-1 max-w-sm space-y-1.5">
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
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="default" className="gap-1.5">
              <Filter className="w-4 h-4" />
              Filtros
              {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* Level 2: Collapsible advanced filters */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleContent>
          <div className="space-y-4 pt-3 border-t border-border">
            {/* Linha 1: Selects */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status de Carteira</Label>
                <Select value={filters.statusCobrancaId || "todos"} onValueChange={(v) => update("statusCobrancaId", v === "todos" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {tiposStatus.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.cor || "#6b7280" }} />
                          {t.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Credor</Label>
                <Select value={filters.credor} onValueChange={(v) => update("credor", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {credores.map((c: any) => (
                      <SelectItem key={c.id} value={c.razao_social}>{c.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Perfil do Devedor</Label>
                <Select value={filters.tipoDevedorId || "todos"} onValueChange={(v) => update("tipoDevedorId", v === "todos" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {tiposDevedor.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de Dívida</Label>
                <Select value={filters.tipoDividaId || "todos"} onValueChange={(v) => update("tipoDividaId", v === "todos" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {tiposDivida.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 2: Datas lado a lado */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Vencimento De</Label>
                <Input type="date" value={filters.dateFrom} onChange={(e) => update("dateFrom", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Vencimento Até</Label>
                <Input type="date" value={filters.dateTo} onChange={(e) => update("dateTo", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cadastro De</Label>
                <Input type="date" value={filters.cadastroDe || ""} onChange={(e) => update("cadastroDe", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cadastro Até</Label>
                <Input type="date" value={filters.cadastroAte || ""} onChange={(e) => update("cadastroAte", e.target.value)} />
              </div>
            </div>

            {/* Linha 3: Valor em aberto */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Valor Aberto De</Label>
                <CurrencyInput value={filters.valorAbertoDe || 0} onValueChange={(v) => update("valorAbertoDe", v)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Valor Aberto Até</Label>
                <CurrencyInput value={filters.valorAbertoAte || 0} onValueChange={(v) => update("valorAbertoAte", v)} />
              </div>
            </div>

            {/* Linha 4: Checkboxes lado a lado */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.semAcordo || false}
                  onCheckedChange={(checked) => update("semAcordo", !!checked)}
                />
                <span className="text-sm text-foreground">Sem acordo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.quitados || false}
                  onCheckedChange={(checked) => update("quitados", !!checked)}
                />
                <span className="text-sm text-foreground">Quitados</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.semContato || false}
                  onCheckedChange={(checked) => update("semContato", !!checked)}
                />
                <span className="text-sm text-foreground">Sem contato</span>
              </label>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default ClientFilters;
