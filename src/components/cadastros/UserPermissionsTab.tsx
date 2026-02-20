import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  MODULE_LABELS,
  ACTION_LABELS,
  MODULE_AVAILABLE_ACTIONS,
  TenantRole,
} from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Shield,
  Plus,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  Users,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface PermissionProfile {
  id: string;
  tenant_id: string;
  name: string;
  base_role: string;
  permissions: Record<string, string[]>;
  is_default: boolean;
  created_at: string;
}

interface LinkedUser {
  id: string;
  full_name: string;
  user_id: string;
}

const BASE_ROLE_LABELS: Record<string, string> = {
  operador: "Operador",
  supervisor: "Supervisor",
  gerente: "Gerente",
  admin: "Admin",
};

const BASE_ROLE_COLORS: Record<string, string> = {
  operador: "bg-muted text-muted-foreground border-border",
  supervisor: "bg-chart-3/10 text-chart-3 border-chart-3/30",
  gerente: "bg-chart-2/10 text-chart-2 border-chart-2/30",
  admin: "bg-primary/10 text-primary border-primary/30",
};

const MODULES = Object.keys(MODULE_LABELS);

export default function UserPermissionsTab() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [pendingPerms, setPendingPerms] = useState<Record<string, Record<string, string[]>>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileRole, setNewProfileRole] = useState<string>("operador");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");

  // Fetch permission profiles
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["permission-profiles", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permission_profiles" as any)
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("is_default", { ascending: false })
        .order("created_at");
      if (error) throw error;
      return (data as unknown as PermissionProfile[]) || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch all profiles to count linked users per permission profile
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles-linked", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, user_id, permission_profile_id")
        .eq("tenant_id", tenant!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const linkedUsersMap: Record<string, LinkedUser[]> = {};
  for (const p of allProfiles as any[]) {
    if (p.permission_profile_id) {
      if (!linkedUsersMap[p.permission_profile_id]) linkedUsersMap[p.permission_profile_id] = [];
      linkedUsersMap[p.permission_profile_id].push({ id: p.id, full_name: p.full_name, user_id: p.user_id });
    }
  }

  // Save permissions for a profile
  const saveMutation = useMutation({
    mutationFn: async ({ profileId, permissions }: { profileId: string; permissions: Record<string, string[]> }) => {
      const { error } = await supabase
        .from("permission_profiles" as any)
        .update({ permissions })
        .eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: ["permission-profiles", tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-permissions"] });
      setPendingPerms((prev) => {
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
      toast.success("Perfil salvo!");
    },
    onError: () => toast.error("Erro ao salvar perfil"),
  });

  // Save name for a profile
  const saveNameMutation = useMutation({
    mutationFn: async ({ profileId, name }: { profileId: string; name: string }) => {
      const { error } = await supabase
        .from("permission_profiles" as any)
        .update({ name })
        .eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permission-profiles", tenant?.id] });
      setEditingName(null);
      toast.success("Nome atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar nome"),
  });

  // Create new profile
  const createMutation = useMutation({
    mutationFn: async ({ name, base_role }: { name: string; base_role: string }) => {
      // Start with empty permissions for all modules
      const basePermissions: Record<string, string[]> = {};
      for (const mod of MODULES) {
        basePermissions[mod] = [];
      }
      const { error } = await supabase
        .from("permission_profiles" as any)
        .insert({
          tenant_id: tenant!.id,
          name,
          base_role,
          permissions: basePermissions,
          is_default: false,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permission-profiles", tenant?.id] });
      setCreateOpen(false);
      setNewProfileName("");
      setNewProfileRole("operador");
      toast.success("Perfil criado!");
    },
    onError: () => toast.error("Erro ao criar perfil"),
  });

  // Delete profile
  const deleteMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from("permission_profiles" as any)
        .delete()
        .eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permission-profiles", tenant?.id] });
      toast.success("Perfil removido!");
    },
    onError: () => toast.error("Erro ao remover perfil"),
  });

  // Unlink user from profile
  const unlinkUserMutation = useMutation({
    mutationFn: async (profileId_userId: { profileId: string; userId: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ permission_profile_id: null } as any)
        .eq("id", profileId_userId.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles-linked", tenant?.id] });
      toast.success("Usuário desvinculado!");
    },
    onError: () => toast.error("Erro ao desvincular"),
  });

  const getActions = (profileId: string, profile: PermissionProfile, module: string): string[] => {
    if (pendingPerms[profileId]?.[module] !== undefined) {
      return pendingPerms[profileId][module];
    }
    return (profile.permissions[module] as string[]) || [];
  };

  const toggleAction = (profileId: string, profile: PermissionProfile, module: string, action: string) => {
    const current = getActions(profileId, profile, module);
    const next = current.includes(action)
      ? current.filter((a) => a !== action)
      : [...current, action];
    setPendingPerms((prev) => ({
      ...prev,
      [profileId]: { ...(prev[profileId] || {}), [module]: next },
    }));
  };

  const hasUnsaved = (profileId: string) =>
    !!pendingPerms[profileId] && Object.keys(pendingPerms[profileId]).length > 0;

  const handleSave = (profile: PermissionProfile) => {
    const base = { ...profile.permissions };
    const pending = pendingPerms[profile.id] || {};
    const merged = { ...base, ...pending };
    saveMutation.mutate({ profileId: profile.id, permissions: merged });
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Carregando perfis...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground">Perfis de Permissão</h3>
            <p className="text-xs text-muted-foreground">
              Crie e configure perfis reutilizáveis. Vincule usuários a um perfil ao cadastrá-los.
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          Novo Perfil
        </Button>
      </div>

      {/* Profile cards */}
      {profiles.map((profile) => {
        const isExpanded = expandedProfile === profile.id;
        const linkedUsers = linkedUsersMap[profile.id] || [];
        const unsaved = hasUnsaved(profile.id);
        const isEditingName = editingName === profile.id;

        return (
          <div
            key={profile.id}
            className={cn(
              "border border-border rounded-xl overflow-hidden transition-all",
              isExpanded ? "bg-card" : "bg-card/50"
            )}
          >
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Name + expand */}
              <button
                className="flex-1 flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
                onClick={() => setExpandedProfile(isExpanded ? null : profile.id)}
              >
                <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isEditingName ? (
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Input
                          value={editingNameValue}
                          onChange={(e) => setEditingNameValue(e.target.value)}
                          className="h-6 text-sm px-1.5 w-40"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveNameMutation.mutate({ profileId: profile.id, name: editingNameValue });
                            if (e.key === "Escape") setEditingName(null);
                          }}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveNameMutation.mutate({ profileId: profile.id, name: editingNameValue })}>
                          <Save className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-foreground">{profile.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingName(profile.id);
                            setEditingNameValue(profile.name);
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0 h-4 border", BASE_ROLE_COLORS[profile.base_role] || BASE_ROLE_COLORS.operador)}
                    >
                      {BASE_ROLE_LABELS[profile.base_role] || profile.base_role}
                    </Badge>
                    {profile.is_default && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">Padrão</Badge>
                    )}
                    {unsaved && (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 bg-warning/20 text-warning border-warning/30">Não salvo</Badge>
                    )}
                    {linkedUsers.length > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users className="w-3 h-3" />
                        {linkedUsers.length} usuário{linkedUsers.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!profile.is_default && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    disabled={linkedUsers.length > 0}
                    title={linkedUsers.length > 0 ? "Desvincule todos os usuários antes de excluir" : "Excluir perfil"}
                    onClick={() => deleteMutation.mutate(profile.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  onClick={() => setExpandedProfile(isExpanded ? null : profile.id)}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                {/* Module permissions grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {MODULES.map((module) => {
                    const availableActions = MODULE_AVAILABLE_ACTIONS[module] || [];
                    const currentActions = getActions(profile.id, profile, module);
                    const hasAccess = currentActions.length > 0;

                    return (
                      <div
                        key={module}
                        className={cn(
                          "rounded-lg border p-3 transition-colors",
                          hasAccess ? "border-border bg-background" : "border-border/50 bg-muted/20"
                        )}
                      >
                        <p className={cn("text-xs font-semibold mb-2", hasAccess ? "text-foreground" : "text-muted-foreground")}>
                          {MODULE_LABELS[module]}
                        </p>
                        <div className="space-y-1.5">
                          {availableActions.map((action) => {
                            const checked = currentActions.includes(action);
                            return (
                              <label key={action} className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleAction(profile.id, profile, module, action)}
                                  className="h-3.5 w-3.5"
                                />
                                <span className={cn("text-[11px] leading-tight", checked ? "text-foreground" : "text-muted-foreground")}>
                                  {ACTION_LABELS[action] || action}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Save action */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="text-xs text-muted-foreground">
                    {linkedUsers.length > 0
                      ? `${linkedUsers.length} usuário${linkedUsers.length !== 1 ? "s" : ""} usando este perfil`
                      : "Nenhum usuário vinculado"}
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => handleSave(profile)}
                    disabled={!unsaved || saveMutation.isPending}
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saveMutation.isPending ? "Salvando..." : "Salvar Permissões"}
                  </Button>
                </div>

                {/* Linked users */}
                {linkedUsers.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Usuários vinculados</p>
                    <div className="space-y-1.5">
                      {linkedUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-muted/30">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                                {(user.full_name || "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium text-foreground">{user.full_name || "Sem nome"}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px] text-muted-foreground hover:text-destructive px-2"
                            onClick={() => unlinkUserMutation.mutate({ profileId: profile.id, userId: user.id })}
                          >
                            Desvincular
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {profiles.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhum perfil encontrado.
        </div>
      )}

      {/* Create profile dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Perfil de Permissão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Perfil</Label>
              <Input
                placeholder="Ex: Operador Comercial, Supervisor Financeiro..."
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Papel Base</Label>
              <Select value={newProfileRole} onValueChange={setNewProfileRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O papel base define o nível de acesso geral. Você poderá customizar as permissões depois.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              disabled={!newProfileName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: newProfileName.trim(), base_role: newProfileRole })}
            >
              {createMutation.isPending ? "Criando..." : "Criar Perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
