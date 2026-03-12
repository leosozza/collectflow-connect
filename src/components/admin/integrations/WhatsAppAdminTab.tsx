import { MessageSquare } from "lucide-react";
import IntegrationTestCard from "./IntegrationTestCard";
import { supabase } from "@/integrations/supabase/client";

const SECRETS = [
  { label: "EVOLUTION_API_URL", configured: true },
  { label: "EVOLUTION_API_KEY", configured: true },
  { label: "WUZAPI_URL", configured: true },
  { label: "WUZAPI_ADMIN_TOKEN", configured: true },
];

const WhatsAppAdminTab = () => {
  const handleTest = async (addLog: (status: "success" | "error" | "info", msg: string) => void) => {
    addLog("info", "Testando provedores WhatsApp configurados...");

    // Test Evolution API
    addLog("info", "[Evolution API] Testando conexão...");
    try {
      const { data: evoData, error: evoError } = await supabase.functions.invoke("evolution-proxy", {
        body: { action: "list_instances" },
      });
      if (evoError) {
        addLog("error", `[Evolution API] Erro: ${evoError.message}`);
      } else if (evoData?.error) {
        addLog("info", `[Evolution API] ${evoData.error}`);
        addLog("success", "[Evolution API] Edge function respondeu");
      } else {
        addLog("success", `[Evolution API] Conectado — ${Array.isArray(evoData) ? evoData.length : 0} instâncias`);
      }
    } catch (err: any) {
      addLog("error", `[Evolution API] ${err.message}`);
    }

    // Test WuzAPI
    addLog("info", "[WuzAPI] Testando conexão...");
    try {
      const { data: wuzData, error: wuzError } = await supabase.functions.invoke("wuzapi-proxy", {
        body: { action: "list_instances" },
      });
      if (wuzError) {
        addLog("error", `[WuzAPI] Erro: ${wuzError.message}`);
      } else if (wuzData?.error) {
        addLog("info", `[WuzAPI] ${wuzData.error}`);
        addLog("success", "[WuzAPI] Edge function respondeu");
      } else {
        addLog("success", `[WuzAPI] Conectado — ${JSON.stringify(wuzData).slice(0, 100)}`);
      }
    } catch (err: any) {
      addLog("error", `[WuzAPI] ${err.message}`);
    }

    addLog("success", "✅ Teste de provedores WhatsApp concluído");
  };

  return (
    <IntegrationTestCard
      icon={MessageSquare}
      title="WhatsApp — Provedores de Mensageria"
      description="Evolution API (Baylers), WuzAPI e Gupshup (Oficial). Cada provedor tem suas credenciais globais."
      secrets={SECRETS}
      onTest={handleTest}
    />
  );
};

export default WhatsAppAdminTab;
