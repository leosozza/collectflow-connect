import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MultiSelect } from "@/components/ui/multi-select";
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
import { fetchCredores, fetchTiposDivida, fetchTiposStatus } from "@/services/cadastrosService";

const DEBTOR_PROFILE_OPTIONS = [
  { value: "ocasional", label: "Ocasional" },
  { value: "recorrente", label: "Recorrente" },
  { value: "resistente", label: "Resistente" },
  { value: "insatisfeito", label: "Insatisfeito" },
];

const SCORE_RANGE_OPTIONS = [
  { value: "bom", label: "Bom (75-100)" },
  { value: "medio", label: "Médio (50-74)" },
  { value: "ruim", label: "Ruim (<50)" },
];

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
  emDia: boolean;
  higienizados: boolean;
  scoreRange: string;
  debtorProfile: string;
}

interface ClientFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onSearch?: () => void;
  showAdvancedFilters?: boolean;
}

const ClientFilters = ({ filters, onChange, onSearch, showAdvancedFilters = true }: ClientFiltersProps) => {
  const { tenant } = useTenant();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { data: credores = [] } = useQuery({
    queryKey: ["credores", tenant?.id],
    queryFn: () => fetchCredores(tenant!.id),
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
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <Input
            placeholder="Buscar por nome, CPF, telefone ou e-mail..."
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch?.()}
          />
        </div>
        <Button size="default" onClick={onSearch} className="gap-1.5">
          <Search className="w-4 h-4" />
          Pesquisar
        </Button>
        {showAdvancedFilters && (
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="default" className="gap-1.5">
                <Filter className="w-4 h-4" />
                Filtros
                {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </div>

      {/* Level 2: Collapsible advanced filters */}
      {showAdvancedFilters && <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleContent>
          <div className="space-y-4 pt-3 border-t border-border">
            {/* Linha 1: Selects */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status de Carteira</Label>
                <MultiSelect
                  options={tiposStatus.map((t: any) => ({ value: t.id, label: t.nome }))}
                  selected={filters.statusCobrancaId ? filters.statusCobrancaId.split(",") : []}
                  onChange={(sel) => update("statusCobrancaId", sel.join(","))}
                  placeholder="Todos"
                  allLabel="Todos"
                  searchable
                  className="w-full"
                />
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
                <MultiSelect
                  options={DEBTOR_PROFILE_OPTIONS}
                  selected={filters.debtorProfile ? filters.debtorProfile.split(",") : []}
                  onChange={(sel) => update("debtorProfile", sel.join(","))}
                  placeholder="Todos"
                  allLabel="Todos"
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de Dívida</Label>
                <MultiSelect
                  options={tiposDivida.map((t: any) => ({ value: t.id, label: t.nome }))}
                  selected={filters.tipoDividaId ? filters.tipoDividaId.split(",") : []}
                  onChange={(sel) => update("tipoDividaId", sel.join(","))}
                  placeholder="Todos"
                  allLabel="Todos"
                  searchable
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Faixa de Score</Label>
                <MultiSelect
                  options={SCORE_RANGE_OPTIONS}
                  selected={filters.scoreRange ? filters.scoreRange.split(",") : []}
                  onChange={(sel) => update("scoreRange", sel.join(","))}
                  placeholder="Todos"
                  allLabel="Todos"
                  className="w-full"
                />
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
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.emDia || false}
                  onCheckedChange={(checked) => update("emDia", !!checked)}
                />
                <span className="text-sm text-foreground">Em dia</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={filters.higienizados || false}
                  onCheckedChange={(checked) => update("higienizados", !!checked)}
                />
                <span className="text-sm text-foreground">Higienizados</span>
              </label>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>}
    </div>
  );
};

export default ClientFilters;
