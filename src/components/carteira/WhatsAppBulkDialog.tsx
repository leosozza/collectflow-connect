import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { fetchCollectionRules, CollectionRule } from "@/services/automacaoService";
import { Client } from "@/services/clientService";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, MessageSquare, Users, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface WhatsAppBulkDialogProps {
  open: boolean;
  onClose: () => void;
  selectedClients: Client[];
}

type SendState = "idle" | "sending" | "done";

const WhatsAppBulkDialog = ({ open, onClose, selectedClients }: WhatsAppBulkDialogProps) => {
  const { tenant } = useTenant();
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);

  const { data: rules = [] } = useQuery({
    queryKey: ["collection-rules", tenant?.id],
    queryFn: () => fetchCollectionRules(tenant!.id),
    enabled: !!tenant?.id && open,
  });

  const settings = (tenant?.settings as Record<string, any>) || {};
  const hasCredentials = !!settings.gupshup_api_key && !!settings.gupshup_source_number;

  useEffect(() => {
    if (!open) {
      setSendState("idle");
      setResult(null);
      setSelectedTemplate("");
      setCustomMessage("");
      setUseCustom(false);
    }
  }, [open]);

  const getMessageTemplate = (): string => {
    if (useCustom) return customMessage;
    const rule = rules.find((r) => r.id === selectedTemplate);
    return rule?.message_template || "";
  };

  const getPreview = (): string => {
    const template = getMessageTemplate();
    if (!template || selectedClients.length === 0) return "";
    const c = selectedClients[0];
    return template
      .replace(/\{\{nome\}\}/g, c.nome_completo)
      .replace(/\{\{cpf\}\}/g, c.cpf)
      .replace(/\{\{valor_parcela\}\}/g,
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(c.valor_parcela))
      )
      .replace(/\{\{data_vencimento\}\}/g,
        new Date(c.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")
      )
      .replace(/\{\{credor\}\}/g, c.credor);
  };

  const handleSend = async () => {
    const template = getMessageTemplate();
    if (!template.trim()) {
      toast.error("Defina uma mensagem antes de enviar");
      return;
    }
    setSendState("sending");
    try {
      const { data, error } = await supabase.functions.invoke("send-bulk-whatsapp", {
        body: {
          client_ids: selectedClients.map((c) => c.id),
          message_template: template,
        },
      });
      if (error) throw error;
      setResult({ sent: data.sent, failed: data.failed, errors: data.errors || [] });
      setSendState("done");
      if (data.sent > 0) toast.success(`${data.sent} mensagens enviadas!`);
      if (data.failed > 0) toast.warning(`${data.failed} falhas no envio`);
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || ""));
      setSendState("idle");
    }
  };

  const canSend = hasCredentials && (useCustom ? customMessage.trim() : selectedTemplate) && sendState === "idle";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Disparo WhatsApp em Lote
          </DialogTitle>
          <DialogDescription>
            Envie mensagens WhatsApp para os clientes selecionados
          </DialogDescription>
        </DialogHeader>

        {!hasCredentials ? (
          <div className="py-4 text-center text-muted-foreground text-sm">
            Configure as credenciais Gupshup na página de <strong>Automação &gt; Configurações</strong> primeiro.
          </div>
        ) : sendState === "done" && result ? (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <div className="flex justify-center gap-6">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-lg font-semibold">{result.sent} enviados</span>
                </div>
                {result.failed > 0 && (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="w-5 h-5" />
                    <span className="text-lg font-semibold">{result.failed} falhas</span>
                  </div>
                )}
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-muted rounded-lg p-3 max-h-32 overflow-y-auto">
                <p className="text-xs font-medium text-muted-foreground mb-1">Detalhes das falhas:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{e}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">{selectedClients.length} clientes selecionados</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Mensagem</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUseCustom(!useCustom)}
                  className="text-xs h-7"
                >
                  {useCustom ? "Usar template" : "Mensagem personalizada"}
                </Button>
              </div>

              {useCustom ? (
                <div className="space-y-1">
                  <Textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Olá {{nome}}, sua parcela de {{valor_parcela}} vence em {{data_vencimento}}..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Variáveis: {"{{nome}}"}, {"{{cpf}}"}, {"{{valor_parcela}}"}, {"{{data_vencimento}}"}, {"{{credor}}"}
                  </p>
                </div>
              ) : (
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {rules.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {getPreview() && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Preview (1º cliente):</Label>
                <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">
                  {getPreview()}
                </div>
              </div>
            )}

            {sendState === "sending" && (
              <div className="space-y-2">
                <Progress value={undefined} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">Enviando mensagens...</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {sendState === "done" ? "Fechar" : "Cancelar"}
          </Button>
          {sendState !== "done" && (
            <Button onClick={handleSend} disabled={!canSend} className="gap-2">
              {sendState === "sending" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MessageSquare className="w-4 h-4" />
              )}
              {sendState === "sending" ? "Enviando..." : "Enviar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppBulkDialog;
