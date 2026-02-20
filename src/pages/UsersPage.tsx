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
import { Edit, Trash2, ChevronsUpDown, Check, X, Phone, Loader2, MessageSquare, Link2, Copy, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommissionGrade, CommissionTier } from "@/lib/commission";
import { fetchWhatsAppInstances, type WhatsAppInstance } from "@/services/whatsappInstanceService";

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
}

const UsersPage = () => {
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<string>("operador");
  const [editGradeId, setEditGradeId] = useState<string>("none");
  const [editName, setEditName] = useState<string>("");
  const [editAgentId, setEditAgentId] = useState<number | null>(null);
  const [agentPopoverOpen, setAgentPopoverOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);
  const [editInstanceIds, setEditInstanceIds] = useState<string[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<string>("operador");
  const [inviteExpiry, setInviteExpiry] = useState<string>("7");
  const [generatedLink, setGeneratedLink] = useState<string>("");
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [newUserOpen, setNewUserOpen] = useState(false);
  const [newUserRole, setNewUserRole] = useState<string>("operador");
  const [newUserExpiry, setNewUserExpiry] = useState<string>("7");
  const [newUserLink, setNewUserLink] = useState<string>("");
  const [generatingNewUser, setGeneratingNewUser] = useState(false);
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

  // Map agentId -> name for display
  const agentNameMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const a of threecAgents) {
      m.set(a.id, a.name);
    }
    return m;
  }, [threecAgents]);

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

  const { data: grades = [] } = useQuery({
    queryKey: ["commission-grades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_grades")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []).map((d) => ({ ...d, tiers: d.tiers as unknown as CommissionTier[] })) as CommissionGrade[];
    },
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

  // Sync editInstanceIds when operator instances load
  useEffect(() => {
    if (editUser && currentOperatorInstances.length > 0) {
      setEditInstanceIds(currentOperatorInstances);
    }
  }, [editUser?.id, currentOperatorInstances.join(",")]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, role, commission_grade_id, full_name, threecplus_agent_id, instanceIds }: { id: string; role: string; commission_grade_id: string | null; full_name: string; threecplus_agent_id: number | null; instanceIds: string[] }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role, commission_grade_id, full_name, threecplus_agent_id } as any)
        .eq("id", id);
      if (error) throw error;

      // Sync operator_instances
      if (tenant?.id) {
        await supabase
          .from("operator_instances" as any)
          .delete()
          .eq("profile_id", id);

        if (instanceIds.length > 0) {
          const rows = instanceIds.map((instId) => ({
            profile_id: id,
            instance_id: instId,
            tenant_id: tenant.id,
          }));
          const { error: insErr } = await supabase
            .from("operator_instances" as any)
            .insert(rows as any);
          if (insErr) throw insErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["operator-instances"] });
      toast.success("Usuário atualizado!");
      setEditUser(null);
    },
    onError: () => toast.error("Erro ao atualizar usuário"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id);
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
    setEditRole(user.role);
    setEditGradeId(user.commission_grade_id || "none");
    setEditName(user.full_name);
    setEditAgentId(user.threecplus_agent_id);
    setEditInstanceIds([]);
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

  // IDs already assigned to other users
  const assignedAgentIds = useMemo(() => {
    const set = new Set<number>();
    for (const u of users) {
      if (u.threecplus_agent_id && u.id !== editUser?.id) {
        set.add(u.threecplus_agent_id);
      }
    }
    return set;
  }, [users, editUser?.id]);

  if (profile?.role !== "admin") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  const selectedAgentName = editAgentId ? agentNameMap.get(editAgentId) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground text-sm">Gerencie operadores e administradores</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setNewUserOpen(true); setNewUserLink(""); }} className="gap-2">
            <UserPlus className="w-4 h-4" /> Novo Usuário
          </Button>
          <Button onClick={() => { setInviteOpen(true); setGeneratedLink(""); }} className="gap-2">
            <Link2 className="w-4 h-4" /> Convidar por Link
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tipo</TableHead>
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
            ) : users.map((u) => (
              <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium text-card-foreground">{u.full_name || "Sem nome"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{u.role}</TableCell>
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
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteUser(u)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Usuário</Label>
              <Select value={editRole} onValueChange={setEditRole}>
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
            </div>
            <div className="space-y-2">
              <Label>Grade de Comissão</Label>
              <Select value={editGradeId} onValueChange={setEditGradeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3CPlus Agent Picker */}
            <div className="space-y-2">
              <Label>Agente 3CPlus</Label>
              {!domain || !apiToken ? (
                <p className="text-xs text-muted-foreground">Configure o domínio e token 3CPlus nas configurações da empresa para vincular agentes.</p>
              ) : (
                <div className="space-y-2">
                  <Popover open={agentPopoverOpen} onOpenChange={setAgentPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={agentPopoverOpen}
                        className="w-full justify-between font-normal"
                      >
                        {editAgentId ? (
                          <span className="truncate">
                            {selectedAgentName || `Agente #${editAgentId}`}
                          </span>
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
                            ) : (
                              "Nenhum agente encontrado"
                            )}
                          </CommandEmpty>
                          <CommandGroup>
                            {threecAgents.map((agent) => {
                              const isAssigned = assignedAgentIds.has(agent.id);
                              const isSelected = editAgentId === agent.id;
                              return (
                                <CommandItem
                                  key={agent.id}
                                  value={`${agent.name} ${agent.id}`}
                                  onSelect={() => {
                                    if (!isAssigned || isSelected) {
                                      setEditAgentId(isSelected ? null : agent.id);
                                      setAgentPopoverOpen(false);
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
                                        ID: {agent.id}
                                        {agent.extension ? ` · Ramal: ${agent.extension}` : ""}
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
                  {editAgentId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      onClick={() => setEditAgentId(null)}
                    >
                      <X className="w-3 h-3" /> Remover vínculo
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* WhatsApp Instances */}
            {whatsappInstances.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4" />
                  Instâncias WhatsApp
                </Label>
                <div className="space-y-2 rounded-md border p-3">
                  {whatsappInstances.map((inst) => (
                    <label key={inst.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={editInstanceIds.includes(inst.id)}
                        onCheckedChange={(checked) => {
                          setEditInstanceIds((prev) =>
                            checked
                              ? [...prev, inst.id]
                              : prev.filter((id) => id !== inst.id)
                          );
                        }}
                      />
                      <span className="text-sm">{inst.name || inst.instance_name}</span>
                      {inst.is_default && (
                        <Badge variant="outline" className="text-[10px]">Padrão</Badge>
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecione quais instâncias este operador terá acesso às conversas.
                </p>
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

      {/* Invite Link Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Convidar por Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
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
              <Label>Validade</Label>
              <Select value={inviteExpiry} onValueChange={setInviteExpiry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">24 horas</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {generatedLink ? (
              <div className="space-y-2">
                <Label>Link gerado</Label>
                <div className="flex gap-2">
                  <Input value={generatedLink} readOnly className="text-xs" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLink);
                      toast.success("Link copiado!");
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full"
                disabled={generatingInvite}
                onClick={async () => {
                  if (!tenant?.id || !profile?.user_id) return;
                  setGeneratingInvite(true);
                  try {
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + parseInt(inviteExpiry));

                    const { data, error } = await supabase
                      .from("invite_links")
                      .insert({
                        tenant_id: tenant.id,
                        role: inviteRole as any,
                        created_by: profile.user_id,
                        expires_at: expiresAt.toISOString(),
                      } as any)
                      .select("token")
                      .single();

                    if (error) throw error;
                    const link = `${window.location.origin}/auth?invite=${(data as any).token}`;
                    setGeneratedLink(link);
                    toast.success("Link de convite gerado!");
                  } catch {
                    toast.error("Erro ao gerar link");
                  } finally {
                    setGeneratingInvite(false);
                  }
                }}
              >
                {generatingInvite ? "Gerando..." : "Gerar Link"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Novo Usuário Dialog */}
      <Dialog open={newUserOpen} onOpenChange={(o) => { setNewUserOpen(o); if (!o) setNewUserLink(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Selecione o cargo e a validade do convite. Um link será gerado para o usuário se cadastrar.
            </p>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
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
              <Label>Validade do convite</Label>
              <Select value={newUserExpiry} onValueChange={setNewUserExpiry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">24 horas</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newUserLink ? (
              <div className="space-y-2">
                <Label>Link de acesso gerado</Label>
                <div className="flex gap-2">
                  <Input value={newUserLink} readOnly className="text-xs" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(newUserLink);
                      toast.success("Link copiado!");
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Compartilhe este link com o novo usuário para que ele possa criar sua conta.</p>
              </div>
            ) : (
              <Button
                className="w-full"
                disabled={generatingNewUser}
                onClick={async () => {
                  if (!tenant?.id || !profile?.user_id) return;
                  setGeneratingNewUser(true);
                  try {
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + parseInt(newUserExpiry));

                    const { data, error } = await supabase
                      .from("invite_links")
                      .insert({
                        tenant_id: tenant.id,
                        role: newUserRole as any,
                        created_by: profile.user_id,
                        expires_at: expiresAt.toISOString(),
                      } as any)
                      .select("token")
                      .single();

                    if (error) throw error;
                    const link = `${window.location.origin}/auth?invite=${(data as any).token}`;
                    setNewUserLink(link);
                    toast.success("Link gerado! Compartilhe com o novo usuário.");
                  } catch {
                    toast.error("Erro ao gerar link");
                  } finally {
                    setGeneratingNewUser(false);
                  }
                }}
              >
                {generatingNewUser ? "Gerando..." : "Gerar Link de Acesso"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;