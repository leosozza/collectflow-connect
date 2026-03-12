import { Phone } from "lucide-react";
import IntegrationTestCard from "./IntegrationTestCard";
import { supabase } from "@/integrations/supabase/client";

const ThreeCPlusTab = () => {
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
      <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
        ℹ️ 3CPlus utiliza domínio e token configurados por tenant na área de Integrações do cliente.
      </p>
    </IntegrationTestCard>
  );
};

export default ThreeCPlusTab;
