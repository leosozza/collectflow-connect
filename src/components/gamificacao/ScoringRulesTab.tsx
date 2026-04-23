import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchScoringRules,
  updateScoringRule,
  restoreDefaultScoringRules,
  METRIC_DEFAULTS,
  type ScoringRule,
} from "@/services/scoringRulesService";
import { recalculateTenantSnapshot } from "@/services/gamificationService";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Info, RotateCcw, RefreshCw, Save } from "lucide-react";

type Draft = Record<string, { label: string; points: string; unit_size: string; enabled: boolean }>;

const ScoringRulesTab = () => {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Draft>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [recalcing, setRecalcing] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["scoring-rules"],
    queryFn: fetchScoringRules,
  });

  useEffect(() => {
    const next: Draft = {};
    for (const r of rules) {
      next[r.id] = {
        label: r.label,
        points: String(r.points),
        unit_size: String(r.unit_size),
        enabled: r.enabled,
      };
    }
    setDrafts(next);
  }, [rules]);

  const setField = (id: string, field: keyof Draft[string], value: string | boolean) => {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value as never } }));
  };

  const isDirty = (r: ScoringRule) => {
    const d = drafts[r.id];
    if (!d) return false;
    return (
      d.label !== r.label ||
      Number(d.points) !== Number(r.points) ||
      Number(d.unit_size) !== Number(r.unit_size) ||
      d.enabled !== r.enabled
    );
  };

  const handleSave = async (r: ScoringRule) => {
    const d = drafts[r.id];
    const points = Number(d.points);
    const unit_size = Number(d.unit_size);
    if (!d.label.trim()) return toast({ title: "Rótulo obrigatório", variant: "destructive" });
    if (Number.isNaN(points)) return toast({ title: "Pontos inválidos", variant: "destructive" });
    if (Number.isNaN(unit_size) || unit_size <= 0) return toast({ title: "Por unidade deve ser > 0", variant: "destructive" });

    setSavingId(r.id);
    try {
      await updateScoringRule(r.id, { label: d.label.trim(), points, unit_size, enabled: d.enabled });
      await qc.invalidateQueries({ queryKey: ["scoring-rules"] });
      toast({
        title: "Regra salva",
        description: "As alterações valem para cálculos futuros. Aplicar agora ao mês atual?",
        action: (
          <ToastAction altText="Aplicar agora" onClick={() => handleRecalc()}>
            Aplicar agora
          </ToastAction>
        ),
      });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const handleRestore = async () => {
    if (!confirm("Restaurar todas as regras para os valores padrão?")) return;
    setRestoring(true);
    try {
      await restoreDefaultScoringRules();
      await qc.invalidateQueries({ queryKey: ["scoring-rules"] });
      toast({ title: "Regras restauradas para o padrão" });
    } catch (e: any) {
      toast({ title: "Erro ao restaurar", description: e.message, variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const handleRecalc = async () => {
    setRecalcing(true);
    try {
      const now = new Date();
      await recalculateTenantSnapshot(now.getFullYear(), now.getMonth() + 1);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ranking"] }),
        qc.invalidateQueries({ queryKey: ["my-points"] }),
        qc.invalidateQueries({ queryKey: ["my-points-goal"] }),
      ]);
      toast({ title: "Pontuação recalculada para o mês atual" });
    } catch (e: any) {
      toast({ title: "Erro ao recalcular", description: e.message, variant: "destructive" });
    } finally {
      setRecalcing(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Regras de Pontuação</h3>
          <p className="text-sm text-muted-foreground">
            Configure como cada métrica gera pontos para os operadores. As alterações afetam apenas cálculos
            futuros — clique em <span className="font-medium">Recalcular mês atual</span> para aplicar agora.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRestore} disabled={restoring}>
            <RotateCcw className="w-4 h-4 mr-1.5" /> Restaurar padrões
          </Button>
          <Button size="sm" onClick={handleRecalc} disabled={recalcing}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${recalcing ? "animate-spin" : ""}`} /> Recalcular mês atual
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center text-sm text-muted-foreground py-12">Carregando regras...</div>
      )}

      <TooltipProvider delayDuration={200}>
        <div className="space-y-3">
          {rules.map(r => {
            const d = drafts[r.id];
            const def = METRIC_DEFAULTS[r.metric];
            const dirty = isDirty(r);
            if (!d) return null;
            return (
              <Card key={r.id} className={`border-border ${dirty ? "ring-1 ring-primary/40" : ""}`}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-1 flex items-center gap-2">
                      <Switch
                        id={`enabled-${r.id}`}
                        checked={d.enabled}
                        onCheckedChange={v => setField(r.id, "enabled", v)}
                      />
                      <Label htmlFor={`enabled-${r.id}`} className="text-xs text-muted-foreground">Ativa</Label>
                    </div>

                    <div className="md:col-span-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Label className="text-xs text-muted-foreground">Métrica</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">{def?.description}</TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        value={d.label}
                        onChange={e => setField(r.id, "label", e.target.value)}
                        placeholder={def?.label}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground mb-1 block">Pontos</Label>
                      <Input
                        type="number"
                        step="1"
                        value={d.points}
                        onChange={e => setField(r.id, "points", e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground mb-1 block">Por unidade</Label>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={d.unit_size}
                        onChange={e => setField(r.id, "unit_size", e.target.value)}
                        disabled={r.metric === "goal_reached"}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">{def?.unit_label}</p>
                    </div>

                    <div className="md:col-span-3 flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleSave(r)}
                        disabled={!dirty || savingId === r.id}
                      >
                        <Save className="w-4 h-4 mr-1.5" />
                        {savingId === r.id ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
};

export default ScoringRulesTab;
