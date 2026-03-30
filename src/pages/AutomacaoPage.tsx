import { useState } from "react";
import { useUrlState } from "@/hooks/useUrlState";
import { usePermissions } from "@/hooks/usePermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MessageHistory from "@/components/automacao/MessageHistory";
import { Link } from "react-router-dom";
import DispositionAutomationsTab from "@/components/automacao/DispositionAutomationsTab";
import WorkflowListTab from "@/components/automacao/workflow/WorkflowListTab";
import GatilhosTab from "@/components/automacao/GatilhosTab";
import WhatsAppTemplatesTab from "@/components/automacao/WhatsAppTemplatesTab";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Automação de Cobrança</h1>
        <p className="text-muted-foreground">Configure regras automáticas de notificação e acompanhe envios</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setNewFlowTriggerType(null); }}>
        <TabsList>
          <TabsTrigger value="fluxos">Fluxos</TabsTrigger>
          <TabsTrigger value="gatilhos">Gatilhos</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="pos-tabulacao">Pós-Tabulação</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="fluxos">
          <WorkflowListTab defaultTriggerType={newFlowTriggerType} />
        </TabsContent>

        <TabsContent value="gatilhos">
          <GatilhosTab onNavigateToNewFlow={handleNavigateToNewFlow} />
        </TabsContent>

        <TabsContent value="templates">
          <WhatsAppTemplatesTab />
        </TabsContent>

        <TabsContent value="pos-tabulacao">
          <DispositionAutomationsTab />
        </TabsContent>

        <TabsContent value="historico">
          <MessageHistory />
        </TabsContent>

        <TabsContent value="config">
          <div className="rounded-lg border bg-card p-6 text-center space-y-3">
            <p className="text-muted-foreground">As configurações de WhatsApp foram movidas para a página de Integrações.</p>
            <Link to="/integracao" className="text-primary hover:underline font-medium">
              Ir para Integrações →
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AutomacaoPage;
