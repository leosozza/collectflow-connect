import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate, useLocation, Link, Outlet } from "react-router-dom";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import { useModules } from "@/hooks/useModules";
import rivoLogo from "@/assets/rivo_connect.png";
import { 
  LayoutDashboard, 
  LogOut, 
  Menu, 
  Wallet,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ChevronDown,
  Headphones,
  Phone,
  MessageCircle,
  Trophy,
  BarChart3,
  Building2,
  BookUser,
  Zap,
  Handshake,
  FileBarChart,
  ShieldCheck,
} from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";
import AgreementCelebration from "@/components/notifications/AgreementCelebration";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import SupportFloatingButton from "@/components/support/SupportFloatingButton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const AppLayout = () => {
  const { profile, signOut } = useAuth();
  const { tenant, tenantUser, isTenantAdmin, isSuperAdmin } = useTenant();
  const permissions = usePermissions();
  const { isModuleEnabled } = useModules();
  const { celebrationNotification, dismissCelebration } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  useActivityTracker();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch { return false; }
  });

  const toggleCollapsed = (val: boolean) => {
    setCollapsed(val);
    try { localStorage.setItem("sidebar-collapsed", String(val)); } catch {}
  };

  const ROLE_LABEL: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    gerente: "Gerente",
    supervisor: "Supervisor",
    operador: "Operador",
  };

  const preContactItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    ...(permissions.canViewGamificacao && isModuleEnabled("gamificacao") ? [{ label: "Gamificação", icon: Trophy, path: "/gamificacao" }] : []),
    ...(permissions.canViewCarteira ? [{ label: "Carteira", icon: Wallet, path: "/carteira" }] : []),
    ...(permissions.canViewAcordos ? [{ label: "Acordos", icon: Handshake, path: "/acordos" }] : []),
    ...(permissions.canViewRelatorios ? [{ label: "Relatórios", icon: FileBarChart, path: "/relatorios" }] : []),
    ...(permissions.canViewOwnAnalytics ? [{ label: "Analytics", icon: BarChart3, path: "/analytics" }] : []),
    ...(permissions.canViewAuditoria ? [{ label: "Auditoria", icon: ShieldCheck, path: "/auditoria" }] : []),
  ];

  const contactCenterEnabled = isModuleEnabled("contact_center");
  const contactCenterItems = [
    ...(permissions.canViewTelefonia && (contactCenterEnabled || isModuleEnabled("telefonia")) ? [{ label: "Telefonia", icon: Phone, path: "/contact-center/telefonia" }] : []),
    ...(permissions.canViewContactCenter && (contactCenterEnabled || isModuleEnabled("whatsapp")) ? [{ label: "WhatsApp", icon: MessageCircle, path: "/contact-center/whatsapp" }] : []),
  ];

  const isContactCenterRoute = ["/contact-center/telefonia", "/contact-center/whatsapp"].some(p => location.pathname === p);
  const isFullBleedRoute = location.pathname === "/contact-center/whatsapp";
  const showContactCenter = contactCenterItems.length > 0;

  const [contactCenterOpen, setContactCenterOpen] = useState(isContactCenterRoute);

  useEffect(() => {
    if (isContactCenterRoute) setContactCenterOpen(true);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        ${collapsed ? "w-16" : "w-64"} gradient-dark flex flex-col
        transform transition-all duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className={`flex items-center ${collapsed ? "justify-center px-2" : "justify-start px-4"} py-5 border-b border-sidebar-border`}>
          {collapsed ? (
            <img src={rivoLogo} alt="RIVO" className="h-7 w-auto object-contain" />
          ) : (
            <img src={rivoLogo} alt="RIVO CONNECT" className="h-24 w-auto object-contain" />
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1 scrollbar-thin">
          {preContactItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.label : undefined}
                className={`
                  flex items-center ${collapsed ? "justify-center" : ""} gap-3 ${collapsed ? "px-2" : "px-4"} py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }
                `}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}

          {/* Automação — always visible if CRM active (absorbed module) */}
          {permissions.canViewAutomacao && (
            <Link
              to="/automacao"
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? "Automação" : undefined}
              className={`
                flex items-center ${collapsed ? "justify-center" : ""} gap-3 ${collapsed ? "px-2" : "px-4"} py-2.5 rounded-lg text-sm font-medium transition-colors
                ${location.pathname === "/automacao"
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }
              `}
            >
              <Zap className="w-5 h-5 flex-shrink-0" />
              {!collapsed && "Automação"}
            </Link>
          )}

          {/* Cadastros */}
          {permissions.canViewCadastros && (
            <Link
              to="/cadastros"
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? "Cadastros" : undefined}
              className={`
                flex items-center ${collapsed ? "justify-center" : ""} gap-3 ${collapsed ? "px-2" : "px-4"} py-2.5 rounded-lg text-sm font-medium transition-colors
                ${location.pathname === "/cadastros"
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }
              `}
            >
              <BookUser className="w-5 h-5 flex-shrink-0" />
              {!collapsed && "Cadastros"}
            </Link>
          )}

          {/* Contact Center */}
          {showContactCenter && contactCenterItems.length > 0 && (
            <Collapsible open={contactCenterOpen} onOpenChange={setContactCenterOpen}>
              <CollapsibleTrigger className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} w-full ${collapsed ? "px-2" : "px-4"} py-2.5 rounded-lg text-sm font-medium transition-colors ${isContactCenterRoute ? "text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                <div className="flex items-center gap-3">
                  <Headphones className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && "Contact Center"}
                </div>
                {!collapsed && <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${contactCenterOpen ? "rotate-180" : ""}`} />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 ml-4">
                {contactCenterItems.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      title={collapsed ? item.label : undefined}
                      className={`
                        flex items-center ${collapsed ? "justify-center" : ""} gap-3 ${collapsed ? "px-2" : "px-4"} py-2 rounded-lg text-sm font-medium transition-colors
                        ${active
                          ? "bg-primary text-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }
                      `}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && item.label}
                    </Link>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

        </nav>

        <div className="px-2 py-4 border-t border-sidebar-border">
          {!collapsed && (
            <div className="px-4 py-2 mb-2">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || "Usuário"}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{ROLE_LABEL[tenantUser?.role || "operador"] || tenantUser?.role || "Operador"}</p>
            </div>
          )}
          {permissions.canViewCentralEmpresa && (
            <Link
              to="/central-empresa"
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? "Central Empresa" : undefined}
              className={`flex items-center ${collapsed ? "justify-center" : ""} gap-3 ${collapsed ? "px-2" : "px-4"} py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 ${
                location.pathname === "/central-empresa"
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Building2 className="w-5 h-5 flex-shrink-0" />
              {!collapsed && "Central Empresa"}
            </Link>
          )}
          {permissions.canViewConfiguracoes && (
            <Link
              to="/configuracoes"
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? "Configurações" : undefined}
              className={`flex items-center ${collapsed ? "justify-center" : ""} gap-3 ${collapsed ? "px-2" : "px-4"} py-2.5 rounded-lg text-sm font-medium transition-colors mb-1 ${
                location.pathname === "/configuracoes"
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Settings className="w-5 h-5 flex-shrink-0" />
              {!collapsed && "Configurações"}
            </Link>
          )}
          <button
            onClick={handleSignOut}
            title={collapsed ? "Sair" : undefined}
            className={`flex items-center ${collapsed ? "justify-center" : ""} gap-3 ${collapsed ? "px-2" : "px-4"} py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors`}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && "Sair"}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 bg-card border-b border-border flex items-center justify-between px-3 lg:px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex h-8 w-8"
              onClick={() => toggleCollapsed(!collapsed)}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </Button>
            {(() => {
              const pageTitles: Record<string, string> = {
                "/dashboard": "Dashboard",
                "/carteira": "Carteira",
                "/contact-center/telefonia": "Telefonia",
                "/contact-center/whatsapp": "WhatsApp",
                "/acordos": "Acordos",
                "/relatorios": "Relatórios",
                "/analytics": "Analytics",
                "/auditoria": "Auditoria",
                "/configuracoes": "Configurações",
                "/central-empresa": "Central Empresa",
                "/signs": "Assinatura Digital",
                "/roadmap": "Roadmap do Produto",
                "/gamificacao": "Gamificação",
                "/api-docs": "API REST",
                "/admin/dashboard": "Dashboard Executivo",
                "/admin/tenants": "Super Admin",
                "/maxlist": "MaxList - Importação",
              };
              const title = pageTitles[location.pathname];
              return title ? (
                <h1 className="text-lg font-bold text-foreground">{title}</h1>
              ) : null;
            })()}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => navigate("/perfil")}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src={(profile as any)?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {(profile?.full_name || "U").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-foreground leading-tight truncate max-w-[120px]">{profile?.full_name || "Usuário"}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{ROLE_LABEL[isSuperAdmin ? "super_admin" : tenantUser?.role || "operador"] || "Operador"}</p>
              </div>
            </button>
          </div>
        </header>

        <main className={`flex-1 overflow-auto ${isFullBleedRoute ? "" : "p-4 lg:p-6"}`}>
          <Outlet />
        </main>
      </div>

      <AgreementCelebration
        notification={celebrationNotification}
        onDismiss={dismissCelebration}
      />

      <SupportFloatingButton />
    </div>
  );
};

export default AppLayout;
