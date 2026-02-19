import { useEffect, useState } from "react";
import { Node } from "reactflow";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  node: Node | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Record<string, any>) => void;
}

const WorkflowNodeProperties = ({ node, open, onClose, onUpdate }: Props) => {
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (node) setForm({ ...node.data });
  }, [node]);

  if (!node) return null;

  const set = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }));

  const handleSave = () => {
    onUpdate(node.id, form);
    onClose();
  };

  const nodeType = node.data.nodeType as string;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-80 sm:max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Propriedades do Nó</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Rótulo</Label>
            <Input value={form.label || ""} onChange={(e) => set("label", e.target.value)} />
          </div>

          {/* Trigger fields */}
          {(nodeType === "trigger_overdue" || nodeType === "trigger_no_contact") && (
            <div>
              <Label>Dias</Label>
              <Input type="number" min={1} value={form.days || ""} onChange={(e) => set("days", Number(e.target.value))} />
            </div>
          )}

          {/* Action WhatsApp / SMS */}
          {(nodeType === "action_whatsapp" || nodeType === "action_sms") && (
            <div>
              <Label>Template da Mensagem</Label>
              <Textarea
                rows={4}
                value={form.message_template || ""}
                onChange={(e) => set("message_template", e.target.value)}
                placeholder="Use {{nome}}, {{cpf}}, {{valor}} como variáveis"
              />
            </div>
          )}

          {/* Wait */}
          {nodeType === "action_wait" && (
            <div>
              <Label>Dias para Aguardar</Label>
              <Input type="number" min={1} value={form.days || ""} onChange={(e) => set("days", Number(e.target.value))} />
            </div>
          )}

          {/* AI negotiate */}
          {nodeType === "action_ai_negotiate" && (
            <div>
              <Label>Contexto Adicional (opcional)</Label>
              <Textarea
                rows={3}
                value={form.context || ""}
                onChange={(e) => set("context", e.target.value)}
              />
            </div>
          )}

          {/* Update status */}
          {nodeType === "action_update_status" && (
            <div>
              <Label>Novo Status</Label>
              <Select value={form.new_status || ""} onValueChange={(v) => set("new_status", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_negociacao">Em Negociação</SelectItem>
                  <SelectItem value="acordado">Acordado</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="quebrado">Quebrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conditions */}
          {(nodeType === "condition_score" || nodeType === "condition_value") && (
            <>
              <div>
                <Label>Operador</Label>
                <Select value={form.operator || ">"} onValueChange={(v) => set("operator", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=">">Maior que (&gt;)</SelectItem>
                    <SelectItem value="<">Menor que (&lt;)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor</Label>
                <Input type="number" value={form.value || ""} onChange={(e) => set("value", Number(e.target.value))} />
              </div>
            </>
          )}

          <Button className="w-full" onClick={handleSave}>Salvar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WorkflowNodeProperties;
