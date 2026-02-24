import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState, useMemo, useEffect } from "react";
import {
  Edit,
  Trash2,
  ChevronsUpDown,
  Check,
  X,
  Phone,
  Loader2,
  MessageSquare,
  UserPlus,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommissionGrade, CommissionTier } from "@/lib/commission";
import { fetchWhatsAppInstances } from "@/services/whatsappInstanceService";
import { formatCPF, formatPhone } from "@/lib/formatters";


interface ThreeCAgent {
  id: number;
  name: string;
  extension?: number;
  status?: string | number;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: "admin" | "operador";
  commission_rate: number;
  commission_grade_id: string | null;
  threecplus_agent_id: number | null;
  permission_profile_id?: string | null;
}

interface PermissionProfile {
  id: string;
  name: string;
  base_role: string;
}

const ROLE_LABELS: Record<string, string> = {
  operador: "Operador",
  supervisor: "Supervisor",
  gerente: "Gerente",
  admin: "Admin",
};

const UsersPage = () => {
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  // Edit state
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<string>("operador");
  const [editGradeId, setEditGradeId] = useState<string>("none");
  const [editName, setEditName] = useState<string>("");
  const [editAgentId, setEditAgentId] = useState<number | null>(null);
  const [agentPopoverOpen, setAgentPopoverOpen] = useState(false);
  const [editInstanceIds, setEditInstanceIds] = useState<string[]>([]);
  const [editProfileId, setEditProfileId] = useState<string>("none");

  // Delete state
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);

  // Change password state
  const [pwUser, setPwUser] = useState<Profile | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  // New user state
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newRole, setNewRole] = useState<string>("operador");
  const [newProfileId, setNewProfileId] = useState<string>("none");
  const [newGradeId, setNewGradeId] = useState<string>("none");
  const [newAgentId, setNewAgentId] = useState<number | null>(null);
  const [newAgentPopoverOpen, setNewAgentPopoverOpen] = useState(false);
  const [newInstanceIds, setNewInstanceIds] = useState<string[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);

  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  // Fetch 3CPlus agents list
  const { data: threecAgents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["threecplus-all-agents", domain],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "list_active_agents", domain, api_token: apiToken },
      });
      if (error) throw error;
      const list = Array.isArray(data) ? data : data?.data || [];
      return list as ThreeCAgent[];
    },
    enabled: !!domain && !!apiToken,
    staleTime: 5 * 60 * 1000,
  });

  const agentNameMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const a of threecAgents) m.set(a.id, a.name);
    return m;
  }, [threecAgents]);

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: emails, error: emailsError }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.rpc("get_user_emails"),
      ]);
      if (error) throw error;
      const emailMap = new Map((emails || []).map((e: { user_id: string; email: string }) => [e.user_id, e.email]));
      return (profiles || []).map((p) => ({ ...p, email: emailMap.get(p.user_id) || "—" })) as (Profile & { email: string })[];
    },
    enabled: profile?.role === "admin",
  });

  // Fetch tenant_users for roles
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

  const tenantRoleMap = new Map(tenantUsers.map((tu: any) => [tu.user_id, tu.role]));

  // Fetch commission grades
  const { data: grades = [] } = useQuery({
    queryKey: ["commission-grades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commission_grades").select("*").order("name");
      if (error) throw error;
      return (data || []).map((d) => ({ ...d, tiers: d.tiers as unknown as CommissionTier[] })) as CommissionGrade[];
    },
  });

  // Fetch permission profiles
  const { data: permissionProfiles = [] } = useQuery({
    queryKey: ["permission-profiles", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permission_profiles" as any)
        .select("id, name, base_role")
        .eq("tenant_id", tenant!.id)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data as unknown as PermissionProfile[]) || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch WhatsApp instances
  const { data: whatsappInstances = [] } = useQuery({
    queryKey: ["whatsapp-instances", tenant?.id],
    queryFn: () => fetchWhatsAppInstances(tenant!.id),
    enabled: !!tenant?.id,
  });

  // Fetch operator_instances for the currently edited user
  const { data: currentOperatorInstances = [] } = useQuery({
    queryKey: ["operator-instances", editUser?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operator_instances" as any)
        .select("instance_id")
        .eq("profile_id", editUser!.id);
      if (error) throw error;
      return (data || []).map((d: any) => d.instance_id as string);
    },
    enabled: !!editUser?.id,
  });

  useEffect(() => {
    if (editUser && currentOperatorInstances.length > 0) {
      setEditInstanceIds(currentOperatorInstances);
    }
  }, [editUser?.id, currentOperatorInstances.join(",")]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      role,
      commission_grade_id,
      full_name,
      threecplus_agent_id,
      instanceIds,
      permission_profile_id,
    }: {
      id: string;
      role: string;
      commission_grade_id: string | null;
      full_name: string;
      threecplus_agent_id: number | null;
      instanceIds: string[];
      permission_profile_id: string | null;
    }) => {
      // Update profile
      const { error } = await supabase
        .from("profiles")
        .update({ commission_grade_id, full_name, threecplus_agent_id, permission_profile_id } as any)
        .eq("id", id);
      if (error) throw error;

      // Update tenant_users role
      const profileRecord = users.find((u) => u.id === id);
      if (profileRecord && tenant?.id) {
        await supabase
          .from("tenant_users")
          .update({ role } as any)
          .eq("user_id", profileRecord.user_id)
          .eq("tenant_id", tenant.id);
      }

      // Sync operator_instances
      if (tenant?.id) {
        await supabase.from("operator_instances" as any).delete().eq("profile_id", id);
        if (instanceIds.length > 0) {
          const rows = instanceIds.map((instId) => ({
            profile_id: id,
            instance_id: instId,
            tenant_id: tenant.id,
          }));
          await supabase.from("operator_instances" as any).insert(rows as any);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-users-roles"] });
      queryClient.invalidateQueries({ queryKey: ["operator-instances"] });
      toast.success("Usuário atualizado!");
      setEditUser(null);
    },
    onError: () => toast.error("Erro ao atualizar usuário"),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuário removido!");
      setDeleteUser(null);
    },
    onError: () => toast.error("Erro ao remover usuário"),
  });

  const handleEdit = (user: Profile) => {
    setEditUser(user);
    setEditRole(tenantRoleMap.get(user.user_id) || "operador");
    setEditGradeId(user.commission_grade_id || "none");
    setEditName(user.full_name);
    setEditAgentId(user.threecplus_agent_id);
    setEditInstanceIds([]);
    setEditProfileId((user as any).permission_profile_id || "none");
  };

  const resetNewUser = () => {
    setNewName("");
    setNewCpf("");
    setNewPhone("");
    setNewEmail("");
    setNewPassword("");
    setShowPassword(false);
    setNewRole("operador");
    setNewProfileId("none");
    setNewGradeId("none");
    setNewAgentId(null);
    setNewInstanceIds([]);
  };

  const handleCreateUser = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast.error("Preencha nome, email e senha");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    setCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          full_name: newName.trim(),
          cpf: newCpf.replace(/\D/g, "") || null,
          phone: newPhone.replace(/\D/g, "") || null,
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          role: newRole,
          permission_profile_id: newProfileId === "none" ? null : newProfileId,
          commission_grade_id: newGradeId === "none" ? null : newGradeId,
          threecplus_agent_id: newAgentId,
          instance_ids: newInstanceIds,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Usuário ${newName} criado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setNewUserOpen(false);
      resetNewUser();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwUser) return;
    if (newPw.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("As senhas não conferem");
      return;
    }
    setChangingPw(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { action: "update_password", user_id: pwUser.user_id, password: newPw },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Senha de ${pwUser.full_name} alterada com sucesso!`);
      setPwUser(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao trocar senha");
    } finally {
      setChangingPw(false);
    }
  };

  const getGradeName = (gradeId: string | null) => {
    if (!gradeId) return "Nenhuma";
    return grades.find((g) => g.id === gradeId)?.name || "—";
  };

  const getAgentDisplay = (agentId: number | null) => {
    if (!agentId) return "—";
    const name = agentNameMap.get(agentId);
    return name ? `${name} (#${agentId})` : `#${agentId}`;
  };

  const assignedAgentIds = useMemo(() => {
    const set = new Set<number>();
    for (const u of users) {
      if (u.threecplus_agent_id && u.id !== editUser?.id) set.add(u.threecplus_agent_id);
    }
    return set;
  }, [users, editUser?.id]);

  const assignedNewAgentIds = useMemo(() => {
    const set = new Set<number>();
    for (const u of users) {
      if (u.threecplus_agent_id) set.add(u.threecplus_agent_id);
    }
    return set;
  }, [users]);

  if (profile?.role !== "admin") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  const AgentPicker = ({
    value,
    onChange,
    open,
    onOpenChange,
    assignedIds,
    excludeId,
  }: {
    value: number | null;
    onChange: (v: number | null) => void;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    assignedIds: Set<number>;
    excludeId?: number | null;
  }) => (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
            {value ? (
              <span className="truncate">{agentNameMap.get(value) || `Agente #${value}`}</span>
            ) : (
              <span className="text-muted-foreground">Selecionar agente...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar agente por nome..." />
            <CommandList>
              <CommandEmpty>
                {agentsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Carregando agentes...</span>
                  </div>
                ) : "Nenhum agente encontrado"}
              </CommandEmpty>
              <CommandGroup>
                {threecAgents.map((agent) => {
                  const isAssigned = assignedIds.has(agent.id) && agent.id !== excludeId;
                  const isSelected = value === agent.id;
                  return (
                    <CommandItem
                      key={agent.id}
                      value={`${agent.name} ${agent.id}`}
                      onSelect={() => {
                        if (!isAssigned || isSelected) {
                          onChange(isSelected ? null : agent.id);
                          onOpenChange(false);
                        }
                      }}
                      disabled={isAssigned && !isSelected}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Check className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{agent.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            ID: {agent.id}{agent.extension ? ` · Ramal: ${agent.extension}` : ""}
                          </p>
                        </div>
                      </div>
                      {isAssigned && !isSelected && (
                        <Badge variant="secondary" className="text-[10px] ml-2 shrink-0">Vinculado</Badge>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && (
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => onChange(null)}>
          <X className="w-3 h-3" /> Remover vínculo
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground text-sm">Gerencie operadores e administradores</p>
        </div>
        <Button onClick={() => { setNewUserOpen(true); resetNewUser(); }} className="gap-2">
          <UserPlus className="w-4 h-4" /> Novo Usuário
        </Button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Grade de Comissão</TableHead>
              <TableHead>Agente 3CPlus</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : users.map((u) => {
              const tenantRole = tenantRoleMap.get(u.user_id) || u.role;
              return (
                <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium text-card-foreground">{u.full_name || "Sem nome"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{(u as any).email}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{ROLE_LABELS[tenantRole] || tenantRole}</TableCell>
                  <TableCell className="text-muted-foreground">{getGradeName(u.commission_grade_id)}</TableCell>
                  <TableCell>
                    {u.threecplus_agent_id ? (
                      <Badge variant="outline" className="gap-1.5 font-normal">
                        <Phone className="w-3 h-3" />
                        {getAgentDisplay(u.threecplus_agent_id)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(u)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      {u.id !== profile?.id && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Trocar Senha" onClick={() => { setPwUser(u); setNewPw(""); setConfirmPw(""); }}>
                          <KeyRound className="w-4 h-4" />
                        </Button>
                      )}
                      {u.id !== profile?.id && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteUser(u)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Perfil de Permissão</Label>
              <Select value={editProfileId} onValueChange={setEditProfileId}>
                <SelectTrigger><SelectValue placeholder="Selecionar perfil..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (usar padrão do cargo)</SelectItem>
                  {permissionProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grade de Comissão</Label>
              <Select value={editGradeId} onValueChange={setEditGradeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {domain && apiToken && (
              <div className="space-y-2">
                <Label>Agente 3CPlus</Label>
                <AgentPicker
                  value={editAgentId}
                  onChange={setEditAgentId}
                  open={agentPopoverOpen}
                  onOpenChange={setAgentPopoverOpen}
                  assignedIds={assignedAgentIds}
                  excludeId={editUser?.threecplus_agent_id}
                />
              </div>
            )}
            {whatsappInstances.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4" /> Instâncias WhatsApp
                </Label>
                <div className="space-y-2 rounded-md border p-3">
                  {whatsappInstances.map((inst) => (
                    <label key={inst.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={editInstanceIds.includes(inst.id)}
                        onCheckedChange={(checked) => {
                          setEditInstanceIds((prev) =>
                            checked ? [...prev, inst.id] : prev.filter((id) => id !== inst.id)
                          );
                        }}
                      />
                      <span className="text-sm">{inst.name || inst.instance_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (editUser) {
                  updateMutation.mutate({
                    id: editUser.id,
                    role: editRole,
                    commission_grade_id: editGradeId === "none" ? null : editGradeId,
                    full_name: editName,
                    threecplus_agent_id: editAgentId,
                    instanceIds: editInstanceIds,
                    permission_profile_id: editProfileId === "none" ? null : editProfileId,
                  });
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deleteUser?.full_name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Password Dialog */}
      <Dialog open={!!pwUser} onOpenChange={() => setPwUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Trocar Senha</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Definir nova senha para <strong>{pwUser?.full_name}</strong>
          </p>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Senha</Label>
              <Input
                type="password"
                placeholder="Repita a nova senha"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwUser(null)}>Cancelar</Button>
            <Button onClick={handleChangePassword} disabled={changingPw || !newPw || !confirmPw}>
              {changingPw ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
              ) : "Salvar Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo Usuário Dialog */}
      <Dialog open={newUserOpen} onOpenChange={(o) => { setNewUserOpen(o); if (!o) resetNewUser(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome Completo <span className="text-destructive">*</span></Label>
              <Input
                placeholder="João da Silva"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input
                placeholder="000.000.000-00"
                value={newCpf}
                onChange={(e) => setNewCpf(formatCPF(e.target.value))}
                maxLength={14}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={newPhone}
                onChange={(e) => setNewPhone(formatPhone(e.target.value))}
                maxLength={15}
              />
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder="joao@empresa.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Grade de Comissão</Label>
              <Select value={newGradeId} onValueChange={setNewGradeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Perfil do Usuário</Label>
              <Select value={newProfileId} onValueChange={setNewProfileId}>
                <SelectTrigger><SelectValue placeholder="Selecionar perfil..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (usar padrão do cargo)</SelectItem>
                  {permissionProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {domain && apiToken && (
              <div className="space-y-2">
                <Label>Agente Discador</Label>
                <AgentPicker
                  value={newAgentId}
                  onChange={setNewAgentId}
                  open={newAgentPopoverOpen}
                  onOpenChange={setNewAgentPopoverOpen}
                  assignedIds={assignedNewAgentIds}
                />
              </div>
            )}
            {whatsappInstances.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4" /> Instância WhatsApp
                </Label>
                <div className="space-y-2 rounded-md border p-3">
                  {whatsappInstances.map((inst) => (
                    <label key={inst.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={newInstanceIds.includes(inst.id)}
                        onCheckedChange={(checked) => {
                          setNewInstanceIds((prev) =>
                            checked ? [...prev, inst.id] : prev.filter((id) => id !== inst.id)
                          );
                        }}
                      />
                      <span className="text-sm">{inst.name || inst.instance_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewUserOpen(false); resetNewUser(); }}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={creatingUser || !newName || !newEmail || !newPassword}>
              {creatingUser ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Usuário"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
