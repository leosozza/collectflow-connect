import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Shield,
  Bell,
  Database,
  Globe,
  CreditCard,
  Search,
  Handshake,
  Cloud,
  Phone,
  MessageSquare,
  Scale,
  Plug,
  Cog,
} from "lucide-react";
import GoLiveChecklist from "@/components/admin/GoLiveChecklist";
import TargetDataTab from "@/components/admin/integrations/TargetDataTab";
import NegociarieTab from "@/components/admin/integrations/NegociarieTab";
import CobCloudTab from "@/components/admin/integrations/CobCloudTab";
import ThreeCPlusTab from "@/components/admin/integrations/ThreeCPlusTab";
import WhatsAppAdminTab from "@/components/admin/integrations/WhatsAppAdminTab";
import NegativacaoTab from "@/components/admin/integrations/NegativacaoTab";
import AsaasPlatformTab from "@/components/admin/integrations/AsaasPlatformTab";

const configSections = [
  {
    icon: Shield,
    title: "Segurança",
    description: "Configurações de segurança e autenticação",
    items: [
      { label: "Autenticação de dois fatores (2FA)", enabled: false },
      { label: "Timeout automático de sessão", enabled: true },
      { label: "Registro de IP e dispositivo", enabled: true },
    ],
  },
  {
    icon: Bell,
    title: "Notificações",
    description: "Alertas e notificações do sistema",
    items: [
      { label: "Alertas de novo inquilino", enabled: true },
      { label: "Alertas de inadimplência", enabled: true },
      { label: "Relatório semanal por e-mail", enabled: false },
    ],
  },
  {
    icon: Database,
    title: "Sistema",
    description: "Configurações gerais do sistema",
    items: [
      { label: "Modo de manutenção", enabled: false },
      { label: "Logs detalhados", enabled: true },
      { label: "Backup automático", enabled: true },
    ],
  },
  {
    icon: Globe,
    title: "Integrações Globais",
    description: "Integrações e APIs do sistema",
    items: [
      { label: "API pública habilitada", enabled: true },
      { label: "Webhooks globais", enabled: false },
    ],
  },
];

const AdminConfiguracoesPage = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Configurações do Sistema
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configurações globais, integrações e gateway de cobrança da plataforma
        </p>
      </div>

      <Tabs defaultValue="integracoes" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="integracoes" className="gap-1.5">
            <Plug className="w-4 h-4" /> Integrações
          </TabsTrigger>
          <TabsTrigger value="geral" className="gap-1.5">
            <Cog className="w-4 h-4" /> Geral
          </TabsTrigger>
        </TabsList>

        {/* === INTEGRAÇÕES === */}
        <TabsContent value="integracoes" className="mt-4">
          <Tabs defaultValue="asaas-plataforma" className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/30 p-1">
              <TabsTrigger value="asaas-plataforma" className="gap-1.5 text-xs">
                <CreditCard className="w-3.5 h-3.5" /> Asaas Plataforma
              </TabsTrigger>
              <TabsTrigger value="targetdata" className="gap-1.5 text-xs">
                <Search className="w-3.5 h-3.5" /> Target Data
              </TabsTrigger>
              <TabsTrigger value="negociarie" className="gap-1.5 text-xs">
                <Handshake className="w-3.5 h-3.5" /> Negociarie
              </TabsTrigger>
              <TabsTrigger value="cobcloud" className="gap-1.5 text-xs">
                <Cloud className="w-3.5 h-3.5" /> CobCloud
              </TabsTrigger>
              <TabsTrigger value="threecplus" className="gap-1.5 text-xs">
                <Phone className="w-3.5 h-3.5" /> 3CPlus
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-1.5 text-xs">
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
              </TabsTrigger>
              <TabsTrigger value="negativacao" className="gap-1.5 text-xs">
                <Scale className="w-3.5 h-3.5" /> Negativação
              </TabsTrigger>
            </TabsList>

            <TabsContent value="asaas-plataforma" className="mt-4">
              <AsaasPlatformTab />
            </TabsContent>
            <TabsContent value="targetdata" className="mt-4"><TargetDataTab /></TabsContent>
            <TabsContent value="negociarie" className="mt-4"><NegociarieTab /></TabsContent>
            <TabsContent value="cobcloud" className="mt-4"><CobCloudTab /></TabsContent>
            <TabsContent value="threecplus" className="mt-4"><ThreeCPlusTab /></TabsContent>
            <TabsContent value="whatsapp" className="mt-4"><WhatsAppAdminTab /></TabsContent>
            <TabsContent value="negativacao" className="mt-4"><NegativacaoTab /></TabsContent>
          </Tabs>
        </TabsContent>

        {/* === GERAL === */}
        <TabsContent value="geral" className="space-y-6 mt-4">
          <GoLiveChecklist />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {configSections.map((section) => (
              <Card key={section.title}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <section.icon className="w-4 h-4 text-primary" />
                    {section.title}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {section.items.map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{item.label}</span>
                      <Switch defaultChecked={item.enabled} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end">
            <Button>Salvar Configurações</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminConfiguracoesPage;
