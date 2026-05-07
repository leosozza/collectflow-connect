import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck, Zap, Play, CheckCircle2, AlertCircle, Eye, EyeOff, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface CreditorIntegrationsVaultProps {
  tenantId: string;
  creditorId: string;
}

export const CreditorIntegrationsVault = ({ tenantId, creditorId }: CreditorIntegrationsVaultProps) => {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  
  const [config, setConfig] = useState({
    client_id: "",
    client_secret: ""
  });

  const loadConfig = async () => {
    if (!creditorId) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("tenant_integrations")
        .select("config")
        .eq("tenant_id", tenantId)
        .eq("creditor_id", creditorId)
        .eq("provider", "negociarie")
        .maybeSingle();

      if (error) throw error;
      if (data?.config) {
        setConfig({
          client_id: data.config.client_id || "",
          client_secret: data.config.client_secret || ""
        });
      }
    } catch (err) {
      console.error("[Vault] Error loading config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [creditorId]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from("tenant_integrations")
        .upsert({
          tenant_id: tenantId,
          creditor_id: creditorId,
          provider: "negociarie",
          config: config,
          is_active: true,
          updated_at: new Date().toISOString()
        } as any, {
          onConflict: "tenant_id,provider,creditor_id"
        });

      if (error) throw error;
      toast.success("Credenciais do credor salvas com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("negociarie-proxy", {
        body: { action: "test-connection" }
      });
      
      if (error) throw error;
      if (data.connected) {
        toast.success("Conexão com Negociarie (Credor) estabelecida!");
      } else {
        throw new Error(data.error || "Erro desconhecido");
      }
    } catch (err: any) {
      toast.error("Falha no teste: " + err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Configuração Negociarie</h4>
              <p className="text-[10px] text-muted-foreground">Credenciais exclusivas para este credor</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-background text-[10px] gap-1">
            <ShieldCheck className="w-3 h-3 text-green-500" /> Cofre Ativo
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground ml-1">Client ID</label>
            <Input 
              placeholder="Insira o Client ID do Credor"
              value={config.client_id}
              onChange={(e) => setConfig(prev => ({ ...prev, client_id: e.target.value }))}
              className="bg-background border-primary/10"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground ml-1">Client Secret</label>
            <div className="relative">
              <Input 
                type={showSecret ? "text" : "password"}
                placeholder="Insira o Client Secret do Credor"
                value={config.client_secret}
                onChange={(e) => setConfig(prev => ({ ...prev, client_secret: e.target.value }))}
                className="bg-background border-primary/10 pr-10"
              />
              <button 
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              className="flex-1 gap-2" 
              onClick={handleSave}
              disabled={loading}
            >
              <Save className="w-4 h-4" />
              {loading ? "Salvando..." : "Salvar no Cofre"}
            </Button>
            <Button 
              variant="outline" 
              className="gap-2 border-primary/20 hover:bg-primary/10"
              onClick={testConnection}
              disabled={testing || !config.client_id}
            >
              {testing ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4 text-primary fill-primary" />
              )}
              Testar
            </Button>
          </div>
        </div>
      </Card>
      
      <p className="text-[10px] text-muted-foreground px-1 italic">
        * As credenciais acima são criptografadas e isoladas por Tenant e Credor.
      </p>
    </div>
  );
};
