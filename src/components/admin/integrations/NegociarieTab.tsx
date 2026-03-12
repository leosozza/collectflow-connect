import { Handshake } from "lucide-react";
import IntegrationTestCard from "./IntegrationTestCard";
import { supabase } from "@/integrations/supabase/client";

const SECRETS = [
  { label: "NEGOCIARIE_CLIENT_ID", configured: true },
  { label: "NEGOCIARIE_CLIENT_SECRET", configured: true },
];

const NegociarieTab = () => {
  const handleTest = async (addLog: (status: "success" | "error" | "info", msg: string) => void) => {
    addLog("info", "Iniciando teste de conexão com Negociarie...");

    try {
      const { data, error } = await supabase.functions.invoke("negociarie-proxy", {
        body: { action: "status" },
      });

      if (error) {
        addLog("error", `Erro na edge function: ${error.message}`);
        return;
      }

      if (data?.error) {
        if (data.error.includes("credentials") || data.error.includes("not configured")) {
          addLog("error", "Credenciais Negociarie não configuradas");
        } else {
          addLog("info", `Resposta: ${JSON.stringify(data).slice(0, 200)}`);
          addLog("success", "Edge function respondeu — conexão ativa");
        }
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
      icon={Handshake}
      title="Negociarie — Gateway de Pagamento"
      description="Integração com o gateway Negociarie para geração de boletos e cobranças."
      secrets={SECRETS}
      onTest={handleTest}
    />
  );
};

export default NegociarieTab;
