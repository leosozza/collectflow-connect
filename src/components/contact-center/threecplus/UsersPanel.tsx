import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Plus, RefreshCw, Edit, UserX, Users2 } from "lucide-react";
import { toast } from "sonner";

const UsersPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "agent" });
  const [saving, setSaving] = useState(false);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const fetchUsers = useCallback(async () => {
    if (!domain || !apiToken) return;
    setLoading(true);
    try {
      const data = await invoke("list_users");
      if (data?.status === 404) { setUsers([]); return; }
      setUsers(Array.isArray(data) ? data : data?.data || []);
    } catch {
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, [invoke, domain, apiToken]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      if (editing) {
        await invoke("update_user", {
          user_id: editing.id,
          user_data: { name: formData.name.trim(), role: formData.role },
        });
        toast.success("Usuário atualizado");
      } else {
        if (!formData.email.trim() || !formData.password.trim()) {
          toast.error("E-mail e senha são obrigatórios para criar usuário");
          setSaving(false);
          return;
        }
        await invoke("create_user", {
          user_data: {
            name: formData.name.trim(),
            email: formData.email.trim(),
            password: formData.password,
            role: formData.role,
          },
        });
        toast.success("Usuário criado");
      }
      setDialogOpen(false);
      setEditing(null);
      setFormData({ name: "", email: "", password: "", role: "agent" });
      fetchUsers();
    } catch {
      toast.error("Erro ao salvar usuário");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (userId: number) => {
    try {
      await invoke("deactivate_user", { user_id: userId });
      toast.success("Usuário desativado");
      fetchUsers();
    } catch {
      toast.error("Erro ao desativar usuário");
    }
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = { admin: "Admin", supervisor: "Supervisor", agent: "Agente" };
    return map[role] || role;
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users2 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Gestão de Usuários 3CPlus</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
          <Button size="sm" onClick={() => {
            setEditing(null);
            setFormData({ name: "", email: "", password: "", role: "agent" });
            setDialogOpen(true);
          }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Usuário
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && users.length === 0 ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Nenhum usuário encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm text-muted-foreground">{u.id}</TableCell>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-sm">{u.email || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {typeof u.role === "object" && u.role !== null
                          ? (u.role.readable_name || u.role.name || "—")
                          : roleLabel(u.role || u.type || "")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.active === false || u.status === "inactive" ? "destructive" : "default"}>
                        {u.active === false || u.status === "inactive" ? "Inativo" : "Ativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => {
                        setEditing(u);
                        setFormData({ name: u.name, email: u.email || "", password: "", role: u.role || "agent" });
                        setDialogOpen(true);
                      }}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeactivate(u.id)}
                        title="Desativar">
                        <UserX className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
            </div>
            {!editing && (
              <>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <Label>Senha</Label>
                  <Input type="password" value={formData.password} onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))} />
                </div>
              </>
            )}
            <div>
              <Label>Perfil</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Agente</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPanel;
