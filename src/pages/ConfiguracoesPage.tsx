import { useEffect, useMemo } from "react";
import { Cloud, Settings, Code2, FileSpreadsheet, Activity, Server } from "lucide-react";
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";

const LEGACY_TAB_MAP: Record<string, string> = {
  integracao: "/configuracoes/integracao",
  auditoria: "/configuracoes/auditoria",
  api_docs: "/configuracoes/api",
  maxlist: "/configuracoes/maxlist",
  mcp: "/configuracoes/mcp",
};

const ConfiguracoesPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isTenantAdmin, tenant } = useTenant();
  const permissions = usePermissions();

  const isMaxList =
    ((tenant as any)?.settings as any)?.maxlist_enabled === true || tenant?.slug === "ybrasil";

  // Backward compatibility: /configuracoes?tab=api_docs → /configuracoes/api
  useEffect(() => {
    const legacyTab = searchParams.get("tab");
    if (legacyTab && LEGACY_TAB_MAP[legacyTab]) {
      navigate(LEGACY_TAB_MAP[legacyTab], { replace: true });
    }
  }, [searchParams, navigate]);

  const items = useMemo(
    () => [
      { key: "integracao", label: "Integração", icon: Cloud, to: "/configuracoes/integracao" },
      ...(permissions.canViewAuditoria
        ? [{ key: "auditoria", label: "Auditoria", icon: Activity, to: "/configuracoes/auditoria" }]
        : []),
      ...(isTenantAdmin
        ? [{ key: "api", label: "API REST", icon: Code2, to: "/configuracoes/api" }]
        : []),
      ...(isTenantAdmin
        ? [{ key: "mcp", label: "Servidor MCP", icon: Server, to: "/configuracoes/mcp" }]
        : []),
      ...(isMaxList
        ? [{ key: "maxlist", label: "MaxList", icon: FileSpreadsheet, to: "/configuracoes/maxlist" }]
        : []),
    ],
    [permissions.canViewAuditoria, isTenantAdmin, isMaxList]
  );

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">Configurações</h1>
      </div>

      <nav className="flex items-center gap-1 border-b border-border">
        {items.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.key === "integracao" && location.pathname === "/configuracoes");
          return (
            <Link
              key={item.key}
              to={item.to}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 -mb-px",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div>
        <Outlet />
      </div>
    </div>
  );
};

export default ConfiguracoesPage;
