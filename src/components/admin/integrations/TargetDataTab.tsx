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
        body: { test_mode: true },
      });

      if (error) {
        const msg = error.message || JSON.stringify(error);
        if (msg.includes("Unauthorized") || msg.includes("401")) {
          addLog("error", "Falha de autenticação — verifique se está logado como super admin");
        } else {
          addLog("error", `Erro na edge function: ${msg}`);
        }
        return;
      }

      if (data?.error === "ip_not_authorized") {
        addLog("error", "❌ IP não autorizado na API Target Data");
        addLog("info", "Os Edge Functions usam IPs dinâmicos que mudam a cada execução.");
        addLog("info", "Solicite à Target Data: desabilitar restrição de IP para sua API key, ou liberar o range de IPs do Supabase.");
        return;
      }

      if (data?.error === "connection_error") {
        addLog("error", `Erro de conexão: ${data.message}`);
        return;
      }

      if (data?.error === "api_error") {
        addLog("error", `API retornou erro: ${data.message}`);
        return;
      }

      if (data?.success) {
        addLog("success", data.message || "Conexão estabelecida com sucesso");
        addLog("success", "✅ Teste de conexão concluído");
      } else if (data?.error) {
        addLog("error", data.message || data.error);
      } else {
        addLog("success", "Edge function respondeu com sucesso");
        addLog("success", "✅ Teste de conexão concluído");
      }
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
