import { useState, useEffect, useMemo } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { fetchTemplates, WhatsAppTemplate } from "@/services/whatsappTemplateService";
import { Client } from "@/services/clientService";
import {
  deduplicateClients,
  distributeRoundRobin,
  fetchEligibleInstances,
  createCampaign,
  createRecipients,
  startCampaign,
  EligibleInstance,
} from "@/services/whatsappCampaignService";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import {
  Loader2,
  MessageSquare,
  Users,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Phone,
  Shuffle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface WhatsAppBulkDialogProps {
  open: boolean;
  onClose: () => void;
  selectedClients: Client[];
}

type Step = 1 | 2 | 3 | 4;

const WhatsAppBulkDialog = ({ open, onClose, selectedClients }: WhatsAppBulkDialogProps) => {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[]; finalStatus?: string } | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["whatsapp-templates", tenant?.id],
    queryFn: () => fetchTemplates(tenant!.id),
    enabled: !!tenant?.id && open,
  });

  const { data: instances = [] } = useQuery({
    queryKey: ["eligible-instances", tenant?.id],
    queryFn: () => fetchEligibleInstances(tenant!.id),
    enabled: !!tenant?.id && open,
  });

  useEffect(() => {
    if (!open) {
      setStep(1);
      setResult(null);
      setSelectedTemplate("");
      setCustomMessage("");
      setUseCustom(false);
      setSelectedInstanceIds([]);
      setSending(false);
    }
  }, [open]);

  // Auto-select all instances
  useEffect(() => {
    if (instances.length > 0 && selectedInstanceIds.length === 0) {
      setSelectedInstanceIds(instances.map((i) => i.id));
    }
  }, [instances]);

  const getMessageTemplate = (): string => {
    if (useCustom) return customMessage;
    const tpl = templates.find((t) => t.id === selectedTemplate);
    return tpl?.message_body || "";
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

  const dedup = useMemo(() => deduplicateClients(selectedClients), [selectedClients]);

  const distribution = useMemo(() => {
    if (selectedInstanceIds.length === 0) return {};
    const distributed = distributeRoundRobin(dedup.recipients, selectedInstanceIds);
    const counts: Record<string, number> = {};
    for (const r of distributed) {
      counts[r.assignedInstanceId] = (counts[r.assignedInstanceId] || 0) + 1;
    }
    return counts;
  }, [dedup.recipients, selectedInstanceIds]);

  const toggleInstance = (id: string) => {
    setSelectedInstanceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const canProceedStep1 = useCustom ? customMessage.trim().length > 0 : !!selectedTemplate;
  const canProceedStep2 = selectedInstanceIds.length > 0;

  const handleSend = async () => {
    if (!tenant?.id || !user?.id) return;
    const template = getMessageTemplate();
    if (!template.trim()) {
      toast.error("Defina uma mensagem antes de enviar");
      return;
    }
    setSending(true);
    setStep(4);

    try {
      const distributed = distributeRoundRobin(dedup.recipients, selectedInstanceIds);

      // Create campaign
      const campaign = await createCampaign({
        tenant_id: tenant.id,
        message_mode: useCustom ? "custom" : "template",
        message_body: template,
        template_id: useCustom ? null : selectedTemplate || null,
        selected_instance_ids: selectedInstanceIds,
        total_selected: selectedClients.length,
        total_unique_recipients: dedup.recipients.length,
        created_by: user.id,
      });

      // Create recipients
      await createRecipients(campaign.id, tenant.id, distributed, template);

      // Start campaign (calls edge function)
      const data = await startCampaign(campaign.id);

      setResult({
        sent: data?.sent || 0,
        failed: data?.failed || 0,
        errors: data?.errors || [],
        finalStatus: data?.finalStatus || undefined,
      });

      if (data?.sent > 0) toast.success(`${data.sent} mensagens enviadas!`);
      if (data?.failed > 0) toast.warning(`${data.failed} falhas no envio`);
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || ""));
      setResult({ sent: 0, failed: dedup.recipients.length, errors: [err.message] });
    } finally {
      setSending(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center gap-1 mb-4">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            s <= step ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Mensagem</Label>
        <Button variant="ghost" size="sm" onClick={() => setUseCustom(!useCustom)} className="text-xs h-7">
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
            {templates.filter(t => t.is_active).map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {getPreview() && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Preview (1º cliente):</Label>
          <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap">{getPreview()}</div>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Phone className="w-4 h-4 text-primary" />
        <Label className="text-sm font-medium">Selecione as instâncias para envio</Label>
      </div>
      {instances.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
          Nenhuma instância não-oficial ativa encontrada. Configure instâncias em <strong>Integrações &gt; WhatsApp</strong>.
        </div>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {instances.map((inst) => (
            <label
              key={inst.id}
              className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={selectedInstanceIds.includes(inst.id)}
                onCheckedChange={() => toggleInstance(inst.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{inst.name}</p>
                <p className="text-xs text-muted-foreground">
                  {inst.phone_number || inst.instance_name} · {inst.provider}
                </p>
              </div>
              <Badge variant="outline" className="text-xs shrink-0">
                {inst.provider_category === "unofficial" ? "Não oficial" : "Oficial"}
              </Badge>
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {selectedInstanceIds.length} instância(s) selecionada(s) — distribuição round-robin automática
      </p>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <p className="text-2xl font-bold text-primary">{selectedClients.length}</p>
          <p className="text-xs text-muted-foreground">Selecionados</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 text-center">
          <p className="text-2xl font-bold text-green-600">{dedup.recipients.length}</p>
          <p className="text-xs text-muted-foreground">Destinatários únicos</p>
        </div>
      </div>

      {dedup.excludedCount > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 text-yellow-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {dedup.excludedCount} cliente(s) sem telefone válido (excluídos)
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Shuffle className="w-4 h-4 text-primary" />
          <Label className="text-sm font-medium">Distribuição por instância</Label>
        </div>
        <div className="space-y-1">
          {selectedInstanceIds.map((id) => {
            const inst = instances.find((i) => i.id === id);
            const count = distribution[id] || 0;
            const pct = dedup.recipients.length > 0 ? Math.round((count / dedup.recipients.length) * 100) : 0;
            return (
              <div key={id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                <span className="truncate">{inst?.name || id}</span>
                <span className="font-medium text-primary">{count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-3 rounded-lg border border-dashed text-sm text-muted-foreground">
        <p><strong>Mensagem:</strong> {useCustom ? "Personalizada" : templates.find(t => t.id === selectedTemplate)?.name || "—"}</p>
        <p><strong>Instâncias:</strong> {selectedInstanceIds.length}</p>
        <p><strong>Modo:</strong> Round-robin automático</p>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4 py-4">
      {sending ? (
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Criando campanha e enviando mensagens...</p>
          <Progress value={undefined} className="h-2" />
        </div>
      ) : result ? (
        <>
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
        </>
      ) : null}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Disparo WhatsApp em Lote
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Defina a mensagem para envio"}
            {step === 2 && "Selecione as instâncias de envio"}
            {step === 3 && "Confirme o resumo da campanha"}
            {step === 4 && (sending ? "Processando campanha..." : "Resultado do envio")}
          </DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 mb-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{selectedClients.length} clientes selecionados</span>
        </div>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        <DialogFooter className="flex justify-between gap-2">
          {step > 1 && step < 4 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as Step)} className="gap-1">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>
              {step === 4 && !sending ? "Fechar" : "Cancelar"}
            </Button>
            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="gap-1">
                Próximo <ChevronRight className="w-4 h-4" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={() => setStep(3)} disabled={!canProceedStep2} className="gap-1">
                Próximo <ChevronRight className="w-4 h-4" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleSend} disabled={sending} className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Criar Campanha e Enviar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppBulkDialog;
