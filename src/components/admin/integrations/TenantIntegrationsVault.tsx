import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Key, ShieldCheck, Loader2, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TenantIntegrationsVaultProps {
  tenantId: string;
}

export const TenantIntegrationsVault = ({ tenantId }: TenantIntegrationsVaultProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const [config, setConfig] = useState({
    client_id: "",
    client_secret: "",
  });

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("config")
        .eq("tenant_id", tenantId)
        .eq("provider", "negociarie")
        .maybeSingle();

      if (error) throw error;
      if (data?.config) {
        setConfig(data.config as any);
      } else {
        setConfig({ client_id: "", client_secret: "" });
      }
    } catch (err: any) {
      console.error("[Vault] Error loading:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) loadConfig();
  }, [tenantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tenant_integrations")
        .upsert({
          tenant_id: tenantId,
          provider: "negociarie",
          config: config,
          is_active: true,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: "tenant_id, provider" });

      if (error) throw error;
      toast({ title: "Configurações salvas!", description: "O cofre foi atualizado com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("negociarie-proxy", {
        body: { action: "test-connection" },
      });

      if (error) throw error;
      if (data?.connected) {
        toast({ title: "Conexão estabelecida!", description: "As credenciais são válidas.", variant: "default" });
      } else {
        throw new Error(data?.error || "Falha na conexão");
      }
    } catch (err: any) {
      toast({ title: "Falha no teste", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Cofre de Integrações</h3>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Key className="w-4 h-4" />
              Negociarie
            </CardTitle>
            {config.client_id ? (
              <Badge variant="default" className="bg-green-600">Configurado</Badge>
            ) : (
              <Badge variant="secondary">Usando Global (Fallback)</Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            Credenciais para geração de Boletos e Pix nesta assessoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Client ID</Label>
            <Input 
              value={config.client_id} 
              onChange={e => setConfig(prev => ({ ...prev, client_id: e.target.value }))}
              placeholder="Ex: 550e8400-e29b-41d4-a716-446655440000"
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Client Secret</Label>
            <div className="relative">
              <Input 
                type={showSecret ? "text" : "password"}
                value={config.client_secret} 
                onChange={e => setConfig(prev => ({ ...prev, client_secret: e.target.value }))}
                placeholder="••••••••••••••••"
                className="bg-background pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              className="flex-1" 
              onClick={handleSave} 
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar no Cofre
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleTestConnection} 
              disabled={testing || !config.client_id}
              title="Testar Conexão"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
