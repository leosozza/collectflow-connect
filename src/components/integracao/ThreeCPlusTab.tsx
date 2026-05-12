import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Wifi, WifiOff, Loader2, Save, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import IntegrationDetailLayout from "./IntegrationDetailLayout";
import { INTEGRATIONS } from "./integrationsCatalog";

const ThreeCPlusTab = () => {
  const meta = INTEGRATIONS["3cplus"];
  const { tenant, refetch } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};

  const [domain, setDomain] = useState(settings.threecplus_domain || "");
  const [apiToken, setApiToken] = useState(settings.threecplus_api_token || "");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    const d = settings.threecplus_domain;
    const t = settings.threecplus_api_token;
    if (d && !domain) setDomain(d);
    if (t && !apiToken) setApiToken(t);
  }, [settings.threecplus_domain, settings.threecplus_api_token]);

  const isConfigured = !!(settings.threecplus_domain && settings.threecplus_api_token);
  const status = connected ? "connected" : isConfigured ? "test" : "not_configured";

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
      const { error } = await supabase.from("tenants").update({ settings: newSettings }).eq("id", tenant.id);
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
        body: { action: "list_campaigns", domain: domain.trim(), api_token: apiToken.trim() },
      });
      if (error) throw error;
      if (data?.status === 200 && data?.data) {
        setConnected(true);
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
    <IntegrationDetailLayout
      name={meta.name}
      category={meta.category}
      logoUrl={meta.logoUrl}
      fallbackIcon={meta.fallbackIcon}
      brandColor={meta.brandColor}
      description={meta.description}
      status={status}
      requirements={meta.requirements}
    >
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Credenciais</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="domain" className="text-xs text-muted-foreground">
                Domínio da empresa
              </Label>
              <Input
                id="domain"
                placeholder="minha-empresa.3c.plus"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="bg-background/50"
              />
              <p className="text-[10px] text-muted-foreground">Ex: minha-empresa.3c.plus (sem https://)</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apiToken" className="text-xs text-muted-foreground">
                Token de API (Gestor)
              </Label>
              <div className="relative">
                <Input
                  id="apiToken"
                  type={showToken ? "text" : "password"}
                  placeholder="Token do gestor 3CPlus"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  className="pr-10 bg-background/50"
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
              <p className="text-[10px] text-muted-foreground">
                Configurações → Usuários → Opções Avançadas
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Button variant="secondary" onClick={handleTestConnection} disabled={testing} className="flex-1">
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : connected ? (
                <Wifi className="w-4 h-4 mr-2 text-emerald-500" />
              ) : (
                <WifiOff className="w-4 h-4 mr-2" />
              )}
              Testar Conexão
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Credenciais
            </Button>
          </div>
        </CardContent>
      </Card>
    </IntegrationDetailLayout>
  );
};

export default ThreeCPlusTab;
