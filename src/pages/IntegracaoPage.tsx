import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import CobCloudTab from "@/components/integracao/CobCloudTab";
import NegociarieTab from "@/components/integracao/NegociarieTab";
import ThreeCPlusTab from "@/components/integracao/ThreeCPlusTab";
import AsaasTab from "@/components/integracao/AsaasTab";
import EvolutionTab from "@/components/integracao/EvolutionTab";
import GupshupTab from "@/components/integracao/GupshupTab";
import SerasaTab from "@/components/integracao/SerasaTab";
import CenprotTab from "@/components/integracao/CenprotTab";
import TargetDataTenantTab from "@/components/integracao/TargetDataTenantTab";
import { Phone, MessageCircle, ShieldAlert, Cloud, Handshake, ArrowLeft, CheckCircle2, CreditCard, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const INTEGRATION_SEGMENTS = [
  {
    title: "Financeiro",
    items: [
      { id: "negociarie", name: "Negociarie", icon: Handshake, color: "bg-blue-600" },
      { id: "asaas", name: "Asaas", icon: CreditCard, color: "bg-indigo-600" },
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
      { id: "evolution", name: "Evolution API", icon: MessageCircle, color: "bg-emerald-500" },
      { id: "gupshup", name: "Gupshup (Oficial)", icon: MessageCircle, color: "bg-green-600" }
    ]
  },
  {
    title: "Negativação",
    items: [
      { id: "serasa", name: "Serasa Experian", icon: ShieldAlert, color: "bg-pink-600" },
      { id: "cenprot", name: "Cenprot", icon: ShieldAlert, color: "bg-red-500" }
    ]
  },
  {
    title: "Enriquecimento de Dados",
    items: [
      { id: "targetdata", name: "Target Data", icon: Search, color: "bg-cyan-600" }
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
  const [vaultIntegrations, setVaultIntegrations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (tenant?.id) {
      // Busca integrações configuradas no cofre
      supabase
        .from("tenant_integrations")
        .select("provider, is_active")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .then(({ data }) => {
          if (data) {
            const vaultMap: Record<string, boolean> = {};
            data.forEach(row => {
              vaultMap[row.provider] = true;
            });
            setVaultIntegrations(vaultMap);
          }
        });
    }
  }, [tenant?.id]);

  if (!isTenantAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Acesso restrito a administradores</p>
      </div>
    );
  }

  const settings = (tenant?.settings as any) || {};
  
  const checkConfigured = (id: string) => {
    switch(id) {
      case "negociarie":
        return !!vaultIntegrations["negociarie"];
      case "asaas":
        return !!vaultIntegrations["asaas"];
      case "3cplus":
        return !!(settings.threecplus_domain && settings.threecplus_api_token);
      case "cobcloud":
        return !!(settings.cobcloud_token_company && settings.cobcloud_token_client);
      case "gupshup":
        return !!(settings.gupshup_api_key && settings.gupshup_app_name);
      case "evolution":
        // Fallback checks or vault checks can be placed here
        return false;
      default:
        return false;
    }
  }

  const renderActiveIntegration = () => {
    switch (activeIntegration) {
      case "negociarie": return <NegociarieTab />;
      case "asaas": return <AsaasTab />;
      case "3cplus": return <ThreeCPlusTab />;
      case "evolution": return <EvolutionTab />;
      case "gupshup": return <GupshupTab />;
      case "serasa": return <SerasaTab />;
      case "cenprot": return <CenprotTab />;
      case "targetdata": return <TargetDataTenantTab />;
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
