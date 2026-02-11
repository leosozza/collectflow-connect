import { useState } from "react";
import { cobcloudService } from "@/services/cobcloudService";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi, WifiOff, Download, Upload, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface LogEntry {
  id: string;
  action: string;
  status: "success" | "error";
  message: string;
  timestamp: Date;
}

const CobCloudTab = () => {
  const { toast } = useToast();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [importCpf, setImportCpf] = useState("");
  const [importLimit, setImportLimit] = useState("100");

  const addLog = (action: string, status: "success" | "error", message: string) => {
    setLogs((prev) => [
      { id: crypto.randomUUID(), action, status, message, timestamp: new Date() },
      ...prev.slice(0, 49),
    ]);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const result = await cobcloudService.testConnection();
      setConnected(result.connected);
      addLog("Teste de Conexão", result.connected ? "success" : "error",
        result.connected ? "Conectado com sucesso" : `Falha: status ${result.status}`);
      toast({
        title: result.connected ? "Conectado!" : "Falha na conexão",
        description: result.connected ? "API CobCloud acessível" : "Verifique as credenciais configuradas",
        variant: result.connected ? "default" : "destructive",
      });
    } catch (e: any) {
      setConnected(false);
      addLog("Teste de Conexão", "error", e.message);
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const result = await cobcloudService.importTitulos({
        limit: Number(importLimit) || 100,
        cpf: importCpf || undefined,
      });
      addLog("Importar Títulos", "success", `${result.imported} títulos importados de ${result.total} encontrados`);
      toast({ title: "Importação concluída", description: `${result.imported} títulos importados` });
    } catch (e: any) {
      addLog("Importar Títulos", "error", e.message);
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
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
              {connected === null ? "Clique para testar a conexão" : connected ? "API CobCloud conectada" : "Sem conexão com a API"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleTestConnection} disabled={testing} className="w-full">
              {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Testar Conexão
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Importar Títulos
            </CardTitle>
            <CardDescription>Buscar títulos do CobCloud e importar para o sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="import-cpf">CPF (opcional)</Label>
                <Input id="import-cpf" placeholder="000.000.000-00" value={importCpf} onChange={(e) => setImportCpf(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="import-limit">Limite</Label>
                <Input id="import-limit" type="number" value={importLimit} onChange={(e) => setImportLimit(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleImport} disabled={importing} className="w-full">
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              Importar
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Enviar Devedores
          </CardTitle>
          <CardDescription>
            Para enviar devedores para o CobCloud, selecione os clientes na página de Clientes e use a ação "Enviar para CobCloud"
          </CardDescription>
        </CardHeader>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Log de Sincronizações</CardTitle></CardHeader>
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

export default CobCloudTab;
