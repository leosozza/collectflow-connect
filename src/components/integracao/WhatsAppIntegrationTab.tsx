import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, ScrollText, Plus, MessageSquare, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import BaylersInstancesList from "./BaylersInstancesList";
import GupshupInstancesList from "./GupshupInstancesList";
import GupshupConfigDialog from "./GupshupConfigDialog";

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: "http" | "log";
  status_code?: number;
  method?: string;
  execution_time_ms?: number;
  level?: string;
  payload?: string;
}

const WhatsAppIntegrationTab = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();

  // Type chooser state
  const [chooserOpen, setChooserOpen] = useState(false);
  // Config dialog state (Gupshup)
  const [configOpen, setConfigOpen] = useState(false);
  // Baylers form trigger
  const [baylersFormOpen, setBaylersFormOpen] = useState(false);

  // Logs state
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const handleFetchLogs = async () => {
    setLoadingLogs(true);
    setLogsOpen(true);
    try {
      const { data, error } = await supabase
        .from("webhook_logs")
        .select("*")
        .in("function_name", ["gupshup-webhook", "gupshup-proxy"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);

      setLogs((data || []).map((l: any) => ({
        id: l.id,
        timestamp: l.created_at,
        message: l.message || "",
        type: l.event_type === "error" ? "log" : "http",
        status_code: l.status_code,
        level: l.event_type,
        payload: l.payload ? (typeof l.payload === 'string' ? l.payload : JSON.stringify(l.payload)) : null,
      })));
    } catch (err: any) {
      toast({ title: "Erro ao buscar logs", description: err.message, variant: "destructive" });
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const formatLogTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    } catch {
      return ts;
    }
  };

  const handleChooseOfficial = () => {
    setChooserOpen(false);
    setConfigOpen(true);
  };

  const handleChooseUnofficial = () => {
    setChooserOpen(false);
    setBaylersFormOpen(true);
  };

  const handleTestConnection = async () => {
    if (!tenant) return;
    const settings = (tenant.settings as Record<string, any>) || {};
    const apiKey = settings.gupshup_api_key;
    const appName = settings.gupshup_app_name;
    if (!apiKey || !appName) {
      toast({ title: "Erro", description: "Configure API Key e App Name primeiro.", variant: "destructive" });
      return;
    }
    toast({ title: "Testando conexão..." });
    try {
      const { data, error } = await supabase.functions.invoke("gupshup-proxy", {
        body: { apiKey, appName, sourceNumber: settings.gupshup_source_number, tenantId: tenant.id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Falha na conexão");
      toast({ title: "Sucesso!", description: "Conexão com Gupshup validada." });
    } catch (err: any) {
      toast({ title: "Falha na Conexão", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Centralized Add Button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          className="gap-2"
          onClick={() => setChooserOpen(true)}
        >
          <Plus className="w-5 h-5" />
          Nova Instância WhatsApp
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Official Gupshup Instances */}
        <GupshupInstancesList onFetchLogs={handleFetchLogs} onTestConnection={handleTestConnection} />

        {/* Unofficial QR Code Instances */}
        <BaylersInstancesList externalFormOpen={baylersFormOpen} onExternalFormClose={() => setBaylersFormOpen(false)} />
      </div>

      {/* Type Chooser Dialog */}
      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Qual tipo de instância deseja criar?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              onClick={handleChooseOfficial}
              className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all text-center group"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">WhatsApp Oficial</p>
                <p className="text-xs text-muted-foreground mt-1">API oficial via Gupshup (BSP)</p>
              </div>
            </button>
            <button
              onClick={handleChooseUnofficial}
              className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all text-center group"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">WhatsApp Não Oficial</p>
                <p className="text-xs text-muted-foreground mt-1">Conexão via QR Code</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gupshup Config Dialog */}
      <GupshupConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        onFetchLogs={handleFetchLogs}
      />

      {/* Logs Dialog */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="w-5 h-5" />
              Logs do Webhook Gupshup
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {loadingLogs ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Carregando logs...
              </div>
            ) : logs.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Nenhum log encontrado
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {logs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className={`p-3 rounded-md border text-xs font-mono ${
                      log.level === "error" || (log.status_code && log.status_code >= 400)
                        ? "border-destructive/50 bg-destructive/5 text-destructive"
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-muted-foreground text-[10px]">
                        {formatLogTimestamp(log.timestamp)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          title="Copiar log"
                          onClick={async () => {
                            const text = `[${formatLogTimestamp(log.timestamp)}] [${log.level || log.type}] ${log.status_code ? `(${log.status_code}) ` : ""}${log.message}${log.payload ? `\nPayload: ${log.payload}` : ""}`;
                            await navigator.clipboard.writeText(text);
                            toast({ title: "Log copiado!" });
                          }}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {log.type === "http" && log.status_code && (
                          <Badge variant={log.status_code < 400 ? "secondary" : "destructive"} className="text-[10px] px-1.5 py-0">
                            {log.method} {log.status_code}
                          </Badge>
                        )}
                        {log.type === "log" && log.level && (
                          <Badge variant={log.level === "error" ? "destructive" : "outline"} className="text-[10px] px-1.5 py-0">
                            {log.level}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="break-all whitespace-pre-wrap leading-relaxed">
                      {log.message}
                    </p>
                    {log.payload && (() => {
                      let parsed: any = null;
                      try { parsed = JSON.parse(log.payload); } catch {}
                      const hasRequestResponse = parsed && parsed.request && parsed.response;
                      return (
                        <div className="mt-1 space-y-1">
                          {hasRequestResponse ? (
                            <>
                              <details>
                                <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">📤 Request</summary>
                                <pre className="mt-1 p-2 rounded bg-muted/50 text-[10px] break-all whitespace-pre-wrap max-h-40 overflow-auto">
                                  {JSON.stringify(parsed.request, null, 2)}
                                </pre>
                              </details>
                              <details>
                                <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">📥 Response</summary>
                                <pre className="mt-1 p-2 rounded bg-muted/50 text-[10px] break-all whitespace-pre-wrap max-h-40 overflow-auto">
                                  {JSON.stringify(parsed.response, null, 2)}
                                </pre>
                              </details>
                            </>
                          ) : (
                            <details>
                              <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Payload</summary>
                              <pre className="mt-1 p-2 rounded bg-muted/50 text-[10px] break-all whitespace-pre-wrap max-h-40 overflow-auto">
                                {parsed ? JSON.stringify(parsed, null, 2) : log.payload}
                              </pre>
                            </details>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppIntegrationTab;
