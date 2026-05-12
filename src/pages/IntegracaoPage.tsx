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
import { ArrowLeft, CheckCircle2, Sparkles, Info, LayoutGrid } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  INTEGRATIONS,
  INTEGRATION_SEGMENTS,
  IntegrationStatus,
} from "@/components/integracao/integrationsCatalog";

const STATUS_LABEL: Record<IntegrationStatus, { text: string; cls: string; Icon: any }> = {
  connected: { text: "Conectado", cls: "text-emerald-500", Icon: CheckCircle2 },
  test: { text: "Em teste", cls: "text-amber-500", Icon: Info },
  not_configured: { text: "Não configurado", cls: "text-muted-foreground", Icon: Info },
  coming_soon: { text: "Em breve", cls: "text-primary", Icon: Sparkles },
};

const IntegracaoPage = () => {
  const { isTenantAdmin, tenant } = useTenant();
  const [activeIntegration, setActiveIntegration] = useState<string | null>(null);
  const [activeSegment, setActiveSegment] = useState<string>("__all__");
  const [vaultIntegrations, setVaultIntegrations] = useState<Record<string, boolean>>({});
  const [hasEvolution, setHasEvolution] = useState(false);
  const [hasGupshup, setHasGupshup] = useState(false);

  useEffect(() => {
    if (tenant?.id) {
      // Lê apenas metadados (RLS bloqueia SELECT direto na tabela)
      supabase.rpc("get_my_integrations_status").then(({ data }: any) => {
        if (Array.isArray(data)) {
          const vaultMap: Record<string, boolean> = {};
          data.forEach((row: any) => {
            if (row?.is_active && (row?.has_credentials || row?.uses_global_fallback)) {
              vaultMap[(row.provider || "").toLowerCase()] = true;
            }
          });
          setVaultIntegrations(vaultMap);
        }
      });

      supabase
        .from("whatsapp_instances")
        .select("id, provider")
        .eq("tenant_id", tenant.id)
        .in("provider", ["evolution", "gupshup"])
        .then(({ data }) => {
          if (data) {
            setHasEvolution(data.some((r: any) => r.provider === "evolution"));
            setHasGupshup(data.some((r: any) => r.provider === "gupshup"));
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

  const computeStatus = (id: string): IntegrationStatus => {
    const meta = INTEGRATIONS[id];
    if (!meta?.available) return "coming_soon";
    switch (id) {
      case "negociarie":
        return vaultIntegrations["negociarie"] ? "connected" : "not_configured";
      case "asaas":
        return vaultIntegrations["asaas"] ? "connected" : "not_configured";
      case "3cplus":
        return settings.threecplus_domain && settings.threecplus_api_token
          ? "connected"
          : "not_configured";
      case "cobcloud":
        return settings.cobcloud_token_company && settings.cobcloud_token_client
          ? "connected"
          : "not_configured";
      case "evolution":
        return hasEvolution ? "connected" : "not_configured";
      case "gupshup":
        return hasGupshup || (settings.gupshup_api_key && settings.gupshup_app_name)
          ? "connected"
          : "not_configured";
      default:
        return "not_configured";
    }
  };

  const renderActiveIntegration = () => {
    switch (activeIntegration) {
      case "negociarie":
        return <NegociarieTab />;
      case "asaas":
        return <AsaasTab />;
      case "3cplus":
        return <ThreeCPlusTab />;
      case "evolution":
        return <EvolutionTab />;
      case "gupshup":
        return <GupshupTab />;
      case "serasa":
        return <SerasaTab />;
      case "cenprot":
        return <CenprotTab />;
      case "targetdata":
        return <TargetDataTenantTab />;
      case "cobcloud":
        return <CobCloudTab />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Integrações</h1>
        <p className="text-muted-foreground">
          Gerencie conexões com serviços externos para sua operação.
        </p>
      </div>

      {activeIntegration ? (
        <div className="space-y-6 animate-fade-in">
          <Button
            variant="ghost"
            className="gap-2 -ml-4 hover:bg-transparent hover:text-primary"
            onClick={() => setActiveIntegration(null)}
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Integrações
          </Button>
          {renderActiveIntegration()}
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          <nav className="flex flex-wrap items-center gap-1 border-b border-border pb-px w-full">
            {[{ title: "__all__", label: "Todos" }, ...INTEGRATION_SEGMENTS.map(s => ({ title: s.title, label: s.title }))].map((seg) => {
              const isActive = activeSegment === seg.title;
              return (
                <button
                  key={seg.title}
                  onClick={() => setActiveSegment(seg.title)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative rounded-t-lg",
                    isActive
                      ? "bg-primary/10 text-primary border-b-[3px] border-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-b-[3px] border-transparent"
                  )}
                >
                  {seg.title === "__all__" && <LayoutGrid className="w-4 h-4 shrink-0" />}
                  <span>{seg.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="space-y-8 pt-2">
            {INTEGRATION_SEGMENTS
              .filter((segment) => activeSegment === "__all__" || activeSegment === segment.title)
              .map((segment) => (
              <div key={segment.title} className="space-y-4">
                {activeSegment === "__all__" && (
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {segment.title}
                  </h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {segment.ids.map((id) => {
                    const meta = INTEGRATIONS[id];
                    if (!meta) return null;
                    const status = computeStatus(id);
                    const sl = STATUS_LABEL[status];
                    return (
                      <Card
                        key={id}
                        className="cursor-pointer hover:scale-[1.02] hover:border-primary/50 hover:shadow-md transition-all duration-200 bg-card/40 backdrop-blur-sm border-border/50 group"
                        onClick={() => setActiveIntegration(id)}
                      >
                        <CardContent className="p-5 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm overflow-hidden bg-white border border-border/50 shrink-0">
                            <img
                              src={meta.logoUrl}
                              alt={`${meta.name} logo`}
                              className="w-full h-full object-contain p-1.5"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
                                if (sib) sib.style.display = "flex";
                              }}
                            />
                            <div
                              className={`w-full h-full ${meta.brandColor} text-white items-center justify-center`}
                              style={{ display: "none" }}
                            >
                              {meta.fallbackIcon}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                              {meta.name}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-1">
                              <sl.Icon className={`w-3.5 h-3.5 ${sl.cls}`} />
                              <span
                                className={`text-[11px] font-medium uppercase tracking-wider ${sl.cls}`}
                              >
                                {sl.text}
                              </span>
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
        </div>
      )}
    </div>
  );
};

export default IntegracaoPage;
