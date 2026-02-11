import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
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
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { profile, signOut } = useAuth();
  const { tenant, tenantUser, isTenantAdmin, isSuperAdmin } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = isTenantAdmin;

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/" },
    { label: "Carteira", icon: Wallet, path: "/carteira" },
    { label: "Cadastro", icon: ClipboardPlus, path: "/cadastro" },
    ...(isAdmin ? [
      { label: "Usuários", icon: UserCog, path: "/usuarios" },
      { label: "Configurações", icon: Settings, path: "/configuracoes" },
      { label: "Empresa", icon: Users, path: "/tenant/configuracoes" },
      { label: "Integração", icon: Cloud, path: "/integracao" },
    ] : []),
    ...(isSuperAdmin ? [
      { label: "Tenants", icon: Users, path: "/admin/tenants" },
    ] : []),
  ];

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

        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => {
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
            <span className="text-sm text-muted-foreground">
              {isSuperAdmin ? "Super Admin" : isTenantAdmin ? "Administrador" : "Operador"}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
