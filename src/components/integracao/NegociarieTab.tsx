import { useState } from "react";
import { negociarieService } from "@/services/negociarieService";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi, WifiOff, Loader2, CheckCircle2, XCircle, Link2, Send } from "lucide-react";
import CobrancaForm from "./CobrancaForm";
import CobrancasList from "./CobrancasList";
import SyncPanel from "./SyncPanel";

interface LogEntry {
  id: string;
  action: string;
  status: "success" | "error";
  message: string;
  timestamp: Date;
}

const NegociarieTab = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [callbackOk, setCallbackOk] = useState<boolean | null>(null);
  const [callbackUrl, setCallbackUrl] = useState(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/negociarie-callback`
  );
  const [settingCallback, setSettingCallback] = useState(false);

  const addLog = (action: string, status: "success" | "error", message: string) => {
    setLogs((prev) => [
      { id: crypto.randomUUID(), action, status, message, timestamp: new Date() },
      ...prev.slice(0, 49),
    ]);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      await negociarieService.testConnection();
      setConnected(true);
      addLog("Teste de Conexão", "success", "API Negociarie conectada com sucesso");
      toast({ title: "Conectado!", description: "API Negociarie acessível" });
    } catch (e: any) {
      setConnected(false);
      addLog("Teste de Conexão", "error", e.message);
      toast({ title: "Falha na conexão", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleSetCallback = async () => {
    if (!callbackUrl.trim()) {
      toast({ title: "URL vazia", description: "Preencha a URL do callback", variant: "destructive" });
      return;
    }
    setSettingCallback(true);
    try {
      await negociarieService.atualizarCallback({ url: callbackUrl.trim() });
      setCallbackOk(true);
      addLog("Callback", "success", `URL registrada: ${callbackUrl.trim()}`);
      toast({ title: "Callback configurado!", description: "URL de callback registrada com sucesso" });
    } catch (e: any) {
      setCallbackOk(false);
      addLog("Callback", "error", `Falha: ${e.message}`);
      toast({ title: "Erro no callback", description: e.message, variant: "destructive" });
    } finally {
      setSettingCallback(false);
    }
  };

  const handleCobrancaCreated = () => {
    setRefreshKey((k) => k + 1);
    addLog("Nova Cobrança", "success", "Cobrança gerada com sucesso");
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Connection status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {connected === null ? (
                <WifiOff className="w-5 h-5 text-muted-foreground" />
              ) : connected ? (
                <Wifi className="w-5 h-5 text-success" />
              ) : (
                <WifiOff className="w-5 h-5 text-destructive" />
              )}
              Status da Conexão
            </CardTitle>
            <CardDescription>
              {connected === null
                ? "Clique para testar a conexão com a API Negociarie"
                : connected
                  ? "API Negociarie conectada"
                  : "Sem conexão com a API"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleTestConnection} disabled={testing} className="w-full">
              {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Testar Conexão
            </Button>
          </CardContent>
        </Card>

        {/* Callback configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-muted-foreground" />
              Configuração de Callback
            </CardTitle>
            <CardDescription>
              URL que receberá notificações de pagamento da Negociarie
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="callback-url">URL do Callback</Label>
              <Input
                id="callback-url"
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <Button onClick={handleSetCallback} disabled={settingCallback} className="w-full">
              {settingCallback ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Configurar Callback
            </Button>
            {callbackOk !== null && (
              <div className="flex items-center gap-2 text-sm">
                {callbackOk ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400">Callback configurado</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span className="text-destructive">Callback não configurado</span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sync Panel */}
      <SyncPanel onSync={(msg) => addLog("Sincronização", "success", msg)} />

      {/* New charge form */}
      {tenant && (
        <CobrancaForm tenantId={tenant.id} onCreated={handleCobrancaCreated} />
      )}

      {/* Charges list */}
      {tenant && (
        <CobrancasList tenantId={tenant.id} refreshKey={refreshKey} />
      )}

      {/* Logs - always visible section */}
      <Card>
        <CardHeader>
          <CardTitle>Log de Operações</CardTitle>
          <CardDescription>
            {logs.length === 0
              ? "Teste a conexão ou configure o callback para ver os logs"
              : `${logs.length} operação(ões) registrada(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma operação registrada ainda
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                  {log.status === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-card-foreground">{log.action}</p>
                    <p className="text-muted-foreground break-all">{log.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {log.timestamp.toLocaleTimeString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NegociarieTab;
