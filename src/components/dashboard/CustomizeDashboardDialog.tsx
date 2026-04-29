import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ALL_DASHBOARD_BLOCKS,
  DEFAULT_DASHBOARD_LAYOUT,
  DashboardBlockId,
  DashboardLayout,
} from "@/hooks/useDashboardLayout";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: DashboardLayout;
  onSave: (layout: DashboardLayout) => void;
  onReset: () => void;
}

const LABELS: Record<DashboardBlockId, string> = {
  kpisTop: "KPIs (cards superiores)",
  parcelas: "Parcelas Programadas",
  totalRecebido: "Total Recebido",
  metas: "Metas",
  agendamentos: "Agendamentos para Hoje",
};

const DESCRIPTIONS: Record<DashboardBlockId, string> = {
  kpisTop: "Grade de indicadores rápidos",
  parcelas: "Vencimentos do dia",
  totalRecebido: "Gráfico de recebimentos",
  metas: "Progresso da meta mensal",
  agendamentos: "Callbacks agendados para hoje",
};

export default function CustomizeDashboardDialog({
  open,
  onOpenChange,
  layout,
  onSave,
  onReset,
}: Props) {
  const [draft, setDraft] = useState<DashboardLayout>(layout);

  useEffect(() => {
    if (open) setDraft(layout);
  }, [open, layout]);

  const toggle = (id: DashboardBlockId) =>
    setDraft((d) => ({ ...d, visible: { ...d.visible, [id]: !d.visible[id] } }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizar Dashboard</DialogTitle>
          <DialogDescription>
            Escolha quais blocos exibir no Dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {ALL_DASHBOARD_BLOCKS.map((id) => (
            <div
              key={id}
              className="rounded-lg border border-border/60 p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{LABELS[id]}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {DESCRIPTIONS[id]}
                </p>
              </div>
              <Switch
                checked={draft.visible[id]}
                onCheckedChange={() => toggle(id)}
              />
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(DEFAULT_DASHBOARD_LAYOUT);
              onReset();
            }}
            className="gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar padrão
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
