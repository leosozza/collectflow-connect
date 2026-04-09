import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { updateTenant } from "@/services/tenantService";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Copy, Check, ScrollText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";

interface GupshupConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFetchLogs: () => void;
}

const GupshupConfigDialog = ({ open, onOpenChange, onFetchLogs }: GupshupConfigDialogProps) => {
  const { tenant, refetch } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const settings = (tenant?.settings as Record<string, any>) || {};

  const [apiKey, setApiKey] = useState(settings.gupshup_api_key || "");
  const [appName, setAppName] = useState(settings.gupshup_app_name || "");
  const [appId, setAppId] = useState(settings.gupshup_app_id || "");
  const [sourceNumber, setSourceNumber] = useState(settings.gupshup_source_number || "");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const webhookUrl = `${supabaseUrl}/functions/v1/gupshup-webhook`;

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!apiKey || !appName) {
      toast({ title: "Erro", description: "API Key e App Name são obrigatórios.", variant: "destructive" });
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("gupshup-proxy", {
        body: { apiKey: apiKey.trim(), appName: appName.trim(), sourceNumber: sourceNumber.replace(/\D/g, ""), tenantId: tenant?.id },
      });
      if (error) throw new Error(error.message || "Erro ao chamar gupshup-proxy");
      if (!data?.success) throw new Error(data?.error || "Falha na conexão com Gupshup");
      toast({ title: "Sucesso!", description: "Conexão com Gupshup validada com sucesso." });
    } catch (err: any) {
      toast({ title: "Falha na Conexão", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!tenant) return;
    if (!apiKey.trim() || !appName.trim() || !sourceNumber.trim()) {
      toast({ title: "Erro", description: "API Key, App Name e Número de Origem são obrigatórios.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await updateTenant(tenant.id, {
        settings: {
          ...settings,
          gupshup_api_key: apiKey.trim(),
          gupshup_app_id: appId.trim(),
          gupshup_app_name: appName.trim(),
          gupshup_source_number: sourceNumber.replace(/\D/g, ""),
          whatsapp_provider: "gupshup",
        },
      });

      const instanceName = `gupshup-${tenant.slug}`;
      const { data: existing } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("instance_name", instanceName)
        .maybeSingle();

      if (existing) {
        const { error: updErr } = await supabase
          .from("whatsapp_instances")
          .update({
            phone_number: sourceNumber.replace(/\D/g, ""),
            status: "connected",
            provider: "gupshup",
            name: appName.trim(),
            instance_url: "https://api.gupshup.io",
            api_key: apiKey.trim(),
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", existing.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await (supabase.from("whatsapp_instances") as any).insert({
          tenant_id: tenant.id,
          instance_name: instanceName,
          phone_number: sourceNumber.replace(/\D/g, ""),
          status: "connected",
          provider: "gupshup",
          provider_category: "official",
          name: appName.trim(),
          instance_url: "https://api.gupshup.io",
          api_key: apiKey.trim(),
        });
        if (insErr) throw insErr;
      }

      await refetch();
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances-gupshup", tenant.id] });
      toast({ title: "Instância oficial salva!", description: "A linha oficial agora está ativa." });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar WhatsApp Oficial (Gupshup)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>App Name</Label>
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Maxfama2" />
            </div>
            <div className="space-y-2">
              <Label>App ID (Opcional)</Label>
              <Input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="uuid-do-app" />
            </div>
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
              <Button variant="outline" size="icon" onClick={onFetchLogs} title="Ver Logs">
                <ScrollText className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Cole esta URL no painel do Gupshup</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={testing || saving}
              className="flex-1"
            >
              {testing ? "Testando..." : "Testar Conexão"}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || testing}
              className="flex-[2]"
            >
              {saving ? "Salvando..." : "Salvar e ativar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GupshupConfigDialog;
