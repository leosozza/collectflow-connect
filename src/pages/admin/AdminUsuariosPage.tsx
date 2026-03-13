import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Search, Loader2, Eye, EyeOff, KeyRound, Users } from "lucide-react";

interface PlatformUser {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  email?: string;
  tenant_name?: string;
  tenant_role?: string;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-destructive/10 text-destructive border-destructive/20",
  admin: "bg-primary/10 text-primary border-primary/20",
  operador: "bg-muted text-muted-foreground border-border",
  supervisor: "bg-accent/50 text-accent-foreground border-accent",
  gerente: "bg-secondary text-secondary-foreground border-secondary",
};

const AdminUsuariosPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // New user dialog
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newRole, setNewRole] = useState("operador");
  const [selectedTenantId, setSelectedTenantId] = useState("none");
  const [creating, setCreating] = useState(false);

  // Change password dialog
  const [pwUser, setPwUser] = useState<PlatformUser | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  // Fetch all profiles with tenant info
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["sa-all-users"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: emails }, { data: tenantUsers }] = await Promise.all([
        supabase.from("profiles").select("id, user_id, full_name, role, created_at").order("created_at", { ascending: false }),
        supabase.rpc("get_user_emails"),
        supabase.from("tenant_users").select("user_id, role, tenant_id, tenants(name)"),
      ]);
      if (error) throw error;

      const emailMap = new Map((emails || []).map((e: any) => [e.user_id, e.email]));
      const tuMap = new Map((tenantUsers || []).map((tu: any) => [
        tu.user_id,
        { role: tu.role, tenant_name: (tu.tenants as any)?.name || "—", tenant_id: tu.tenant_id },
      ]));

      return (profiles || []).map((p: any) => {
        const tu = tuMap.get(p.user_id);
        return {
          ...p,
          email: emailMap.get(p.user_id) || "—",
          tenant_name: tu?.tenant_name || "—",
          tenant_role: tu?.role || "—",
        } as PlatformUser;
      });
    },
  });

  // Fetch tenants for select
  const { data: tenants = [] } = useQuery({
    queryKey: ["sa-tenants-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.tenant_name?.toLowerCase().includes(q)
    );
  });

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast.error("Preencha nome, email e senha");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    setCreating(true);
    try {
      const body: any = {
        full_name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
      };
      if (selectedTenantId !== "none") {
        body.tenant_id = selectedTenantId;
      }
      const { data, error } = await supabase.functions.invoke("create-user", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Usuário ${newName} criado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["sa-all-users"] });
      setNewOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("operador");
      setSelectedTenantId("none");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    } finally {
      setCreating(false);
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
      toast.success(`Senha de ${pwUser.full_name} alterada!`);
      setPwUser(null);
      setNewPw("");
      setConfirmPw("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao trocar senha");
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Gestão de Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie todos os usuários da plataforma
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Novo Usuário
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              {filtered.length} usuário(s)
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-sm">{user.tenant_name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={ROLE_COLORS[user.tenant_role || ""] || ROLE_COLORS.operador}
                      >
                        {user.tenant_role || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Alterar senha"
                        onClick={() => {
                          setPwUser(user);
                          setNewPw("");
                          setConfirmPw("");
                        }}
                      >
                        <KeyRound className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New User Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Novo Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome completo *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <Label>Senha *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Função</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operador">Operador</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empresa (Tenant)</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {tenants.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={!!pwUser} onOpenChange={(open) => !open && setPwUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Alterar Senha — {pwUser?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <Label>Confirmar senha</Label>
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Repita a senha"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwUser(null)}>Cancelar</Button>
            <Button onClick={handleChangePassword} disabled={changingPw}>
              {changingPw ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsuariosPage;
