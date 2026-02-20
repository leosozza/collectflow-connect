import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  TenantRole,
  getDefaultPermissions,
  MODULE_LABELS,
  ACTION_LABELS,
  MODULE_AVAILABLE_ACTIONS,
} from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { RotateCcw, Save, ChevronDown, ChevronUp, Shield } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/30",
  gerente: "bg-chart-2/10 text-chart-2 border-chart-2/30",
  supervisor: "bg-chart-3/10 text-chart-3 border-chart-3/30",
  operador: "bg-muted text-muted-foreground border-border",
  super_admin: "bg-destructive/10 text-destructive border-destructive/30",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  gerente: "Gerente",
  supervisor: "Supervisor",
  operador: "Operador",
  super_admin: "Super Admin",
};

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

interface PermissionEntry {
  module: string;
  actions: string[];
}

export default function UserPermissionsTab() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, string[]>>>({});

  // Fetch all profiles (users) in tenant
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles-for-permissions", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, role")
        .eq("tenant_id", tenant!.id)
        .order("full_name");
      if (error) throw error;
      return (data || []) as Profile[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch tenant_users to get actual tenant roles
  const { data: tenantUsers = [] } = useQuery({
    queryKey: ["tenant-users-roles", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_users")
        .select("user_id, role")
        .eq("tenant_id", tenant!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const tenantRoleMap = new Map(tenantUsers.map((tu: any) => [tu.user_id, tu.role as TenantRole]));

  // Fetch all existing permission overrides for the tenant
  const { data: allPermissions = [] } = useQuery({
    queryKey: ["all-permissions", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions" as any)
        .select("profile_id, module, actions")
        .eq("tenant_id", tenant!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Build a map: profile_id -> { module -> actions[] }
  const permissionMap: Record<string, Record<string, string[]>> = {};
  for (const p of allPermissions as any[]) {
    if (!permissionMap[p.profile_id]) permissionMap[p.profile_id] = {};
    permissionMap[p.profile_id][p.module] = p.actions;
  }

  // Get effective permissions for a profile (override or role default)
  const getEffective = (profileId: string, role: TenantRole): Record<string, string[]> => {
    const saved = permissionMap[profileId] || {};
    const defaults = getDefaultPermissions(role);
    // If there are any overrides, merge them with defaults
    const hasSavedAny = Object.keys(saved).length > 0;
    if (!hasSavedAny) return { ...defaults };
    return { ...defaults, ...saved };
  };

  const saveMutation = useMutation({
    mutationFn: async ({ profileId, changes }: { profileId: string; changes: Record<string, string[]> }) => {
      if (!tenant?.id) return;
      // Upsert each module
      const rows = Object.entries(changes).map(([module, actions]) => ({
        profile_id: profileId,
        tenant_id: tenant.id,
        module,
        actions,
      }));
      const { error } = await supabase
        .from("user_permissions" as any)
        .upsert(rows, { onConflict: "profile_id,module" });
      if (error) throw error;
    },
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: ["all-permissions", tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-permissions"] });
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
      toast.success("Permissões salvas!");
    },
    onError: () => toast.error("Erro ao salvar permissões"),
  });

  const resetMutation = useMutation({
    mutationFn: async (profileId: string) => {
      if (!tenant?.id) return;
      const { error } = await supabase
        .from("user_permissions" as any)
        .delete()
        .eq("profile_id", profileId)
        .eq("tenant_id", tenant.id);
      if (error) throw error;
    },
    onSuccess: (_, profileId) => {
      queryClient.invalidateQueries({ queryKey: ["all-permissions", tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-permissions"] });
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
      toast.success("Permissões restauradas ao padrão do papel!");
    },
    onError: () => toast.error("Erro ao restaurar permissões"),
  });

  const getModuleActions = (profileId: string, role: TenantRole, module: string): string[] => {
    if (pendingChanges[profileId]?.[module] !== undefined) {
      return pendingChanges[profileId][module];
    }
    return getEffective(profileId, role)[module] || [];
  };

  const toggleAction = (profileId: string, role: TenantRole, module: string, action: string) => {
    const current = getModuleActions(profileId, role, module);
    const next = current.includes(action)
      ? current.filter((a) => a !== action)
      : [...current, action];
    setPendingChanges((prev) => ({
      ...prev,
      [profileId]: { ...prev[profileId], [module]: next },
    }));
  };

  const hasUnsavedChanges = (profileId: string) =>
    !!pendingChanges[profileId] && Object.keys(pendingChanges[profileId]).length > 0;

  const handleSave = (profileId: string) => {
    if (!pendingChanges[profileId]) return;
    const role = tenantRoleMap.get(profiles.find((p) => p.id === profileId)?.user_id || "") || "operador";
    const effective = getEffective(profileId, role);
    // Merge pending over effective
    const toSave = { ...effective, ...pendingChanges[profileId] };
    saveMutation.mutate({ profileId, changes: toSave });
  };

  const MODULES = Object.keys(MODULE_LABELS).filter((m) => m !== "dashboard" ? true : true);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Carregando usuários...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-semibold text-foreground">Permissões por Usuário</h3>
          <p className="text-xs text-muted-foreground">
            Customize as permissões individuais de cada usuário. As permissões abaixo sobrepõem o padrão do papel.
          </p>
        </div>
      </div>

      {profiles.map((profile) => {
        const role = tenantRoleMap.get(profile.user_id) || "operador";
        const isExpanded = expandedUser === profile.id;
        const hasChanges = hasUnsavedChanges(profile.id);
        const hasOverrides = !!permissionMap[profile.id] && Object.keys(permissionMap[profile.id]).length > 0;

        return (
          <div
            key={profile.id}
            className={cn(
              "border border-border rounded-xl overflow-hidden transition-all",
              isExpanded ? "bg-card" : "bg-card/50"
            )}
          >
            {/* Header row */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedUser(isExpanded ? null : profile.id)}
            >
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {(profile.full_name || "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground">{profile.full_name || "Sem nome"}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 h-4 capitalize border", ROLE_COLORS[role] || ROLE_COLORS.operador)}
                  >
                    {ROLE_LABELS[role] || role}
                  </Badge>
                  {hasOverrides && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      Customizado
                    </Badge>
                  )}
                  {hasChanges && (
                    <Badge className="text-[10px] px-1.5 py-0 h-4 bg-warning/20 text-warning border-warning/30">
                      Não salvo
                    </Badge>
                  )}
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            {/* Expanded permissions */}
            {isExpanded && (
              <div className="border-t border-border px-4 pb-4 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {MODULES.map((module) => {
                    const availableActions = MODULE_AVAILABLE_ACTIONS[module] || [];
                    const currentActions = getModuleActions(profile.id, role as TenantRole, module);
                    const defaultActions = getDefaultPermissions(role as TenantRole)[module] || [];
                    const hasModuleAccess = currentActions.length > 0;

                    return (
                      <div
                        key={module}
                        className={cn(
                          "rounded-lg border p-3 transition-colors",
                          hasModuleAccess ? "border-border bg-background" : "border-border/50 bg-muted/20"
                        )}
                      >
                        <p className={cn("text-xs font-semibold mb-2", hasModuleAccess ? "text-foreground" : "text-muted-foreground")}>
                          {MODULE_LABELS[module]}
                        </p>
                        <div className="space-y-1.5">
                          {availableActions.map((action) => {
                            const checked = currentActions.includes(action);
                            const isDefault = defaultActions.includes(action);
                            return (
                              <label
                                key={action}
                                className="flex items-center gap-2 cursor-pointer group"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleAction(profile.id, role as TenantRole, module, action)}
                                  className="h-3.5 w-3.5"
                                />
                                <span className={cn(
                                  "text-[11px] leading-tight",
                                  checked ? "text-foreground" : "text-muted-foreground"
                                )}>
                                  {ACTION_LABELS[action] || action}
                                  {!isDefault && checked && (
                                    <span className="ml-1 text-warning text-[9px]">+</span>
                                  )}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => resetMutation.mutate(profile.id)}
                    disabled={resetMutation.isPending || (!hasOverrides && !hasChanges)}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar Padrão
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => handleSave(profile.id)}
                    disabled={!hasChanges || saveMutation.isPending}
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saveMutation.isPending ? "Salvando..." : "Salvar Permissões"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {profiles.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhum usuário encontrado no tenant.
        </div>
      )}
    </div>
  );
}
