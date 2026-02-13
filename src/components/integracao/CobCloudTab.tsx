import { useState, useEffect } from "react";
import { cobcloudService } from "@/services/cobcloudService";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { updateTenant } from "@/services/tenantService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Wifi, WifiOff, Upload, Loader2, CheckCircle2, XCircle, KeyRound, Save, Eye, EyeOff, Database } from "lucide-react";
import CobCloudPreviewCard from "./cobcloud/CobCloudPreviewCard";

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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionDetail, setConnectionDetail] = useState<{ devedores_count?: number; titulos_count?: number } | null>(null);
  const [credentialsOpen, setCredentialsOpen] = useState(false);

  // Credentials state
  const [tokenCompany, setTokenCompany] = useState("");
  const [tokenAssessoria, setTokenAssessoria] = useState("");
  const [tokenClient, setTokenClient] = useState("");
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [showAssessoria, setShowAssessoria] = useState(false);
  const [showClient, setShowClient] = useState(false);

  const hasCredentials = !!(tenant?.settings?.cobcloud_token_company && tenant?.settings?.cobcloud_token_client);

  useEffect(() => {
    if (tenant?.settings) {
      setTokenCompany(tenant.settings.cobcloud_token_company || "");
      setTokenAssessoria(tenant.settings.cobcloud_token_assessoria || "");
      setTokenClient(tenant.settings.cobcloud_token_client || "");
    }
  }, [tenant?.settings]);

  const handleSaveCredentials = async () => {
    if (!tenant) return;
    if (!tokenCompany.trim() || !tokenClient.trim()) {
      toast({ title: "Preencha Token Company e Token Client", variant: "destructive" });
      return;
    }
    setSavingCredentials(true);
    try {
      const newSettings = {
        ...(tenant.settings || {}),
        cobcloud_token_company: tokenCompany.trim(),
        cobcloud_token_assessoria: tokenAssessoria.trim(),
        cobcloud_token_client: tokenClient.trim(),
      };
      await updateTenant(tenant.id, { settings: newSettings });
      await refetch();
      toast({ title: "Credenciais salvas com sucesso!" });
      setCredentialsOpen(false);
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
    if (!hasCredentials) {
      toast({ title: "Configure as credenciais primeiro", variant: "destructive" });
      setCredentialsOpen(true);
      return;
    }
    setTesting(true);
    try {
      const result = await cobcloudService.testConnection();
      setConnected(result.connected);
      setConnectionDetail({
        devedores_count: result.devedores_count,
        titulos_count: result.titulos_count,
      });
      const detail = `Devedores: ${result.devedores_count ?? 0} | Títulos: ${result.titulos_count ?? 0}`;
      addLog("Teste de Conexão", result.connected ? "success" : "error",
        result.connected ? `Conectado. ${detail}` : `Falha: status ${result.status}`);
      toast({
        title: result.connected ? "Conectado!" : "Falha na conexão",
        description: result.connected ? `API CobCloud acessível. ${detail}` : "Verifique as credenciais configuradas",
        variant: result.connected ? "default" : "destructive",
      });
    } catch (e: any) {
      setConnected(false);
      setConnectionDetail(null);
      addLog("Teste de Conexão", "error", e.message);
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const connectionIcon = connected === null
    ? <WifiOff className="w-5 h-5" />
    : connected
      ? <Wifi className="w-5 h-5" />
      : <WifiOff className="w-5 h-5" />;

  const connectionColor = connected === null
    ? "text-muted-foreground"
    : connected
      ? "text-green-500"
      : "text-destructive";

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Compact header with icon buttons */}
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">CobCloud</h2>

          <div className="flex items-center gap-1 ml-auto">
            {/* Token icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="relative"
                  onClick={() => setCredentialsOpen(true)}
                >
                  <KeyRound className="w-4 h-4" />
                  {hasCredentials && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-background" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {hasCredentials ? "Credenciais configuradas — clique para editar" : "Configurar credenciais"}
              </TooltipContent>
            </Tooltip>

            {/* Connection status icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={connectionColor}
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : connectionIcon}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {testing
                  ? "Testando conexão..."
                  : connected === null
                    ? "Testar conexão"
                    : connected
                      ? `Conectado — Devedores: ${connectionDetail?.devedores_count ?? 0} | Títulos: ${connectionDetail?.titulos_count ?? 0}`
                      : "Conexão falhou — clique para testar novamente"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Connection detail badges */}
        {connectionDetail && connected && (
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-sm">
              <Database className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Devedores:</span>
              <strong className="text-card-foreground">{connectionDetail.devedores_count ?? 0}</strong>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-sm">
              <Database className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Títulos:</span>
              <strong className="text-card-foreground">{connectionDetail.titulos_count ?? 0}</strong>
            </div>
          </div>
        )}

        {/* Credentials Modal */}
        <Dialog open={credentialsOpen} onOpenChange={setCredentialsOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                Credenciais CobCloud
              </DialogTitle>
              <DialogDescription>
                Insira os tokens de autenticação da API CobCloud v3.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="token-company">Token Company</Label>
                <div className="relative">
                  <Input id="token-company" type={showCompany ? "text" : "password"} placeholder="Token da empresa" value={tokenCompany} onChange={(e) => setTokenCompany(e.target.value)} />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowCompany(!showCompany)}>
                    {showCompany ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="token-assessoria">Token Assessoria (opcional)</Label>
                <div className="relative">
                  <Input id="token-assessoria" type={showAssessoria ? "text" : "password"} placeholder="Token da assessoria" value={tokenAssessoria} onChange={(e) => setTokenAssessoria(e.target.value)} />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowAssessoria(!showAssessoria)}>
                    {showAssessoria ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="token-client">Token Client</Label>
                <div className="relative">
                  <Input id="token-client" type={showClient ? "text" : "password"} placeholder="Token do client/credor" value={tokenClient} onChange={(e) => setTokenClient(e.target.value)} />
                  <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowClient(!showClient)}>
                    {showClient ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <Button onClick={handleSaveCredentials} disabled={savingCredentials} className="w-full">
                {savingCredentials ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Credenciais
              </Button>
              {hasCredentials && (
                <p className="text-sm text-green-500 flex items-center gap-1 justify-center">
                  <CheckCircle2 className="w-4 h-4" /> Credenciais configuradas
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview + Import Card */}
        <CobCloudPreviewCard hasCredentials={hasCredentials} onLog={addLog} />

        {/* Export info */}
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

        {/* Logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Log de Sincronizações</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                    {log.status === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
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
    </TooltipProvider>
  );
};

export default CobCloudTab;
