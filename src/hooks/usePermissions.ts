import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

export type TenantRole = "super_admin" | "admin" | "gerente" | "supervisor" | "operador";

// Default permissions per role
const ROLE_DEFAULTS: Record<TenantRole, Record<string, string[]>> = {
  super_admin: {
    dashboard: ["view_all"],
    gamificacao: ["view", "manage"],
    carteira: ["view", "create", "import", "delete"],
    acordos: ["view", "create", "approve"],
    relatorios: ["view"],
    analytics: ["view_all"],
    automacao: ["view", "manage"],
    contact_center: ["view", "manage_admin"],
    telefonia: ["view"],
    cadastros: ["view", "manage"],
    financeiro: ["view", "manage"],
    integracoes: ["view", "manage"],
    configuracoes: ["view", "manage"],
    central_empresa: ["view", "manage"],
    auditoria: ["view"],
  },
  admin: {
    dashboard: ["view_all"],
    gamificacao: ["view", "manage"],
    carteira: ["view", "create", "import", "delete"],
    acordos: ["view", "create", "approve"],
    relatorios: ["view"],
    analytics: ["view_all"],
    automacao: ["view", "manage"],
    contact_center: ["view", "manage_admin"],
    telefonia: ["view"],
    cadastros: ["view", "manage"],
    financeiro: ["view", "manage"],
    integracoes: ["view", "manage"],
    configuracoes: ["view", "manage"],
    central_empresa: ["view", "manage"],
    auditoria: ["view"],
  },
  gerente: {
    dashboard: ["view_all"],
    gamificacao: ["view", "manage"],
    carteira: ["view", "create", "import"],
    acordos: ["view", "create", "approve"],
    relatorios: ["view"],
    analytics: ["view_all"],
    automacao: [],
    contact_center: [],
    telefonia: [],
    cadastros: [],
    financeiro: ["view", "manage"],
    integracoes: [],
    configuracoes: [],
    central_empresa: [],
    auditoria: ["view"],
  },
  supervisor: {
    dashboard: ["view_all"],
    gamificacao: ["view"],
    carteira: ["view", "create", "import"],
    acordos: ["view", "create", "approve"],
    relatorios: ["view"],
    analytics: ["view_all"],
    automacao: [],
    contact_center: ["view", "manage_admin"],
    telefonia: ["view"],
    cadastros: [],
    financeiro: [],
    integracoes: [],
    configuracoes: [],
    central_empresa: [],
    auditoria: [],
  },
  operador: {
    dashboard: ["view_own"],
    gamificacao: ["view"],
    carteira: ["view"],
    acordos: ["view", "create"],
    relatorios: [],
    analytics: ["view_own"],
    automacao: [],
    contact_center: ["view"],
    telefonia: ["view"],
    cadastros: [],
    financeiro: [],
    integracoes: [],
    configuracoes: [],
    central_empresa: [],
    auditoria: [],
  },
};

export function usePermissions() {
  const { tenantUser, isSuperAdmin, loading: tenantLoading } = useTenant();
  const role = (tenantUser?.role as TenantRole) || "operador";

  // Fetch individual permission overrides
  const { data: overrides = [], isLoading: permLoading } = useQuery({
    queryKey: ["my-permissions", tenantUser?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_permissions");
      if (error) return [];
      return (data || []) as { module: string; actions: string[] }[];
    },
    enabled: !!tenantUser,
    staleTime: 5 * 60 * 1000,
  });

  // Build effective permissions: start with role defaults, apply overrides
  const effectivePermissions = (() => {
    const base = { ...ROLE_DEFAULTS[role] };
    for (const override of overrides) {
      base[override.module] = override.actions;
    }
    return base;
  })();

  const has = (module: string, action: string): boolean => {
    const actions = effectivePermissions[module] || [];
    return actions.includes(action);
  };

  const hasAny = (module: string): boolean => {
    const actions = effectivePermissions[module] || [];
    return actions.length > 0;
  };

  return {
    role,
    loading: tenantLoading || permLoading,
    effectivePermissions,

    // Dashboard
    canViewAllDashboard: has("dashboard", "view_all"),
    canViewOwnDashboard: has("dashboard", "view_own") || has("dashboard", "view_all"),

    // Gamificação
    canViewGamificacao: hasAny("gamificacao"),
    canManageGamificacao: has("gamificacao", "manage"),

    // Carteira
    canViewCarteira: hasAny("carteira"),
    canCreateCarteira: has("carteira", "create"),
    canImportCarteira: has("carteira", "import"),
    canDeleteCarteira: has("carteira", "delete"),

    // Acordos
    canViewAcordos: hasAny("acordos"),
    canCreateAcordos: has("acordos", "create"),
    canApproveAcordos: has("acordos", "approve"),

    // Relatórios
    canViewRelatorios: hasAny("relatorios"),

    // Analytics
    canViewAllAnalytics: has("analytics", "view_all"),
    canViewOwnAnalytics: has("analytics", "view_own") || has("analytics", "view_all"),

    // Automação
    canViewAutomacao: hasAny("automacao"),

    // Contact Center
    canViewContactCenter: hasAny("contact_center"),
    canManageContactCenterAdmin: has("contact_center", "manage_admin"),

    // Telefonia
    canViewTelefonia: hasAny("telefonia"),

    // Cadastros
    canViewCadastros: hasAny("cadastros"),
    canManageCadastros: has("cadastros", "manage"),

    // Financeiro
    canViewFinanceiro: hasAny("financeiro"),

    // Integrações
    canViewIntegracoes: hasAny("integracoes"),

    // Configurações
    canViewConfiguracoes: hasAny("configuracoes"),

    // Central Empresa
    canViewCentralEmpresa: hasAny("central_empresa"),

    // Auditoria
    canViewAuditoria: hasAny("auditoria"),
  };
}

// Utility to get default permissions for a role (used in UserPermissionsTab)
export function getDefaultPermissions(role: TenantRole) {
  return ROLE_DEFAULTS[role] || ROLE_DEFAULTS["operador"];
}

export const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  gamificacao: "Gamificação",
  carteira: "Carteira",
  acordos: "Acordos",
  relatorios: "Relatórios",
  analytics: "Analytics",
  automacao: "Automação",
  contact_center: "Contact Center",
  telefonia: "Telefonia",
  cadastros: "Cadastros",
  financeiro: "Financeiro",
  integracoes: "Integrações",
  configuracoes: "Configurações",
  central_empresa: "Central Empresa",
  auditoria: "Auditoria",
};

export const ACTION_LABELS: Record<string, string> = {
  view: "Visualizar",
  view_all: "Visualizar (Todos)",
  view_own: "Visualizar (Próprio)",
  create: "Criar",
  import: "Importar",
  delete: "Excluir",
  approve: "Aprovar/Rejeitar",
  manage: "Gerenciar",
  manage_admin: "Gerenciar (Administrativo)",
};

export const MODULE_AVAILABLE_ACTIONS: Record<string, string[]> = {
  dashboard: ["view_own", "view_all"],
  gamificacao: ["view", "manage"],
  carteira: ["view", "create", "import", "delete"],
  acordos: ["view", "create", "approve"],
  relatorios: ["view"],
  analytics: ["view_own", "view_all"],
  automacao: ["view", "manage"],
  contact_center: ["view", "manage_admin"],
  telefonia: ["view"],
  cadastros: ["view", "manage"],
  financeiro: ["view", "manage"],
  integracoes: ["view", "manage"],
  configuracoes: ["view", "manage"],
  central_empresa: ["view", "manage"],
  auditoria: ["view"],
};
