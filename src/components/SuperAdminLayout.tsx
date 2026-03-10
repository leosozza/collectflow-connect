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
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Navigate } from "react-router-dom";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { label: "Suporte", icon: Headphones, path: "/admin/suporte" },
  { label: "Gestão de Equipes", icon: Users, path: "/admin/equipes" },
  { label: "Gestão Financeira", icon: DollarSign, path: "/admin/financeiro" },
  { label: "Gestão de Inquilinos", icon: Building2, path: "/admin/tenants" },
  { label: "Treinamentos e Reuniões", icon: GraduationCap, path: "/admin/treinamentos" },
  { label: "Configurações do Sistema", icon: Settings, path: "/admin/configuracoes" },
  { label: "Relatórios e Análises", icon: BarChart3, path: "/admin/relatorios" },
];

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

  const pageTitles: Record<string, string> = {
    "/admin": "Dashboard de Gestão",
    "/admin/suporte": "Suporte",
    "/admin/equipes": "Gestão de Equipes",
    "/admin/financeiro": "Gestão Financeira",
    "/admin/tenants": "Gestão de Inquilinos",
    "/admin/treinamentos": "Treinamentos e Reuniões",
    "/admin/configuracoes": "Configurações do Sistema",
    "/admin/relatorios": "Relatórios e Análises",
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
          ${collapsed ? "w-16" : "w-64"} flex flex-col
          bg-[hsl(222,47%,11%)] text-white
          transform transition-all duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className={`flex items-center ${collapsed ? "justify-center px-2" : "justify-start px-4"} py-5 border-b border-white/10`}>
          {collapsed ? (
            <Shield className="w-7 h-7 text-amber-400" />
          ) : (
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-white tracking-wide">RIVO CONNECT</p>
                <p className="text-[10px] text-amber-400 font-medium uppercase tracking-widest">Super Admin</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1 scrollbar-thin">
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
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-4 border-t border-white/10">
          {!collapsed && (
            <div className="px-4 py-2 mb-2">
              <p className="text-sm font-medium text-white truncate">{profile?.full_name || "Super Admin"}</p>
              <p className="text-xs text-amber-400/80">Super Administrador</p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            title={collapsed ? "Sair" : undefined}
            className={`flex items-center ${collapsed ? "justify-center" : ""} gap-3 ${collapsed ? "px-2" : "px-4"} py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white w-full transition-colors`}
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
                <AvatarFallback className="bg-amber-500/10 text-amber-600 text-xs font-semibold">
                  {(profile?.full_name || "SA").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-foreground leading-tight truncate max-w-[120px]">{profile?.full_name || "Super Admin"}</p>
                <p className="text-[10px] text-amber-600 font-medium">Super Admin</p>
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
