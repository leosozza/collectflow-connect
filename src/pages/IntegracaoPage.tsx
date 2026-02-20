import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CobCloudTab from "@/components/integracao/CobCloudTab";
import NegociarieTab from "@/components/integracao/NegociarieTab";
import ThreeCPlusTab from "@/components/integracao/ThreeCPlusTab";
import WhatsAppIntegrationTab from "@/components/integracao/WhatsAppIntegrationTab";
import ProtestoTab from "@/components/integracao/ProtestoTab";
import { Phone, MessageCircle, ShieldAlert } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";

const IntegracaoPage = () => {
  const { isTenantAdmin } = useTenant();

  if (!isTenantAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrações</h1>
        <p className="text-muted-foreground">Gerencie conexões com serviços externos</p>
      </div>

      <Tabs defaultValue="negociarie">
        <TabsList>
          <TabsTrigger value="cobcloud">CobCloud</TabsTrigger>
          <TabsTrigger value="negociarie">Negociarie</TabsTrigger>
          <TabsTrigger value="telefonia" className="gap-2">
            <Phone className="w-4 h-4" />
            Telefonia
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="negativacao" className="gap-2">
            <ShieldAlert className="w-4 h-4" />
            Negativação
          </TabsTrigger>
        </TabsList>
        <TabsContent value="cobcloud">
          <CobCloudTab />
        </TabsContent>
        <TabsContent value="negociarie">
          <NegociarieTab />
        </TabsContent>
        <TabsContent value="telefonia">
          <ThreeCPlusTab />
        </TabsContent>
        <TabsContent value="whatsapp">
          <WhatsAppIntegrationTab />
        </TabsContent>
        <TabsContent value="negativacao">
          <ProtestoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegracaoPage;
