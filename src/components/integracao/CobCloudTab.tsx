import { useState, useEffect } from "react";
import { cobcloudService } from "@/services/cobcloudService";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { updateTenant } from "@/services/tenantService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi, WifiOff, Download, Upload, Loader2, CheckCircle2, XCircle, KeyRound, Save, Eye, EyeOff } from "lucide-react";

interface LogEntry {
  id: string;
  action: string;
  status: "success" | "error";
  message: string;
  timestamp: Date;
}

const CobCloudTab = () => {
  const { toast } = useToast();
  const { tenant, refetch } = useTenant();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [importCpf, setImportCpf] = useState("");
  const [importLimit, setImportLimit] = useState("100");

  // Credentials state
  const [tokenAssessoria, setTokenAssessoria] = useState("");
  const [tokenClient, setTokenClient] = useState("");
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [showAssessoria, setShowAssessoria] = useState(false);
  const [showClient, setShowClient] = useState(false);

  const hasCredentials = !!(tenant?.settings?.cobcloud_token_assessoria && tenant?.settings?.cobcloud_token_client);

  useEffect(() => {
    if (tenant?.settings) {
      setTokenAssessoria(tenant.settings.cobcloud_token_assessoria || "");
      setTokenClient(tenant.settings.cobcloud_token_client || "");
    }
  }, [tenant?.settings]);

  const handleSaveCredentials = async () => {
    if (!tenant) return;
    if (!tokenAssessoria.trim() || !tokenClient.trim()) {
      toast({ title: "Preencha ambos os tokens", variant: "destructive" });
      return;
    }
    setSavingCredentials(true);
    try {
      const newSettings = {
        ...(tenant.settings || {}),
        cobcloud_token_assessoria: tokenAssessoria.trim(),
        cobcloud_token_client: tokenClient.trim(),
      };
      await updateTenant(tenant.id, { settings: newSettings });
      await refetch();
      toast({ title: "Credenciais salvas com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSavingCredentials(false);
    }
  };

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
      {/* Credentials Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Credenciais CobCloud
          </CardTitle>
          <CardDescription>
            Insira os tokens de autenticação da API CobCloud v3. Os tokens são salvos de forma segura nas configurações da empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="token-assessoria">Token Assessoria</Label>
              <div className="relative">
                <Input
                  id="token-assessoria"
                  type={showAssessoria ? "text" : "password"}
                  placeholder="Insira o token da assessoria"
                  value={tokenAssessoria}
                  onChange={(e) => setTokenAssessoria(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowAssessoria(!showAssessoria)}
                >
                  {showAssessoria ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="token-client">Token Client</Label>
              <div className="relative">
                <Input
                  id="token-client"
                  type={showClient ? "text" : "password"}
                  placeholder="Insira o token do client"
                  value={tokenClient}
                  onChange={(e) => setTokenClient(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowClient(!showClient)}
                >
                  {showClient ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
          <Button onClick={handleSaveCredentials} disabled={savingCredentials} className="w-full sm:w-auto">
            {savingCredentials ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Credenciais
          </Button>
          {hasCredentials && (
            <p className="text-sm text-success flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Credenciais configuradas
            </p>
          )}
        </CardContent>
      </Card>

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
            <Button onClick={handleTestConnection} disabled={testing || !hasCredentials} className="w-full">
              {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Testar Conexão
            </Button>
            {!hasCredentials && (
              <p className="text-xs text-muted-foreground mt-2">Salve as credenciais acima para testar</p>
            )}
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
            <Button onClick={handleImport} disabled={importing || !hasCredentials} className="w-full">
              {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              Importar
            </Button>
            {!hasCredentials && (
              <p className="text-xs text-muted-foreground">Salve as credenciais acima para importar</p>
            )}
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
