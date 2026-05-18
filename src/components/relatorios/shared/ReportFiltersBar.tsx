import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

interface ReportFiltersBarProps {
  dateFrom: string;
  dateTo: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  credor?: string;
  onCredor?: (v: string) => void;
  showCredor?: boolean;
  credorRequired?: boolean;
  operator?: string;
  onOperator?: (v: string) => void;
  showOperator?: boolean;
}

export const ReportFiltersBar = ({
  dateFrom,
  dateTo,
  onDateFrom,
  onDateTo,
  credor,
  onCredor,
  showCredor,
  credorRequired,
  operator,
  onOperator,
  showOperator,
}: ReportFiltersBarProps) => {
  const { tenant } = useTenant();

  const { data: credores = [] } = useQuery({
    queryKey: ["report-credores", tenant?.id],
    enabled: !!tenant?.id && !!showCredor,
    queryFn: async () => {
      const { data } = await supabase
        .from("credores" as any)
        .select("id, nome")
        .eq("tenant_id", tenant!.id)
        .order("nome");
      return ((data || []) as any[]).map((c) => c.nome).filter(Boolean);
    },
  });

  const { data: operators = [] } = useQuery({
    queryKey: ["report-operators", tenant?.id],
    enabled: !!tenant?.id && !!showOperator,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("tenant_id", tenant!.id);
      return (data || []).map((p: any) => ({ id: p.user_id, name: p.full_name || "Sem nome" }));
    },
  });

  return (
    <div className="bg-card rounded-xl border border-border p-4 grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
      <div>
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">De</Label>
        <Input type="date" value={dateFrom} onChange={(e) => onDateFrom(e.target.value)} />
      </div>
      <div>
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Até</Label>
        <Input type="date" value={dateTo} onChange={(e) => onDateTo(e.target.value)} />
      </div>
      {showCredor && (
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Credor {credorRequired && <span className="text-destructive">*</span>}
          </Label>
          <Select value={credor || ""} onValueChange={(v) => onCredor?.(v)}>
            <SelectTrigger>
              <SelectValue placeholder={credorRequired ? "Selecione um credor" : "Todos"} />
            </SelectTrigger>
            <SelectContent>
              {!credorRequired && <SelectItem value="__all__">Todos</SelectItem>}
              {credores.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {showOperator && (
        <div>
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Operador</Label>
          <Select value={operator || "__all__"} onValueChange={(v) => onOperator?.(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {operators.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};
