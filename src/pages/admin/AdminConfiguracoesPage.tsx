import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, Shield, Bell, Database, Globe, CreditCard, AlertTriangle, Wifi, WifiOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import GoLiveChecklist from "@/components/admin/GoLiveChecklist";
import { getSystemSetting, updateSystemSetting } from "@/services/systemSettingsService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const configSections = [
  {
    icon: Shield,
    title: "Segurança",
    description: "Configurações de segurança e autenticação",
    items: [
      { label: "Autenticação de dois fatores (2FA)", enabled: false },
      { label: "Timeout automático de sessão", enabled: true },
      { label: "Registro de IP e dispositivo", enabled: true },
    ],
  },
  {
    icon: Bell,
    title: "Notificações",
    description: "Alertas e notificações do sistema",
    items: [
      { label: "Alertas de novo inquilino", enabled: true },
      { label: "Alertas de inadimplência", enabled: true },
      { label: "Relatório semanal por e-mail", enabled: false },
    ],
  },
  {
    icon: Database,
    title: "Sistema",
    description: "Configurações gerais do sistema",
    items: [
      { label: "Modo de manutenção", enabled: false },
      { label: "Logs detalhados", enabled: true },
      { label: "Backup automático", enabled: true },
    ],
  },
  {
    icon: Globe,
    title: "Integrações Globais",
    description: "Integrações e APIs do sistema",
    items: [
      { label: "API pública habilitada", enabled: true },
      { label: "Webhooks globais", enabled: false },
    ],
  },
];

