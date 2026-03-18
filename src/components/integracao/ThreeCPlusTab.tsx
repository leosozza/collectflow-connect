import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wifi, WifiOff, Loader2, Save, Phone, Eye, EyeOff, ArrowRightLeft, FlaskConical, CheckCircle2, XCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { DISPOSITION_TYPES } from "@/services/dispositionService";

type TestLog = { time: string; status: "success" | "error" | "info"; message: string };

const MailingTestCard = ({ campaigns, domain, apiToken }: { campaigns: any[]; domain: string; apiToken: string }) => {
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testName, setTestName] = useState("Contato Teste");
  const [testCpf, setTestCpf] = useState("00000000000");
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<TestLog[]>([]);

  const addLog = (status: TestLog["status"], message: string) => {
    setLogs((prev) => [{ time: new Date().toLocaleTimeString("pt-BR"), status, message }, ...prev]);
  };

  const handleTestSend = async () => {
    if (!selectedCampaign) { toast.error("Selecione uma campanha"); return; }
    if (!testPhone) { toast.error("Informe um telefone de teste"); return; }

    setSending(true);
    setLogs([]);
    addLog("info", "Iniciando teste de envio de mailing...");

    try {
      // Step 1: Create list
      addLog("info", `Criando lista na campanha ${selectedCampaign}...`);
      const { data: listData, error: listError } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "create_list", domain: domain.trim(), api_token: apiToken.trim(), campaign_id: selectedCampaign },
      });
      if (listError) throw listError;

      const listId = listData?.data?.id || listData?.id;
      if (!listId) {
        addLog("error", `Resposta create_list: ${JSON.stringify(listData).slice(0, 300)}`);
        throw new Error("Não foi possível criar a lista — ID não retornado");
      }
      addLog("success", `Lista criada com ID: ${listId}`);

      // Step 2: Send mailing
      const mailings = [{
        identifier: testCpf.replace(/\D/g, ""),
        phone: testPhone.replace(/\D/g, ""),
        Nome: testName,
        Extra1: "TESTE",
        Extra2: "0.00",
        Extra3: "test-id",
      }];

      addLog("info", `Enviando 1 contato de teste para lista ${listId}...`);
      addLog("info", `Payload: ${JSON.stringify(mailings[0])}`);

      const { data: sendData, error: sendError } = await supabase.functions.invoke("threecplus-proxy", {
        body: {
          action: "send_mailing",
          domain: domain.trim(),
          api_token: apiToken.trim(),
          campaign_id: selectedCampaign,
          list_id: listId,
          mailings,
        },
      });
      if (sendError) throw sendError;

      // Detect API-level errors (e.g. 422)
      const httpStatus = sendData?.status;
      const responseBody = JSON.stringify(sendData, null, 2);

      if (httpStatus && httpStatus >= 400) {
        addLog("error", `❌ API retornou HTTP ${httpStatus}`);
        addLog("error", `Detalhes: ${responseBody.slice(0, 600)}`);
        // Show validation errors if present
        if (sendData?.data?.errors) {
          Object.entries(sendData.data.errors).forEach(([field, msgs]: [string, any]) => {
            addLog("error", `Campo "${field}": ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`);
          });
        }
      } else {
        addLog("success", `✅ Mailing enviado com sucesso! HTTP ${httpStatus || 200}`);
        addLog("info", `Resposta: ${responseBody.slice(0, 500)}`);
      }

      // Step 3: Verify — get campaign lists to check if mailing was received
      addLog("info", "Verificando lista na campanha...");
      const { data: listsData } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "get_campaign_lists", domain: domain.trim(), api_token: apiToken.trim(), campaign_id: selectedCampaign },
      });
      const allLists = Array.isArray(listsData) ? listsData : listsData?.data || [];
      const createdList = allLists.find((l: any) => String(l.id) === String(listId));

      if (createdList) {
        const count = createdList.mailing_count ?? createdList.total ?? "?";
        addLog("success", `✅ Lista ${listId} encontrada na campanha! Contatos na lista: ${count}`);
      } else {
        addLog("info", `Lista ${listId} não encontrada na verificação (pode levar alguns segundos para aparecer)`);
      }

      addLog("success", "✅ Teste concluído com sucesso!");
    } catch (err: any) {
      addLog("error", `❌ Erro: ${err.message || JSON.stringify(err)}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <FlaskConical className="w-5 h-5 text-primary" />
          <div>
            <CardTitle className="text-base">Teste de Envio de Mailing</CardTitle>
            <CardDescription>
              Envie um contato de teste para validar que o fluxo de criação de lista e envio está funcionando
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Campanha</Label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma campanha" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Telefone de teste</Label>
            <Input placeholder="11999998888" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={testName} onChange={(e) => setTestName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input value={testCpf} onChange={(e) => setTestCpf(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleTestSend} disabled={sending || !selectedCampaign} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Enviando..." : "Enviar Teste"}
          </Button>
          {logs.length > 0 && !sending && (
            <Badge variant="outline" className={
              logs[0]?.status === "success"
                ? "bg-green-500/10 text-green-600 border-green-200"
                : logs[0]?.status === "error"
                ? "bg-destructive/10 text-destructive border-destructive/20"
                : "bg-muted text-muted-foreground"
            }>
              {logs[0]?.status === "success" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : logs[0]?.status === "error" ? <XCircle className="w-3 h-3 mr-1" /> : null}
              {logs[0]?.status === "success" ? "Sucesso" : "Falha"}
            </Badge>
          )}
        </div>

        {logs.length > 0 && (
          <ScrollArea className="h-[220px] rounded-md border border-border bg-muted/30 p-3">
            <div className="space-y-1.5 font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-muted-foreground shrink-0">[{log.time}]</span>
                  {log.status === "success" && <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />}
                  {log.status === "error" && <XCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />}
                  {log.status === "info" && <Wifi className="w-3 h-3 text-primary mt-0.5 shrink-0" />}
                  <span className={
                    log.status === "success" ? "text-green-600 dark:text-green-400"
                    : log.status === "error" ? "text-destructive"
                    : "text-foreground"
                  }>{log.message}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

const ThreeCPlusTab = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};

  const [domain, setDomain] = useState(settings.threecplus_domain || "");
  const [apiToken, setApiToken] = useState(settings.threecplus_api_token || "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  // Qualification mapping state
  const [qualifications, setQualifications] = useState<any[]>([]);
  const [loadingQuals, setLoadingQuals] = useState(false);
  const [dispositionMap, setDispositionMap] = useState<Record<string, string>>(
    settings.threecplus_disposition_map || {}
  );
  const [savingMap, setSavingMap] = useState(false);

  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      const newSettings = {
        ...settings,
        threecplus_domain: domain.trim(),
        threecplus_api_token: apiToken.trim(),
      };
      const { error } = await supabase
        .from("tenants")
        .update({ settings: newSettings })
        .eq("id", tenant.id);
      if (error) throw error;
      toast.success("Credenciais 3CPlus salvas!");
    } catch {
      toast.error("Erro ao salvar credenciais");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!domain || !apiToken) {
      toast.error("Preencha domínio e token");
      return;
    }
    setTesting(true);
    setConnected(null);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: {
          action: "list_campaigns",
          domain: domain.trim(),
          api_token: apiToken.trim(),
        },
      });
      if (error) throw error;
      if (data?.status === 200 && data?.data) {
        setConnected(true);
        setCampaigns(data.data || []);
        toast.success(`Conectado! ${(data.data || []).length} campanhas encontradas`);
      } else {
        setConnected(false);
        toast.error(data?.detail || "Falha na conexão");
      }
    } catch (err: any) {
      setConnected(false);
      toast.error("Erro ao testar conexão: " + (err.message || ""));
    } finally {
      setTesting(false);
    }
  };

  const loadQualifications = async () => {
    if (!domain || !apiToken) return;
    setLoadingQuals(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: {
          action: "list_qualifications",
          domain: domain.trim(),
          api_token: apiToken.trim(),
        },
      });
      if (error) throw error;
      const list = Array.isArray(data) ? data : data?.data || [];
      setQualifications(list);
    } catch {
      toast.error("Erro ao carregar qualificações do 3CPlus");
    } finally {
      setLoadingQuals(false);
    }
  };

  // Load qualifications when connection is tested
  useEffect(() => {
    if (connected) {
      loadQualifications();
    }
  }, [connected]);

  const handleSaveMap = async () => {
    if (!tenant?.id) return;
    setSavingMap(true);
    try {
      const newSettings = {
        ...settings,
        threecplus_disposition_map: dispositionMap,
      };
      const { error } = await supabase
        .from("tenants")
        .update({ settings: newSettings })
        .eq("id", tenant.id);
      if (error) throw error;
      toast.success("Mapeamento de tabulações salvo!");
    } catch {
      toast.error("Erro ao salvar mapeamento");
    } finally {
      setSavingMap(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Phone className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>3CPlus - Discador</CardTitle>
              <CardDescription>
                Configure a integração com o discador 3CPlus para envio de listas de contatos e discagem automática
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domínio da empresa</Label>
              <Input
                id="domain"
                placeholder="minha-empresa.3c.plus"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ex: minha-empresa.3c.plus (sem https://)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiToken">Token de API (Gestor)</Label>
              <div className="relative">
                <Input
                  id="apiToken"
                  type={showToken ? "text" : "password"}
                  placeholder="Token do gestor 3CPlus"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Obtenha em Configurações → Usuários → Opções Avançadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={handleTestConnection} disabled={testing} className="gap-2">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              Testar Conexão
            </Button>
            {connected !== null && (
              <Badge variant={connected ? "default" : "destructive"} className="gap-1">
                {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {connected ? "Conectado" : "Falha"}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {campaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campanhas Disponíveis</CardTitle>
            <CardDescription>Campanhas encontradas na sua conta 3CPlus</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {campaigns.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">ID: {c.id}</p>
                  </div>
                  <Badge variant={c.status === "running" ? "default" : "secondary"}>
                    {c.status || "—"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teste de Envio de Mailing */}
      {campaigns.length > 0 && (
        <MailingTestCard
          campaigns={campaigns}
          domain={domain}
          apiToken={apiToken}
        />
      )}

      {/* Disposition → Qualification Mapping */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-base">Mapeamento de Tabulações</CardTitle>
              <CardDescription>
                Vincule cada tabulação do Rivo a uma qualificação do 3CPlus para tabulação automática
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {qualifications.length === 0 && !loadingQuals && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Teste a conexão acima para carregar as qualificações do 3CPlus.
              </p>
              <Button variant="outline" size="sm" onClick={loadQualifications} disabled={!domain || !apiToken || loadingQuals}>
                {loadingQuals ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Carregar Qualificações
              </Button>
            </div>
          )}

          {loadingQuals && <p className="text-sm text-muted-foreground">Carregando qualificações...</p>}

          {qualifications.length > 0 && (
            <>
              <div className="space-y-3">
                {Object.entries(DISPOSITION_TYPES).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-40 shrink-0">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{key}</p>
                    </div>
                    <Select
                      value={dispositionMap[key] || ""}
                      onValueChange={(v) =>
                        setDispositionMap((prev) => ({ ...prev, [key]: v === "__none__" ? "" : v }))
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Não mapeado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Não mapeado</SelectItem>
                        {qualifications.map((q: any) => (
                          <SelectItem key={q.id} value={String(q.id)}>
                            {q.name || q.label || `ID ${q.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={handleSaveMap} disabled={savingMap} className="gap-2">
                {savingMap ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Mapeamento
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ThreeCPlusTab;
