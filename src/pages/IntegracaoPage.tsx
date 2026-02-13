import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CobCloudTab from "@/components/integracao/CobCloudTab";
import NegociarieTab from "@/components/integracao/NegociarieTab";
import ThreeCPlusTab from "@/components/integracao/ThreeCPlusTab";

const IntegracaoPage = () => {
  const { profile } = useAuth();

  if (profile?.role !== "admin") {
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
          <TabsTrigger value="threecplus">3CPlus</TabsTrigger>
        </TabsList>
        <TabsContent value="cobcloud">
          <CobCloudTab />
        </TabsContent>
        <TabsContent value="negociarie">
          <NegociarieTab />
        </TabsContent>
        <TabsContent value="threecplus">
          <ThreeCPlusTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegracaoPage;
