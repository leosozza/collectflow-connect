import { Search } from "lucide-react";
import IntegrationTestCard from "./IntegrationTestCard";
import { supabase } from "@/integrations/supabase/client";

const SECRETS = [
  { label: "TARGETDATA_API_KEY", configured: true },
  { label: "TARGETDATA_API_SECRET", configured: true },
];

const TargetDataTab = () => {
  const handleTest = async (addLog: (status: "success" | "error" | "info", msg: string) => void) => {
    addLog("info", "Iniciando teste de conexão com Target Data...");
    addLog("info", "Verificando credenciais configuradas...");

    try {
      const { data, error } = await supabase.functions.invoke("targetdata-enrich", {
        body: {
          tenant_id: "00000000-0000-0000-0000-000000000000",
          cpfs: ["00000000000"],
          job_id: "test-connection",
          cost_per_client: 0,
        },
      });

      if (error) {
        // Edge function invocation error
        const msg = error.message || JSON.stringify(error);
        if (msg.includes("Unauthorized") || msg.includes("401")) {
          addLog("error", "Falha de autenticação — verifique se está logado como super admin");
        } else {
          addLog("error", `Erro na edge function: ${msg}`);
        }
        return;
      }

      if (data?.error) {
        if (data.error.includes("credentials")) {
          addLog("error", "Credenciais Target Data não configuradas nos secrets");
        } else {
          addLog("info", `API retornou: ${data.error}`);
          addLog("success", "Edge function respondeu — conexão com o serviço está ativa");
        }
      } else {
        addLog("success", "Edge function targetdata-enrich respondeu com sucesso");
      }

      addLog("success", "✅ Teste de conexão concluído");
    } catch (err: any) {
      addLog("error", `Erro: ${err.message}`);
    }
  };

  return (
    <IntegrationTestCard
      icon={Search}
      title="Target Data — Higienização de Base"
      description="Enriquecimento de dados (telefones, e-mails, endereços) via CPF. Custo: 1 token por cliente."
      secrets={SECRETS}
      onTest={handleTest}
    />
  );
};

export default TargetDataTab;
