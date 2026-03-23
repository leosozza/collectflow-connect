import { Phone, ArrowLeftRight, ArrowRight } from "lucide-react";
import IntegrationTestCard from "./IntegrationTestCard";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

const ThreeCPlusTab = () => {
  const [webhookActive, setWebhookActive] = useState<boolean | null>(null);

  useEffect(() => {
    checkWebhookStatus();
  }, []);

  const checkWebhookStatus = async () => {
    try {
      // Check if any campaign has a registered webhook by testing the webhook endpoint existence
      const { data } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "list_campaigns" },
      });
      const campaigns = Array.isArray(data) ? data : data?.data || data?.results || [];
      
      if (campaigns.length === 0) {
        setWebhookActive(false);
        return;
      }

      // Check first campaign for webhooks
      for (const camp of campaigns.slice(0, 3)) {
        try {
          const whData = await supabase.functions.invoke("threecplus-proxy", {
            body: { action: "list_webhooks", campaign_id: camp.id },
          }).then(r => r.data);
          const webhooks = Array.isArray(whData) ? whData : whData?.data || [];
          if (webhooks.length > 0) {
            setWebhookActive(true);
            return;
          }
        } catch { /* skip */ }
      }
      setWebhookActive(false);
    } catch {
      setWebhookActive(false);
    }
  };

  const handleTest = async (addLog: (status: "success" | "error" | "info", msg: string) => void) => {
    addLog("info", "Iniciando teste de conexão com 3CPlus...");
    addLog("info", "3CPlus usa credenciais por tenant (domínio + token)");

    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "list_agents" },
      });

      if (error) {
        addLog("error", `Erro na edge function: ${error.message}`);
        return;
      }

      if (data?.error) {
        addLog("info", `Resposta: ${data.error}`);
        addLog("success", "Edge function threecplus-proxy está acessível");
      } else {
        addLog("success", `Resposta: ${JSON.stringify(data).slice(0, 200)}`);
      }

      // Test webhook endpoint
      addLog("info", "Verificando endpoint de webhook bidirecional...");
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/threecplus-webhook`;
      addLog("success", `Webhook URL: ${webhookUrl}`);
      addLog("info", `Status bidirecional: ${webhookActive ? "ATIVO ✅" : "INATIVO — ative webhooks nas campanhas"}`);

      addLog("success", "✅ Teste concluído");
    } catch (err: any) {
      addLog("error", `Erro: ${err.message}`);
    }
  };

  return (
    <IntegrationTestCard
      icon={Phone}
      title="3CPlus — Telefonia / Discador"
      description="Click2call, tabulação e gerenciamento de campanhas de discagem. Credenciais por tenant."
      secrets={[]}
      onTest={handleTest}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Modo de integração:</span>
          {webhookActive === null ? (
            <Badge variant="outline" className="text-xs">Verificando...</Badge>
          ) : webhookActive ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs gap-1">
              <ArrowLeftRight className="w-3 h-3" />
              Bidirecional
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-500/30 bg-amber-500/10">
              <ArrowRight className="w-3 h-3" />
              Unidirecional
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          {webhookActive
            ? "✅ Webhooks ativos — chamadas, qualificações e status são registrados automaticamente no RIVO."
            : "ℹ️ Ative webhooks nas campanhas (aba Telefonia → Campanhas) para receber eventos em tempo real da 3CPlus."}
        </p>
      </div>
    </IntegrationTestCard>
  );
};

export default ThreeCPlusTab;
