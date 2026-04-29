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
  metas: "Meta do Mês",
  totalRecebido: "Total Recebido",
  kpisOperacionais: "KPIs Operacionais",
  agendamentos: "Agendamentos para Hoje",
  parcelas: "Parcelas Programadas",
  totalQuebra: "Total de Quebra",
  pendentes: "Pendentes",
  colchaoAcordos: "Colchão de Acordos",
};

const DESCRIPTIONS: Record<DashboardBlockId, string> = {
  metas: "Progresso da meta mensal",
  totalRecebido: "Gráfico de recebimentos",
  kpisOperacionais: "Acionados hoje, acordos do dia e do mês",
  agendamentos: "Callbacks agendados para hoje",
  parcelas: "Vencimentos do dia",
  totalQuebra: "Valor total de quebra de acordos",
  pendentes: "Valor pendente de pagamento",
  colchaoAcordos: "Total projetado em acordos",
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
            Escolha quais blocos exibir. Para reordenar, basta arrastar os cards
            diretamente no Dashboard pelo ícone <GripVertical className="inline w-3 h-3 align-text-bottom" />.
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
