import { useState, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Client } from "@/services/clientService";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Phone, Users, Pause, Play, CheckCircle2, XCircle, Info } from "lucide-react";
import { toast } from "sonner";

interface DialerExportDialogProps {
  open: boolean;
  onClose: () => void;
  selectedClients: Client[];
}

type LogEntry = {
  time: string;
  status: "success" | "error" | "info";
  message: string;
};

const BATCH_SIZE = 50;

const DialerExportDialog = ({ open, onClose, selectedClients }: DialerExportDialogProps) => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // Progress state
  const [totalMailings, setTotalMailings] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const pausedRef = useRef(false);
  const cancelledRef = useRef(false);

  const addLog = useCallback((status: LogEntry["status"], message: string) => {
    const time = new Date().toLocaleTimeString("pt-BR");
    setLogs((prev) => [...prev, { time, status, message }]);
  }, []);

  const loadCampaigns = async () => {
    if (!domain || !apiToken) {
      toast.error("Configure as credenciais 3CPlus na página de Integrações");
      return;
    }
    setLoadingCampaigns(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "list_campaigns", domain, api_token: apiToken },
      });
      if (error) throw error;
      setCampaigns(data?.data || []);
    } catch {
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const resetState = () => {
    setSentCount(0);
    setErrorCount(0);
    setLogs([]);
    setPaused(false);
    setFinished(false);
    pausedRef.current = false;
    cancelledRef.current = false;
  };

  const waitWhilePaused = async () => {
    while (pausedRef.current && !cancelledRef.current) {
      await new Promise((r) => setTimeout(r, 300));
    }
  };

  const handleSend = async () => {
    if (!selectedCampaign) {
      toast.error("Selecione uma campanha");
      return;
    }

    resetState();
    setSending(true);

    // Deduplicate by CPF
    const uniqueClients = new Map<string, Client>();
    selectedClients.forEach((c) => {
      const cpf = c.cpf.replace(/\D/g, "");
      if (!uniqueClients.has(cpf)) uniqueClients.set(cpf, c);
    });

    const allMailings = Array.from(uniqueClients.values()).map((c) => ({
      identifier: c.cpf.replace(/\D/g, ""),
      phone: c.phone?.replace(/\D/g, "") || "",
      Nome: c.nome_completo,
      Extra1: c.credor,
      Extra2: String(c.valor_parcela),
      Extra3: c.id,
    }));

    setTotalMailings(allMailings.length);
    addLog("info", `Iniciando envio de ${allMailings.length} contatos em lotes de ${BATCH_SIZE}...`);

    try {
      // 1. Create list
      addLog("info", "Criando lista na campanha...");
      const { data: listData, error: listError } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "create_list", domain, api_token: apiToken, campaign_id: selectedCampaign },
      });
      if (listError) throw listError;
      const listId = listData?.data?.id;
      if (!listId) throw new Error("Não foi possível criar a lista");
      addLog("success", `Lista criada com ID ${listId}`);

      // 2. Send in batches
      const totalBatches = Math.ceil(allMailings.length / BATCH_SIZE);

      for (let i = 0; i < totalBatches; i++) {
        if (cancelledRef.current) {
          addLog("info", "Envio cancelado pelo usuário.");
          break;
        }

        await waitWhilePaused();
        if (cancelledRef.current) break;

        const batch = allMailings.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const batchNum = i + 1;

        try {
          addLog("info", `Enviando lote ${batchNum}/${totalBatches} (${batch.length} contatos)...`);

          const { data: sendData, error: sendError } = await supabase.functions.invoke("threecplus-proxy", {
            body: {
              action: "send_mailing",
              domain,
              api_token: apiToken,
              campaign_id: selectedCampaign,
              list_id: listId,
              mailings: batch,
            },
          });

          if (sendError) throw sendError;

          const httpStatus = sendData?.status;
          if (httpStatus && httpStatus >= 400) {
            addLog("error", `Lote ${batchNum}: API retornou HTTP ${httpStatus}`);
            if (sendData?.data?.errors) {
              Object.entries(sendData.data.errors).forEach(([field, msgs]: any) => {
                const msgText = Array.isArray(msgs) ? msgs.join(", ") : msgs;
                addLog("error", `  → ${field}: ${msgText}`);
              });
            }
            setErrorCount((prev) => prev + batch.length);
          } else {
            addLog("success", `Lote ${batchNum}/${totalBatches} enviado com sucesso`);
            setSentCount((prev) => prev + batch.length);
          }
        } catch (err: any) {
          addLog("error", `Erro no lote ${batchNum}: ${err.message}`);
          setErrorCount((prev) => prev + batch.length);
        }
      }

      if (!cancelledRef.current) {
        addLog("success", "✅ Envio concluído!");
        toast.success(`Mailing enviado para o discador!`);
      }
    } catch (err: any) {
      addLog("error", `Erro fatal: ${err.message}`);
      toast.error("Erro ao enviar para discador: " + (err.message || ""));
    } finally {
      setSending(false);
      setFinished(true);
    }
  };

  const handlePauseResume = () => {
    const next = !paused;
    setPaused(next);
    pausedRef.current = next;
    addLog("info", next ? "⏸ Envio pausado" : "▶ Envio retomado");
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    pausedRef.current = false;
    setPaused(false);
  };

  // Load campaigns when dialog opens
  if (open && campaigns.length === 0 && !loadingCampaigns) {
    loadCampaigns();
  }

  const hasCredentials = !!domain && !!apiToken;
  const progressPercent = totalMailings > 0 ? Math.round(((sentCount + errorCount) / totalMailings) * 100) : 0;
  const showProgress = sending || finished;

  const LogIcon = ({ status }: { status: LogEntry["status"] }) => {
    if (status === "success") return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />;
    if (status === "error") return <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />;
    return <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !sending) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Enviar para Discador 3CPlus
          </DialogTitle>
          <DialogDescription>
            Envie os clientes selecionados como mailing para uma campanha no discador
          </DialogDescription>
        </DialogHeader>

        {!hasCredentials ? (
          <div className="py-4 text-center text-muted-foreground text-sm">
            Configure as credenciais 3CPlus na página de <strong>Integrações</strong> primeiro.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">{selectedClients.length} clientes selecionados</span>
            </div>

            {!showProgress && (
              <div className="space-y-2">
                <Label>Campanha</Label>
                {loadingCampaigns ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando campanhas...
                  </div>
                ) : (
                  <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma campanha" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Progress Section */}
            {showProgress && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-3" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>✅ {sentCount} enviados</span>
                    {errorCount > 0 && <span className="text-destructive">❌ {errorCount} erros</span>}
                    <span>Total: {totalMailings}</span>
                  </div>
                </div>

                {/* Pause / Resume */}
                {sending && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePauseResume}
                      className="gap-1.5"
                    >
                      {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      {paused ? "Retomar" : "Pausar"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleCancel}
                    >
                      Cancelar
                    </Button>
                    {paused && (
                      <span className="text-xs text-amber-500 font-medium animate-pulse">Pausado</span>
                    )}
                  </div>
                )}

                {/* Log */}
                <div className="space-y-1">
                  <Label className="text-xs">Log de envio</Label>
                  <ScrollArea className="h-40 rounded-md border bg-muted/30 p-2">
                    <div className="space-y-1">
                      {logs.map((log, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs">
                          <LogIcon status={log.status} />
                          <span className="text-muted-foreground shrink-0">{log.time}</span>
                          <span className={
                            log.status === "error" ? "text-destructive" :
                            log.status === "success" ? "text-green-600 dark:text-green-400" :
                            "text-foreground"
                          }>{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            {finished ? "Fechar" : "Cancelar"}
          </Button>
          {!finished && (
            <Button
              onClick={handleSend}
              disabled={sending || !selectedCampaign || !hasCredentials}
              className="gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
              {sending ? "Enviando..." : "Enviar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DialerExportDialog;
