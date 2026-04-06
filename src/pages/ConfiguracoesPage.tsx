import { useState } from "react";
import { Cloud, Settings, Code2, FileSpreadsheet, Activity } from "lucide-react";
import { useUrlState } from "@/hooks/useUrlState";
import IntegracaoPage from "@/pages/IntegracaoPage";
import ApiDocsPage from "@/pages/ApiDocsPage";
import MaxListPage from "@/pages/MaxListPage";
import AuditoriaPage from "@/pages/AuditoriaPage";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";

const ConfiguracoesPage = () => {
  const [active, setActive] = useUrlState("tab", "integracao");
  const { isTenantAdmin, isSuperAdmin, tenant } = useTenant();
  const permissions = usePermissions();
  const [visited, setVisited] = useState<Set<string>>(() => new Set(["integracao", active]));

  const isMaxList = ((tenant as any)?.settings as any)?.maxlist_enabled === true || tenant?.slug === "ybrasil";

  const items = [
    { key: "integracao", label: "Integração", icon: Cloud },
    ...(permissions.canViewAuditoria ? [{ key: "auditoria", label: "Auditoria", icon: Activity }] : []),
    ...(isTenantAdmin ? [{ key: "api_docs", label: "API REST", icon: Code2 }] : []),
    ...(isMaxList ? [{ key: "maxlist", label: "MaxList", icon: FileSpreadsheet }] : []),
  ];

  const handleTabChange = (key: string) => {
    setVisited((prev) => new Set(prev).add(key));
    setActive(key);
  };

  return (
    <div className="animate-fade-in space-y-4">
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
              onClick={() => handleTabChange(item.key)}
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

      <div>
        <div style={{ display: active === "integracao" ? "block" : "none" }}>
          <IntegracaoPage />
        </div>
        {visited.has("auditoria") && (
          <div style={{ display: active === "auditoria" ? "block" : "none" }}>
            <AuditoriaPage />
          </div>
        )}
        {visited.has("api_docs") && (
          <div style={{ display: active === "api_docs" ? "block" : "none" }}>
            <ApiDocsPage />
          </div>
        )}
        {isMaxList && visited.has("maxlist") && (
          <div style={{ display: active === "maxlist" ? "block" : "none" }}>
            <MaxListPage />
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfiguracoesPage;
