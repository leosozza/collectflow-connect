import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { fetchTemplates, WhatsAppTemplate } from "@/services/whatsappTemplateService";
import { Client } from "@/services/clientService";
import {
  deduplicateClients,
  distributeRoundRobin,
  distributeWeighted,
  fetchEligibleInstances,
  createCampaign,
  createRecipients,
  startCampaign,
  deriveProviderCategory,
  isMixedProviderSelection,
  pollCampaignProgress,
  EligibleInstance,
  CampaignProgress,
  InstanceWeight,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
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
  ShieldCheck,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface WhatsAppBulkDialogProps {
  open: boolean;
  onClose: () => void;
  selectedClients: Client[];
}

type Step = 1 | 2 | 3 | 4;

const AVG_DELAY_PER_MESSAGE_S = 11.5; // average of 8-15s
const BATCH_REST_S = 120; // 2 min rest every 15 messages
const BATCH_SIZE = 15;

function estimateTimeMinutes(totalRecipients: number): number {
  const batches = Math.floor(totalRecipients / BATCH_SIZE);
  const totalDelayS = totalRecipients * AVG_DELAY_PER_MESSAGE_S + batches * BATCH_REST_S;
  return Math.ceil(totalDelayS / 60);
}

const WhatsAppBulkDialog = ({ open, onClose, selectedClients }: WhatsAppBulkDialogProps) => {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [distributionMode, setDistributionMode] = useState<"equal" | "weighted">("equal");
  const [weightMap, setWeightMap] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[]; finalStatus?: string } | null>(null);
  const [confirmStartOpen, setConfirmStartOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Cleanup polling on unmount or close
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setResult(null);
      setSelectedTemplate("");
      setCustomMessage("");
      setUseCustom(false);
      setSelectedInstanceIds([]);
      setDistributionMode("equal");
      setWeightMap({});
      setSending(false);
      setCampaignId(null);
      setProgress(null);
      setConfirmStartOpen(false);
      setCampaignName("");
      stopPolling();
    }
  }, [open, stopPolling]);

  // Polling for campaign progress — drives final result
  useEffect(() => {
    if (sending && campaignId) {
      pollingRef.current = setInterval(async () => {
        const p = await pollCampaignProgress(campaignId);
        if (p) {
          setProgress(p);
          // When campaign reaches a terminal status, finalize UI from real DB data
          if (["completed", "completed_with_errors", "failed"].includes(p.status)) {
            stopPolling();
            setResult({
              sent: p.sent_count,
              failed: p.failed_count,
              errors: [],
              finalStatus: p.status,
            });
            setSending(false);
            if (p.sent_count > 0) toast.success(`${p.sent_count} mensagens enviadas!`);
            if (p.failed_count > 0) toast.warning(`${p.failed_count} falhas no envio`);
          }
        }
      }, 5000);
    }
    return stopPolling;
  }, [sending, campaignId, stopPolling]);

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

  // Equalize weights whenever the selected set changes (sum to 100, last absorbs remainder)
  useEffect(() => {
    if (selectedInstanceIds.length === 0) {
      setWeightMap({});
      return;
    }
    const n = selectedInstanceIds.length;
    const base = Math.floor(100 / n);
    const remainder = 100 - base * n;
    const next: Record<string, number> = {};
    selectedInstanceIds.forEach((id, idx) => {
      next[id] = idx === n - 1 ? base + remainder : base;
    });
    setWeightMap(next);
  }, [selectedInstanceIds]);

  const weightsArray: InstanceWeight[] = useMemo(
    () => selectedInstanceIds.map((id) => ({ instanceId: id, weight: weightMap[id] ?? 0 })),
    [selectedInstanceIds, weightMap]
  );

  const weightsSum = useMemo(
    () => weightsArray.reduce((s, w) => s + (w.weight || 0), 0),
    [weightsArray]
  );

  const distribution = useMemo(() => {
    if (selectedInstanceIds.length === 0) return {};
    const distributed =
      distributionMode === "weighted" && weightsSum === 100
        ? distributeWeighted(dedup.recipients, weightsArray)
        : distributeRoundRobin(dedup.recipients, selectedInstanceIds);
    const counts: Record<string, number> = {};
    for (const r of distributed) {
      counts[r.assignedInstanceId] = (counts[r.assignedInstanceId] || 0) + 1;
    }
    return counts;
  }, [dedup.recipients, selectedInstanceIds, distributionMode, weightsArray, weightsSum]);

  const toggleInstance = (id: string) => {
    setSelectedInstanceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const updateWeight = (id: string, value: number) => {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    setWeightMap((prev) => ({ ...prev, [id]: v }));
  };

  const equalizeWeights = () => {
    if (selectedInstanceIds.length === 0) return;
    const n = selectedInstanceIds.length;
    const base = Math.floor(100 / n);
    const remainder = 100 - base * n;
    const next: Record<string, number> = {};
    selectedInstanceIds.forEach((id, idx) => {
      next[id] = idx === n - 1 ? base + remainder : base;
    });
    setWeightMap(next);
  };

  const isMixed = useMemo(
    () => isMixedProviderSelection(selectedInstanceIds, instances),
    [selectedInstanceIds, instances]
  );

  const providerCategory = useMemo(
    () => deriveProviderCategory(selectedInstanceIds, instances),
    [selectedInstanceIds, instances]
  );

  const canProceedStep1 = useCustom ? customMessage.trim().length > 0 : !!selectedTemplate;
  const weightsValid =
    distributionMode === "equal" ||
    (weightsSum === 100 && selectedInstanceIds.every((id) => (weightMap[id] ?? 0) > 0));
  const canProceedStep2 = selectedInstanceIds.length > 0 && !isMixed && weightsValid;

  // Pre-send validation
  const getValidationErrors = (): string[] => {
    const errors: string[] = [];
    if (selectedInstanceIds.length === 0) errors.push("Selecione pelo menos uma instância");
    if (isMixed) errors.push("Não é permitido misturar instâncias oficiais e não-oficiais. Crie campanhas separadas.");
    if (!getMessageTemplate().trim()) errors.push("Defina uma mensagem antes de enviar");
    if (dedup.recipients.length === 0) errors.push("Nenhum destinatário válido encontrado");
    if (distributionMode === "weighted") {
      if (weightsSum !== 100) errors.push(`Os pesos devem somar 100% (atual: ${weightsSum}%)`);
      if (selectedInstanceIds.some((id) => (weightMap[id] ?? 0) <= 0))
        errors.push("Todas as instâncias selecionadas precisam ter peso maior que 0");
    }
    return errors;
  };

  const buildDefaultName = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `Disparo carteira ${hh}:${mm}`;
  };

  const requestStart = () => {
    if (!tenant?.id || !user?.id) return;
    const validationErrors = getValidationErrors();
    if (validationErrors.length > 0) {
      validationErrors.forEach((e) => toast.error(e));
      return;
    }
    if (!campaignName.trim()) setCampaignName(buildDefaultName());
    setConfirmStartOpen(true);
  };

  const handleSend = async () => {
    if (!tenant?.id || !user?.id) return;

    const validationErrors = getValidationErrors();
    if (validationErrors.length > 0) {
      validationErrors.forEach((e) => toast.error(e));
      return;
    }

    const template = getMessageTemplate();
    setConfirmStartOpen(false);
    setSending(true);
    setStep(4);

    try {
      const useWeighted = distributionMode === "weighted" && weightsSum === 100;
      const distributed = useWeighted
        ? distributeWeighted(dedup.recipients, weightsArray)
        : distributeRoundRobin(dedup.recipients, selectedInstanceIds);
      const providerCategory = deriveProviderCategory(selectedInstanceIds, instances);
      const finalName = campaignName.trim() || buildDefaultName();

      const campaign = await createCampaign({
        tenant_id: tenant.id,
        message_mode: useCustom ? "custom" : "template",
        message_body: template,
        template_id: useCustom ? null : selectedTemplate || null,
        selected_instance_ids: selectedInstanceIds,
        total_selected: selectedClients.length,
        total_unique_recipients: dedup.recipients.length,
        created_by: user.id,
        provider_category: providerCategory,
        name: finalName,
        instance_weights: useWeighted ? weightsArray : null,
      });

      setCampaignId(campaign.id);
      await createRecipients(campaign.id, tenant.id, distributed, template);

      // Fire-and-forget: triggers edge function, polling handles progress/result
      await startCampaign(campaign.id);
      // sending stays true — polling useEffect will set result + setSending(false) when done
    } catch (err: any) {
      toast.error("Erro ao criar campanha: " + (err.message || ""));
      setResult({ sent: 0, failed: dedup.recipients.length, errors: [err.message] });
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

  const getProviderBadge = (inst: EligibleInstance) => {
    if (inst.provider_category === "official_meta" || inst.provider === "gupshup") {
      return <Badge className="text-xs shrink-0 bg-green-100 text-green-800 border-green-300">Oficial</Badge>;
    }
    const label = inst.provider === "wuzapi" ? "WuzAPI" : inst.provider === "baylers" ? "Baylers" : inst.provider || "Evolution";
    return <Badge variant="outline" className="text-xs shrink-0">{label}</Badge>;
  };

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
          Nenhuma instância habilitada para disparo em lote. Verifique se há instâncias com status operacional em <strong>Integrações &gt; WhatsApp</strong>.
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
              {getProviderBadge(inst)}
            </label>
          ))}
        </div>
      )}
      {isMixed && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Você selecionou instâncias oficiais e não-oficiais. Crie campanhas separadas para cada tipo.
        </div>
      )}

      {selectedInstanceIds.length > 0 && !isMixed && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-medium">Distribuição</Label>
            <div className="flex items-center rounded-md border overflow-hidden">
              <button
                type="button"
                onClick={() => setDistributionMode("equal")}
                className={`px-3 py-1 text-xs transition-colors ${
                  distributionMode === "equal"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                Igual
              </button>
              <button
                type="button"
                onClick={() => setDistributionMode("weighted")}
                className={`px-3 py-1 text-xs transition-colors ${
                  distributionMode === "weighted"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                Por peso
              </button>
            </div>
          </div>

          {distributionMode === "equal" ? (
            <p className="text-xs text-muted-foreground">
              Round-robin: os {dedup.recipients.length} destinatários únicos serão distribuídos igualmente entre {selectedInstanceIds.length} instância(s).
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Ajuste a porcentagem de envios por número (soma deve ser 100%).
                </p>
                <Button type="button" variant="ghost" size="sm" onClick={equalizeWeights} className="h-6 text-xs">
                  Equalizar
                </Button>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {selectedInstanceIds.map((id) => {
                  const inst = instances.find((i) => i.id === id);
                  const w = weightMap[id] ?? 0;
                  const count = Math.round((dedup.recipients.length * w) / 100);
                  return (
                    <div key={id} className="space-y-1 rounded-md border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate flex-1">{inst?.name || id}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={w}
                            onChange={(e) => updateWeight(id, Number(e.target.value) || 0)}
                            className="h-7 w-16 text-right text-xs"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={w}
                        onChange={(e) => updateWeight(id, Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <p className="text-xs text-muted-foreground">
                        ~{count} destinatário(s)
                      </p>
                    </div>
                  );
                })}
              </div>
              <div
                className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                  weightsSum === 100
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                <span>Soma dos pesos</span>
                <span className="font-semibold">{weightsSum}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {selectedInstanceIds.length} instância(s) selecionada(s)
        {distributionMode === "weighted" ? " — distribuição personalizada" : " — distribuição igual (round-robin)"}
      </p>
    </div>
  );

  const renderStep3 = () => {
    const validationErrors = getValidationErrors();
    const estimatedMin = estimateTimeMinutes(dedup.recipients.length);

    return (
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

        {/* Anti-Ban notice — provider-specific */}
        <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
          providerCategory === "official_meta"
            ? "bg-blue-500/10 border-blue-500/20 text-blue-700"
            : "bg-green-500/10 border-green-500/20 text-green-700"
        }`}>
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-medium">
              {providerCategory === "official_meta" ? "Modo Oficial" : "Modo Anti-Ban Ativo (Não-Oficial)"}
            </p>
            <p className="text-xs mt-0.5">
              {providerCategory === "official_meta"
                ? `Intervalos de 1-3s entre mensagens + pausa de 30s a cada 50 envios. Tempo estimado: ~${Math.ceil(dedup.recipients.length * 2 / 60 + Math.floor(dedup.recipients.length / 50) * 0.5)} minutos`
                : `Intervalos de 8-15s entre mensagens + pausa de 2min a cada 15 envios por instância. Tempo estimado: ~${estimatedMin} minutos`
              }
            </p>
          </div>
        </div>

        {validationErrors.length > 0 && (
          <div className="space-y-1 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            {validationErrors.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="w-4 h-4 shrink-0" />
                {e}
              </div>
            ))}
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
          <p><strong>Modo:</strong> Round-robin automático com proteção Anti-Ban</p>
        </div>
      </div>
    );
  };

  const getCampaignStatusBadge = () => {
    if (!result?.finalStatus) return null;
    const map: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
      completed: { label: "Concluída", variant: "default" },
      completed_with_errors: { label: "Concluída com falhas", variant: "secondary" },
      failed: { label: "Falhou", variant: "destructive" },
    };
    const info = map[result.finalStatus] || { label: result.finalStatus, variant: "outline" as const };
    return <Badge variant={info.variant} className="text-sm px-3 py-1">{info.label}</Badge>;
  };

  const renderStep4 = () => {
    const totalRecipients = dedup.recipients.length;
    const currentSent = progress?.sent_count || 0;
    const currentFailed = progress?.failed_count || 0;
    const currentProcessed = currentSent + currentFailed;
    const progressPct = totalRecipients > 0 ? Math.round((currentProcessed / totalRecipients) * 100) : 0;
    const estimatedMin = estimateTimeMinutes(totalRecipients);
    const remainingRecipients = totalRecipients - currentProcessed;
    const estimatedRemainingMin = estimateTimeMinutes(remainingRecipients > 0 ? remainingRecipients : 0);

    return (
      <div className="space-y-4 py-4">
        {sending ? (
          <div className="space-y-4">
            {/* Anti-Ban Badge */}
            <div className="flex items-center justify-center gap-2">
              <Badge className="bg-green-100 text-green-800 border-green-300 gap-1.5 px-3 py-1.5">
                <ShieldCheck className="w-4 h-4" />
                Modo Anti-Ban Ativo
              </Badge>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <Progress value={progressPct} className="h-3" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {currentProcessed} de {totalRecipients} processados
                </span>
                <span className="font-medium text-primary">{progressPct}%</span>
              </div>
            </div>

            {/* Counters */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-primary">{currentSent}</p>
                <p className="text-xs text-muted-foreground">Enviados</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-destructive">{currentFailed}</p>
                <p className="text-xs text-muted-foreground">Falhas</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold text-muted-foreground">{remainingRecipients > 0 ? remainingRecipients : 0}</p>
                <p className="text-xs text-muted-foreground">Restantes</p>
              </div>
            </div>

            {/* Time estimate */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              {currentProcessed > 0
                ? `~${estimatedRemainingMin} min restante${estimatedRemainingMin !== 1 ? "s" : ""}`
                : `Tempo estimado: ~${estimatedMin} minutos`
              }
            </div>

            {/* Explanation */}
            <p className="text-xs text-center text-muted-foreground">
              Enviando com intervalos de segurança para proteger suas instâncias.
              Você pode fechar esta janela — a campanha continua em segundo plano.
            </p>

            {/* Spinner */}
            <div className="flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          </div>
        ) : result ? (
          <>
            <div className="text-center space-y-3">
              {getCampaignStatusBadge()}
              <div className="flex justify-center gap-6 mt-2">
                <div className="flex items-center gap-2 text-primary">
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
              <p className="text-xs text-muted-foreground">
                Total processado: {result.sent + result.failed} destinatário(s)
              </p>
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
  };

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
            {step === 4 && (sending ? "Processando campanha em modo seguro..." : "Resultado do envio")}
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
              {step === 4 && !sending ? "Fechar" : sending ? "Fechar (continua em 2º plano)" : "Cancelar"}
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
              <Button onClick={requestStart} disabled={sending || getValidationErrors().length > 0} className="gap-2">
                <ShieldCheck className="w-4 h-4" />
                Criar Campanha e Enviar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {/* W2.1 — Bloqueante: confirmação antes de iniciar disparo */}
      <AlertDialog
        open={confirmStartOpen}
        onOpenChange={(v) => {
          if (sending) return;
          setConfirmStartOpen(v);
        }}
      >
        <AlertDialogContent
          onEscapeKeyDown={(e) => {
            if (sending) e.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar disparo em lote
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div className="space-y-1">
                  <Label htmlFor="campaign-name" className="text-xs">Nome da campanha</Label>
                  <Input
                    id="campaign-name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder={buildDefaultName()}
                    disabled={sending}
                    className="h-8"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">Destinatários únicos</p>
                    <p className="text-lg font-semibold text-foreground">{dedup.recipients.length}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">Tempo estimado</p>
                    <p className="text-lg font-semibold text-foreground">
                      ~{providerCategory === "official_meta"
                        ? Math.ceil(dedup.recipients.length * 2 / 60 + Math.floor(dedup.recipients.length / 50) * 0.5)
                        : estimateTimeMinutes(dedup.recipients.length)} min
                    </p>
                  </div>
                </div>

                <div className="rounded-md border p-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Modo:{" "}
                    <span className="font-medium text-foreground">
                      {providerCategory === "official_meta" ? "Oficial Meta" : "Anti-Ban (Não-Oficial)"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Instâncias selecionadas ({selectedInstanceIds.length}):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedInstanceIds.map((id) => {
                      const inst = instances.find((i) => i.id === id);
                      return (
                        <Badge key={id} variant="outline" className="text-xs">
                          {inst?.name || id}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive text-xs flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Após iniciar, o disparo <strong>não pode ser interrompido</strong> pelo painel.
                    Mensagens já enviadas <strong>não podem ser revertidas</strong>.
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={sending} className="gap-2">
              <ShieldCheck className="w-4 h-4" />
              Confirmar e iniciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default WhatsAppBulkDialog;
