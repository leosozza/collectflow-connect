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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

interface EditState {
  operatorId: string;
  operatorName: string;
  amount: number;
  points: number;
}

const GoalsManagementTab = () => {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [credorFilter, setCredorFilter] = useState<string>("__global__");
  const [editing, setEditing] = useState<EditState | null>(null);

  const { data: operators = [] } = useQuery({
    queryKey: ["tenant-operators-gamification", tenant?.id],
    queryFn: async () => {
      const { data: participants } = await supabase
        .from("gamification_participants")
        .select("profile_id")
        .eq("tenant_id", tenant!.id)
        .eq("enabled", true);

      const enabledIds = (participants || []).map((p: any) => p.profile_id);
      if (enabledIds.length === 0) return [];

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .in("id", enabledIds)
        .in("role", ["operador"] as any)
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
  const pointsMap = new Map(goals.map((g: any) => [g.operator_id, g.points_reward || 0]));

  const saveMut = useMutation({
    mutationFn: async (e: EditState) => {
      await upsertGoal({
        operator_id: e.operatorId,
        year,
        month,
        target_amount: e.amount,
        tenant_id: tenant!.id,
        created_by: user!.id,
        credor_id: effectiveCredorId,
        points_reward: e.points,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["my-goal"] });
      qc.invalidateQueries({ queryKey: ["my-goal-history"] });
      qc.invalidateQueries({ queryKey: ["dash-meta-my-goal"] });
      qc.invalidateQueries({ queryKey: ["dash-meta-goals"] });
      setEditing(null);
      toast.success("Meta salva!");
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
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[year - 1, year, year + 1].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={credorFilter} onValueChange={setCredorFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__global__">Global (todos credores)</SelectItem>
            {credores.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Operador</TableHead>
            <TableHead className="w-40">Meta Atual</TableHead>
            <TableHead className="w-40">Pontos ao bater</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {operators.map((op: any) => {
            const current = goalMap.get(op.id) || 0;
            const currentPts = pointsMap.get(op.id) || 0;
            return (
              <TableRow key={op.id}>
                <TableCell className="font-medium">{op.full_name || "Sem nome"}</TableCell>
                <TableCell>{formatCurrency(current)}</TableCell>
                <TableCell>{currentPts}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      setEditing({
                        operatorId: op.id,
                        operatorName: op.full_name || "Sem nome",
                        amount: current,
                        points: currentPts,
                      })
                    }
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {operators.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Nenhum operador encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar meta — {editing?.operatorName}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="meta-amount">Meta (R$)</Label>
                <CurrencyInput
                  id="meta-amount"
                  value={editing.amount}
                  onValueChange={(v) => setEditing((prev) => prev ? { ...prev, amount: v } : prev)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meta-points">Pontos ao bater</Label>
                <Input
                  id="meta-points"
                  type="number"
                  min={0}
                  value={editing.points}
                  onChange={(e) =>
                    setEditing((prev) => prev ? { ...prev, points: Number(e.target.value) || 0 } : prev)
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saveMut.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => editing && saveMut.mutate(editing)}
              disabled={saveMut.isPending}
            >
              {saveMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GoalsManagementTab;
