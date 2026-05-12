import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Wifi, ScrollText, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import GupshupInstancesList from "./GupshupInstancesList";
import GupshupConfigDialog from "./GupshupConfigDialog";
import IntegrationDetailLayout from "./IntegrationDetailLayout";
import { INTEGRATIONS } from "./integrationsCatalog";

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: "http" | "log";
  status_code?: number;
  method?: string;
  level?: string;
  payload?: string | null;
}

const GupshupTab = () => {
  const meta = INTEGRATIONS.gupshup;
  const { tenant } = useTenant();
  const { toast } = useToast();

  const [configOpen, setConfigOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [hasInstance, setHasInstance] = useState(false);

  const settings = (tenant?.settings as Record<string, any>) || {};
  const hasCreds = !!(settings.gupshup_api_key && settings.gupshup_app_name);

  useEffect(() => {
    if (!tenant?.id) return;
    supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("provider", "gupshup")
      .limit(1)
      .then(({ data }) => setHasInstance(!!data && data.length > 0));
  }, [tenant?.id]);

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
        payload: l.payload ? (typeof l.payload === "string" ? l.payload : JSON.stringify(l.payload)) : null,
      })));
    } catch (err: any) {
      toast({ title: "Erro ao buscar logs", description: err.message, variant: "destructive" });
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleTestConnection = async () => {
    if (!tenant) return;
    const apiKey = settings.gupshup_api_key;
    const appName = settings.gupshup_app_name;
    if (!apiKey || !appName) {
      toast({ title: "Credenciais ausentes", description: "Configure API Key e App Name primeiro.", variant: "destructive" });
      return;
    }
    toast({ title: "Testando conexão..." });
    try {
      const { data, error } = await supabase.functions.invoke("gupshup-proxy", {
        body: { apiKey, appName, sourceNumber: settings.gupshup_source_number, tenantId: tenant.id },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Falha na conexão");
      toast({ title: "Conexão validada!", description: "Gupshup respondeu com sucesso." });
    } catch (err: any) {
      toast({ title: "Falha na conexão", description: err.message, variant: "destructive" });
    }
  };

  const formatLogTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    } catch {
      return ts;
    }
  };

  const status = hasInstance || hasCreds ? "connected" : "not_configured";

  return (
    <>
      <IntegrationDetailLayout
        name={meta.name}
        category={meta.category}
        logoUrl={meta.logoUrl}
        fallbackIcon={meta.fallbackIcon}
        brandColor={meta.brandColor}
        description={meta.description}
        status={status}
        requirements={meta.requirements}
        footer={
          <div className="space-y-4">
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={handleFetchLogs} className="gap-2">
                <ScrollText className="w-4 h-4" /> Ver logs
              </Button>
              <Button variant="outline" onClick={handleTestConnection} className="gap-2">
                <Wifi className="w-4 h-4" /> Testar conexão
              </Button>
              <Button onClick={() => setConfigOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Nova instância
              </Button>
            </div>
            <GupshupInstancesList onFetchLogs={handleFetchLogs} onTestConnection={handleTestConnection} />
          </div>
        }
      />

      <GupshupConfigDialog open={configOpen} onOpenChange={setConfigOpen} onFetchLogs={handleFetchLogs} />

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
              <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando logs...</div>
            ) : logs.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">Nenhum log encontrado</div>
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
                      <span className="text-muted-foreground text-[10px]">{formatLogTimestamp(log.timestamp)}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          title="Copiar log"
                          onClick={async () => {
                            const text = `[${formatLogTimestamp(log.timestamp)}] [${log.level || log.type}] ${
                              log.status_code ? `(${log.status_code}) ` : ""
                            }${log.message}${log.payload ? `\nPayload: ${log.payload}` : ""}`;
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
                    <p className="break-all whitespace-pre-wrap leading-relaxed">{log.message}</p>
                    {log.payload && (
                      <details className="mt-1">
                        <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Payload</summary>
                        <pre className="mt-1 p-2 rounded bg-muted/50 text-[10px] break-all whitespace-pre-wrap max-h-40 overflow-auto">
                          {log.payload}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GupshupTab;
