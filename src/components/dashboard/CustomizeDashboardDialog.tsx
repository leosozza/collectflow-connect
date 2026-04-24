import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
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
  kpisTop: "KPIs superiores",
  parcelas: "Parcelas Programadas",
  totalRecebido: "Total Recebido",
  metas: "Metas",
  agendamentos: "Agendamentos para Hoje",
};

const ORDERABLE: DashboardBlockId[] = ["parcelas", "totalRecebido", "metas", "agendamentos"];

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

  const move = (id: DashboardBlockId, dir: -1 | 1) => {
    setDraft((d) => {
      const order = [...d.order];
      const idx = order.indexOf(id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= order.length) return d;
      [order[idx], order[target]] = [order[target], order[idx]];
      return { ...d, order };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizar Dashboard</DialogTitle>
          <DialogDescription>
            Escolha quais blocos exibir e a ordem deles. As preferências ficam salvas neste navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* KPIs (visibility only) */}
          <div className="rounded-lg border border-border/60 p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{LABELS.kpisTop}</p>
              <p className="text-[11px] text-muted-foreground">Linha superior de cards</p>
            </div>
            <Switch checked={draft.visible.kpisTop} onCheckedChange={() => toggle("kpisTop")} />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Blocos principais
            </p>
            {draft.order.map((id, idx) => (
              <div
                key={id}
                className="rounded-lg border border-border/60 p-3 flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{LABELS[id]}</p>
                  <p className="text-[11px] text-muted-foreground">Posição {idx + 1}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={idx === 0}
                    onClick={() => move(id, -1)}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={idx === draft.order.length - 1}
                    onClick={() => move(id, 1)}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                  <Switch checked={draft.visible[id]} onCheckedChange={() => toggle(id)} />
                </div>
              </div>
            ))}
            {/* Make sure orderable blocks not in order still appear (defensive) */}
            {ORDERABLE.filter((id) => !draft.order.includes(id)).map((id) => (
              <div
                key={id}
                className="rounded-lg border border-border/60 p-3 flex items-center justify-between"
              >
                <p className="text-sm font-medium">{LABELS[id]}</p>
                <Switch checked={draft.visible[id]} onCheckedChange={() => toggle(id)} />
              </div>
            ))}
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
            Salvar layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
