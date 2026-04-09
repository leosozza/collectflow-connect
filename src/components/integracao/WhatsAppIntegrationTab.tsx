import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { updateTenant } from "@/services/tenantService";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Eye, EyeOff, Copy, Check, Radio, ScrollText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import BaylersInstancesList from "./BaylersInstancesList";

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

  // Gupshup state
  const [apiKey, setApiKey] = useState(settings.gupshup_api_key || "");
  const [appName, setAppName] = useState(settings.gupshup_app_name || "");
  const [appId, setAppId] = useState(settings.gupshup_app_id || "");
  const [sourceNumber, setSourceNumber] = useState(settings.gupshup_source_number || "");
  const [showGupshupKey, setShowGupshupKey] = useState(false);
  const [savingGupshup, setSavingGupshup] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [copied, setCopied] = useState(false);

  // Logs state
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const activeProvider = settings.whatsapp_provider || (settings.gupshup_api_key ? "gupshup" : "");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const webhookUrl = `${supabaseUrl}/functions/v1/gupshup-webhook`;

  const isGupshupConfigured = !!(settings.gupshup_api_key && settings.gupshup_app_name && settings.gupshup_source_number);

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const handleTestConnection = async () => {
    if (!apiKey || !appName) {
      toast({ title: "Erro", description: "API Key e App Name são obrigatórios para o teste.", variant: "destructive" });
      return;
    }

    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke("gupshup-proxy", {
        body: { apiKey: apiKey.trim(), appName: appName.trim() },
      });

      if (error) {
        throw new Error(error.message || "Erro ao chamar gupshup-proxy");
      }
      if (!data?.success) {
        throw new Error(data?.error || "Falha na conexão com Gupshup");
      }

      toast({ title: "Sucesso!", description: "Conexão com Gupshup validada com sucesso." });
    } catch (err: any) {
      toast({ title: "Falha na Conexão", description: err.message, variant: "destructive" });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveGupshup = async () => {
    if (!tenant) return;
    setSavingGupshup(true);
    try {
      await updateTenant(tenant.id, {
        settings: {
          ...settings,
          gupshup_api_key: apiKey.trim(),
          gupshup_app_id: appId.trim(),
          gupshup_app_name: appName.trim(),
          gupshup_source_number: sourceNumber.replace(/\D/g, ""),
          whatsapp_provider: "gupshup",
        },
      });

      const instanceName = `gupshup-${tenant.slug}`;
      const { data: existing } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("instance_name", instanceName)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("whatsapp_instances")
          .update({
            phone_number: sourceNumber.replace(/\D/g, ""),
            status: "connected",
            provider: "gupshup",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await (supabase
          .from("whatsapp_instances") as any)
          .insert({
            tenant_id: tenant.id,
            instance_name: instanceName,
            phone_number: sourceNumber.replace(/\D/g, ""),
            status: "connected",
            provider: "gupshup",
          });
      }

      await refetch();
      toast({ title: "Configurações GupShup salvas!", description: "A linha oficial agora está ativa." });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSavingGupshup(false);
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
        {/* Gupshup Card */}
        <Card className={activeProvider === "gupshup" ? "ring-2 ring-primary" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5" />
                Oficial (Gupshup)
              </CardTitle>
              <div className="flex items-center gap-2">
                {isGupshupConfigured && <Badge variant="secondary" className="text-green-700 bg-green-100">Configurado</Badge>}
                {activeProvider === "gupshup" && <Badge><Radio className="w-3 h-3 mr-1" />Ativo</Badge>}
              </div>
            </div>
            <CardDescription>API oficial do WhatsApp Business via Gupshup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showGupshupKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Sua API Key do Gupshup"
                />
                <button
                  type="button"
                  onClick={() => setShowGupshupKey(!showGupshupKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showGupshupKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>App Name</Label>
                <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Maxfama2" />
              </div>
              <div className="space-y-2">
                <Label>App ID (Opcional)</Label>
                <Input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="uuid-do-app" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Número de Origem</Label>
              <Input value={sourceNumber} onChange={(e) => setSourceNumber(e.target.value)} placeholder="5511999999999" />
              <p className="text-xs text-muted-foreground">Número com código do país, sem caracteres especiais</p>
            </div>

            <div className="space-y-2">
              <Label>Webhook de Retorno</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="text-xs bg-muted" />
                <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={handleFetchLogs} disabled={loadingLogs} title="Ver Logs do Webhook">
                  <ScrollText className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Cole esta URL no painel do Gupshup para receber status de entrega</p>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handleTestConnection} 
                disabled={testingConnection || savingGupshup}
                className="flex-1"
              >
                {testingConnection ? "Testando..." : "Testar Conexão"}
              </Button>
              <Button 
                onClick={handleSaveGupshup} 
                disabled={savingGupshup || testingConnection} 
                className="flex-[2]"
              >
                {savingGupshup ? "Salvando..." : "Salvar e ativar Gupshup"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Baylers Card */}
        <BaylersInstancesList />
      </div>

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
                        {log.type === "http" && log.status_code && (
                          <Badge variant={log.status_code < 400 ? "secondary" : "destructive"} className="text-[10px] px-1.5 py-0">
                            {log.method} {log.status_code}
                          </Badge>
                        )}
                        {log.type === "http" && log.execution_time_ms && (
                          <span className="text-muted-foreground text-[10px]">{log.execution_time_ms}ms</span>
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
