import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { updateTenant } from "@/services/tenantService";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Copy, Check, ScrollText } from "lucide-react";
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
}

const WhatsAppIntegrationTab = () => {
  const { tenant, refetch } = useTenant();
  const { toast } = useToast();
  const settings = (tenant?.settings as Record<string, any>) || {};

  // Config dialog state
  const [configOpen, setConfigOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Official Gupshup Instances */}
        <GupshupInstancesList onAddNew={() => setConfigOpen(true)} />

        {/* Unofficial QR Code Instances */}
        <BaylersInstancesList />
      </div>

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
                            const text = `[${formatLogTimestamp(log.timestamp)}] [${log.level || log.type}] ${log.status_code ? `(${log.status_code}) ` : ""}${log.message}`;
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
