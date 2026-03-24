import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Loader2, Save, Phone, Eye, EyeOff, ArrowRightLeft, CheckCircle2, XCircle, ShieldAlert, Info } from "lucide-react";
import { toast } from "sonner";

const SYSTEM_QUALIFICATIONS = [
  { id: -2, name: "Não qualificada" },
  { id: -3, name: "Caixa Postal" },
  { id: -4, name: "Mudo" },
  { id: -5, name: "Limite de tempo excedido" },
];

const ThreeCPlusTab = () => {
  const { tenant, refetch } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};

  const [domain, setDomain] = useState(settings.threecplus_domain || "");
  const [apiToken, setApiToken] = useState(settings.threecplus_api_token || "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [showSyncStatus, setShowSyncStatus] = useState(false);

  const [tenantDispositions, setTenantDispositions] = useState<{ key: string; label: string; threecplus_qualification_id?: number | null }[]>([]);

  useEffect(() => {
    if (!tenant?.id) return;
    supabase
      .from("call_disposition_types")
      .select("key, label, threecplus_qualification_id" as any)
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTenantDispositions(data as any);
        }
      });
  }, [tenant?.id]);

  useEffect(() => {
    const d = settings.threecplus_domain;
    const t = settings.threecplus_api_token;
    if (d && !domain) setDomain(d);
    if (t && !apiToken) setApiToken(t);
  }, [settings.threecplus_domain, settings.threecplus_api_token]);

  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      const { data: freshTenant } = await supabase
        .from("tenants").select("settings").eq("id", tenant.id).single();
      const freshSettings = (freshTenant?.settings as Record<string, any>) || {};
      const newSettings = {
        ...freshSettings,
        threecplus_domain: domain.trim(),
        threecplus_api_token: apiToken.trim(),
      };
      const { error } = await supabase
        .from("tenants")
        .update({ settings: newSettings })
        .eq("id", tenant.id);
      if (error) throw error;
      await refetch();
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
        setShowSyncStatus(true);
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

      {/* Sync Status — only after successful connection test */}
      {showSyncStatus && tenantDispositions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-base">Status de Sincronização</CardTitle>
                <CardDescription>
                  Tabulações criadas em Cadastros são sincronizadas automaticamente com a 3CPlus
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tabulação RIVO</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">ID 3CPlus</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantDispositions.map((d) => {
                    const qId = (d as any).threecplus_qualification_id;
                    const synced = !!qId;
                    return (
                      <tr key={d.key} className="border-t border-border">
                        <td className="px-3 py-2">
                          <p className="font-medium">{d.label}</p>
                          <p className="text-[10px] text-muted-foreground">{d.key}</p>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{qId || "—"}</td>
                        <td className="px-3 py-2">
                          {synced ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Sincronizado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-500/30 bg-amber-500/10">
                              <XCircle className="w-3 h-3" />
                              Pendente sync
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Crie tabulações em <strong>Cadastros → Tabulações de Chamada</strong> e clique <strong>Sincronizar 3CPlus</strong> para vincular automaticamente.
            </p>
          </CardContent>
        </Card>
      )}

      {/* System Qualifications Info Card */}
      <Card className="border-muted">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Qualificações Nativas do Sistema 3CPlus</CardTitle>
              <CardDescription>
                Estas qualificações são automáticas da 3CPlus e não podem ser editadas. São aplicadas pelo discador quando o contato não é atendido.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">ID</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Comportamento</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">-2</td>
                  <td className="px-3 py-2">Não qualificada</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">Ligação completada mas não tabulada pelo operador</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">-3</td>
                  <td className="px-3 py-2">Caixa Postal</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">Chamada caiu na caixa postal</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">-4</td>
                  <td className="px-3 py-2">Mudo</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">Chamada atendida sem áudio detectado</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">-5</td>
                  <td className="px-3 py-2">Limite de tempo excedido</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">TPA expirou sem tabulação do operador</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            Qualificações nativas — gerenciadas automaticamente pela 3CPlus
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ThreeCPlusTab;
