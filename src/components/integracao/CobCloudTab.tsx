import { useState, useEffect } from "react";
import { cobcloudService } from "@/services/cobcloudService";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/hooks/useTenant";
import { updateTenant } from "@/services/tenantService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi, WifiOff, Loader2, KeyRound, Save, Eye, EyeOff, Database } from "lucide-react";
import IntegrationDetailLayout from "./IntegrationDetailLayout";
import { INTEGRATIONS } from "./integrationsCatalog";

const CobCloudTab = () => {
  const meta = INTEGRATIONS.cobcloud;
  const { toast } = useToast();
  const { tenant, refetch } = useTenant();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [connectionDetail, setConnectionDetail] = useState<{ devedores_count?: number; titulos_count?: number } | null>(null);

  const [tokenCompany, setTokenCompany] = useState("");
  const [tokenAssessoria, setTokenAssessoria] = useState("");
  const [tokenClient, setTokenClient] = useState("");
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [showCompany, setShowCompany] = useState(false);
  const [showAssessoria, setShowAssessoria] = useState(false);
  const [showClient, setShowClient] = useState(false);

  const hasCredentials = !!(tenant?.settings?.cobcloud_token_company && tenant?.settings?.cobcloud_token_client);
  const status = connected ? "connected" : hasCredentials ? "test" : "not_configured";

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
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleTestConnection = async () => {
    if (!hasCredentials) {
      toast({ title: "Configure as credenciais primeiro", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const result = await cobcloudService.testConnection();
      setConnected(result.connected);
      setConnectionDetail({ devedores_count: result.devedores_count, titulos_count: result.titulos_count });
      const detail = `Devedores: ${result.devedores_count ?? 0} | Títulos: ${result.titulos_count ?? 0}`;
      toast({
        title: result.connected ? "Conectado!" : "Falha na conexão",
        description: result.connected ? `API CobCloud acessível. ${detail}` : "Verifique as credenciais",
        variant: result.connected ? "default" : "destructive",
      });
    } catch (e: any) {
      setConnected(false);
      setConnectionDetail(null);
      toast({ title: "Erro", description: e.message, variant: "destructive" });
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
            <h3 className="font-semibold text-sm text-foreground">Credenciais da API CobCloud v3</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Token Company</Label>
              <div className="relative">
                <Input type={showCompany ? "text" : "password"} placeholder="Token da empresa" value={tokenCompany} onChange={(e) => setTokenCompany(e.target.value)} className="bg-background/50" />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowCompany(!showCompany)}>
                  {showCompany ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Token Assessoria (opcional)</Label>
              <div className="relative">
                <Input type={showAssessoria ? "text" : "password"} placeholder="Token da assessoria" value={tokenAssessoria} onChange={(e) => setTokenAssessoria(e.target.value)} className="bg-background/50" />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowAssessoria(!showAssessoria)}>
                  {showAssessoria ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Token Client</Label>
              <div className="relative">
                <Input type={showClient ? "text" : "password"} placeholder="Token do client/credor" value={tokenClient} onChange={(e) => setTokenClient(e.target.value)} className="bg-background/50" />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowClient(!showClient)}>
                  {showClient ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button onClick={handleTestConnection} disabled={testing || !hasCredentials} variant="secondary" className="flex-1">
                {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : connected ? <Wifi className="w-4 h-4 mr-2 text-emerald-500" /> : <WifiOff className="w-4 h-4 mr-2" />}
                Testar Conexão
              </Button>
              <Button onClick={handleSaveCredentials} disabled={savingCredentials} className="flex-1">
                {savingCredentials ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Credenciais
              </Button>
            </div>
          </div>

          {connectionDetail && connected && (
            <div className="pt-4 border-t border-border/50">
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
            </div>
          )}
        </CardContent>
      </Card>
    </IntegrationDetailLayout>
  );
};

export default CobCloudTab;
