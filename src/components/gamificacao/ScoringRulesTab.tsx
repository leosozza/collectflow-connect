import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchScoringRules,
  updateScoringRule,
  restoreDefaultScoringRules,
  METRIC_DEFAULTS,
  type ScoringMetric,
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
import { Info, RotateCcw, RefreshCw, Save, Coins } from "lucide-react";

type Draft = Record<string, { points: string; unit_size: string; enabled: boolean }>;

// Mapa de exibição: como cada métrica deve ser apresentada como frase.
// `unitInline` define se mostramos o segundo input ("a cada R$ X") ou só uma sentença.
const METRIC_PHRASE: Record<
  ScoringMetric,
  { name: string; before: string; after: string; showUnit: boolean; unitPrefix?: string; unitSuffix?: string }
> = {
  payment_count:        { name: "Pagamento confirmado",      before: "pontos para cada", after: "pagamento confirmado",   showUnit: false },
  total_received:       { name: "Valor recebido",            before: "pontos a cada",    after: "recebidos",              showUnit: true,  unitPrefix: "R$", unitSuffix: "" },
  agreement_created:    { name: "Acordo formalizado",        before: "pontos por",       after: "acordo formalizado",     showUnit: false },
  agreement_paid:       { name: "Acordo totalmente quitado", before: "pontos por",       after: "acordo quitado integralmente", showUnit: false },
  agreement_break:      { name: "Quebra de acordo",          before: "pontos por",       after: "acordo quebrado (use valor negativo para penalizar)", showUnit: false },
  achievement_unlocked: { name: "Conquista desbloqueada",    before: "pontos por",       after: "conquista desbloqueada", showUnit: false },
  goal_reached:         { name: "Meta do mês atingida",      before: "pontos como",      after: "bônus único ao bater a meta do mês", showUnit: false },
};

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
      Number(d.points) !== Number(r.points) ||
      Number(d.unit_size) !== Number(r.unit_size) ||
      d.enabled !== r.enabled
    );
  };

  const handleSave = async (r: ScoringRule) => {
    const d = drafts[r.id];
    const points = Number(d.points);
    const unit_size = Number(d.unit_size);
    if (Number.isNaN(points)) return toast({ title: "Pontos inválidos", variant: "destructive" });
    if (Number.isNaN(unit_size) || unit_size <= 0) return toast({ title: "Faixa deve ser > 0", variant: "destructive" });

    setSavingId(r.id);
    try {
      await updateScoringRule(r.id, { points, unit_size, enabled: d.enabled });
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">Regras de Pontuação</h3>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Defina quantos pontos cada ação do operador vale neste mês. As métricas são <span className="font-medium text-foreground">fixas do sistema</span> — você só configura o valor em pontos e ativa/desativa cada uma.
          </p>
          <p className="text-sm text-muted-foreground max-w-3xl flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-primary" />
            Os pontos acumulados no mês são convertidos em <span className="font-medium text-foreground">Rivo Coins (1 ponto = 1 RC)</span> no primeiro dia do mês seguinte.
          </p>
          <p className="text-xs text-muted-foreground">
            Alterações valem para cálculos futuros — clique em <span className="font-medium">Recalcular mês atual</span> para reaplicar agora.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
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
            const phrase = METRIC_PHRASE[r.metric];
            const dirty = isDirty(r);
            if (!d) return null;

            // Pré-visualização: só faz sentido para total_received
            const previewExample = r.metric === "total_received"
              ? (() => {
                  const ex = 250;
                  const pts = Math.floor(ex / Math.max(1, Number(d.unit_size))) * Number(d.points);
                  return `Exemplo: um pagamento de R$ ${ex} vale ${pts} pontos.`;
                })()
              : null;

            return (
              <Card key={r.id} className={`border-border ${dirty ? "ring-1 ring-primary/40" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    {/* Linha 1: ativa + nome da métrica fixo + tooltip */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`enabled-${r.id}`}
                            checked={d.enabled}
                            onCheckedChange={v => setField(r.id, "enabled", v)}
                          />
                          <Label htmlFor={`enabled-${r.id}`} className="text-xs text-muted-foreground">
                            {d.enabled ? "Ativa" : "Inativa"}
                          </Label>
                        </div>
                        <div className="h-5 w-px bg-border" />
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium text-foreground truncate">{phrase.name}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-medium mb-1">{def?.label}</p>
                              <p className="text-xs">{def?.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSave(r)}
                        disabled={!dirty || savingId === r.id}
                      >
                        <Save className="w-4 h-4 mr-1.5" />
                        {savingId === r.id ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>

                    {/* Linha 2: frase configurável */}
                    <div className={`flex flex-wrap items-center gap-2 text-sm ${d.enabled ? "text-foreground" : "text-muted-foreground opacity-70"}`}>
                      <Input
                        type="number"
                        step="1"
                        value={d.points}
                        onChange={e => setField(r.id, "points", e.target.value)}
                        className="w-20 h-9 text-center font-semibold"
                        disabled={!d.enabled}
                      />
                      <span>{phrase.before}</span>

                      {phrase.showUnit && (
                        <>
                          {phrase.unitPrefix && <span className="text-muted-foreground">{phrase.unitPrefix}</span>}
                          <Input
                            type="number"
                            step="1"
                            min="1"
                            value={d.unit_size}
                            onChange={e => setField(r.id, "unit_size", e.target.value)}
                            className="w-24 h-9 text-center font-semibold"
                            disabled={!d.enabled}
                          />
                          {phrase.unitSuffix && <span className="text-muted-foreground">{phrase.unitSuffix}</span>}
                        </>
                      )}

                      <span>{phrase.after}</span>
                    </div>

                    {previewExample && (
                      <p className="text-xs text-muted-foreground italic">{previewExample}</p>
                    )}
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