const AdminConfiguracoesPage = () => {
  const [asaasEnv, setAsaasEnv] = useState<string>("sandbox");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testLogs, setTestLogs] = useState<{ time: string; status: "success" | "error" | "info"; message: string }[]>([]);

  useEffect(() => {
    getSystemSetting("asaas_environment").then((val) => {
      if (val) setAsaasEnv(val);
      setLoading(false);
    });
  }, []);

  const handleToggleEnv = () => {
    if (asaasEnv === "sandbox") {
      // Going to production — confirm
      setShowConfirm(true);
    } else {
      // Going back to sandbox — no confirm needed
      switchEnv("sandbox");
    }
  };

  const switchEnv = async (newEnv: string) => {
    setSaving(true);
    try {
      await updateSystemSetting("asaas_environment", newEnv);
      setAsaasEnv(newEnv);
      toast.success(`Ambiente Asaas alterado para ${newEnv === "production" ? "Produção" : "Sandbox"}`);
    } catch {
      toast.error("Erro ao alterar ambiente");
    } finally {
      setSaving(false);
      setShowConfirm(false);
    }
  };

  const isProduction = asaasEnv === "production";

  const addLog = (status: "success" | "error" | "info", message: string) => {
    setTestLogs((prev) => [
      { time: new Date().toLocaleTimeString("pt-BR"), status, message },
      ...prev,
    ]);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestLogs([]);
    const env = isProduction ? "Produção" : "Sandbox";

    addLog("info", `Iniciando teste de conexão (${env})...`);

    try {
      // Step 1: Check system_settings
      addLog("info", "Verificando configuração do ambiente...");
      const currentEnv = await getSystemSetting("asaas_environment");
      if (currentEnv) {
        addLog("success", `Ambiente configurado: ${currentEnv}`);
      } else {
        addLog("error", "Configuração de ambiente não encontrada no banco");
        setTesting(false);
        return;
      }

      // Step 2: Test proxy connection
      addLog("info", "Testando conexão com API Asaas via proxy...");
      const { data, error } = await supabase.functions.invoke("asaas-proxy", {
        body: { action: "create_customer", name: "Teste Conexão", cpfCnpj: "00000000000" },
      });

      if (error) {
        addLog("error", `Erro na edge function: ${error.message}`);
        toast.error("Falha no teste de conexão");
        setTesting(false);
        return;
      }

      if (data?.errors) {
        // Asaas returned an error — but connection works
        const errMsg = data.errors[0]?.description || JSON.stringify(data.errors);
        if (errMsg.includes("já cadastrado") || errMsg.includes("already")) {
          addLog("success", `API Asaas respondeu (cliente já existe) — Conexão OK`);
        } else {
          addLog("info", `API Asaas respondeu com erro de validação: ${errMsg}`);
          addLog("success", "Conexão com a API está funcionando (erro esperado para dados de teste)");
        }
      } else if (data?.id) {
        addLog("success", `Cliente de teste criado com sucesso (ID: ${data.id})`);
      } else {
        addLog("info", `Resposta da API: ${JSON.stringify(data).slice(0, 200)}`);
      }

      addLog("success", `✅ Teste de conexão concluído (${env})`);
      toast.success("Conexão com Asaas verificada!");
    } catch (err: any) {
      addLog("error", `Erro inesperado: ${err.message}`);
      toast.error("Erro ao testar conexão");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Configurações do Sistema
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Configurações globais da plataforma</p>
      </div>

      {/* Asaas Gateway Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Gateway de Pagamento (Asaas)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Controle o ambiente do gateway de cobranças
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-foreground font-medium">Ambiente ativo:</span>
              <Badge
                variant={isProduction ? "default" : "secondary"}
                className={isProduction
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-amber-500 hover:bg-amber-600 text-white"
                }
              >
                {isProduction ? "🟢 Produção" : "🟡 Sandbox"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sandbox</span>
              <Switch
                checked={isProduction}
                onCheckedChange={handleToggleEnv}
                disabled={loading || saving}
              />
              <span className="text-xs text-muted-foreground">Produção</span>
            </div>
          </div>

          {isProduction && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">
                O ambiente de produção está ativo. Todas as cobranças serão reais e processadas pelo Asaas.
              </p>
            </div>
          )}

          {/* Test Connection */}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing || loading}
              className="gap-2"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              {testing ? "Testando..." : "Testar Conexão"}
            </Button>
            {testLogs.length > 0 && !testing && (
              <Badge
                variant="outline"
                className={
                  testLogs[0]?.status === "success"
                    ? "bg-green-500/10 text-green-600 border-green-200"
                    : testLogs[0]?.status === "error"
                    ? "bg-destructive/10 text-destructive border-destructive/20"
                    : "bg-muted text-muted-foreground"
                }
              >
                {testLogs[0]?.status === "success" ? (
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                ) : testLogs[0]?.status === "error" ? (
                  <XCircle className="w-3 h-3 mr-1" />
                ) : null}
                {testLogs[0]?.status === "success" ? "Conectado" : "Falha"}
              </Badge>
            )}
          </div>

          {/* Logs */}
          {testLogs.length > 0 && (
            <ScrollArea className="h-[180px] rounded-md border border-border bg-muted/30 p-3">
              <div className="space-y-1.5 font-mono text-xs">
                {testLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground shrink-0">[{log.time}]</span>
                    {log.status === "success" && <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />}
                    {log.status === "error" && <XCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />}
                    {log.status === "info" && <Wifi className="w-3 h-3 text-primary mt-0.5 shrink-0" />}
                    <span className={
                      log.status === "success" ? "text-green-600 dark:text-green-400" :
                      log.status === "error" ? "text-destructive" :
                      "text-foreground"
                    }>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {configSections.map((section) => (
          <Card key={section.title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <section.icon className="w-4 h-4 text-primary" />
                {section.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{section.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{item.label}</span>
                  <Switch defaultChecked={item.enabled} />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button>Salvar Configurações</Button>
      </div>

      {/* Confirmation dialog for production */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Ativar ambiente de Produção?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ao ativar o ambiente de produção, todas as cobranças serão processadas de forma real
              pelo Asaas. Certifique-se de que a chave de API de produção está configurada corretamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => switchEnv("production")}
              disabled={saving}
              className="bg-destructive hover:bg-destructive/90"
            >
              {saving ? "Salvando..." : "Sim, ativar Produção"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminConfiguracoesPage;
