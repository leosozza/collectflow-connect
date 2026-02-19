import { useEffect, useState } from "react";
import { Node } from "reactflow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Trash2, Copy, X, Plus } from "lucide-react";
import { getNodeTypeConfig } from "./FlowNodeTypes";

interface Props {
  node: Node | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, data: Record<string, any>) => void;
  onDelete?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string) => void;
}

const WorkflowNodeProperties = ({ node, open, onClose, onUpdate, onDelete, onDuplicate }: Props) => {
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (node) setForm({ ...node.data });
  }, [node]);

  if (!node || !open) return null;

  const set = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }));
  const handleSave = () => { onUpdate(node.id, form); onClose(); };
  const nodeType = node.data.nodeType as string;
  const config = getNodeTypeConfig(nodeType);

  return (
    <div className="w-72 border-l bg-card flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          {config && <config.icon className="w-4 h-4" style={{ color: config.color }} />}
          <h4 className="text-sm font-semibold truncate">Propriedades</h4>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {/* Label */}
          <div>
            <Label className="text-xs">Rótulo</Label>
            <Input className="h-8 text-xs" value={form.label || ""} onChange={(e) => set("label", e.target.value)} />
          </div>

          {/* Trigger days */}
          {(nodeType === "trigger_overdue" || nodeType === "trigger_no_contact") && (
            <div>
              <Label className="text-xs">Dias</Label>
              <Input className="h-8 text-xs" type="number" min={1} value={form.days || ""} onChange={(e) => set("days", Number(e.target.value))} />
            </div>
          )}

          {/* Webhook trigger */}
          {nodeType === "trigger_webhook" && (
            <div>
              <Label className="text-xs">URL do Webhook</Label>
              <Input className="h-8 text-xs" value={form.webhook_url || ""} onChange={(e) => set("webhook_url", e.target.value)} placeholder="https://..." />
            </div>
          )}

          {/* WhatsApp Text / SMS */}
          {(nodeType === "action_whatsapp" || nodeType === "action_sms") && (
            <div>
              <Label className="text-xs">Template da Mensagem</Label>
              <Textarea rows={4} className="text-xs" value={form.message_template || ""} onChange={(e) => set("message_template", e.target.value)} placeholder="Use {{nome}}, {{cpf}}, {{valor}}" />
              <p className="text-[10px] text-muted-foreground mt-1">Variáveis: {"{{nome}}"}, {"{{cpf}}"}, {"{{valor}}"}</p>
            </div>
          )}

          {/* WhatsApp Media */}
          {nodeType === "action_whatsapp_media" && (
            <>
              <div>
                <Label className="text-xs">Tipo de Mídia</Label>
                <Select value={form.media_type || "image"} onValueChange={(v) => set("media_type", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">URL da Mídia</Label>
                <Input className="h-8 text-xs" value={form.media_url || ""} onChange={(e) => set("media_url", e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <Label className="text-xs">Legenda</Label>
                <Input className="h-8 text-xs" value={form.caption || ""} onChange={(e) => set("caption", e.target.value)} />
              </div>
            </>
          )}

          {/* WhatsApp Buttons */}
          {nodeType === "action_whatsapp_buttons" && (
            <>
              <div>
                <Label className="text-xs">Mensagem</Label>
                <Textarea rows={3} className="text-xs" value={form.message_template || ""} onChange={(e) => set("message_template", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Botões (máx 3)</Label>
                <div className="space-y-1.5 mt-1">
                  {(form.buttons || []).map((btn: any, i: number) => (
                    <div key={btn.id || i} className="flex gap-1">
                      <Input className="h-7 text-xs flex-1" value={btn.text} onChange={(e) => {
                        const btns = [...(form.buttons || [])];
                        btns[i] = { ...btns[i], text: e.target.value };
                        set("buttons", btns);
                      }} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => {
                        set("buttons", (form.buttons || []).filter((_: any, j: number) => j !== i));
                      }}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {(form.buttons || []).length < 3 && (
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => {
                      set("buttons", [...(form.buttons || []), { id: `btn_${Date.now()}`, text: "" }]);
                    }}>
                      <Plus className="w-3 h-3 mr-1" /> Adicionar Botão
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Email */}
          {nodeType === "action_email" && (
            <>
              <div>
                <Label className="text-xs">Assunto</Label>
                <Input className="h-8 text-xs" value={form.subject || ""} onChange={(e) => set("subject", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Corpo</Label>
                <Textarea rows={4} className="text-xs" value={form.body || ""} onChange={(e) => set("body", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Campo de Email</Label>
                <Input className="h-8 text-xs" value={form.to_field || "email"} onChange={(e) => set("to_field", e.target.value)} />
              </div>
            </>
          )}

          {/* Wait / Delay (days) */}
          {nodeType === "action_wait" && (
            <div>
              <Label className="text-xs">Dias para Aguardar</Label>
              <Input className="h-8 text-xs" type="number" min={1} value={form.days || ""} onChange={(e) => set("days", Number(e.target.value))} />
            </div>
          )}

          {/* Delay (minutes) */}
          {nodeType === "delay" && (
            <>
              <div>
                <Label className="text-xs">Duração</Label>
                <div className="flex gap-2">
                  <Input className="h-8 text-xs flex-1" type="number" min={1} value={form.delay_minutes || 60} onChange={(e) => set("delay_minutes", Number(e.target.value))} />
                  <Select value={form.delay_unit || "minutes"} onValueChange={(v) => set("delay_unit", v)}>
                    <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Min</SelectItem>
                      <SelectItem value="hours">Horas</SelectItem>
                      <SelectItem value="days">Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Slider value={[form.delay_minutes || 60]} min={1} max={1440} step={1} onValueChange={([v]) => set("delay_minutes", v)} />
              </div>
            </>
          )}

          {/* AI Negotiate */}
          {nodeType === "action_ai_negotiate" && (
            <div>
              <Label className="text-xs">Contexto Adicional</Label>
              <Textarea rows={3} className="text-xs" value={form.context || ""} onChange={(e) => set("context", e.target.value)} />
            </div>
          )}

          {/* Update Status */}
          {nodeType === "action_update_status" && (
            <div>
              <Label className="text-xs">Novo Status</Label>
              <Select value={form.new_status || ""} onValueChange={(v) => set("new_status", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar" /></SelectTrigger>
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

          {/* Conditions (score/value/status) */}
          {(nodeType === "condition_score" || nodeType === "condition_value") && (
            <>
              <div>
                <Label className="text-xs">Operador</Label>
                <Select value={form.operator || ">"} onValueChange={(v) => set("operator", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=">">Maior que (&gt;)</SelectItem>
                    <SelectItem value="<">Menor que (&lt;)</SelectItem>
                    <SelectItem value="=">Igual (=)</SelectItem>
                    <SelectItem value="!=">Diferente (≠)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor</Label>
                <Input className="h-8 text-xs" type="number" value={form.value || ""} onChange={(e) => set("value", Number(e.target.value))} />
              </div>
            </>
          )}

          {nodeType === "condition_status" && (
            <div>
              <Label className="text-xs">Status (separados por vírgula)</Label>
              <Input className="h-8 text-xs" value={(form.status_values || []).join(", ")} onChange={(e) => set("status_values", e.target.value.split(",").map((s: string) => s.trim()))} placeholder="pendente, em_negociacao" />
            </div>
          )}

          {/* Wait Response */}
          {nodeType === "wait_response" && (
            <div>
              <Label className="text-xs">Timeout (segundos)</Label>
              <Input className="h-8 text-xs" type="number" min={30} value={form.timeout_seconds || 3600} onChange={(e) => set("timeout_seconds", Number(e.target.value))} />
            </div>
          )}

          {/* Input Capture */}
          {nodeType === "input_capture" && (
            <>
              <div>
                <Label className="text-xs">Pergunta</Label>
                <Textarea rows={2} className="text-xs" value={form.question || ""} onChange={(e) => set("question", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Nome da Variável</Label>
                <Input className="h-8 text-xs" value={form.variable_name || ""} onChange={(e) => set("variable_name", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Tipo de Validação</Label>
                <Select value={form.validation_type || "text"} onValueChange={(v) => set("validation_type", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="number">Número</SelectItem>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Create Agreement */}
          {nodeType === "action_create_agreement" && (
            <>
              <div>
                <Label className="text-xs">Desconto (%)</Label>
                <Input className="h-8 text-xs" type="number" min={0} max={100} value={form.discount || ""} onChange={(e) => set("discount", Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Parcelas</Label>
                <Input className="h-8 text-xs" type="number" min={1} value={form.installments || ""} onChange={(e) => set("installments", Number(e.target.value))} />
              </div>
            </>
          )}

          {/* Webhook Action */}
          {nodeType === "action_webhook" && (
            <>
              <div>
                <Label className="text-xs">URL</Label>
                <Input className="h-8 text-xs" value={form.url || ""} onChange={(e) => set("url", e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <Label className="text-xs">Método</Label>
                <Select value={form.method || "POST"} onValueChange={(v) => set("method", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Headers (JSON)</Label>
                <Textarea rows={2} className="text-xs" value={form.headers || ""} onChange={(e) => set("headers", e.target.value)} placeholder='{"Authorization": "Bearer ..."}' />
              </div>
              <div>
                <Label className="text-xs">Body Template</Label>
                <Textarea rows={3} className="text-xs" value={form.body_template || ""} onChange={(e) => set("body_template", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Salvar Resposta em</Label>
                <Input className="h-8 text-xs" value={form.save_to || ""} onChange={(e) => set("save_to", e.target.value)} placeholder="variavel_resposta" />
              </div>
            </>
          )}

          {/* Set Variable */}
          {nodeType === "action_set_variable" && (
            <>
              <div>
                <Label className="text-xs">Nome</Label>
                <Input className="h-8 text-xs" value={form.var_name || ""} onChange={(e) => set("var_name", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Valor</Label>
                <Input className="h-8 text-xs" value={form.var_value || ""} onChange={(e) => set("var_value", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Escopo</Label>
                <Select value={form.var_scope || "flow"} onValueChange={(v) => set("var_scope", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flow">Fluxo</SelectItem>
                    <SelectItem value="client">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Transfer to Human */}
          {nodeType === "transfer_to_human" && (
            <>
              <div>
                <Label className="text-xs">Departamento</Label>
                <Input className="h-8 text-xs" value={form.department || ""} onChange={(e) => set("department", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Mensagem</Label>
                <Textarea rows={2} className="text-xs" value={form.message || ""} onChange={(e) => set("message", e.target.value)} />
              </div>
            </>
          )}

          {/* Loop */}
          {nodeType === "loop" && (
            <>
              <div>
                <Label className="text-xs">Máx. Iterações</Label>
                <Input className="h-8 text-xs" type="number" min={1} max={100} value={form.max_iterations || 5} onChange={(e) => set("max_iterations", Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Condição de Saída</Label>
                <Input className="h-8 text-xs" value={form.exit_condition || ""} onChange={(e) => set("exit_condition", e.target.value)} placeholder="Ex: status == pago" />
              </div>
            </>
          )}

          {/* Save */}
          <Button className="w-full" size="sm" onClick={handleSave}>Salvar</Button>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            {onDuplicate && (
              <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => onDuplicate(node.id)}>
                <Copy className="w-3 h-3 mr-1" /> Duplicar
              </Button>
            )}
            {onDelete && (
              <Button variant="outline" size="sm" className="flex-1 text-xs text-destructive" onClick={() => onDelete(node.id)}>
                <Trash2 className="w-3 h-3 mr-1" /> Excluir
              </Button>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default WorkflowNodeProperties;
