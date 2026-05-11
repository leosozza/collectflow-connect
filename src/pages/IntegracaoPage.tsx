import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import CobCloudTab from "@/components/integracao/CobCloudTab";
import NegociarieTab from "@/components/integracao/NegociarieTab";
import ThreeCPlusTab from "@/components/integracao/ThreeCPlusTab";
import WhatsAppIntegrationTab from "@/components/integracao/WhatsAppIntegrationTab";
import ProtestoTab from "@/components/integracao/ProtestoTab";
import { Phone, MessageCircle, ShieldAlert, Cloud, Handshake, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const INTEGRATION_SEGMENTS = [
  {
    title: "Financeiro",
    items: [
      { id: "negociarie", name: "Negociarie", icon: Handshake, color: "bg-blue-600" },
    ]
  },
  {
    title: "Discador",
    items: [
      { id: "3cplus", name: "3CPlus", icon: Phone, color: "bg-orange-500" }
    ]
  },
  {
    title: "WhatsApp",
    items: [
      { id: "whatsapp", name: "WhatsApp", icon: MessageCircle, color: "bg-emerald-500" }
    ]
  },
  {
    title: "Negativação",
    items: [
      { id: "negativacao", name: "Negativação", icon: ShieldAlert, color: "bg-red-500" }
    ]
  },
  {
    title: "CRMs",
    items: [
      { id: "cobcloud", name: "CobCloud", icon: Cloud, color: "bg-purple-600" }
    ]
  }
];

const IntegracaoPage = () => {
  const { isTenantAdmin, tenant } = useTenant();
  const [activeIntegration, setActiveIntegration] = useState<string | null>(null);

  if (!isTenantAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  // Check if configured for visual badges
  const settings = (tenant?.settings as any) || {};
  
  const checkConfigured = (id: string) => {
    switch(id) {
      case "negociarie":
        return false; // Negociarie uses Vault mostly, or callback needs checking. Leave as not configured unless we have a specific setting.
      case "3cplus":
        return !!(settings.threecplus_domain && settings.threecplus_api_token);
      case "cobcloud":
        return !!(settings.cobcloud_token_company && settings.cobcloud_token_client);
      case "whatsapp":
        return !!(settings.gupshup_api_key && settings.gupshup_app_name);
      default:
        return false;
    }
  }

  const renderActiveIntegration = () => {
    switch (activeIntegration) {
      case "negociarie": return <NegociarieTab />;
      case "3cplus": return <ThreeCPlusTab />;
      case "whatsapp": return <WhatsAppIntegrationTab />;
      case "negativacao": return <ProtestoTab />;
      case "cobcloud": return <CobCloudTab />;
      default: return null;
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Integrações</h1>
        <p className="text-muted-foreground">Gerencie conexões com serviços externos para sua operação.</p>
      </div>

      {activeIntegration ? (
        <div className="space-y-6 animate-fade-in">
          <Button variant="ghost" className="gap-2 -ml-4 hover:bg-transparent hover:text-primary" onClick={() => setActiveIntegration(null)}>
            <ArrowLeft className="w-4 h-4" />
            Voltar para Integrações
          </Button>
          {renderActiveIntegration()}
        </div>
      ) : (
        <div className="space-y-8 animate-fade-in pt-4">
          {INTEGRATION_SEGMENTS.map((segment) => (
            <div key={segment.title} className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {segment.title}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {segment.items.map((item) => {
                  const isConfigured = checkConfigured(item.id);
                  return (
                    <Card 
                      key={item.id} 
                      className="cursor-pointer hover:scale-[1.02] hover:border-primary/50 hover:shadow-md transition-all duration-200 bg-card/40 backdrop-blur-sm border-border/50 group"
                      onClick={() => setActiveIntegration(item.id)}
                    >
                      <CardContent className="p-5 flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm ${item.color}`}>
                          <item.icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{item.name}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            {isConfigured ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-[11px] text-emerald-500 font-medium uppercase tracking-wider">Conectado</span>
                              </>
                            ) : (
                              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Não configurado</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IntegracaoPage;
