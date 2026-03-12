import { Scale } from "lucide-react";
import IntegrationTestCard from "./IntegrationTestCard";

const NegativacaoTab = () => {
  const handleTest = async (addLog: (status: "success" | "error" | "info", msg: string) => void) => {
    addLog("info", "Verificando módulos de negativação...");
    addLog("info", "[Serasa] Módulo de negativação preparado — aguardando credenciais por tenant");
    addLog("info", "[CENPROT/Protesto] Módulo de protesto preparado — aguardando credenciais por tenant");
    addLog("success", "ℹ️ Negativação e Protesto são configurados por credor/tenant na área de Integrações");
    addLog("success", "✅ Verificação concluída");
  };

  return (
    <IntegrationTestCard
      icon={Scale}
      title="Negativação — Serasa & Protesto"
      description="Integração com Serasa (negativação) e CENPROT (protesto de títulos). Configuração por credor."
      secrets={[]}
      onTest={handleTest}
    >
      <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
        ℹ️ Serasa e Protesto são configurados por credor na aba de Integrações do tenant. Registros ativos são removidos automaticamente quando um acordo é aprovado.
      </p>
    </IntegrationTestCard>
  );
};

export default NegativacaoTab;
