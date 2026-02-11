import { useState } from "react";
import { negociarieService } from "@/services/negociarieService";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Loader2, CheckCircle2, XCircle, Link2 } from "lucide-react";
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

  const addLog = (action: string, status: "success" | "error", message: string) => {
    setLogs((prev) => [
      { id: crypto.randomUUID(), action, status, message, timestamp: new Date() },
      ...prev.slice(0, 49),
    ]);
  };

  const CALLBACK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/negociarie-callback`;

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      await negociarieService.testConnection();
      setConnected(true);
      addLog("Teste de Conexão", "success", "API Negociarie conectada com sucesso");

      // Auto-register callback URL
      try {
        await negociarieService.atualizarCallback({ url: CALLBACK_URL });
        setCallbackOk(true);
        addLog("Callback", "success", `URL de callback registrada: ${CALLBACK_URL}`);
      } catch (cbErr: any) {
        setCallbackOk(false);
        addLog("Callback", "error", `Falha ao registrar callback: ${cbErr.message}`);
      }

      toast({ title: "Conectado!", description: "API Negociarie acessível e callback configurado" });
    } catch (e: any) {
      setConnected(false);
      addLog("Teste de Conexão", "error", e.message);
      toast({ title: "Falha na conexão", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
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
          <CardContent className="space-y-3">
            <Button onClick={handleTestConnection} disabled={testing} className="w-full">
              {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Testar Conexão
            </Button>
            {callbackOk !== null && (
              <div className="flex items-center gap-2 text-sm">
                {callbackOk ? (
                  <>
                    <Link2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400">Callback configurado</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 text-destructive" />
                    <span className="text-destructive">Callback não configurado</span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sync Panel */}
        <SyncPanel onSync={(msg) => addLog("Sincronização", "success", msg)} />
      </div>

      {/* New charge form */}
      {tenant && (
        <CobrancaForm tenantId={tenant.id} onCreated={handleCobrancaCreated} />
      )}

      {/* Charges list */}
      {tenant && (
        <CobrancasList tenantId={tenant.id} refreshKey={refreshKey} />
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Log de Operações</CardTitle>
          </CardHeader>
          <CardContent>
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
                    <p className="text-muted-foreground">{log.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {log.timestamp.toLocaleTimeString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NegociarieTab;
