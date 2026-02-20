import { useState, useEffect } from "react";
import { Cloud, Map, Settings, Code2, FileSpreadsheet } from "lucide-react";
import IntegracaoPage from "@/pages/IntegracaoPage";
import RoadmapPage from "@/pages/RoadmapPage";
import ApiDocsPage from "@/pages/ApiDocsPage";
import MaxListPage from "@/pages/MaxListPage";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/useTenant";
import { useSearchParams } from "react-router-dom";


const ConfiguracoesPage = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "integracao";
  const [active, setActive] = useState(defaultTab);
  const { isTenantAdmin, isSuperAdmin, tenant } = useTenant();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActive(tab);
  }, [searchParams]);

  const isMaxList = tenant?.slug === "maxfama" || tenant?.slug === "temis";

  const items = [
    { key: "integracao", label: "Integração", icon: Cloud },
    ...(isTenantAdmin ? [{ key: "roadmap", label: "Roadmap", icon: Map }] : []),
    ...(isTenantAdmin ? [{ key: "api_docs", label: "API REST", icon: Code2 }] : []),
    ...(isMaxList ? [{ key: "maxlist", label: "MaxList", icon: FileSpreadsheet }] : []),
  ];

  const activeLabel = items.find((i) => i.key === active)?.label;

  return (
    <div className="flex gap-6 animate-fade-in">
      {/* Sub-navegação lateral */}
      <div className="w-56 flex-shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Configurações</h1>
        </div>

        <nav className="space-y-0.5">
          {items.map((item) => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary border-l-[3px] border-primary pl-[calc(0.75rem-3px)]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-[3px] border-transparent pl-[calc(0.75rem-3px)]"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground">{activeLabel}</h2>
        </div>
        {active === "integracao" && <IntegracaoPage />}
        {active === "roadmap" && <RoadmapPage />}
        {active === "api_docs" && <ApiDocsPage />}
        {active === "maxlist" && <MaxListPage />}
      </div>
    </div>
  );
};

export default ConfiguracoesPage;
