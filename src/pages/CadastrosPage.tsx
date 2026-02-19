import { useState } from "react";
import { Building2, Users, UserCheck, FileText, Database, UserCog, Cloud, Tags, ShieldCheck, Map, Search } from "lucide-react";
import RoadmapPage from "@/pages/RoadmapPage";
import CredorList from "@/components/cadastros/CredorList";
import EquipeList from "@/components/cadastros/EquipeList";
import TipoDevedorList from "@/components/cadastros/TipoDevedorList";
import TipoDividaList from "@/components/cadastros/TipoDividaList";
import TipoStatusList from "@/components/cadastros/TipoStatusList";
import UsersPage from "@/pages/UsersPage";
import IntegracaoPage from "@/pages/IntegracaoPage";
import TenantSettingsPage from "@/pages/TenantSettingsPage";
import SuperAdminPage from "@/pages/SuperAdminPage";
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
  const [active, setActive] = useState("credores");
  const [search, setSearch] = useState("");
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
        { key: "credores", label: "Credores", icon: Building2, badge: credores?.length ?? null },
        { key: "equipes", label: "Equipes", icon: Users, badge: equipes?.length ?? null },
        { key: "tipo_devedor", label: "Perfil do Devedor", icon: UserCheck },
        { key: "tipo_divida", label: "Tipo de Dívida", icon: FileText },
        { key: "tipo_status", label: "Tipo de Status", icon: Tags, badge: tiposStatus?.length ?? null },
      ],
    },
    {
      title: "Pessoas",
      items: [
        { key: "usuarios", label: "Usuários", icon: UserCog, badge: usuariosCount ?? null },
      ],
    },
    {
      title: "Sistema",
      items: [
        { key: "integracao", label: "Integração", icon: Cloud },
        ...(isTenantAdmin ? [{ key: "tenant_config", label: "Config. Empresa", icon: Building2 }] : []),
        ...(isSuperAdmin ? [{ key: "super_admin", label: "Super Admin", icon: ShieldCheck }] : []),
        ...(isTenantAdmin ? [{ key: "roadmap", label: "Roadmap", icon: Map }] : []),
      ],
    },
  ];

  const filteredGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.label.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((group) => group.items.length > 0);

  const activeLabel = groups
    .flatMap((g) => g.items)
    .find((i) => i.key === active)?.label;

  return (
    <div className="flex gap-6 animate-fade-in">
      {/* Sub-navegação lateral */}
      <div className="w-56 flex-shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Configurações</h1>
        </div>

        {/* Busca rápida */}
        <div className="relative mb-4">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar seção..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Grupos de navegação */}
        <nav className="space-y-4">
          {filteredGroups.map((group, groupIndex) => (
            <div key={group.title}>
              {groupIndex > 0 && <Separator className="mb-3" />}
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1.5">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = active === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setActive(item.key)}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative",
                        isActive
                          ? "bg-primary/10 text-primary border-l-[3px] border-primary pl-[calc(0.75rem-3px)]"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-[3px] border-transparent pl-[calc(0.75rem-3px)]"
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-2">
              Nenhuma seção encontrada.
            </p>
          )}
        </nav>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground">{activeLabel}</h2>
        </div>
        {active === "credores" && <CredorList />}
        {active === "usuarios" && <UsersPage />}
        {active === "equipes" && <EquipeList />}
        {active === "tipo_devedor" && <TipoDevedorList />}
        {active === "tipo_divida" && <TipoDividaList />}
        {active === "tipo_status" && <TipoStatusList />}
        {active === "integracao" && <IntegracaoPage />}
        {active === "tenant_config" && <TenantSettingsPage />}
        {active === "super_admin" && <SuperAdminPage />}
        {active === "roadmap" && <RoadmapPage />}
      </div>
    </div>
  );
};

export default CadastrosPage;
