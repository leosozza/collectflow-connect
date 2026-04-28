import { useEffect, useState } from "react";
import { RotateCcw, GripVertical } from "lucide-react";
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
  kpiAcionadosHoje: "Acionados Hoje",
  kpiAcordosDia: "Acordos do Dia",
  kpiAcordosMes: "Acordos do Mês",
  kpiQuebra: "Total de Quebra",
  kpiPendentes: "Pendentes",
  kpiColchao: "Colchão de Acordos",
  parcelas: "Parcelas Programadas",
  totalRecebido: "Total Recebido",
  metas: "Metas",
  agendamentos: "Agendamentos para Hoje",
};

const KPI_GROUP: DashboardBlockId[] = [
  "kpiAcionadosHoje",
  "kpiAcordosDia",
  "kpiAcordosMes",
  "kpiQuebra",
  "kpiPendentes",
  "kpiColchao",
];

const CARD_GROUP: DashboardBlockId[] = [
  "metas",
  "agendamentos",
  "totalRecebido",
  "parcelas",
];

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

  const renderRow = (id: DashboardBlockId) => (
    <div
      key={id}
      className="rounded-lg border border-border/60 p-2.5 flex items-center justify-between gap-3"
    >
      <p className="text-sm font-medium truncate">{LABELS[id]}</p>
      <Switch checked={draft.visible[id]} onCheckedChange={() => toggle(id)} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personalizar Dashboard</DialogTitle>
          <DialogDescription>
            Escolha quais blocos exibir. Para reordenar, arraste os cards
            diretamente no Dashboard pelo ícone{" "}
            <GripVertical className="inline w-3 h-3 align-text-bottom" />.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
              KPIs
            </p>
            <div className="space-y-2">{KPI_GROUP.map(renderRow)}</div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
              Cards
            </p>
            <div className="space-y-2">{CARD_GROUP.map(renderRow)}</div>
          </div>
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
