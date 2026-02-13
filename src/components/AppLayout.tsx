import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { 
  LayoutDashboard, 
  Users, 
  LogOut, 
  Menu, 
  X, 
  Zap,
  Settings,
  UserCog,
  Wallet,
  Cloud,
  ClipboardPlus,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart3,
  Handshake,
  DollarSign,
  FileText,
  ChevronDown,
  Shield,
  Headphones,
  Phone,
  MessageCircle
} from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";
import AgreementCelebration from "@/components/notifications/AgreementCelebration";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { profile, signOut } = useAuth();
  const { tenant, tenantUser, isTenantAdmin, isSuperAdmin } = useTenant();
  const { celebrationNotification, dismissCelebration } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  useActivityTracker();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = isTenantAdmin;

  const preContactItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/" },
    { label: "Carteira", icon: Wallet, path: "/carteira" },
    ...(!isAdmin ? [{ label: "Log de Importações", icon: ClipboardPlus, path: "/cadastro" }] : []),
  ];

  const postContactItems = isAdmin ? [
    { label: "Acordos", icon: Handshake, path: "/acordos" },
    { label: "Financeiro", icon: DollarSign, path: "/financeiro" },
    { label: "Relatórios", icon: BarChart3, path: "/relatorios" },
    { label: "Integração", icon: Cloud, path: "/integracao" },
  ] : [];

  const contactCenterItems = isAdmin ? [
    { label: "Telefonia", icon: Phone, path: "/contact-center/telefonia" },
    { label: "WhatsApp", icon: MessageCircle, path: "/contact-center/whatsapp" },
  ] : [];

  const advancedNavItems = isAdmin ? [
    { label: "Configurações", icon: Settings, path: "/configuracoes" },
    { label: "Automação", icon: Bot, path: "/automacao" },
    { label: "Usuários", icon: UserCog, path: "/usuarios" },
    { label: "Log de Importações", icon: ClipboardPlus, path: "/cadastro" },
    { label: "Empresa", icon: Users, path: "/tenant/configuracoes" },
    { label: "Auditoria", icon: FileText, path: "/auditoria" },
  ] : [];

  const superAdminNavItems = isSuperAdmin ? [
    { label: "Tenants", icon: Users, path: "/admin/tenants" },
  ] : [];

  const isAdvancedRoute = advancedNavItems.some(item => location.pathname === item.path);
  const isSuperAdminRoute = superAdminNavItems.some(item => location.pathname === item.path);
  const isContactCenterRoute = contactCenterItems.some(item => location.pathname === item.path);

  const [advancedOpen, setAdvancedOpen] = useState(isAdvancedRoute);
  const [superAdminOpen, setSuperAdminOpen] = useState(isSuperAdminRoute);
  const [contactCenterOpen, setContactCenterOpen] = useState(isContactCenterRoute);

  useEffect(() => {
    if (isAdvancedRoute) setAdvancedOpen(true);
    if (isSuperAdminRoute) setSuperAdminOpen(true);
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
        <div className={`flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-6"} py-5 border-b border-sidebar-border`}>
          <div className="w-8 h-8 rounded-lg gradient-orange flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && <span className="text-lg font-bold text-sidebar-foreground">{tenant?.name || "Connect Control"}</span>}
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

          {contactCenterItems.length > 0 && (
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

          {postContactItems.map((item) => {
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

          {advancedNavItems.length > 0 && (
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              {!collapsed && (
                <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 mt-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors">
                  Avançado
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
              )}
              <CollapsibleContent className="space-y-1">
                {advancedNavItems.map((item) => {
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
              </CollapsibleContent>
            </Collapsible>
          )}

          {superAdminNavItems.length > 0 && (
            <Collapsible open={superAdminOpen} onOpenChange={setSuperAdminOpen}>
              {!collapsed && (
                <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 mt-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors">
                  Super Admin
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${superAdminOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
              )}
              <CollapsibleContent className="space-y-1">
                {superAdminNavItems.map((item) => {
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
              </CollapsibleContent>
            </Collapsible>
          )}
        </nav>

        <div className="px-2 py-4 border-t border-sidebar-border">
          {!collapsed && (
            <div className="px-4 py-2 mb-2">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || "Usuário"}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{tenantUser?.role || "operador"}</p>
            </div>
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
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <span className="text-sm text-muted-foreground">
              {isSuperAdmin ? "Super Admin" : isTenantAdmin ? "Administrador" : "Operador"}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      <AgreementCelebration
        notification={celebrationNotification}
        onDismiss={dismissCelebration}
      />
    </div>
  );
};

export default AppLayout;
