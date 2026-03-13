import { useState } from "react";
import { useNavigate, useLocation, Link, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import rivoLogo from "@/assets/rivo_connect.png";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Headphones,
  Users,
  DollarSign,
  Building2,
  GraduationCap,
  Settings,
  BarChart3,
  Map,
  Package,
  ChevronDown,
  Zap,
  Briefcase,
  ShieldCheck,
  Cog,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Navigate } from "react-router-dom";

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

interface NavGroup {
  groupLabel: string;
  groupIcon: LucideIcon;
  items: NavItem[];
}

const dashboardItem: NavItem = {
  label: "Dashboard",
  icon: LayoutDashboard,
  path: "/admin",
};

const navGroups: NavGroup[] = [
  {
    groupLabel: "Operação",
    groupIcon: Briefcase,
    items: [
      { label: "Suporte", icon: Headphones, path: "/admin/suporte" },
      { label: "Gestão de Equipes", icon: Users, path: "/admin/equipes" },
      { label: "Treinamentos e Reuniões", icon: GraduationCap, path: "/admin/treinamentos" },
    ],
  },
  {
    groupLabel: "Automação e Serviços",
    groupIcon: Zap,
    items: [
      { label: "Serviços e Tokens", icon: Package, path: "/admin/servicos" },
      { label: "Relatórios e Análises", icon: BarChart3, path: "/admin/relatorios" },
      { label: "Integrações", icon: Settings, path: "/admin/configuracoes" },
    ],
  },
  {
    groupLabel: "Gestão de Clientes",
    groupIcon: Building2,
    items: [
      { label: "Gestão de Inquilinos", icon: Building2, path: "/admin/tenants" },
    ],
  },
  {
    groupLabel: "Administração",
    groupIcon: ShieldCheck,
    items: [
      { label: "Gestão Financeira", icon: DollarSign, path: "/admin/financeiro" },
    ],
  },
  {
    groupLabel: "Configurações",
    groupIcon: Cog,
    items: [
      { label: "Roadmap", icon: Map, path: "/admin/roadmap" },
    ],
  },
];

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard de Gestão",
  "/admin/suporte": "Suporte",
  "/admin/equipes": "Gestão de Equipes",
  "/admin/financeiro": "Gestão Financeira",
  "/admin/tenants": "Gestão de Inquilinos",
  "/admin/treinamentos": "Treinamentos e Reuniões",
  "/admin/configuracoes": "Integrações",
  "/admin/relatorios": "Relatórios e Análises",
  "/admin/servicos": "Serviços e Tokens",
  "/admin/roadmap": "Roadmap",
};

const SuperAdminLayout = () => {
  const { profile, signOut } = useAuth();
  const { isSuperAdmin, loading } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const renderNavLink = (item: NavItem) => {
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
  };

  const renderGroup = (group: NavGroup, index: number) => {
    const groupHasActive = group.items.some((item) => location.pathname === item.path);

    if (collapsed) {
      return (
        <div key={group.groupLabel} className={index > 0 ? "pt-2 mt-2 border-t border-sidebar-border/30" : ""}>
          {group.items.map(renderNavLink)}
        </div>
      );
    }

    return (
      <Collapsible key={group.groupLabel} defaultOpen={true}>
        <div className={index > 0 ? "pt-3 mt-3 border-t border-sidebar-border/30" : ""}>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-1.5 group cursor-pointer">
            <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold">
              {group.groupLabel}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/40 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 ml-1 space-y-0.5">
            {group.items.map(renderNavLink)}
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          ${collapsed ? "w-16" : "w-64"} gradient-dark flex flex-col
          transform transition-all duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center ${collapsed ? "justify-center px-2" : "justify-start px-4"} py-5 border-b border-sidebar-border`}>
          {collapsed ? (
            <img src={rivoLogo} alt="RIVO" className="h-7 w-auto object-contain" />
          ) : (
            <div className="flex flex-col items-start gap-1">
              <img src={rivoLogo} alt="RIVO CONNECT" className="h-24 w-auto object-contain" />
              <p className="text-[10px] text-primary font-medium uppercase tracking-widest px-1">Super Admin</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1 scrollbar-thin">
          {/* Dashboard - always visible at top */}
          {renderNavLink(dashboardItem)}

          {/* Collapsible groups */}
          {navGroups.map((group, index) => renderGroup(group, index))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-4 border-t border-sidebar-border">
          {!collapsed && (
            <div className="px-4 py-2 mb-2">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || "Super Admin"}</p>
              <p className="text-xs text-primary/80">Super Administrador</p>
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
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
            <h1 className="text-lg font-semibold text-foreground">
              {pageTitles[location.pathname] || "Super Admin"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/admin/perfil")}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src={(profile as any)?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {(profile?.full_name || "SA").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-foreground leading-tight truncate max-w-[120px]">{profile?.full_name || "Super Admin"}</p>
                <p className="text-[10px] text-primary font-medium">Super Admin</p>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;
