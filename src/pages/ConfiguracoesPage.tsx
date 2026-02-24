import { useState, useEffect } from "react";
import { Cloud, Map, Settings, Code2, FileSpreadsheet, Activity } from "lucide-react";
import IntegracaoPage from "@/pages/IntegracaoPage";
import RoadmapPage from "@/pages/RoadmapPage";
import ApiDocsPage from "@/pages/ApiDocsPage";
import MaxListPage from "@/pages/MaxListPage";
import AuditoriaPage from "@/pages/AuditoriaPage";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { useSearchParams } from "react-router-dom";


const ConfiguracoesPage = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "integracao";
  const [active, setActive] = useState(defaultTab);
  const { isTenantAdmin, isSuperAdmin, tenant } = useTenant();
  const permissions = usePermissions();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActive(tab);
  }, [searchParams]);

  const isMaxList = tenant?.id === "39a450f8-7a40-46e5-8bc7-708da5043ec7";

  const items = [
    { key: "integracao", label: "Integração", icon: Cloud },
    ...(permissions.canViewAuditoria ? [{ key: "auditoria", label: "Auditoria", icon: Activity }] : []),
    ...(isTenantAdmin ? [{ key: "roadmap", label: "Roadmap", icon: Map }] : []),
    ...(isTenantAdmin ? [{ key: "api_docs", label: "API REST", icon: Code2 }] : []),
    ...(isMaxList ? [{ key: "maxlist", label: "MaxList", icon: FileSpreadsheet }] : []),
  ];

  const activeLabel = items.find((i) => i.key === active)?.label;

  return (
    <div className="animate-fade-in space-y-4">
      {/* Cabeçalho + menu superior */}
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">Configurações</h1>
      </div>

      <nav className="flex items-center gap-1 border-b border-border">
        {items.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 -mb-px",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Conteúdo */}
      <div>
        {active === "integracao" && <IntegracaoPage />}
        {active === "auditoria" && <AuditoriaPage />}
        {active === "roadmap" && <RoadmapPage />}
        {active === "api_docs" && <ApiDocsPage />}
        {active === "maxlist" && <MaxListPage />}
      </div>
    </div>
  );
};

export default ConfiguracoesPage;
