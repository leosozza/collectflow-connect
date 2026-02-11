import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { updateTenant } from "@/services/tenantService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Eye, EyeOff } from "lucide-react";

const GupshupSettings = () => {
  const { tenant, refetch } = useTenant();
  const { toast } = useToast();
  const settings = (tenant?.settings as Record<string, any>) || {};

  const [apiKey, setApiKey] = useState(settings.gupshup_api_key || "");
  const [appName, setAppName] = useState(settings.gupshup_app_name || "");
  const [sourceNumber, setSourceNumber] = useState(settings.gupshup_source_number || "");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      await updateTenant(tenant.id, {
        settings: {
          ...settings,
          gupshup_api_key: apiKey.trim(),
          gupshup_app_name: appName.trim(),
          gupshup_source_number: sourceNumber.replace(/\D/g, ""),
        },
      });
      await refetch();
      toast({ title: "Credenciais Gupshup salvas!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isConfigured = !!(settings.gupshup_api_key && settings.gupshup_app_name && settings.gupshup_source_number);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Integração WhatsApp (Gupshup)
        </CardTitle>
        <CardDescription>
          Configure suas credenciais Gupshup para enviar mensagens de cobrança via WhatsApp.
          {isConfigured && (
            <span className="ml-2 text-green-600 font-medium">✓ Configurado</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Sua API Key do Gupshup"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>App Name</Label>
          <Input
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="Nome do app no Gupshup"
          />
        </div>
        <div className="space-y-2">
          <Label>Número de Origem</Label>
          <Input
            value={sourceNumber}
            onChange={(e) => setSourceNumber(e.target.value)}
            placeholder="5511999999999"
          />
          <p className="text-xs text-muted-foreground">Número com código do país, sem caracteres especiais</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar credenciais"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default GupshupSettings;
