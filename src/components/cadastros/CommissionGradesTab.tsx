import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, TrendingUp, Percent } from "lucide-react";
import type { CommissionGrade, CommissionTier } from "@/lib/commission";

const emptyTier = (): CommissionTier => ({ min: 0, max: null, rate: 0 });

const CommissionGradesTab = () => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CommissionGrade | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommissionGrade | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"fixa" | "escalonada">("fixa");
  const [formTiers, setFormTiers] = useState<CommissionTier[]>([emptyTier()]);

  const { data: grades = [], isLoading } = useQuery({
    queryKey: ["commission-grades", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_grades")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []).map((d) => ({
        ...d,
        tiers: (d.tiers as unknown as CommissionTier[]) || [],
      })) as CommissionGrade[];
    },
    enabled: !!tenant?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const tiers = formType === "fixa"
        ? [{ min: 0, max: null, rate: formTiers[0]?.rate ?? 0 }]
        : formTiers.map((t, i) => ({
            min: t.min,
            max: i === formTiers.length - 1 ? null : t.max,
            rate: t.rate,
          }));

      if (editing) {
        const { error } = await supabase
          .from("commission_grades")
          .update({ name: formName, tiers: tiers as any, updated_at: new Date().toISOString() })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("commission_grades")
          .insert({ name: formName, tiers: tiers as any, tenant_id: tenant!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-grades"] });
      toast.success(editing ? "Grade atualizada!" : "Grade criada!");
      closeDialog();
    },
    onError: () => toast.error("Erro ao salvar grade"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commission_grades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-grades"] });
      toast.success("Grade removida!");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Erro ao remover grade"),
  });

  const openNew = () => {
    setEditing(null);
    setFormName("");
    setFormType("fixa");
    setFormTiers([emptyTier()]);
    setDialogOpen(true);
  };

  const openEdit = (grade: CommissionGrade) => {
    setEditing(grade);
    setFormName(grade.name);
    const isEscalonada = grade.tiers.length > 1 || (grade.tiers.length === 1 && grade.tiers[0].min > 0);
    setFormType(isEscalonada ? "escalonada" : "fixa");
    setFormTiers(grade.tiers.length > 0 ? [...grade.tiers] : [emptyTier()]);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const addTier = () => setFormTiers((prev) => [...prev, emptyTier()]);

  const removeTier = (i: number) =>
    setFormTiers((prev) => prev.filter((_, idx) => idx !== i));

  const updateTier = (i: number, field: keyof CommissionTier, value: number | null) =>
    setFormTiers((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  const gradeTypeBadge = (grade: CommissionGrade) => {
    const isEscalonada = grade.tiers.length > 1 || (grade.tiers.length === 1 && grade.tiers[0].min > 0);
    return isEscalonada ? "Escalonada" : "Fixa";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Crie modelos de comissão fixos ou escalonados para vincular a cada usuário.
        </p>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Grade
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">Carregando...</div>
      ) : grades.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 border border-dashed rounded-xl">
          <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma grade de comissão criada.</p>
          <Button variant="link" className="mt-1 text-sm" onClick={openNew}>Criar primeira grade</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {grades.map((grade) => (
            <div
              key={grade.id}
              className="bg-card border border-border rounded-xl p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-semibold text-card-foreground">{grade.name}</p>
                  <Badge variant="secondary" className="text-[11px]">
                    {gradeTypeBadge(grade)}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(grade)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(grade)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Tiers table */}
              <div className="rounded-lg border border-border overflow-hidden text-sm">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground">Faixa</th>
                      <th className="text-right px-3 py-1.5 text-xs font-medium text-muted-foreground">Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grade.tiers.map((tier, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-1.5 text-muted-foreground">
                          {grade.tiers.length === 1 && tier.min === 0
                            ? "Valor total recebido"
                            : tier.max === null
                            ? `Acima de ${formatCurrency(tier.min)}`
                            : `${formatCurrency(tier.min)} – ${formatCurrency(tier.max)}`}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold text-primary">
                          {tier.rate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Grade" : "Nova Grade de Comissão"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome da Grade</Label>
              <Input
                placeholder="Ex: Grade Operador Padrão"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formType}
                onValueChange={(v) => {
                  setFormType(v as "fixa" | "escalonada");
                  setFormTiers([emptyTier()]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixa">
                    <span className="flex items-center gap-2">
                      <Percent className="w-3.5 h-3.5" /> Fixa — percentual único sobre o total recebido
                    </span>
                  </SelectItem>
                  <SelectItem value="escalonada">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="w-3.5 h-3.5" /> Escalonada — faixas de valor com percentuais diferentes
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formType === "fixa" ? (
              <div className="space-y-2">
                <Label>% de Comissão</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    className="w-32"
                    value={formTiers[0]?.rate ?? 0}
                    onChange={(e) => updateTier(0, "rate", parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-muted-foreground text-sm">% sobre o valor total recebido</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Faixas</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addTier} className="h-7 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Adicionar Faixa
                  </Button>
                </div>
                <div className="space-y-2">
                  {formTiers.map((tier, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-3">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Mín (R$)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            value={tier.min}
                            onChange={(e) => updateTier(i, "min", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Máx (R$) — vazio = sem limite</Label>
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            placeholder="Sem limite"
                            value={tier.max ?? ""}
                            onChange={(e) =>
                              updateTier(i, "max", e.target.value === "" ? null : parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">% Comissão</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={tier.rate}
                            onChange={(e) => updateTier(i, "rate", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      {formTiers.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                          onClick={() => removeTier(i)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !formName.trim()}
            >
              {saveMutation.isPending ? "Salvando..." : editing ? "Salvar Alterações" : "Criar Grade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Grade</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteTarget?.name}</strong>? Usuários vinculados perderão esta grade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CommissionGradesTab;
