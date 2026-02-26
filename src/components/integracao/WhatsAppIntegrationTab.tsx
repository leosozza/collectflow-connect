import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { updateTenant } from "@/services/tenantService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Eye, EyeOff, Copy, Check, Radio } from "lucide-react";
import BaylersInstancesList from "./BaylersInstancesList";
import WuzApiInstancesList from "./WuzApiInstancesList";

const WhatsAppIntegrationTab = () => {
  const { tenant, refetch } = useTenant();
  const { toast } = useToast();
  const settings = (tenant?.settings as Record<string, any>) || {};

  // Gupshup state
  const [apiKey, setApiKey] = useState(settings.gupshup_api_key || "");
  const [appName, setAppName] = useState(settings.gupshup_app_name || "");
  const [sourceNumber, setSourceNumber] = useState(settings.gupshup_source_number || "");
  const [showGupshupKey, setShowGupshupKey] = useState(false);
  const [savingGupshup, setSavingGupshup] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeProvider = settings.whatsapp_provider || (settings.gupshup_api_key ? "gupshup" : "");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const webhookUrl = `${supabaseUrl}/functions/v1/gupshup-webhook`;

  const isGupshupConfigured = !!(settings.gupshup_api_key && settings.gupshup_app_name && settings.gupshup_source_number);

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveGupshup = async () => {
    if (!tenant) return;
    setSavingGupshup(true);
    try {
      await updateTenant(tenant.id, {
        settings: {
          ...settings,
          gupshup_api_key: apiKey.trim(),
          gupshup_app_name: appName.trim(),
          gupshup_source_number: sourceNumber.replace(/\D/g, ""),
          whatsapp_provider: "gupshup",
        },
      });
      await refetch();
      toast({ title: "Credenciais Gupshup salvas!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingGupshup(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gupshup Card */}
        <Card className={activeProvider === "gupshup" ? "ring-2 ring-primary" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5" />
                Oficial (Gupshup)
              </CardTitle>
              <div className="flex items-center gap-2">
                {isGupshupConfigured && <Badge variant="secondary" className="text-green-700 bg-green-100">Configurado</Badge>}
                {activeProvider === "gupshup" && <Badge><Radio className="w-3 h-3 mr-1" />Ativo</Badge>}
              </div>
            </div>
            <CardDescription>API oficial do WhatsApp Business via Gupshup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showGupshupKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Sua API Key do Gupshup"
                />
                <button
                  type="button"
                  onClick={() => setShowGupshupKey(!showGupshupKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showGupshupKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>App Name</Label>
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Nome do app no Gupshup" />
            </div>
            <div className="space-y-2">
              <Label>Número de Origem</Label>
              <Input value={sourceNumber} onChange={(e) => setSourceNumber(e.target.value)} placeholder="5511999999999" />
              <p className="text-xs text-muted-foreground">Número com código do país, sem caracteres especiais</p>
            </div>
            <div className="space-y-2">
              <Label>Webhook de Retorno</Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="text-xs bg-muted" />
                <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Cole esta URL no painel do Gupshup para receber status de entrega</p>
            </div>
            <Button onClick={handleSaveGupshup} disabled={savingGupshup} className="w-full">
              {savingGupshup ? "Salvando..." : "Salvar e ativar Gupshup"}
            </Button>
          </CardContent>
        </Card>

        {/* Baylers Card */}
        <BaylersInstancesList />
      </div>

      {/* WuzAPI Card - full width */}
      <WuzApiInstancesList />
    </div>
  );
};

export default WhatsAppIntegrationTab;
