import { Cloud } from "lucide-react";
import IntegrationTestCard from "./IntegrationTestCard";
import { supabase } from "@/integrations/supabase/client";

const CobCloudTab = () => {
  const handleTest = async (addLog: (status: "success" | "error" | "info", msg: string) => void) => {
    addLog("info", "Iniciando teste de conexão com CobCloud...");
    addLog("info", "CobCloud usa credenciais por tenant (settings do tenant)");

    try {
      const { data, error } = await supabase.functions.invoke("cobcloud-proxy", {
        body: { action: "status" },
      });

      if (error) {
        addLog("error", `Erro na edge function: ${error.message}`);
        return;
      }

      if (data?.error) {
        addLog("info", `Resposta: ${data.error}`);
        addLog("success", "Edge function cobcloud-proxy está acessível");
      } else {
        addLog("success", `Status: ${JSON.stringify(data).slice(0, 200)}`);
      }

      addLog("success", "✅ Teste concluído");
    } catch (err: any) {
      addLog("error", `Erro: ${err.message}`);
    }
  };

  return (
    <IntegrationTestCard
      icon={Cloud}
      title="CobCloud — Importação de Títulos"
      description="Importação e exportação de devedores/títulos. Credenciais configuradas por tenant."
      secrets={[]}
      onTest={handleTest}
    >
      <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
        ℹ️ CobCloud utiliza tokens por tenant (token_company, token_assessoria, token_client) configurados na área do cliente em Integrações.
      </p>
    </IntegrationTestCard>
  );
};

export default CobCloudTab;
