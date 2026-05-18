import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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

  const credoresQuery = useQuery({
    queryKey: ["report-credores", tenant?.id],
    enabled: !!tenant?.id && !!showCredor,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const nomes = new Set<string>();

      // 1) Cadastros formais (tabela credores usa razao_social / nome_fantasia)
      const { data: cadastrados, error: errCad } = await supabase
        .from("credores" as any)
        .select("razao_social, nome_fantasia")
        .eq("tenant_id", tenant!.id);
      if (errCad) throw errCad;
      ((cadastrados || []) as any[]).forEach((c) => {
        const n = (c?.nome_fantasia || c?.razao_social || "").toString().trim();
        if (n) nomes.add(n);
      });

      // 2) Fallback: credores presentes na carteira importada (clients.credor)
      const { data: distintos } = await supabase
        .from("clients")
        .select("credor")
        .eq("tenant_id", tenant!.id)
        .not("credor", "is", null)
        .limit(1000);
      ((distintos || []) as any[]).forEach((c) => {
        const n = (c?.credor || "").toString().trim();
        if (n && n.toLowerCase() !== "default") nomes.add(n);
      });

      return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
  });
  const credores = credoresQuery.data || [];

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
          {credoresQuery.isLoading ? (
            <Skeleton className="h-10 w-full rounded-md" />
          ) : (
            <Select
              key={`credor-select-${credores.length}`}
              value={credor && credor.length > 0 ? credor : undefined}
              onValueChange={(v) => onCredor?.(v)}
              disabled={credores.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    credores.length === 0
                      ? "Nenhum credor cadastrado"
                      : credorRequired
                      ? "Selecione um credor"
                      : "Todos"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                {!credorRequired && <SelectItem value="__all__">Todos</SelectItem>}
                {credores.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
