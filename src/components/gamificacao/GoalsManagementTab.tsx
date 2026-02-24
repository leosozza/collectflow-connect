import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchGoals, upsertGoal } from "@/services/goalService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import { Save } from "lucide-react";
import { toast } from "sonner";

const GoalsManagementTab = () => {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [credorFilter, setCredorFilter] = useState<string>("__global__");
  const [editedGoals, setEditedGoals] = useState<Record<string, number>>({});

  const { data: operators = [] } = useQuery({
    queryKey: ["tenant-operators", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("tenant_id", tenant!.id)
        .order("full_name");
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const { data: credores = [] } = useQuery({
    queryKey: ["credores-active", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("credores")
        .select("id, razao_social")
        .eq("tenant_id", tenant!.id)
        .eq("status", "ativo")
        .order("razao_social");
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const effectiveCredorId = credorFilter === "__global__" ? null : credorFilter;

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", year, month, effectiveCredorId],
    queryFn: () => fetchGoals(year, month, effectiveCredorId),
  });

  const goalMap = new Map(goals.map((g) => [g.operator_id, g.target_amount]));

  const saveMut = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(editedGoals);
      for (const [opId, amount] of entries) {
        await upsertGoal({
          operator_id: opId,
          year,
          month,
          target_amount: amount,
          tenant_id: tenant!.id,
          created_by: user!.id,
          credor_id: effectiveCredorId,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      setEditedGoals({});
      toast.success("Metas salvas!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i).toLocaleString("pt-BR", { month: "long" }),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setEditedGoals({}); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setEditedGoals({}); }}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[year - 1, year, year + 1].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={credorFilter} onValueChange={(v) => { setCredorFilter(v); setEditedGoals({}); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__global__">Global (todos credores)</SelectItem>
            {credores.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {Object.keys(editedGoals).length > 0 && (
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="gap-1.5 ml-auto">
            <Save className="w-3.5 h-3.5" /> Salvar
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Operador</TableHead>
            <TableHead className="w-40">Meta Atual</TableHead>
            <TableHead className="w-40">Nova Meta (R$)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {operators.map((op: any) => {
            const current = goalMap.get(op.id) || 0;
            return (
              <TableRow key={op.id}>
                <TableCell className="font-medium">{op.full_name || "Sem nome"}</TableCell>
                <TableCell className="text-muted-foreground">{formatCurrency(current)}</TableCell>
                <TableCell>
                  <CurrencyInput
                    value={editedGoals[op.id] ?? 0}
                    onValueChange={(v) =>
                      setEditedGoals((prev) => ({
                        ...prev,
                        [op.id]: v,
                      }))
                    }
                    className="h-8 w-40"
                    placeholder={String(current)}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {operators.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Nenhum operador encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default GoalsManagementTab;
