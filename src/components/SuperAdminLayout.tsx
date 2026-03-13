import { useState, useMemo } from "react";
import { useNavigate, useLocation, Link, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useSAPermissions } from "@/hooks/useSAPermissions";
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
  Map,
  Package,
  ChevronDown,
  Zap,
  Briefcase,
  ShieldCheck,
  Cog,
  Shield,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  moduleSlug?: string;
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
  moduleSlug: "dashboard",
};

const navGroups: NavGroup[] = [
  {
    groupLabel: "Operação",
    groupIcon: Briefcase,
    items: [
      { label: "Suporte", icon: Headphones, path: "/admin/suporte", moduleSlug: "suporte" },
      { label: "Gestão de Equipes", icon: Users, path: "/admin/equipes", moduleSlug: "gestao_equipes" },
      { label: "Treinamentos e Reuniões", icon: GraduationCap, path: "/admin/treinamentos", moduleSlug: "treinamentos_reunioes" },
    ],
  },
  {
    groupLabel: "Automação e Serviços",
    groupIcon: Zap,
    items: [
      { label: "Serviços e Tokens", icon: Package, path: "/admin/servicos", moduleSlug: "servicos_tokens" },
      { label: "Integrações", icon: Settings, path: "/admin/configuracoes", moduleSlug: "integracoes" },
    ],
  },
  {
    groupLabel: "Gestão de Clientes",
    groupIcon: Building2,
    items: [
      { label: "Gestão de Clientes", icon: Building2, path: "/admin/tenants", moduleSlug: "gestao_inquilinos" },
    ],
  },
  {
    groupLabel: "Administração",
    groupIcon: ShieldCheck,
    items: [
      { label: "Gestão Financeira", icon: DollarSign, path: "/admin/financeiro", moduleSlug: "gestao_financeira" },
    ],
  },
  {
    groupLabel: "Configurações",
    groupIcon: Cog,
    items: [
      { label: "Permissões e Módulos", icon: Shield, path: "/admin/permissoes", moduleSlug: "permissoes_modulos" },
      { label: "Roadmap", icon: Map, path: "/admin/roadmap", moduleSlug: "roadmap" },
      { label: "Gestão de Usuários", icon: UserPlus, path: "/admin/usuarios", moduleSlug: "gestao_usuarios" },
    ],
  },
];

const ROUTE_MODULE_MAP: Record<string, string> = {
  "/admin": "dashboard",
  "/admin/suporte": "suporte",
  "/admin/equipes": "gestao_equipes",
  "/admin/treinamentos": "treinamentos_reunioes",
  "/admin/servicos": "servicos_tokens",
  "/admin/permissoes": "permissoes_modulos",
  "/admin/configuracoes": "integracoes",
  "/admin/tenants": "gestao_inquilinos",
  "/admin/financeiro": "gestao_financeira",
  "/admin/roadmap": "roadmap",
  "/admin/usuarios": "gestao_usuarios",
};

const pageTitles: Record<string, string> = {
  "/admin": "Dashboard de Gestão",
  "/admin/suporte": "Suporte",
  "/admin/equipes": "Gestão de Equipes",
  "/admin/financeiro": "Gestão Financeira",
  "/admin/tenants": "Gestão de Clientes",
  "/admin/treinamentos": "Treinamentos e Reuniões",
  "/admin/configuracoes": "Integrações",
  "/admin/servicos": "Serviços e Tokens",
  "/admin/roadmap": "Roadmap",
  "/admin/permissoes": "Permissões e Módulos",
  "/admin/usuarios": "Gestão de Usuários",
  "/admin/perfil": "Meu Perfil",
};

const SuperAdminLayout = () => {
  const { profile, signOut } = useAuth();
  const { isSuperAdmin, loading } = useTenant();
  const { hasView, isOwner, loading: permLoading } = useSAPermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Filter nav items based on permissions
  const filteredGroups = useMemo(() => {
    if (permLoading) return navGroups;
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.moduleSlug || hasView(item.moduleSlug)),
      }))
      .filter((group) => group.items.length > 0);
  }, [permLoading, hasView, isOwner]);

  const showDashboard = useMemo(() => {
    if (permLoading) return true;
    return hasView("dashboard");
  }, [permLoading, hasView]);

  // Route protection
  const currentModuleSlug = ROUTE_MODULE_MAP[location.pathname];
  const isProfilePage = location.pathname === "/admin/perfil";

  if (loading || permLoading) {
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

  // Check route permission (skip for profile and dashboard)
  if (currentModuleSlug && !isProfilePage && currentModuleSlug !== "dashboard" && !hasView(currentModuleSlug)) {
    toast({ title: "Acesso negado", description: "Você não tem permissão para acessar este módulo.", variant: "destructive" });
    return <Navigate to="/admin" replace />;
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
          <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2.5 rounded-lg group cursor-pointer hover:bg-sidebar-accent/50 transition-colors">
            <div className="flex items-center gap-3">
              <group.groupIcon className="w-5 h-5 flex-shrink-0 text-sidebar-foreground" />
              <span className="text-sm font-medium text-sidebar-foreground">
                {group.groupLabel}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-sidebar-foreground/50 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 ml-8 space-y-0.5">
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

        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1 scrollbar-thin">
          {showDashboard && renderNavLink(dashboardItem)}
          {filteredGroups.map((group, index) => renderGroup(group, index))}
        </nav>

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

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden lg:flex" onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Expandir menu" : "Recolher menu"}>
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
