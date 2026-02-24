import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/hooks/useTenant";
import { fetchTiposDevedor, fetchTiposDivida } from "@/services/cadastrosService";

interface ReportFiltersProps {
  selectedYear: string;
  setSelectedYear: (v: string) => void;
  selectedMonth: string;
  setSelectedMonth: (v: string) => void;
  selectedCredor: string;
  setSelectedCredor: (v: string) => void;
  selectedOperator: string;
  setSelectedOperator: (v: string) => void;
  credores: string[];
  operators: { id: string; name: string }[];
  // New filters
  selectedStatus: string;
  setSelectedStatus: (v: string) => void;
  selectedTipoDivida: string;
  setSelectedTipoDivida: (v: string) => void;
  selectedTipoDevedor: string;
  setSelectedTipoDevedor: (v: string) => void;
  quitacaoDe: string;
  setQuitacaoDe: (v: string) => void;
  quitacaoAte: string;
  setQuitacaoAte: (v: string) => void;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const generateYearOptions = () => {
  const now = new Date();
  const years: number[] = [];
  for (let i = 0; i < 4; i++) years.push(now.getFullYear() - i);
  return years;
};

const ReportFilters = ({
  selectedYear, setSelectedYear,
  selectedMonth, setSelectedMonth,
  selectedCredor, setSelectedCredor,
  selectedOperator, setSelectedOperator,
  credores, operators,
  selectedStatus, setSelectedStatus,
  selectedTipoDivida, setSelectedTipoDivida,
  selectedTipoDevedor, setSelectedTipoDevedor,
  quitacaoDe, setQuitacaoDe,
  quitacaoAte, setQuitacaoAte,
}: ReportFiltersProps) => {
  const { tenant } = useTenant();
  const yearOptions = generateYearOptions();

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

  return (
    <div className="space-y-4">
      {/* Linha 1: Período e entidade */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[90px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {monthNames.map((name, i) => (
                <SelectItem key={i} value={i.toString()}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Credor</Label>
          <Select value={selectedCredor} onValueChange={setSelectedCredor}>
            <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {credores.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Operador</Label>
          <Select value={selectedOperator} onValueChange={setSelectedOperator}>
            <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {operators.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Linha 2: Filtros adicionais */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Status do Acordo</Label>
          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="quebra">Quebra</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Tipo de Dívida</Label>
          <Select value={selectedTipoDivida} onValueChange={setSelectedTipoDivida}>
            <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {tiposDivida.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Perfil do Devedor</Label>
          <Select value={selectedTipoDevedor} onValueChange={setSelectedTipoDevedor}>
            <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {tiposDevedor.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Quitação De</Label>
          <Input type="date" value={quitacaoDe} onChange={(e) => setQuitacaoDe(e.target.value)} className="w-auto h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Quitação Até</Label>
          <Input type="date" value={quitacaoAte} onChange={(e) => setQuitacaoAte(e.target.value)} className="w-auto h-9 text-sm" />
        </div>
      </div>
    </div>
  );
};

export default ReportFilters;
