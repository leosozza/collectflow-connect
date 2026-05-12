import { useState } from "react";
import { useUrlState } from "@/hooks/useUrlState";
import { usePermissions } from "@/hooks/usePermissions";
import MessageHistory from "@/components/automacao/MessageHistory";
import { Link } from "react-router-dom";
import DispositionAutomationsTab from "@/components/automacao/DispositionAutomationsTab";
import WorkflowListTab from "@/components/automacao/workflow/WorkflowListTab";
import GatilhosTab from "@/components/automacao/GatilhosTab";
import WhatsAppTemplatesTab from "@/components/automacao/WhatsAppTemplatesTab";
import { GitBranch, Zap, FileText, ListChecks, History, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "fluxos", label: "Fluxos", icon: GitBranch },
  { key: "gatilhos", label: "Gatilhos", icon: Zap },
  { key: "templates", label: "Templates", icon: FileText },
  { key: "pos-tabulacao", label: "Pós-Tabulação", icon: ListChecks },
  { key: "historico", label: "Histórico", icon: History },
  { key: "config", label: "Configurações", icon: Settings },
];

const AutomacaoPage = () => {
  const permissions = usePermissions();
  const [activeTab, setActiveTab] = useUrlState("tab", "fluxos");
  const [newFlowTriggerType, setNewFlowTriggerType] = useState<string | null>(null);

  if (!permissions.canViewAutomacao) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const handleNavigateToNewFlow = (triggerType: string) => {
    setNewFlowTriggerType(triggerType);
    setActiveTab("fluxos");
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setNewFlowTriggerType(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Automação de Cobrança</h1>
        <p className="text-muted-foreground">Configure regras automáticas de notificação e acompanhe envios</p>
      </div>

      <nav className="flex flex-wrap items-center gap-1 border-b border-border pb-px w-full">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all relative rounded-t-lg",
                isActive
                  ? "bg-primary/10 text-primary border-b-[3px] border-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-b-[3px] border-transparent"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4">
        {activeTab === "fluxos" && <WorkflowListTab defaultTriggerType={newFlowTriggerType} />}
        {activeTab === "gatilhos" && <GatilhosTab onNavigateToNewFlow={handleNavigateToNewFlow} />}
        {activeTab === "templates" && <WhatsAppTemplatesTab />}
        {activeTab === "pos-tabulacao" && <DispositionAutomationsTab />}
        {activeTab === "historico" && <MessageHistory />}
        {activeTab === "config" && (
          <div className="rounded-lg border bg-card p-6 text-center space-y-3">
            <p className="text-muted-foreground">As configurações de WhatsApp foram movidas para a página de Integrações.</p>
            <Link to="/integracao" className="text-primary hover:underline font-medium">
              Ir para Integrações →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomacaoPage;
