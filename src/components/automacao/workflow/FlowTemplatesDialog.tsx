import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FLOW_TEMPLATES, type FlowTemplate } from "./FlowTemplates";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (template: FlowTemplate) => void;
}

const FlowTemplatesDialog = ({ open, onClose, onSelect }: Props) => {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Templates de Fluxo</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 mt-2">
          {FLOW_TEMPLATES.map((tpl) => (
            <Card key={tpl.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => { onSelect(tpl); onClose(); }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="text-xl">{tpl.icon}</span>
                  {tpl.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">{tpl.description}</p>
                <p className="text-[10px] text-muted-foreground">{tpl.nodes.length} nós · {tpl.edges.length} conexões</p>
                <Button size="sm" variant="outline" className="w-full mt-2" onClick={(e) => { e.stopPropagation(); onSelect(tpl); onClose(); }}>
                  Usar Template
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FlowTemplatesDialog;
