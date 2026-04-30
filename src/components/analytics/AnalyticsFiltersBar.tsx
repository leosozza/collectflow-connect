import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, subDays, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";

interface Props {
  tenantId: string | undefined;
  isOperator: boolean;
  showChannel: boolean;
  showScore: boolean;
  dateFrom: string;
  dateTo: string;
  credores: string[];
  operators: string[];
  channels: string[];
  scoreMin: string;
  scoreMax: string;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  setCredores: (v: string[]) => void;
  setOperators: (v: string[]) => void;
  setChannels: (v: string[]) => void;
  setScoreMin: (v: string) => void;
  setScoreMax: (v: string) => void;
}

const CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "voice", label: "Voz" },
  { value: "email", label: "E-mail" },
  { value: "sms", label: "SMS" },
  { value: "portal", label: "Portal" },
];

const fmt = (d: string) => (d ? format(parseISO(d), "dd MMM", { locale: ptBR }) : "—");

export const AnalyticsFiltersBar = (p: Props) => {
  const { data: credorOpts = [] } = useQuery({
    queryKey: ["analytics-credor-opts", p.tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("credor")
        .eq("tenant_id", p.tenantId!)
        .not("credor", "is", null)
        .limit(1000);
      const set = new Set<string>((data || []).map((r: any) => r.credor).filter(Boolean));
      return Array.from(set).sort().map((c) => ({ value: c, label: c }));
    },
    enabled: !!p.tenantId,
  });

  const { data: operatorOpts = [] } = useQuery({
    queryKey: ["analytics-operator-opts", p.tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("tenant_id", p.tenantId!);
      return (data || []).map((u: any) => ({ value: u.user_id, label: u.full_name || "Sem nome" }));
    },
    enabled: !!p.tenantId && !p.isOperator,
  });

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-3 flex flex-wrap items-center gap-2">
      {/* date from */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-8 gap-1.5", !p.dateFrom && "text-muted-foreground")}>
            <CalendarIcon className="w-3.5 h-3.5" /> De: {fmt(p.dateFrom)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={p.dateFrom ? parseISO(p.dateFrom) : undefined}
            onSelect={(d) => d && p.setDateFrom(format(d, "yyyy-MM-dd"))}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {/* date to */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-8 gap-1.5", !p.dateTo && "text-muted-foreground")}>
            <CalendarIcon className="w-3.5 h-3.5" /> Até: {fmt(p.dateTo)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={p.dateTo ? parseISO(p.dateTo) : undefined}
            onSelect={(d) => d && p.setDateTo(format(d, "yyyy-MM-dd"))}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <MultiSelect
        options={credorOpts}
        selected={p.credores}
        onChange={p.setCredores}
        allLabel="Todos Credores"
        className="w-[160px]"
      />
      {!p.isOperator && (
        <MultiSelect
          options={operatorOpts}
          selected={p.operators}
          onChange={p.setOperators}
          allLabel="Todos Operadores"
          className="w-[160px]"
        />
      )}
      {p.showChannel && (
        <MultiSelect
          options={CHANNEL_OPTIONS}
          selected={p.channels}
          onChange={p.setChannels}
          allLabel="Todos Canais"
          className="w-[140px]"
        />
      )}
      {p.showScore && (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="Score min"
            value={p.scoreMin}
            onChange={(e) => p.setScoreMin(e.target.value)}
            className="h-8 w-[90px] text-xs"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            type="number"
            min={0}
            max={100}
            placeholder="Score max"
            value={p.scoreMax}
            onChange={(e) => p.setScoreMax(e.target.value)}
            className="h-8 w-[90px] text-xs"
          />
        </div>
      )}
    </div>
  );
};
