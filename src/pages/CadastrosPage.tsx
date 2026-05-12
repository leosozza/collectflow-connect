import { useState, useMemo } from "react";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Building2, Users, UserCheck, FileText, Database, UserCog, Tags, Search, Headset } from "lucide-react";
import CredorList from "@/components/cadastros/CredorList";
import CredorForm from "@/components/cadastros/CredorForm";
import EquipeList from "@/components/cadastros/EquipeList";
import TipoDevedorList from "@/components/cadastros/TipoDevedorList";
import TipoDividaList from "@/components/cadastros/TipoDividaList";
import TipoStatusList from "@/components/cadastros/TipoStatusList";


import DispositionTabsWrapper from "@/components/cadastros/DispositionTabsWrapper";
import UsersPage from "@/pages/UsersPage";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/useTenant";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { fetchCredores, fetchEquipes, fetchTiposStatus } from "@/services/cadastrosService";
import { supabase } from "@/integrations/supabase/client";

interface NavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  badge?: number | null;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const CadastrosPage = () => {
  useScrollRestore();
  const { tab, credorId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Quando estamos numa rota /cadastros/credores/:credorId/... ou /cadastros/credores/novo,
  // o segmento "tab" não vem nos params — forçamos "credores" para o menu lateral.
  const isCredorRoute = location.pathname.startsWith("/cadastros/credores/");
  const active = isCredorRoute ? "credores" : (tab || "credores");
  const setActive = (key: string) => navigate(`/cadastros/${key}`, { replace: true });
  const { isTenantAdmin, isSuperAdmin, tenant } = useTenant();

  const tenantId = tenant?.id;

  const { data: credores } = useQuery({
    queryKey: ["credores-count", tenantId],
    queryFn: () => fetchCredores(tenantId!),
    enabled: !!tenantId,
  });

  const { data: equipes } = useQuery({
    queryKey: ["equipes-count", tenantId],
    queryFn: () => fetchEquipes(tenantId!),
    enabled: !!tenantId,
  });

  const { data: tiposStatus } = useQuery({
    queryKey: ["tipos_status-count", tenantId],
    queryFn: () => fetchTiposStatus(tenantId!),
    enabled: !!tenantId,
  });

  const { data: usuariosCount } = useQuery({
    queryKey: ["usuarios-count", tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId!);
      return count ?? 0;
    },
    enabled: !!tenantId,
  });

  const groups: NavGroup[] = [
    {
      title: "Cadastros",
      items: [
        { key: "credores", label: "Credores", icon: Building2 },
        { key: "usuarios", label: "Usuários", icon: UserCog },
        { key: "equipes", label: "Equipes", icon: Users },
        { key: "tipo_devedor", label: "Perfil do Devedor", icon: UserCheck },
        { key: "tipo_status", label: "Tipo de Status", icon: Tags },
        { key: "tabulacoes", label: "Tabulações de Atendimento", icon: Headset },
      ],
    },
  ];

  // Estado do formulário de credor controlado pela URL
  const isNewCredor = location.pathname === "/cadastros/credores/novo";
  const credorFormOpen = isCredorRoute && (!!credorId || isNewCredor);
  const editingCredor = useMemo(
    () => (credorId ? credores?.find((c: any) => c.id === credorId) ?? null : null),
    [credorId, credores]
  );

  const handleCredorFormOpenChange = (open: boolean) => {
    if (!open) navigate("/cadastros/credores");
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full">
      {/* Cabeçalho unificado */}
      <div className="flex items-center gap-2">
        <Database className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Cadastros</h1>
      </div>

      {/* Navegação Horizontal Premium */}
      <nav className="flex flex-wrap items-center gap-1 border-b border-border pb-px">
        {groups.flatMap((g) => g.items).map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all relative rounded-t-lg",
                isActive
                  ? "bg-primary/10 text-primary border-b-[3px] border-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-b-[3px] border-transparent"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center bg-background/50 text-foreground"
                >
                  {item.badge}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      {/* Conteúdo Full-Width (Sem título redundante) */}
      <div className="flex-1 min-w-0">
        {active === "credores" && <CredorList />}
        {active === "usuarios" && <UsersPage />}
        {active === "equipes" && <EquipeList />}
        {active === "tipo_devedor" && <TipoDevedorList />}
        {active === "tipo_status" && <TipoStatusList />}
        {(active === "tabulacoes" || active === "tabulacao_chamada") && <DispositionTabsWrapper />}
      </div>

      {/* Formulário de credor controlado pela URL */}
      <CredorForm
        open={credorFormOpen}
        onOpenChange={handleCredorFormOpenChange}
        editing={editingCredor}
      />
    </div>
  );
};


export default CadastrosPage;
